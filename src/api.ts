import type { Company, SearchFilters } from './types'
import { supabase } from './supabase'

export type SearchResponse = {
  companies: Company[]
  source: 'google' | 'geoapify' | 'combined' | 'demo'
  warning?: string
  cached?: boolean
  language?: string
  localizedService?: string
  localizedTargetBusiness?: string
  location?: { lat: number; lon: number; displayName: string; radiusKm: number }
  usage?: { searches: number; limit: number }
}

export async function searchCompanies(filters: SearchFilters): Promise<SearchResponse> {
  const { data } = await supabase.auth.getSession()
  const response = await fetch('/api/search', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${data.session?.access_token || ''}`,
    },
    body: JSON.stringify(filters),
  })

  if (!response.ok) {
    const body = await response.json().catch(() => ({}))
    throw new Error(body.error || 'Не вдалося виконати пошук')
  }

  return response.json()
}


export type OutreachFormPayload = { service:string; audience:string; problem:string; result:string; offer:string; cta:string; proof:string; language:'uk'|'pl'|'en'; tone:'direct'|'friendly'|'expert'|'soft' }
export type OutreachPack = { subject:string; main:string; short:string }
export async function generateAiOutreach(form: OutreachFormPayload): Promise<{ pack:OutreachPack; model?:string }> {
  const { data } = await supabase.auth.getSession()
  const response = await fetch('/api/ai-outreach', { method:'POST', headers:{ 'Content-Type':'application/json', Authorization:`Bearer ${data.session?.access_token || ''}` }, body:JSON.stringify(form) })
  const body = await response.json().catch(()=>({}))
  if (!response.ok) throw new Error(body.error || 'Не вдалося створити AI-звернення')
  return body
}
