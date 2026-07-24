export type LeadStatus =
  | 'New'
  | 'Contacted'
  | 'Replied'
  | 'Interested'
  | 'Quote Sent'
  | 'Negotiation'
  | 'Won'
  | 'Lost'

export type Channel = 'Email' | 'WhatsApp' | 'Facebook' | 'Instagram' | 'LinkedIn' | 'SMS' | 'Call Script' | 'Follow-up 1' | 'Follow-up 2'

export interface LeadActivity {
  id: string
  type: 'note' | 'contact' | 'reply' | 'status' | 'reminder'
  text: string
  createdAt: string
}

export interface Company {
  id: string
  name: string
  category: string
  country: string
  city: string
  address: string
  website: string
  email: string
  phone: string
  rating: number
  reviews: number
  language: string
  localizedService?: string
  localizedTargetBusiness?: string
  reason: string
  painPoints: string[]
  offer: string
  status: LeadStatus
  notes: string
  nextContact?: string
  activities?: LeadActivity[]
  facebook?: string
  instagram?: string
  googleMapsUrl?: string
  source?: 'Google' | 'Geoapify'
  placeId?: string
}

export interface SearchFilters {
  service: string
  targetBusiness: string
  country: string
  city: string
  radius: number
}
