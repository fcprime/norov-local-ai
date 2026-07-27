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
  hasMore?: boolean
  cursor?: { googlePageToken?: string; geoOffset?: number } | null
}

export async function searchCompanies(filters: SearchFilters, cursor?: SearchResponse['cursor']): Promise<SearchResponse> {
  const { data } = await supabase.auth.getSession()
  const response = await fetch('/api/search', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${data.session?.access_token || ''}`,
    },
    body: JSON.stringify({ ...filters, ...(cursor ? { cursor } : {}) }),
  })

  if (!response.ok) {
    const body = await response.json().catch(() => ({}))
    throw new Error(body.error || 'Не вдалося виконати пошук')
  }

  return response.json()
}


export type OutreachFormPayload = { service:string; audience:string; problem:string; result:string; offer:string; cta:string; proof:string; language:'uk'|'pl'|'en'; tone:'direct'|'friendly'|'expert'|'soft'; previousPack?:OutreachPack | null; variantIndex?:number }
export type OutreachPack = { subject:string; main:string; short:string }
export async function generateAiOutreach(form: OutreachFormPayload): Promise<{ pack:OutreachPack; model?:string }> {
  const { data } = await supabase.auth.getSession()
  const response = await fetch('/api/ai-outreach', { method:'POST', headers:{ 'Content-Type':'application/json', Authorization:`Bearer ${data.session?.access_token || ''}` }, body:JSON.stringify(form) })
  const body = await response.json().catch(()=>({}))
  if (!response.ok) throw new Error(body.error || 'Не вдалося створити AI-звернення')
  return body
}


export type ContactEnrichmentResponse = {
  email?: string
  facebook?: string
  instagram?: string
}

export async function enrichCompanyContact(website: string): Promise<ContactEnrichmentResponse> {
  const { data } = await supabase.auth.getSession()
  const response = await fetch('/api/enrich-contact', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${data.session?.access_token || ''}`,
    },
    body: JSON.stringify({ website }),
  })
  const body = await response.json().catch(() => ({}))
  if (!response.ok) throw new Error(body.error || 'Не вдалося перевірити сайт компанії')
  return body
}
