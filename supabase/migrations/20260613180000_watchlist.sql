-- Migration 0018: buyer watchlist
--
-- Lets a signed-in buyer save a product to a personal watchlist.
-- Used by the heart button on PDP and the /buyer/watchlist page.
-- Future work: surface watchlist hits in the page_view tracker so
-- the recommendations carousel can boost items already on the
-- watcher's list (e.g. "frequently viewed by watchlist users").
--
-- Schema:
--   - user_id:  auth.users FK, cascades on delete
--   - product_id: products.id FK, cascades on delete
--   - UNIQUE (user_id, product_id) prevents dupes
--   - saved_at  timestamptz, default now()
--   - notify_on_drop boolean, default true (Phase 8 will hook this
--     to the price_alert_log loop)
--
-- RLS:
--   - SELECT/INSERT/DELETE: only when auth.uid() = user_id
--   - Admins can SELECT ALL via the service-role client; this is
--     already implicit (RLS only restricts the anon/authenticated
--     roles; the service-role bypasses RLS entirely).
--
-- Indexes:
--   - PK on id
--   - UNIQUE on (user_id, product_id) — also acts as the dedup index
--   - btree on user_id alone (for "list this user's watchlist" queries)
--   - btree on product_id alone (for "how many watch this?" future use)

CREATE TABLE IF NOT EXISTS public.watchlist (
  id              BIGSERIAL PRIMARY KEY,
  user_id         UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  product_id      BIGINT NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  saved_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  notify_on_drop  BOOLEAN NOT NULL DEFAULT true,
  UNIQUE (user_id, product_id)
);

CREATE INDEX IF NOT EXISTS idx_watchlist_user_id
  ON public.watchlist (user_id, saved_at DESC);
CREATE INDEX IF NOT EXISTS idx_watchlist_product_id
  ON public.watchlist (product_id);

ALTER TABLE public.watchlist ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "watchlist: select own" ON public.watchlist;
DROP POLICY IF EXISTS "watchlist: insert own" ON public.watchlist;
DROP POLICY IF EXISTS "watchlist: delete own" ON public.watchlist;

CREATE POLICY "watchlist: select own"
  ON public.watchlist
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "watchlist: insert own"
  ON public.watchlist
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "watchlist: delete own"
  ON public.watchlist
  FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- UPDATE is intentionally not granted — only saved_at and
-- notify_on_drop are mutable by the user, and we don't expose
-- either in the UI yet. When we do, add a policy for it.
