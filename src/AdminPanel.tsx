import { useEffect, useState } from 'react'
import { supabase, type AccessStatus, type Profile } from './supabase'

type AdminUser = Profile & { searches_this_month: number; google_requests_this_month: number; last_search_at: string | null }
type GlobalStats = { googleRequests: number; googleSoftWarning: number; googleHardLimit: number; fallbackActive: boolean; searches: number; users: number }

async function callAdmin(body: Record<string, unknown>) {
  const { data } = await supabase.auth.getSession()
  const response = await fetch('/api/admin', {
    method: 'POST',
    headers: { 'content-type': 'application/json', Authorization: `Bearer ${data.session?.access_token || ''}` },
    body: JSON.stringify(body),
  })
  const payload = await response.json().catch(() => ({}))
  if (!response.ok) throw new Error(payload.error || 'Помилка адмінки')
  return payload
}

export default function AdminPanel() {
  const [users, setUsers] = useState<AdminUser[]>([])
  const [stats, setStats] = useState<GlobalStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  async function load() {
    setLoading(true); setError('')
    try {
      const data = await callAdmin({ action: 'dashboard' })
      setUsers(data.users || []); setStats(data.stats || null)
    } catch (e) { setError(e instanceof Error ? e.message : 'Помилка') }
    finally { setLoading(false) }
  }

  useEffect(() => { load() }, [])

  async function updateUser(user: AdminUser, patch: Record<string, unknown>) {
    try {
      await callAdmin({ action: 'update_user', userId: user.id, patch })
      await load()
    } catch (e) { setError(e instanceof Error ? e.message : 'Помилка') }
  }

  return (
    <div className="admin-page">
      <div className="admin-heading"><div><p className="eyebrow">Керування SaaS</p><h2>Адмін-панель</h2></div><button className="secondary" onClick={load}>Оновити</button></div>
      {error && <div className="api-warning">{error}</div>}
      {stats && <section className="admin-metrics">
        <div><span>Google API</span><strong>{stats.googleRequests} / {stats.googleHardLimit}</strong><small>{stats.fallbackActive ? 'Geoapify fallback активний' : stats.googleRequests >= stats.googleSoftWarning ? 'Ліміт майже вичерпано' : 'Працює нормально'}</small></div>
        <div><span>Пошуків цього місяця</span><strong>{stats.searches}</strong><small>усі користувачі</small></div>
        <div><span>Користувачів</span><strong>{stats.users}</strong><small>зареєстровані акаунти</small></div>
      </section>}
      {loading ? <div className="search-progress"><div className="spinner"/><div><strong>Завантажуємо статистику</strong></div></div> : (
        <div className="admin-table-wrap"><table className="admin-table"><thead><tr><th>Користувач</th><th>Статус</th><th>Роль</th><th>Ліміт/міс.</th><th>Пошуки</th><th>Google</th><th>Останній пошук</th></tr></thead><tbody>
          {users.map((user) => <tr key={user.id}><td><strong>{user.full_name || 'Без імені'}</strong><small>{user.email}</small></td><td><select value={user.status} onChange={(e) => updateUser(user, { status: e.target.value as AccessStatus })}><option value="pending">pending</option><option value="active">active</option><option value="blocked">blocked</option><option value="expired">expired</option></select></td><td><select value={user.role} onChange={(e) => updateUser(user, { role: e.target.value })}><option value="user">user</option><option value="admin">admin</option></select></td><td><input type="number" min="0" value={user.monthly_search_limit} onChange={(e) => updateUser(user, { monthly_search_limit: Number(e.target.value) })}/></td><td>{user.searches_this_month}</td><td>{user.google_requests_this_month}</td><td>{user.last_search_at ? new Date(user.last_search_at).toLocaleString() : '—'}</td></tr>)}
        </tbody></table></div>
      )}
    </div>
  )
}
