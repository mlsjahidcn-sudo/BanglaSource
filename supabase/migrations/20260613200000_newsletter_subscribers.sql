-- Migration 0020: newsletter subscribers
--
-- Email capture for the "best weekly deals" digest. The signup
-- form on the home page posts here. We don't have email infra
-- yet, so this is just lead-capture. The admin can later pipe
-- it to Resend/Postmark.
--
-- Schema:
--   - id:           bigserial
--   - email:        text, UNIQUE
--   - source:       optional utm-style "where did they come from"
--   - ip_hash:      optional SHA-256 of IP for rate limiting
--   - created_at:   timestamptz default now()
--
-- RLS:
--   - INSERT: anyone (anon + authenticated). We don't expose
--     UPDATE/DELETE.
--   - SELECT: nobody (admin uses service-role).

CREATE TABLE IF NOT EXISTS public.newsletter_subscribers (
  id           BIGSERIAL PRIMARY KEY,
  email        TEXT NOT NULL UNIQUE,
  source       TEXT,
  ip_hash      TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_newsletter_recent
  ON public.newsletter_subscribers (created_at DESC);

ALTER TABLE public.newsletter_subscribers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "newsletter: insert anon" ON public.newsletter_subscribers;
CREATE POLICY "newsletter: insert anon"
  ON public.newsletter_subscribers FOR INSERT TO anon, authenticated
  WITH CHECK (true);

DROP POLICY IF EXISTS "newsletter: select own" ON public.newsletter_subscribers;
-- Intentionally no SELECT policy for authenticated; admin uses
-- service-role to read the list.
