-- Migration 0029: contact_messages
--
-- Phase 24: the public /contact form. Today the form
-- `setSent(true)`s and does nothing — the message
-- goes nowhere. Phase 24 wires it to POST /api/contact
-- which inserts a row here + fans out an email to ops.
--
-- Schema:
--   - id:            bigserial
--   - user_id:       auth.users FK CASCADE (nullable —
--                    contact form works for non-signed-in
--                    visitors too)
--   - name:          2-120 chars
--   - phone:         4-20 chars (BD-style mobile,
--                    E.164-ish)
--   - email:         optional, 0-254 chars
--   - company:       optional, 0-120 chars
--   - message:       10-2000 chars
--   - source:        'footer' | 'contact-page' | 'rfq-fallback'
--                    | 'whatsapp-fallback' — where on
--                    the site the form was submitted
--                    from. Useful for analytics.
--   - status:        'new' (default) | 'in_progress' |
--                    'resolved' | 'spam' — admin
--                    workflow.
--   - ip_hash:       optional, sha256(ip + salt) for
--                    spam detection without storing
--                    the raw IP. GDPR-friendly.
--   - admin_owner_id: optional FK to auth.users
--   - timestamps
--
-- RLS:
--   - INSERT: anon, authenticated (the public form).
--   - SELECT: admins only (service-role). No
--     public read.
--
-- The "in_progress" / "resolved" transitions are
-- admin actions; they go through service-role, no
-- RLS policy. We don't need an `updated_at` because
-- the only mutating action is a status flip; we use
-- the existing public.set_updated_at trigger for
-- that.

create table if not exists public.contact_messages (
  id              bigserial primary key,
  user_id         uuid references auth.users(id) on delete set null,
  name            text not null check (char_length(name) between 2 and 120),
  phone           text not null check (char_length(phone) between 4 and 20),
  email           text check (email is null or char_length(email) <= 254),
  company         text check (company is null or char_length(company) <= 120),
  message         text not null check (char_length(message) between 10 and 2000),
  source          text not null default 'contact-page'
                    check (source in ('footer','contact-page','rfq-fallback','whatsapp-fallback','other')),
  status          text not null default 'new'
                    check (status in ('new','in_progress','resolved','spam')),
  ip_hash         text,
  admin_owner_id  uuid references auth.users(id) on delete set null,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index if not exists contact_messages_status_idx
  on public.contact_messages (status, created_at desc);

-- RLS
alter table public.contact_messages enable row level security;

drop policy if exists "contact_insert_anyone" on public.contact_messages;
create policy "contact_insert_anyone" on public.contact_messages
  for insert with check (true);

-- No SELECT / UPDATE policies for users. Admins
-- read via service-role.

drop trigger if exists contact_messages_touch on public.contact_messages;
create trigger contact_messages_touch
  before update on public.contact_messages
  for each row execute function public.set_updated_at();
