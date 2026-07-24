import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import type { Session } from '@supabase/supabase-js'
import App from './App'
import { supabase, supabaseConfigured, type Profile } from './supabase'

type AuthMode = 'login' | 'register' | 'forgot' | 'recovery'

function LoginScreen({ initialMode = 'login', onRecoveryComplete }: { initialMode?: AuthMode; onRecoveryComplete?: () => void }) {
  const [mode, setMode] = useState<AuthMode>(initialMode)
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')

  function changeMode(nextMode: AuthMode) {
    setMode(nextMode)
    setError('')
    setMessage('')
    setPassword('')
    setConfirmPassword('')
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setLoading(true)
    setError('')
    setMessage('')

    try {
      if (mode === 'register') {
        if (!fullName.trim()) throw new Error('Вкажіть ваше ім’я.')
        if (password.length < 8) throw new Error('Пароль має містити щонайменше 8 символів.')
        if (password !== confirmPassword) throw new Error('Паролі не збігаються.')

        const { data, error: authError } = await supabase.auth.signUp({
          email: email.trim(),
          password,
          options: {
            emailRedirectTo: window.location.origin,
            data: { full_name: fullName.trim() },
          },
        })
        if (authError) throw authError

        if (data.session) {
          setMessage('Акаунт створено. Доступ очікує активації адміністратором.')
        } else {
          setMessage('Реєстрацію завершено. Перевірте пошту та підтвердьте email, після чого увійдіть.')
          setMode('login')
        }
      } else if (mode === 'forgot') {
        const { error: authError } = await supabase.auth.resetPasswordForEmail(email.trim(), {
          redirectTo: window.location.origin,
        })
        if (authError) throw authError
        setMessage('Посилання для зміни пароля надіслано на вашу пошту.')
      } else if (mode === 'recovery') {
        if (password.length < 8) throw new Error('Пароль має містити щонайменше 8 символів.')
        if (password !== confirmPassword) throw new Error('Паролі не збігаються.')
        const { error: authError } = await supabase.auth.updateUser({ password })
        if (authError) throw authError
        await supabase.auth.signOut()
        setMessage('Пароль успішно змінено. Увійдіть із новим паролем.')
        setMode('login')
        onRecoveryComplete?.()
      } else {
        const { error: authError } = await supabase.auth.signInWithPassword({
          email: email.trim(),
          password,
        })
        if (authError) throw authError
      }
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : 'Не вдалося виконати дію.')
    } finally {
      setLoading(false)
    }
  }

  const title = mode === 'register'
    ? 'Створіть акаунт'
    : mode === 'forgot'
      ? 'Відновлення пароля'
      : mode === 'recovery'
        ? 'Створіть новий пароль'
        : 'Увійдіть у Norov Local AI'

  const copy = mode === 'register'
    ? 'Зареєструйтеся через будь-яку email-адресу. Нові акаунти активуються адміністратором.'
    : mode === 'forgot'
      ? 'Вкажіть email, який використовували під час реєстрації.'
      : mode === 'recovery'
        ? 'Введіть новий пароль для вашого акаунта.'
        : 'Використовуйте email і пароль, створені під час реєстрації.'

  return (
    <div className="auth-page">
      <section className="auth-card auth-card-wide">
        <div className="brand auth-brand">
          <div className="brand-mark">N</div>
          <div><strong>Norov Local AI</strong><span>Local B2B Sales OS</span></div>
        </div>
        <p className="eyebrow">Закритий доступ</p>
        <h1>{title}</h1>
        <p className="auth-copy">{copy}</p>

        {(mode === 'login' || mode === 'register') && (
          <div className="auth-tabs" role="tablist" aria-label="Авторизація">
            <button type="button" className={mode === 'login' ? 'active' : ''} onClick={() => changeMode('login')}>Вхід</button>
            <button type="button" className={mode === 'register' ? 'active' : ''} onClick={() => changeMode('register')}>Реєстрація</button>
          </div>
        )}

        <form className="auth-form" onSubmit={handleSubmit}>
          {mode === 'register' && (
            <label>
              <span>Ім’я</span>
              <input value={fullName} onChange={(event) => setFullName(event.target.value)} autoComplete="name" required />
            </label>
          )}

          {mode !== 'recovery' && (
            <label>
              <span>Email</span>
              <input type="email" value={email} onChange={(event) => setEmail(event.target.value)} autoComplete="email" required />
            </label>
          )}

          {(mode === 'login' || mode === 'register' || mode === 'recovery') && (
            <label>
              <span>{mode === 'recovery' ? 'Новий пароль' : 'Пароль'}</span>
              <input type="password" value={password} onChange={(event) => setPassword(event.target.value)} autoComplete={mode === 'login' ? 'current-password' : 'new-password'} minLength={8} required />
            </label>
          )}

          {(mode === 'register' || mode === 'recovery') && (
            <label>
              <span>Повторіть пароль</span>
              <input type="password" value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} autoComplete="new-password" minLength={8} required />
            </label>
          )}

          <button className="primary auth-submit" type="submit" disabled={loading}>
            {loading
              ? 'Зачекайте…'
              : mode === 'register'
                ? 'Створити акаунт'
                : mode === 'forgot'
                  ? 'Надіслати посилання'
                  : mode === 'recovery'
                    ? 'Зберегти новий пароль'
                    : 'Увійти'}
          </button>
        </form>

        {mode === 'login' && <button className="auth-link" type="button" onClick={() => changeMode('forgot')}>Забули пароль?</button>}
        {(mode === 'forgot' || mode === 'recovery') && <button className="auth-link" type="button" onClick={() => changeMode('login')}>Повернутися до входу</button>}

        {message && <div className="auth-success">{message}</div>}
        {error && <div className="api-warning">{error}</div>}
      </section>
    </div>
  )
}

function AccessScreen({ profile, onSignOut }: { profile: Profile; onSignOut: () => void }) {
  const messages = {
    pending: ['Акаунт очікує активації', 'Адміністратор уже бачить вашу реєстрацію. Доступ буде відкрито після підтвердження.'],
    blocked: ['Доступ призупинено', 'Зверніться до адміністратора для відновлення доступу.'],
    expired: ['Термін доступу завершився', 'Зверніться до адміністратора для продовження доступу.'],
  } as const
  const [title, text] = messages[profile.status as keyof typeof messages] || messages.pending
  return (
    <div className="auth-page">
      <section className="auth-card">
        <div className="status-orb">N</div>
        <h1>{title}</h1>
        <p className="auth-copy">{text}</p>
        <small>{profile.email}</small>
        <button className="secondary auth-logout" onClick={onSignOut}>Вийти з акаунта</button>
      </section>
    </div>
  )
}

export default function AuthGate() {
  const [session, setSession] = useState<Session | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [recoveryMode, setRecoveryMode] = useState(false)

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session)
      setLoading(false)
    })
    const { data } = supabase.auth.onAuthStateChange((event, nextSession) => {
      if (event === 'PASSWORD_RECOVERY') setRecoveryMode(true)
      setSession(nextSession)
    })
    return () => data.subscription.unsubscribe()
  }, [])

  useEffect(() => {
    async function loadProfile() {
      if (!session?.user || recoveryMode) {
        setProfile(null)
        setLoading(false)
        return
      }
      setLoading(true)
      setError('')
      const { data, error: profileError } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', session.user.id)
        .single()
      if (profileError) setError(profileError.message)
      setProfile((data as Profile | null) || null)
      setLoading(false)
    }
    loadProfile()
  }, [session, recoveryMode])

  if (!supabaseConfigured) {
    return <div className="auth-page"><section className="auth-card"><h1>Supabase ще не підключено</h1><p className="auth-copy">Додайте VITE_SUPABASE_URL і VITE_SUPABASE_ANON_KEY у файл .env та в Netlify Environment variables.</p></section></div>
  }
  if (loading) return <div className="auth-page"><div className="spinner" /></div>
  if (recoveryMode) return <LoginScreen initialMode="recovery" onRecoveryComplete={() => setRecoveryMode(false)} />
  if (!session) return <LoginScreen />
  if (error || !profile) return <div className="auth-page"><section className="auth-card"><h1>Не вдалося завантажити профіль</h1><div className="api-warning">{error || 'Профіль не знайдено. Виконайте SQL-налаштування Supabase.'}</div><button className="secondary" onClick={() => supabase.auth.signOut()}>Вийти</button></section></div>
  if (profile.status !== 'active' && profile.role !== 'admin') return <AccessScreen profile={profile} onSignOut={() => supabase.auth.signOut()} />

  return <App userId={session.user.id} profile={profile} onSignOut={() => supabase.auth.signOut()} />
}
