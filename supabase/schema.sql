-- Norov Local AI: run this file once in Supabase SQL Editor.
create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null default '',
  full_name text,
  avatar_url text,
  role text not null default 'user' check (role in ('user','admin')),
  status text not null default 'pending' check (status in ('pending','active','blocked','expired')),
  monthly_search_limit integer not null default 300 check (monthly_search_limit >= 0),
  access_expires_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.user_state (
  user_id uuid primary key references auth.users(id) on delete cascade,
  state jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

create table if not exists public.search_logs (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  provider text not null,
  google_request_count integer not null default 0,
  service text not null default '',
  target_business text not null default '',
  country text not null default '',
  city text not null default '',
  radius_km integer not null default 25,
  results_count integer not null default 0,
  cache_hit boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists search_logs_user_created_idx on public.search_logs(user_id, created_at desc);
create index if not exists search_logs_created_idx on public.search_logs(created_at desc);

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, email, full_name, avatar_url)
  values (
    new.id,
    coalesce(new.email, ''),
    coalesce(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name'),
    new.raw_user_meta_data->>'avatar_url'
  )
  on conflict (id) do nothing;
  insert into public.user_state (user_id) values (new.id) on conflict (user_id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute procedure public.handle_new_user();

alter table public.profiles enable row level security;
alter table public.user_state enable row level security;
alter table public.search_logs enable row level security;

create policy "profiles_read_own" on public.profiles for select using (auth.uid() = id);
create policy "user_state_own_all" on public.user_state for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
-- Search logs are written/read through protected Netlify Functions using service_role.

-- After your first email registration, promote yourself with your real email:
-- update public.profiles set role='admin', status='active', monthly_search_limit=0 where email='YOUR_EMAIL@gmail.com';

-- Stripe purchase automation (safe to run more than once)
alter table public.profiles add column if not exists stripe_customer_id text;
alter table public.profiles add column if not exists stripe_checkout_session_id text;
create unique index if not exists profiles_stripe_checkout_session_idx
  on public.profiles(stripe_checkout_session_id)
  where stripe_checkout_session_id is not null;
