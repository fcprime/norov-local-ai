# Supabase setup

1. Open Supabase → SQL Editor → New query.
2. Paste and run `supabase/schema.sql`.
3. Log in once through Google on the local site. The account will appear as `pending`.
4. In SQL Editor run:

```sql
update public.profiles
set role = 'admin', status = 'active', monthly_search_limit = 0
where email = 'YOUR_EMAIL@gmail.com';
```

5. Add variables from `.env.example` to local `.env` and Netlify Environment variables.
6. In Supabase Authentication → URL Configuration:
   - Site URL: your production Netlify URL
   - Redirect URLs: `http://localhost:5173/**` and your Netlify URL `/**`

Never commit `.env` or expose `SUPABASE_SERVICE_ROLE_KEY` in frontend code.
