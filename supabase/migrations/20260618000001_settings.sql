-- Migration 20260618000001: settings (admin-configurable runtime values)
--
-- Phase 48 (2026-06-18): user feedback was that the CNY → BDT rate
-- is hardcoded in pricing.ts (was 16.85, market reality 18.2-18.3)
-- and there's no way for an admin to update it without redeploying.
-- This table stores runtime config the operator can flip from the
-- admin UI without a code change.
--
-- Seed: fx_cny_bdt = 18.25 (mid of user-specified 18.2-18.3).

begin;

create table if not exists public.settings (
  key text primary key,
  -- jsonb so we can store numbers, strings, booleans, or objects
  -- depending on the setting. Each setting documents its own shape.
  value jsonb not null,
  updated_at timestamptz not null default now(),
  -- updated_by is null when the row was seeded by a migration
  -- (no human authored it). NULL is also allowed for service-role
  -- automated writes.
  updated_by uuid references auth.users (id)
);

alter table public.settings enable row level security;

-- RLS: only admins (profiles.is_admin = true) can read or write.
-- Pattern matches group_buys / rfqs / quotes admin policies.
drop policy if exists settings_admin_all on public.settings;
create policy settings_admin_all
  on public.settings
  for all
  to authenticated
  using (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid()
        and p.is_admin = true
    )
  )
  with check (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid()
        and p.is_admin = true
    )
  );

-- Service-role bypasses RLS anyway, but be explicit so an admin
-- client with the anon key can never read settings.

-- Seed: FX rate. 18.25 CNY → 1 BDT (user-stated market range 18.2-18.3).
insert into public.settings (key, value, updated_by)
values ('fx_cny_bdt', '18.25'::jsonb, null)
on conflict (key) do nothing;

commit;