import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined

export const supabaseConfigured = Boolean(url && anonKey)

export const supabase = createClient(url || 'https://example.supabase.co', anonKey || 'missing-key', {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
})

export type AccessStatus = 'pending' | 'active' | 'blocked' | 'expired'
export type AppRole = 'user' | 'admin'

export type Profile = {
  id: string
  email: string
  full_name: string | null
  avatar_url: string | null
  role: AppRole
  status: AccessStatus
  monthly_search_limit: number
  access_expires_at: string | null
  created_at: string
}
