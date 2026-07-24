# Stripe → Supabase automatic access

## Added routes
- `/payment-success` — success screen after Stripe payment.
- `/set-password` — customer creates a password from the Supabase invitation.
- `/.netlify/functions/stripe-webhook` — receives Stripe `checkout.session.completed`.

## 1. Supabase
Run the updated `supabase/schema.sql` in SQL Editor.

In Authentication → URL Configuration → Redirect URLs add:
- `https://norov-local-ai.netlify.app/set-password`
- `http://localhost:5173/set-password`

In Authentication → Email Templates → Invite user, use a Ukrainian invitation and keep the confirmation URL variable from the original template.

## 2. Netlify environment variables for the CRM project
Keep existing Supabase variables and add:

```
STRIPE_WEBHOOK_SECRET=whsec_...
STRIPE_PAYMENT_LINK_ID=plink_...   # optional but recommended
APP_URL=https://norov-local-ai.netlify.app
```

`SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` must already be configured.

## 3. Stripe
Developers → Webhooks → Add endpoint:

`https://norov-local-ai.netlify.app/.netlify/functions/stripe-webhook`

Select event:
- `checkout.session.completed`

Copy the signing secret `whsec_...` into Netlify.

In the live Payment Link set After payment redirect to:

`https://norov-local-ai.netlify.app/payment-success`

## Result
After a paid checkout, the webhook creates/invites the Supabase user, activates access for 60 days, and sets the search limit to 150. New users receive an invitation email and create their own password.
