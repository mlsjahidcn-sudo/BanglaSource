-- ============================================================================
-- 0001_profiles_and_quotes.sql
-- Minimal schema for BanglaSource B2B marketplace:
--   - profiles (1:1 with auth.users, auto-created via trigger)
--   - quotes  (per-user request list, submitted from /cart)
--
-- RLS: users can only see/edit their own rows. Service-role bypasses for
-- server-side writes from API routes that already validated the user.
-- ============================================================================

-- ── profiles ────────────────────────────────────────────────────────────────
create table if not exists public.profiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  email       text not null,
  full_name   text,
  company     text,
  phone       text,
  country     text default 'BD',
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- Auto-create a profile row when a new auth user signs up
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email)
  values (new.id, new.email)
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ── quotes ─────────────────────────────────────────────────────────────────
create table if not exists public.quotes (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references auth.users(id) on delete cascade,

  -- quote identity
  quote_id        text not null unique,           -- Q-YYYYMMDD-XXXXX

  -- source params
  product_ids     text[] not null,               -- ["738201456912", ...]
  shipping_mode   text not null check (shipping_mode in ('air','sea','express')),
  total_qty       integer not null check (total_qty > 0),

  -- money (stored as integer BDT)
  fob_cny_fen     bigint not null,
  fx_cny_bdt      numeric(10,4) not null,
  cn_subtotal_bdt bigint not null,
  intl_bdt        bigint not null,
  agent_bdt       bigint not null,
  consol_bdt      bigint not null,
  duty_bdt        bigint not null,
  duty_pct        numeric(5,4) not null,
  vat_bdt         bigint not null,
  ait_bdt         bigint not null,
  markup_bdt      bigint not null,
  markup_pct      numeric(5,2) not null,
  total_bdt       bigint not null,
  unit_bdt        bigint not null,
  chargeable_kg   numeric(10,2) not null,
  transit_days    text not null,

  -- ops
  status          text not null default 'pending'
                    check (status in ('pending','sourced','quoted','confirmed','paid','shipped','delivered','cancelled')),
  notes           text,
  expires_at      timestamptz not null,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index if not exists quotes_user_id_idx on public.quotes(user_id);
create index if not exists quotes_status_idx on public.quotes(status);
create index if not exists quotes_created_at_idx on public.quotes(created_at desc);

-- updated_at trigger
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_quotes_updated_at on public.quotes;
create trigger trg_quotes_updated_at
  before update on public.quotes
  for each row execute function public.set_updated_at();

drop trigger if exists trg_profiles_updated_at on public.profiles;
create trigger trg_profiles_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

-- ── RLS ────────────────────────────────────────────────────────────────────
alter table public.profiles enable row level security;
alter table public.quotes   enable row level security;

-- profiles: users can read/update their own row; service-role bypasses
drop policy if exists "profiles: select own" on public.profiles;
create policy "profiles: select own"
  on public.profiles for select
  using (auth.uid() = id);

drop policy if exists "profiles: update own" on public.profiles;
create policy "profiles: update own"
  on public.profiles for update
  using (auth.uid() = id)
  with check (auth.uid() = id);

-- quotes: users can read/insert their own; updates only by service-role
drop policy if exists "quotes: select own" on public.quotes;
create policy "quotes: select own"
  on public.quotes for select
  using (auth.uid() = user_id);

drop policy if exists "quotes: insert own" on public.quotes;
create policy "quotes: insert own"
  on public.quotes for insert
  with check (auth.uid() = user_id);

-- (no UPDATE policy: only the service-role can update status / notes —
--  this is an ops-only action. Reads + new submissions from the user are
--  fully covered.)
