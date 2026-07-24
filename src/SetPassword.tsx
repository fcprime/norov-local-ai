import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import type { Session } from '@supabase/supabase-js'
import { supabase } from './supabase'

export default function SetPassword() {
  const [session, setSession] = useState<Session | null>(null)
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [done, setDone] = useState(false)

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session)
      setLoading(false)
    })
    const { data } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession)
      setLoading(false)
    })
    return () => data.subscription.unsubscribe()
  }, [])

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError('')
    if (password.length < 8) return setError('Пароль має містити щонайменше 8 символів.')
    if (password !== confirmPassword) return setError('Паролі не збігаються.')
    setSaving(true)
    const { error: updateError } = await supabase.auth.updateUser({ password })
    setSaving(false)
    if (updateError) return setError(updateError.message)
    setDone(true)
  }

  if (loading) return <div className="auth-page"><div className="spinner" /></div>

  if (done) {
    return (
      <div className="auth-page"><section className="auth-card auth-card-wide">
        <div className="status-orb">✓</div>
        <h1>Пароль створено</h1>
        <p className="auth-copy">Ваш акаунт готовий. Тепер можна перейти до Norov Local AI.</p>
        <a className="primary-link" href="/">Увійти в сервіс</a>
      </section></div>
    )
  }

  return (
    <div className="auth-page"><section className="auth-card auth-card-wide">
      <div className="status-orb">N</div>
      <h1>Створіть пароль</h1>
      <p className="auth-copy">Використайте email, на який було оформлено покупку. Пароль має містити щонайменше 8 символів.</p>
      {!session ? (
        <div className="api-warning">Посилання недійсне або завершилося. Відкрийте актуальне посилання із листа Supabase або зверніться до підтримки.</div>
      ) : (
        <form className="auth-form" onSubmit={submit}>
          <label><span>Новий пароль</span><input type="password" value={password} onChange={(e) => setPassword(e.target.value)} minLength={8} required /></label>
          <label><span>Повторіть пароль</span><input type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} minLength={8} required /></label>
          <button className="primary auth-submit" disabled={saving}>{saving ? 'Зберігаємо…' : 'Створити пароль'}</button>
        </form>
      )}
      {error && <div className="api-warning">{error}</div>}
    </section></div>
  )
}
