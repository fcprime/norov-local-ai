const SUPABASE_URL = String(process.env.SUPABASE_URL || '').replace(/\/$/, '')
const SUPABASE_ANON_KEY = String(process.env.SUPABASE_ANON_KEY || '')
const SUPABASE_SERVICE_ROLE_KEY = String(process.env.SUPABASE_SERVICE_ROLE_KEY || '')

export function isSupabaseServerConfigured() {
  return Boolean(SUPABASE_URL && SUPABASE_ANON_KEY && SUPABASE_SERVICE_ROLE_KEY)
}

function authHeader(request) {
  return request.headers.get('authorization') || request.headers.get('Authorization') || ''
}

export async function requireUser(request) {
  if (!isSupabaseServerConfigured()) throw Object.assign(new Error('Supabase server variables are not configured.'), { status: 503 })
  const authorization = authHeader(request)
  if (!authorization.startsWith('Bearer ')) throw Object.assign(new Error('Потрібна авторизація.'), { status: 401 })
  const response = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
    headers: { apikey: SUPABASE_ANON_KEY, Authorization: authorization },
  })
  if (!response.ok) throw Object.assign(new Error('Сесія недійсна або завершилася.'), { status: 401 })
  return response.json()
}

export async function db(path, options = {}) {
  if (!isSupabaseServerConfigured()) throw Object.assign(new Error('Supabase server variables are not configured.'), { status: 503 })
  const response = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    ...options,
    headers: {
      apikey: SUPABASE_SERVICE_ROLE_KEY,
      Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
      'content-type': 'application/json',
      ...(options.headers || {}),
    },
  })
  const text = await response.text()
  if (!response.ok) throw new Error(`Supabase ${response.status}: ${text.slice(0, 400)}`)
  return text ? JSON.parse(text) : null
}

export async function getProfile(userId) {
  const rows = await db(`profiles?id=eq.${encodeURIComponent(userId)}&select=*`)
  return rows?.[0] || null
}

export function monthStartIso() {
  const now = new Date()
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)).toISOString()
}

export async function getMonthlyLogs(userId = null) {
  const filters = [`created_at=gte.${encodeURIComponent(monthStartIso())}`]
  if (userId) filters.push(`user_id=eq.${encodeURIComponent(userId)}`)
  return (await db(`search_logs?${filters.join('&')}&select=user_id,provider,google_request_count,created_at`)) || []
}

export async function insertSearchLog(row) {
  return db('search_logs', {
    method: 'POST',
    headers: { Prefer: 'return=minimal' },
    body: JSON.stringify(row),
  })
}

export function json(data, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { 'content-type': 'application/json' } })
}
