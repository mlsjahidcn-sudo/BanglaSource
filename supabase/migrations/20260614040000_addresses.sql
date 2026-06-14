-- Migration 0025: addresses
--
-- Phase 19 (address book). A signed-in buyer can save up to N
-- shipping destinations. The /checkout page pre-fills the form
-- with their default address; the order row carries both the
-- resolved address_snapshot (jsonb, frozen at order time) AND
-- the optional address_id (FK) for back-tracing.
--
-- Why both? Two reasons:
--   1. Invoice stability: if the buyer edits the saved address
--      after placing the order, the order's resolved address
--      doesn't change.
--   2. Operational lookups: admin can "jump to the buyer's
--      address book" from an order detail page (future).
--
-- Schema:
--   - id:            bigserial
--   - user_id:       auth.users FK CASCADE
--   - label:         'Home' | 'Office' | '3PL' | 'Factory' | 'Other'
--                    (free-form, but we ship 5 presets in the UI)
--   - full_name:     not null, 2-80 chars
--   - phone:         not null, 4-20 chars (E.164-ish; we don't
--                    validate country code in the DB)
--   - country:       not null, 2-letter code ('BD' default)
--   - district:      not null, 2-80 chars (e.g. "Gulshan, Dhaka")
--   - address_line:  not null, 4-200 chars
--   - is_default:    boolean. AT MOST ONE row per user can have
--                    is_default=true (enforced by a partial
--                    unique index). The trigger below maintains
--                    this invariant — setting a new default
--                    clears the old one in the same tx.
--   - created_at, updated_at
--
-- RLS:
--   - SELECT/INSERT/UPDATE/DELETE: only when auth.uid() = user_id.
--   - Admins can SELECT ALL via the service-role client.
--
-- Indexes:
--   - PK on id
--   - btree on (user_id, is_default desc) — "give me my default
--     address" is the hot path on /checkout
--   - partial unique on (user_id) where is_default = true — the
--     "at most one default" invariant, enforced at the DB
--     level so concurrent requests can't race past the trigger

create table if not exists public.addresses (
  id              bigserial primary key,
  user_id         uuid not null references auth.users(id) on delete cascade,
  label           text not null default 'Home'
                    check (label in ('Home', 'Office', '3PL', 'Factory', 'Other')),
  full_name       text not null check (char_length(full_name) between 2 and 80),
  phone           text not null check (char_length(phone) between 4 and 20),
  country         text not null default 'BD'
                    check (char_length(country) = 2),
  district        text not null check (char_length(district) between 2 and 80),
  address_line    text not null check (char_length(address_line) between 4 and 200),
  is_default      boolean not null default false,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index if not exists addresses_user_id_idx
  on public.addresses (user_id, is_default desc, updated_at desc);

-- The "at most one default per user" invariant. Partial unique
-- index so NULL values (non-default rows) don't conflict.
create unique index if not exists addresses_one_default_per_user_idx
  on public.addresses (user_id)
  where is_default = true;

-- Maintain the invariant on insert/update: if a row is being
-- set to is_default=true, flip every other row for the same
-- user to is_default=false in the same transaction. (The
-- partial unique index above is the safety net — concurrent
-- requests would fail the constraint before the trigger even
-- runs.)
create or replace function public.addresses_single_default()
returns trigger as $$
begin
  if new.is_default = true then
    update public.addresses
      set is_default = false, updated_at = now()
      where user_id = new.user_id
        and id <> new.id
        and is_default = true;
  end if;
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists addresses_single_default_t on public.addresses;
create trigger addresses_single_default_t
  before insert or update on public.addresses
  for each row execute function public.addresses_single_default();

-- updated_at trigger (uses the shared set_updated_at fn from
-- migration 0000; if running this migration in isolation, the
-- trigger fn may need to be created first — see 00_run_all.sql)
drop trigger if exists addresses_touch on public.addresses;
create trigger addresses_touch
  before update on public.addresses
  for each row execute function public.set_updated_at();

-- RLS
alter table public.addresses enable row level security;

drop policy if exists "addresses_select_own" on public.addresses;
create policy "addresses_select_own" on public.addresses
  for select using (auth.uid() = user_id);

drop policy if exists "addresses_insert_own" on public.addresses;
create policy "addresses_insert_own" on public.addresses
  for insert with check (auth.uid() = user_id);

drop policy if exists "addresses_update_own" on public.addresses;
create policy "addresses_update_own" on public.addresses
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "addresses_delete_own" on public.addresses;
create policy "addresses_delete_own" on public.addresses
  for delete using (auth.uid() = user_id);

-- Optional: when an order row references a saved address, add
-- the FK column. The order's `address_snapshot` (jsonb) remains
-- the source of truth for the order itself; address_id is
-- supplementary metadata for back-tracing.
alter table public.orders
  add column if not exists address_id bigint
    references public.addresses(id) on delete set null;
comment on column public.orders.address_id is
  'Optional FK to the buyer''s saved address book. The resolved address_snapshot (jsonb) is still the source of truth for the order itself — this column is supplementary metadata for back-tracing. NULL on delete so address removal doesn''t break order history.';
