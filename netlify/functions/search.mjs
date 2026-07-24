import { getMonthlyLogs, getProfile, insertSearchLog, json, requireUser } from './_supabase.mjs'
import https from 'node:https'

const GOOGLE_PLACES_API_KEY = String(process.env.GOOGLE_PLACES_API_KEY || '').trim()
const GEOAPIFY_API_KEY = String(process.env.GEOAPIFY_API_KEY || '').trim()
const GOOGLE_PLACES_BASE = 'https://places.googleapis.com'
const GEOAPIFY_BASE = 'https://api.geoapify.com'

const countryCodes = {
  Austria: 'at', Belgium: 'be', Bulgaria: 'bg', Croatia: 'hr', Cyprus: 'cy', Czechia: 'cz',
  Denmark: 'dk', Estonia: 'ee', Finland: 'fi', France: 'fr', Germany: 'de', Greece: 'gr',
  Hungary: 'hu', Ireland: 'ie', Italy: 'it', Latvia: 'lv', Lithuania: 'lt', Luxembourg: 'lu',
  Malta: 'mt', Netherlands: 'nl', Poland: 'pl', Portugal: 'pt', Romania: 'ro', Slovakia: 'sk',
  Slovenia: 'si', Spain: 'es', Sweden: 'se', 'United Kingdom': 'gb', Norway: 'no',
  Switzerland: 'ch', Iceland: 'is', 'United States': 'us', Canada: 'ca', Australia: 'au',
  'New Zealand': 'nz', Ukraine: 'ua',
}

const languageCodes = {
  Austria: 'de', Belgium: 'nl', Bulgaria: 'bg', Croatia: 'hr', Cyprus: 'el', Czechia: 'cs',
  Denmark: 'da', Estonia: 'et', Finland: 'fi', France: 'fr', Germany: 'de', Greece: 'el',
  Hungary: 'hu', Ireland: 'en', Italy: 'it', Latvia: 'lv', Lithuania: 'lt', Luxembourg: 'fr',
  Malta: 'mt', Netherlands: 'nl', Poland: 'pl', Portugal: 'pt', Romania: 'ro', Slovakia: 'sk',
  Slovenia: 'sl', Spain: 'es', Sweden: 'sv', 'United Kingdom': 'en', Norway: 'no',
  Switzerland: 'de', Iceland: 'is', 'United States': 'en', Canada: 'en', Australia: 'en',
  'New Zealand': 'en', Ukraine: 'uk',
}

const languages = {
  Austria: 'Deutsch', Belgium: 'Nederlands / Français', Bulgaria: 'Български', Croatia: 'Hrvatski',
  Cyprus: 'Ελληνικά / English', Czechia: 'Čeština', Denmark: 'Dansk', Estonia: 'Eesti',
  Finland: 'Suomi / Svenska', France: 'Français', Germany: 'Deutsch', Greece: 'Ελληνικά',
  Hungary: 'Magyar', Ireland: 'English', Italy: 'Italiano', Latvia: 'Latviešu', Lithuania: 'Lietuvių',
  Luxembourg: 'Français / Deutsch', Malta: 'Malti / English', Netherlands: 'Nederlands', Poland: 'Polski',
  Portugal: 'Português', Romania: 'Română', Slovakia: 'Slovenčina', Slovenia: 'Slovenščina', Spain: 'Español',
  Sweden: 'Svenska', 'United Kingdom': 'English', Norway: 'Norsk',
  Switzerland: 'Deutsch / Français / Italiano', Iceland: 'Íslenska', 'United States': 'English (US)',
  Canada: 'English (Canada)', Australia: 'English', 'New Zealand': 'English', Ukraine: 'Українська',
}

const targetRules = [
  { words: ['готел', 'hotel', 'hostel'], label: 'Готель або хостел', googleQuery: 'hotels and hostels', categories: ['accommodation'] },
  { words: ['офіс', 'office', 'cowork', 'коворкінг'], label: 'Офіс або коворкінг', googleQuery: 'offices and coworking spaces', categories: ['office', 'building.office'] },
  { words: ['ресторан', 'restaurant', 'кафе', 'cafe'], label: 'Ресторан або кафе', googleQuery: 'restaurants and cafes', categories: ['catering'] },
  { words: ['клінік', 'clinic', 'стомат', 'dent'], label: 'Клініка або стоматологія', googleQuery: 'clinics and dental clinics', categories: ['healthcare'] },
  { words: ['салон краси', 'beauty', 'перукар', 'hairdresser'], label: 'Салон краси або перукарня', googleQuery: 'beauty salons and hairdressers', categories: ['commercial.health_and_beauty'] },
  { words: ['дитяч', 'kindergarten', 'childcare'], label: 'Дитячий центр', googleQuery: 'childcare centers and kindergartens', categories: ['childcare', 'building.kindergarten', 'leisure.playground'] },
  { words: ['автосалон', 'автосервіс', 'car dealer', 'dealership', 'car service'], label: 'Автобізнес', googleQuery: 'car dealerships and car services', categories: ['commercial.vehicle', 'service.vehicle'] },
  { words: ['спортзал', 'gym', 'fitness'], label: 'Спортзал або фітнес-клуб', googleQuery: 'gyms and fitness clubs', categories: ['sport'] },
  { words: ['школ', 'навчаль', 'school', 'education'], label: 'Навчальний заклад', googleQuery: 'schools and education centers', categories: ['education', 'building.college'] },
  { words: ['меблів', 'інтер’єр', 'furniture', 'interior'], label: 'Магазин меблів або інтер’єру', googleQuery: 'furniture and interior stores', categories: ['commercial.houseware_and_hardware'] },
  { words: ['торгов', 'магазин', 'shopping', 'retail'], label: 'Торговий об’єкт', googleQuery: 'shopping centers and retail stores', categories: ['commercial'] },
  { words: ['івент', 'event', 'розваж', 'entertainment'], label: 'Івент або розважальний заклад', googleQuery: 'event venues and entertainment venues', categories: ['entertainment', 'building.entertainment'] },
  { words: ['завод', 'склад', 'виробниц', 'factory', 'warehouse', 'industrial'], label: 'Виробничий або складський об’єкт', googleQuery: 'factories warehouses and manufacturers', categories: ['building.industrial'] },
  { words: ['апартамент', 'розміщення', 'apartment', 'accommodation'], label: 'Об’єкт розміщення', googleQuery: 'apartments and accommodation', categories: ['accommodation', 'building.accommodation'] },
  { words: ['турист', 'tourism'], label: 'Туристичний об’єкт', googleQuery: 'tourist attractions', categories: ['tourism'] },
]

const cache = new Map()
const CACHE_TTL = 15 * 60 * 1000

function normalize(value = '') {
  return String(value).normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().toLowerCase()
}

function resolveTarget(targetBusiness) {
  const normalized = normalize(targetBusiness)
  return targetRules.find((rule) => rule.words.some((word) => normalized.includes(normalize(word)))) || {
    label: targetBusiness || 'Локальний бізнес', googleQuery: targetBusiness || 'local businesses', categories: ['commercial'],
  }
}

function requestJsonGet(url, timeoutMs = 45000) {
  return new Promise((resolve, reject) => {
    const request = https.get(url, { headers: { Accept: 'application/json', 'User-Agent': 'NorovLocalAI/3.0' }, family: 4 }, (response) => {
      let body = ''
      response.setEncoding('utf8')
      response.on('data', (chunk) => { body += chunk })
      response.on('end', () => {
        const status = response.statusCode || 500
        if (status < 200 || status >= 300) return reject(new Error(`HTTP ${status}${body ? ` — ${body.slice(0, 400).replace(/\s+/g, ' ')}` : ''}`))
        try { resolve(JSON.parse(body)) } catch { reject(new Error('Сервіс повернув некоректну JSON-відповідь.')) }
      })
    })
    request.setTimeout(timeoutMs, () => request.destroy(new Error(`Сервіс не відповів за ${Math.round(timeoutMs / 1000)} секунд.`)))
    request.on('error', reject)
  })
}

function requestJsonPost(url, payload, headers = {}, timeoutMs = 45000) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify(payload)
    const parsedUrl = new URL(url)
    const request = https.request({
      hostname: parsedUrl.hostname, path: `${parsedUrl.pathname}${parsedUrl.search}`, method: 'POST', family: 4,
      headers: { Accept: 'application/json', 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body), 'User-Agent': 'NorovLocalAI/3.0', ...headers },
    }, (response) => {
      let responseBody = ''
      response.setEncoding('utf8')
      response.on('data', (chunk) => { responseBody += chunk })
      response.on('end', () => {
        const status = response.statusCode || 500
        if (status < 200 || status >= 300) return reject(new Error(`Google Places HTTP ${status}${responseBody ? ` — ${responseBody.slice(0, 500).replace(/\s+/g, ' ')}` : ''}`))
        try { resolve(JSON.parse(responseBody)) } catch { reject(new Error('Google Places повернув некоректну JSON-відповідь.')) }
      })
    })
    request.setTimeout(timeoutMs, () => request.destroy(new Error(`Google Places не відповів за ${Math.round(timeoutMs / 1000)} секунд.`)))
    request.on('error', reject)
    request.write(body)
    request.end()
  })
}

async function geocodeCity(city, country) {
  if (!GEOAPIFY_API_KEY) return null
  const params = new URLSearchParams({ text: `${city}, ${country}`, format: 'json', limit: '1', apiKey: GEOAPIFY_API_KEY })
  if (countryCodes[country]) params.set('filter', `countrycode:${countryCodes[country]}`)
  const data = await requestJsonGet(`${GEOAPIFY_BASE}/v1/geocode/search?${params}`)
  const item = data?.results?.[0]
  if (!item) throw new Error('Не вдалося знайти це місто. Перевірте написання.')
  return { lat: Number(item.lat), lon: Number(item.lon), displayName: item.formatted || `${city}, ${country}` }
}

function mapGooglePlace(place, context) {
  const name = String(place?.displayName?.text || '').trim() || 'Компанія без назви'
  const website = String(place?.websiteUri || '').trim()
  const phone = String(place?.internationalPhoneNumber || place?.nationalPhoneNumber || '').trim()
  const googleMapsUrl = String(place?.googleMapsUri || '').trim()
  const contacts = [website && 'сайт', phone && 'телефон'].filter(Boolean)
  const primaryType = String(place?.primaryTypeDisplayName?.text || '').trim() || String(place?.primaryType || '').replaceAll('_', ' ') || context.targetLabel
  return {
    id: `google-${place?.id || crypto.randomUUID()}`, name, category: primaryType, country: context.country, city: context.city,
    address: String(place?.formattedAddress || '').trim() || context.city, website, email: '', phone, facebook: '', instagram: '', googleMapsUrl,
    rating: Number(place?.rating || 0), reviews: Number(place?.userRatingCount || 0), language: languages[context.country] || 'English',
    localizedService: context.service, localizedTargetBusiness: context.targetBusiness,
    reason: `${name} — це ${context.targetLabel.toLowerCase()} у вибраному місті або радіусі. ${contacts.length ? `Є відкриті контакти: ${contacts.join(', ')}.` : 'Контакти можна уточнити через сайт, Google Maps або інші відкриті джерела.'}`,
    painPoints: [`Може регулярно потребувати послугу: ${context.service}`, 'Важливі зручний графік робіт і мінімальне втручання в роботу бізнесу'],
    offer: `Запропонувати коротку безкоштовну оцінку потреби в послузі «${context.service}» та тестовий обсяг робіт.`,
    status: 'New', notes: '', source: 'Google', placeId: String(place?.id || ''),
  }
}

async function searchGooglePlaces({ lat, lon, radius, service, targetBusiness, country, city }) {
  if (!GOOGLE_PLACES_API_KEY) throw new Error('Не задано GOOGLE_PLACES_API_KEY у змінних середовища.')
  const rule = resolveTarget(targetBusiness)
  const requestBody = {
    textQuery: `${rule.googleQuery} in ${city}, ${country}`,
    pageSize: 20,
    languageCode: languageCodes[country] || 'en',
    regionCode: String(countryCodes[country] || '').toUpperCase(),
  }
  if (Number.isFinite(lat) && Number.isFinite(lon) && Number.isFinite(radius)) {
    requestBody.locationBias = { circle: { center: { latitude: lat, longitude: lon }, radius: Math.min(radius, 50000) } }
  }
  const fieldMask = [
    'places.id', 'places.displayName', 'places.formattedAddress', 'places.location', 'places.primaryType',
    'places.primaryTypeDisplayName', 'places.websiteUri', 'places.nationalPhoneNumber', 'places.internationalPhoneNumber',
    'places.rating', 'places.userRatingCount', 'places.businessStatus', 'places.googleMapsUri',
  ].join(',')
  const data = await requestJsonPost(`${GOOGLE_PLACES_BASE}/v1/places:searchText`, requestBody, {
    'X-Goog-Api-Key': GOOGLE_PLACES_API_KEY, 'X-Goog-FieldMask': fieldMask,
  })
  return (data?.places || [])
    .filter((place) => place?.businessStatus !== 'CLOSED_PERMANENTLY')
    .map((place) => mapGooglePlace(place, { service, targetBusiness, targetLabel: rule.label, country, city }))
    .sort((a, b) => [b.website, b.phone].filter(Boolean).length - [a.website, a.phone].filter(Boolean).length || b.reviews - a.reviews || a.name.localeCompare(b.name))
}

function pick(obj, paths) {
  for (const path of paths) {
    const value = path.split('.').reduce((acc, key) => acc?.[key], obj)
    if (value !== undefined && value !== null && String(value).trim() !== '') return value
  }
  return ''
}

function mapGeoapifyFeature(feature, context) {
  const p = feature?.properties || {}
  const name = p.name || p.address_line1 || 'Компанія без назви'
  const website = String(pick(p, ['website', 'contact.website', 'datasource.raw.website']))
  const phone = String(pick(p, ['contact.phone', 'phone', 'datasource.raw.phone', 'datasource.raw.contact:phone']))
  const email = String(pick(p, ['contact.email', 'email', 'datasource.raw.email', 'datasource.raw.contact:email']))
  const facebook = String(pick(p, ['contact.facebook', 'datasource.raw.contact:facebook', 'datasource.raw.facebook']))
  const instagram = String(pick(p, ['contact.instagram', 'datasource.raw.contact:instagram', 'datasource.raw.instagram']))
  const contacts = [website && 'сайт', phone && 'телефон', email && 'email'].filter(Boolean)
  const categories = Array.isArray(p.categories) ? p.categories : []
  const category = categories[0]?.split('.').pop()?.replaceAll('_', ' ') || context.category
  return {
    id: `geoapify-${p.place_id || crypto.randomUUID()}`, name, category: category.replace(/\b\w/g, (char) => char.toUpperCase()), country: context.country,
    city: p.city || p.town || p.village || context.city, address: p.formatted || [p.address_line1, p.address_line2].filter(Boolean).join(', ') || context.city,
    website, email, phone, facebook, instagram, googleMapsUrl: '', rating: 0, reviews: 0, language: languages[context.country] || 'English',
    localizedService: context.service, localizedTargetBusiness: context.targetBusiness,
    reason: `${name} — це ${context.targetLabel.toLowerCase()} у вибраному радіусі. ${contacts.length ? `Є відкриті контакти: ${contacts.join(', ')}.` : 'Контакти можна уточнити через сайт або інші відкриті джерела.'}`,
    painPoints: [`Може регулярно потребувати послугу: ${context.service}`, 'Важливі зручний графік робіт і мінімальне втручання в роботу бізнесу'],
    offer: `Запропонувати коротку безкоштовну оцінку потреби в послузі «${context.service}» та тестовий обсяг робіт.`,
    status: 'New', notes: '', source: 'Geoapify', placeId: p.place_id || '',
  }
}

async function searchGeoapifyPlaces({ lat, lon, radius, service, targetBusiness, country, city }) {
  if (!GEOAPIFY_API_KEY || !Number.isFinite(lat) || !Number.isFinite(lon)) return []
  const rule = resolveTarget(targetBusiness)
  const params = new URLSearchParams({ categories: rule.categories.join(','), filter: `circle:${lon},${lat},${Math.min(radius, 50000)}`, bias: `proximity:${lon},${lat}`, limit: '50', apiKey: GEOAPIFY_API_KEY })
  const data = await requestJsonGet(`${GEOAPIFY_BASE}/v2/places?${params}`)
  return (data?.features || []).map((feature) => mapGeoapifyFeature(feature, { category: rule.label, targetLabel: rule.label, service, targetBusiness, country, city }))
}

function canonicalWebsite(value = '') {
  return normalize(value).replace(/^https?:\/\//, '').replace(/^www\./, '').replace(/\/$/, '')
}

function mergeCompanies(primary, fallback) {
  const merged = [...primary]
  const phones = new Set(primary.map((c) => normalize(c.phone)).filter(Boolean))
  const websites = new Set(primary.map((c) => canonicalWebsite(c.website)).filter(Boolean))
  const names = new Set(primary.map((c) => normalize(c.name)))
  for (const company of fallback) {
    const phone = normalize(company.phone)
    const website = canonicalWebsite(company.website)
    const name = normalize(company.name)
    if ((phone && phones.has(phone)) || (website && websites.has(website)) || names.has(name)) continue
    merged.push(company)
    if (phone) phones.add(phone)
    if (website) websites.add(website)
    if (name) names.add(name)
  }
  return merged
}

export default async (request) => {
  if (request.method !== 'POST') return json({ error: 'Method not allowed' }, 405)
  try {
    const user = await requireUser(request)
    const profile = await getProfile(user.id)
    if (!profile) return json({ error: 'Профіль користувача не знайдено.' }, 403)
    if (profile.role !== 'admin' && profile.status !== 'active') return json({ error: 'Ваш акаунт ще не активований адміністратором.' }, 403)
    if (profile.access_expires_at && new Date(profile.access_expires_at) < new Date() && profile.role !== 'admin') {
      return json({ error: 'Термін доступу завершився.' }, 403)
    }

    const body = await request.json().catch(() => ({}))
    const service = String(body?.service || '').trim()
    const targetBusiness = String(body?.targetBusiness || '').trim()
    const country = String(body?.country || '').trim()
    const city = String(body?.city || '').trim()
    const radiusKm = Math.max(1, Math.min(Number(body?.radius || 25), 50))
    if (!service || !targetBusiness || !country || !city) return json({ error: 'Заповніть вашу послугу, кому продаємо, країну та місто.' }, 400)

    const userLogs = await getMonthlyLogs(user.id)
    const userLimit = Math.max(0, Number(profile.monthly_search_limit || 0))
    if (profile.role !== 'admin' && userLimit > 0 && userLogs.length >= userLimit) {
      return json({ error: `Ви використали місячний ліміт: ${userLimit} пошуків.` }, 429)
    }

    const cacheKey = normalize(`${service}|${targetBusiness}|${country}|${city}|${radiusKm}`)
    const cached = cache.get(cacheKey)
    if (cached && Date.now() - cached.createdAt < CACHE_TTL) {
      await insertSearchLog({
        user_id: user.id, provider: 'cache', google_request_count: 0, service, target_business: targetBusiness,
        country, city, radius_km: radiusKm, results_count: cached.payload.companies.length, cache_hit: true,
      })
      return json({ ...cached.payload, cached: true, usage: { searches: userLogs.length + 1, limit: userLimit } })
    }

    if (!GOOGLE_PLACES_API_KEY && !GEOAPIFY_API_KEY) return json({ error: 'Не задано GOOGLE_PLACES_API_KEY або GEOAPIFY_API_KEY у змінних середовища.' }, 503)

    const allLogs = await getMonthlyLogs()
    const googleUsed = allLogs.reduce((sum, log) => sum + Number(log.google_request_count || 0), 0)
    const warningLimit = Math.max(1, Number(process.env.GOOGLE_MONTHLY_WARNING_LIMIT || 4000))
    const hardLimit = Math.max(warningLimit, Number(process.env.GOOGLE_MONTHLY_HARD_LIMIT || 4500))
    const googleAllowed = Boolean(GOOGLE_PLACES_API_KEY) && googleUsed < hardLimit

    let location = null
    if (GEOAPIFY_API_KEY) {
      try { location = await geocodeCity(city, country) }
      catch (error) { console.warn('Geoapify geocoding failed:', error instanceof Error ? error.message : error) }
    }

    let googleCompanies = []
    let googleError = ''
    let googleRequestCount = 0
    if (googleAllowed) {
      googleRequestCount = 1
      try {
        googleCompanies = await searchGooglePlaces({ lat: location?.lat, lon: location?.lon, radius: radiusKm * 1000, service, targetBusiness, country, city })
      } catch (error) {
        googleError = error instanceof Error ? error.message : 'Помилка Google Places'
        console.error('Google Places failed:', googleError)
      }
    }

    let geoapifyCompanies = []
    if (GEOAPIFY_API_KEY && location) {
      try { geoapifyCompanies = await searchGeoapifyPlaces({ ...location, radius: radiusKm * 1000, service, targetBusiness, country, city }) }
      catch (error) { console.error('Geoapify fallback failed:', error instanceof Error ? error.message : error) }
    }

    const companies = mergeCompanies(googleCompanies, geoapifyCompanies).slice(0, 50)
    if (companies.length === 0 && googleError) throw new Error(googleError)
    const source = googleCompanies.length && geoapifyCompanies.length ? 'combined' : googleCompanies.length ? 'google' : 'geoapify'
    const fallbackActive = !googleAllowed
    const warning = companies.length === 0
      ? 'Не знайдено компаній у вибраному сегменті. Спробуйте іншу категорію, місто або радіус.'
      : fallbackActive
        ? 'Місячний резерв Google вичерпано. Пошук тимчасово виконується через Geoapify / OpenStreetMap.'
        : googleUsed + googleRequestCount >= warningLimit
          ? 'Google API наближається до внутрішнього місячного ліміту. Резервний пошук Geoapify буде активовано автоматично.'
          : googleError ? 'Google Places тимчасово не відповів. Показані резервні дані Geoapify.' : ''

    const payload = {
      companies, source, language: languages[country] || 'English', warning,
      location: location ? { ...location, radiusKm } : { lat: 0, lon: 0, displayName: `${city}, ${country}`, radiusKm },
      usage: { searches: userLogs.length + 1, limit: userLimit },
    }
    cache.set(cacheKey, { createdAt: Date.now(), payload })
    await insertSearchLog({
      user_id: user.id, provider: source, google_request_count: googleRequestCount, service, target_business: targetBusiness,
      country, city, radius_km: radiusKm, results_count: companies.length, cache_hit: false,
    })
    return json(payload)
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : 'Невідома помилка пошуку' }, error?.status || 502)
  }
}
