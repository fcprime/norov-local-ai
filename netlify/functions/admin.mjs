import { db, getMonthlyLogs, getProfile, json, requireUser } from './_supabase.mjs'

const WARNING = Math.max(1, Number(process.env.GOOGLE_MONTHLY_WARNING_LIMIT || 4000))
const HARD_LIMIT = Math.max(WARNING, Number(process.env.GOOGLE_MONTHLY_HARD_LIMIT || 4500))

export default async (request) => {
  if (request.method !== 'POST') return json({ error: 'Method not allowed' }, 405)
  try {
    const user = await requireUser(request)
    const me = await getProfile(user.id)
    if (!me || me.role !== 'admin') return json({ error: 'Доступ лише для адміністратора.' }, 403)
    const body = await request.json().catch(() => ({}))

    if (body.action === 'update_user') {
      const allowed = ['status', 'role', 'monthly_search_limit', 'access_expires_at']
      const patch = Object.fromEntries(Object.entries(body.patch || {}).filter(([key]) => allowed.includes(key)))
      if (!body.userId || Object.keys(patch).length === 0) return json({ error: 'Немає даних для оновлення.' }, 400)
      await db(`profiles?id=eq.${encodeURIComponent(body.userId)}`, {
        method: 'PATCH', headers: { Prefer: 'return=minimal' }, body: JSON.stringify(patch),
      })
      return json({ ok: true })
    }

    const profiles = (await db('profiles?select=*&order=created_at.desc')) || []
    const logs = await getMonthlyLogs()
    const byUser = new Map()
    let googleRequests = 0
    for (const log of logs) {
      googleRequests += Number(log.google_request_count || 0)
      const current = byUser.get(log.user_id) || { searches: 0, google: 0, last: null }
      current.searches += 1
      current.google += Number(log.google_request_count || 0)
      if (!current.last || log.created_at > current.last) current.last = log.created_at
      byUser.set(log.user_id, current)
    }
    const users = profiles.map((profile) => {
      const usage = byUser.get(profile.id) || { searches: 0, google: 0, last: null }
      return { ...profile, searches_this_month: usage.searches, google_requests_this_month: usage.google, last_search_at: usage.last }
    })
    return json({
      users,
      stats: { googleRequests, googleSoftWarning: WARNING, googleHardLimit: HARD_LIMIT, fallbackActive: googleRequests >= HARD_LIMIT, searches: logs.length, users: profiles.length },
    })
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : 'Admin error' }, error?.status || 500)
  }
}
