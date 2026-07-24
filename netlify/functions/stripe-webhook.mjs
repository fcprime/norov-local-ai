import crypto from 'node:crypto'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  String(process.env.SUPABASE_URL || ''),
  String(process.env.SUPABASE_SERVICE_ROLE_KEY || ''),
  { auth: { autoRefreshToken: false, persistSession: false } },
)

function response(body, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } })
}

function verifyStripeSignature(payload, signatureHeader, secret) {
  const parts = Object.fromEntries(signatureHeader.split(',').map((part) => part.split('=')))
  const timestamp = parts.t
  const signature = parts.v1
  if (!timestamp || !signature) return false
  if (Math.abs(Date.now() / 1000 - Number(timestamp)) > 300) return false
  const expected = crypto.createHmac('sha256', secret).update(`${timestamp}.${payload}`).digest('hex')
  const a = Buffer.from(expected, 'hex')
  const b = Buffer.from(signature, 'hex')
  return a.length === b.length && crypto.timingSafeEqual(a, b)
}

async function findUserByEmail(email) {
  for (let page = 1; page <= 10; page += 1) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage: 1000 })
    if (error) throw error
    const found = data.users.find((user) => user.email?.toLowerCase() === email.toLowerCase())
    if (found) return found
    if (data.users.length < 1000) break
  }
  return null
}

export default async (request) => {
  if (request.method !== 'POST') return response({ error: 'Method not allowed' }, 405)
  const webhookSecret = String(process.env.STRIPE_WEBHOOK_SECRET || '')
  if (!webhookSecret || !process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return response({ error: 'Server environment variables are missing' }, 503)
  }

  const payload = await request.text()
  const signature = request.headers.get('stripe-signature') || ''
  if (!verifyStripeSignature(payload, signature, webhookSecret)) {
    return response({ error: 'Webhook signature verification failed' }, 400)
  }

  let event
  try { event = JSON.parse(payload) }
  catch { return response({ error: 'Invalid JSON' }, 400) }

  if (event.type !== 'checkout.session.completed') return response({ received: true })

  try {
    const session = event.data.object
    if (session.payment_status !== 'paid') return response({ received: true, ignored: 'not paid' })

    const email = String(session.customer_details?.email || session.customer_email || '').trim().toLowerCase()
    if (!email) throw new Error('Stripe session does not contain customer email')

    const expectedPaymentLink = String(process.env.STRIPE_PAYMENT_LINK_ID || '').trim()
    if (expectedPaymentLink && session.payment_link !== expectedPaymentLink) {
      return response({ received: true, ignored: 'different payment link' })
    }

    const accessExpiresAt = new Date(Date.now() + 60 * 24 * 60 * 60 * 1000).toISOString()
    let user = await findUserByEmail(email)
    let invited = false

    if (!user) {
      const { data, error } = await supabase.auth.admin.inviteUserByEmail(email, {
        redirectTo: `${String(process.env.APP_URL || 'https://norov-local-ai.netlify.app').replace(/\/$/, '')}/set-password`,
        data: { purchase_source: 'stripe', stripe_customer_id: String(session.customer || '') },
      })
      if (error) throw error
      user = data.user
      invited = true
    }

    const { error: profileError } = await supabase.from('profiles').upsert({
      id: user.id,
      email,
      status: 'active',
      role: 'user',
      monthly_search_limit: 150,
      access_expires_at: accessExpiresAt,
      stripe_customer_id: String(session.customer || ''),
      stripe_checkout_session_id: session.id,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'id' })
    if (profileError) throw profileError

    return response({ received: true, userId: user.id, invited })
  } catch (error) {
    console.error('Stripe fulfillment failed', error)
    return response({ error: error instanceof Error ? error.message : 'Fulfillment failed' }, 500)
  }
}
