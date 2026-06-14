-- Migration 0026: newsletter double opt-in
--
-- Phase 20: newsletter needs a confirmation step before we
-- start sending. The current `newsletter_subscribers` table
-- only stores `email + source + ip_hash + created_at`, which
-- is fine for a one-step signup but doesn't let us enforce
-- "user confirmed" or handle a stale signup that was never
-- clicked through.
--
-- Schema changes:
--   - confirm_token:  text — 32-char nanoid generated at
--                     signup time. Sent in the confirmation
--                     email; required to flip confirmed_at.
--                     Stored UNIQUE so a token can only be
--                     redeemed once.
--   - confirmed_at:   timestamptz NULL until the user clicks
--                     the link in the confirmation email.
--   - unsubscribed_at: timestamptz NULL while subscribed.
--                     We send the unsubscribe link in every
--                     campaign and honour it here. (Resend
--                     also tracks this via their list-unsubscribe
--                     header, but the DB is the source of truth
--                     for our own flows.)
--
-- RLS:
--   - INSERT: anon, authenticated (existing policy, kept).
--   - SELECT: anyone with the right token (the /confirm
--             route is a server route, not a direct client
--             query — we keep the existing "select own" policy
--             that says "no" for authenticated).
--   - UPDATE: never from the client. The /confirm route uses
--             the service-role key.
--
-- A partial index on `email WHERE confirmed_at IS NOT NULL`
-- gives the marketing-team "active subscribers" count in O(1).
--
-- Backfill: existing rows have no confirm_token and no
-- confirmed_at. We treat them as **already-confirmed** (since
-- they were inserted before the opt-in was enforced). Setting
-- confirmed_at = created_at for legacy rows. New rows start
-- NULL until they click the link.

alter table public.newsletter_subscribers
  add column if not exists confirm_token text,
  add column if not exists confirmed_at timestamptz,
  add column if not exists unsubscribed_at timestamptz;

-- Backfill: treat all pre-migration rows as confirmed
update public.newsletter_subscribers
  set confirmed_at = created_at
  where confirmed_at is null and confirm_token is null;

-- Generated tokens for the (currently impossible) case where
-- someone is a confirmed_at=NULL legacy row. None should
-- exist, but this is a safety net.
update public.newsletter_subscribers
  set confirm_token = encode(gen_random_bytes(16), 'hex')
  where confirm_token is null;

-- Unique token (NULLs allowed for the rare case where a user
-- has confirm_token=NULL because they unsubscribed via Resend
-- header; new rows always have a non-null token).
create unique index if not exists newsletter_subscribers_token_idx
  on public.newsletter_subscribers (confirm_token)
  where confirm_token is not null;

-- "Active subscribers" partial index (campaign sends filter
-- on confirmed_at IS NOT NULL AND unsubscribed_at IS NULL).
create index if not exists newsletter_active_idx
  on public.newsletter_subscribers (email)
  where confirmed_at is not null and unsubscribed_at is null;
