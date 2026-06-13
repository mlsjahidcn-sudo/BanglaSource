-- Migration 0019: notifications
--
-- Per-user in-app notifications. Created by the price-alerts cron
-- when a `drop` alert fans out to all watchlist users with
-- `notify_on_drop = true`. The schema is generic enough to also
-- hold other event types (quote-update, new-message, etc.) — kind
-- is a free-form string we use for filtering + icon mapping.
--
-- Schema:
--   - id:               bigserial
--   - user_id:          auth.users FK CASCADE
--   - kind:             'price_drop' | 'price_rise' | future kinds
--   - title:            short summary line (e.g. "Pro6 TWS dropped 18%")
--   - body:             optional longer body for the notifications page
--   - href:             deep link to the relevant page
--   - related_alert_id: nullable FK back to price_alert_log (so the
--                       "View alert" admin page can find its fan-out)
--   - related_product_id: nullable FK to products (for the per-product
--                       badge, future use)
--   - read_at:          timestamptz NULL until the user marks it read
--   - created_at:       timestamptz default now()
--
-- Dedup:
--   - UNIQUE (user_id, related_alert_id) — when the same alert fires
--     and the same user has the product on their watchlist, we don't
--     insert twice. ON CONFLICT DO NOTHING in the fan-out step.
--   - id also acts as the per-user chronological ordering
--
-- RLS:
--   - SELECT: only the owner (auth.uid() = user_id)
--   - UPDATE: only the owner (marking read). Service-role bypasses
--     for the fan-out step.
--   - INSERT: not granted to authenticated; only service-role inserts
--     (cron job).

CREATE TABLE IF NOT EXISTS public.notifications (
  id                  BIGSERIAL PRIMARY KEY,
  user_id             UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  kind                TEXT NOT NULL,
  title               TEXT NOT NULL,
  body                TEXT,
  href                TEXT,
  related_alert_id    BIGINT REFERENCES public.price_alert_log(id) ON DELETE CASCADE,
  related_product_id  BIGINT REFERENCES public.products(id) ON DELETE CASCADE,
  read_at             TIMESTAMPTZ,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, related_alert_id)
);

CREATE INDEX IF NOT EXISTS idx_notifications_user_recent
  ON public.notifications (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_unread
  ON public.notifications (user_id)
  WHERE read_at IS NULL;

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "notifications: select own" ON public.notifications;
DROP POLICY IF EXISTS "notifications: update own" ON public.notifications;
DROP POLICY IF EXISTS "notifications: insert own" ON public.notifications;

CREATE POLICY "notifications: select own"
  ON public.notifications
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "notifications: update own"
  ON public.notifications
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- INSERT: only via the service-role client (cron). No policy for
-- authenticated on INSERT — that path isn't exposed in the API.
-- We don't add an INSERT policy here so it's truly service-only.
