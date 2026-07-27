import dns from 'node:dns/promises'
import net from 'node:net'
import { getProfile, json, requireUser } from './_supabase.mjs'

const EMAIL_RE = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi
const SOCIAL_RE = /https?:\/\/(?:www\.)?(facebook\.com|instagram\.com)\/[^"' <>)]+/gi

function isPrivateIp(ip) {
  if (net.isIP(ip) === 4) {
    const [a, b] = ip.split('.').map(Number)
    return a === 10 || a === 127 || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168)
  }
  if (net.isIP(ip) === 6) {
    const value = ip.toLowerCase()
    return value === '::1' || value.startsWith('fc') || value.startsWith('fd') || value.startsWith('fe80:')
  }
  return false
}

async function safeUrl(value) {
  let url
  try {
    url = new URL(String(value || '').trim())
  } catch {
    throw Object.assign(new Error('Некоректна адреса сайту.'), { status: 400 })
  }
  if (!['http:', 'https:'].includes(url.protocol)) {
    throw Object.assign(new Error('Дозволені лише HTTP/HTTPS сайти.'), { status: 400 })
  }
  if (net.isIP(url.hostname) || url.hostname === 'localhost' || url.hostname.endsWith('.local')) {
    throw Object.assign(new Error('Цю адресу не можна перевірити.'), { status: 400 })
  }
  const addresses = await dns.lookup(url.hostname, { all: true })
  if (!addresses.length || addresses.some((item) => isPrivateIp(item.address))) {
    throw Object.assign(new Error('Цю адресу не можна перевірити.'), { status: 400 })
  }
  return url
}

function cleanEmail(value) {
  const email = String(value || '')
    .trim()
    .replace(/[),.;:]+$/g, '')
    .toLowerCase()

  if (!email || email.length > 254) return ''
  if (!EMAIL_RE.test(email)) return ''
  EMAIL_RE.lastIndex = 0
  if (/\.(png|jpg|jpeg|gif|webp|svg)$/i.test(email)) return ''
  if (isPlaceholderEmail(email)) return ''
  return email
}

const PLACEHOLDER_DOMAINS = new Set([
  'example.com',
  'example.org',
  'example.net',
  'test.com',
  'email.com',
  'domain.com',
  'yourdomain.com',
  'company.com',
  'sample.com',
])

function isPlaceholderEmail(email) {
  const [local = '', domain = ''] = String(email || '').toLowerCase().split('@')
  if (!local || !domain) return true
  if (PLACEHOLDER_DOMAINS.has(domain)) return true
  if (/^(example|test|name|email|yourname|user|username)$/i.test(local)) return true
  if (/^(info|contact|kontakt|hello|mail|office)@(example|test|domain)\./i.test(email)) return true
  return false
}

function registrableDomain(hostname) {
  const host = String(hostname || '').toLowerCase().replace(/^www\./, '')
  const parts = host.split('.').filter(Boolean)
  return parts.length <= 2 ? host : parts.slice(-2).join('.')
}

function emailScore(email, websiteDomain) {
  const [local = '', domain = ''] = email.split('@')
  let score = 100

  if (registrableDomain(domain) === registrableDomain(websiteDomain)) score -= 60
  if (/^(info|contact|kontakt|office|hello|sales|booking|reception|sekretariat|biuro|recepcja)$/i.test(local)) score -= 25
  if (/^(noreply|no-reply|donotreply|do-not-reply)$/i.test(local)) score += 100
  if (/gmail\.com$|outlook\.com$|hotmail\.com$|yahoo\.com$/i.test(domain)) score += 20

  return score
}

function extract(html, baseUrl) {
  const emails = new Set()
  for (const match of html.matchAll(/mailto:([^"'? <]+)/gi)) {
    const email = cleanEmail(decodeURIComponent(match[1]))
    if (email) emails.add(email)
  }
  for (const match of html.matchAll(EMAIL_RE)) {
    const email = cleanEmail(match[0])
    if (email) emails.add(email)
  }

  let facebook = ''
  let instagram = ''
  for (const match of html.matchAll(SOCIAL_RE)) {
    const link = match[0].replace(/&amp;/g, '&')
    if (!facebook && /facebook\.com/i.test(link)) facebook = link
    if (!instagram && /instagram\.com/i.test(link)) instagram = link
  }

  const internalLinks = []
  for (const match of html.matchAll(/href=["']([^"'#]+)["']/gi)) {
    try {
      const url = new URL(match[1], baseUrl)
      if (url.origin !== baseUrl.origin) continue
      if (/(contact|kontakt|about|o-nas|impressum|contatti|contacto|contacts)/i.test(url.pathname)) {
        internalLinks.push(url.href)
      }
    } catch {}
  }
  return { emails: [...emails], facebook, instagram, internalLinks: [...new Set(internalLinks)].slice(0, 3) }
}

async function fetchHtml(url) {
  const response = await fetch(url, {
    redirect: 'follow',
    headers: { 'user-agent': 'Mozilla/5.0 (compatible; NorovLocalAI/1.0; contact enrichment)' },
    signal: AbortSignal.timeout(9000),
  })
  if (!response.ok) return ''
  const type = response.headers.get('content-type') || ''
  if (!type.includes('text/html')) return ''
  return (await response.text()).slice(0, 1_000_000)
}

export default async function handler(request) {
  if (request.method !== 'POST') return json({ error: 'Method not allowed' }, 405)
  try {
    const user = await requireUser(request)
    const profile = await getProfile(user.id)
    if (!profile || (profile.role !== 'admin' && profile.status !== 'active')) {
      return json({ error: 'Ваш акаунт не має активного доступу.' }, 403)
    }
    if (profile.role !== 'admin' && profile.access_expires_at && new Date(profile.access_expires_at).getTime() < Date.now()) {
      return json({ error: 'Термін доступу завершився.' }, 403)
    }

    const body = await request.json().catch(() => ({}))
    const url = await safeUrl(body.website)
    const homepage = await fetchHtml(url.href)
    if (!homepage) return json({ email: '', facebook: '', instagram: '' })

    const first = extract(homepage, url)
    const emails = new Set(first.emails)
    let facebook = first.facebook
    let instagram = first.instagram

    for (const link of first.internalLinks) {
      const checked = await safeUrl(link)
      const html = await fetchHtml(checked.href)
      if (!html) continue
      const data = extract(html, checked)
      data.emails.forEach((email) => emails.add(email))
      facebook ||= data.facebook
      instagram ||= data.instagram
    }

    const websiteDomain = url.hostname
    const validEmails = [...emails].filter((email) => !isPlaceholderEmail(email))
    const preferred = validEmails
      .sort((a, b) => emailScore(a, websiteDomain) - emailScore(b, websiteDomain))[0] || ''

    return json({
      email: preferred,
      emails: validEmails,
      facebook,
      instagram,
    })
  } catch (error) {
    console.error('Contact enrichment error:', error)
    return json({ error: error?.message || 'Не вдалося перевірити сайт.' }, error?.status || 500)
  }
}
