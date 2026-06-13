-- Migration 0011: Product image storage + AI run tracking
-- ──────────────────────────────────────────────────────────────
-- Adds:
--   1) Supabase Storage bucket `product-images` (public read,
--      service-role write). Admins upload via signed URL.
--   2) `ai_runs` table: cost tracking + dedup cache for DeepSeek
--      translations / regenerations. Keyed by (kind, source_id,
--      source_hash) so re-running with the same inputs is free.
--   3) Helper: `get_untranslated_products()` RPC for the
--      translate-catalog script.

BEGIN;

-- ── 1) Storage bucket for product images ────────────────────────
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'product-images',
  'product-images',
  true,                -- public read; shopper hits the CDN URL directly
  5 * 1024 * 1024,     -- 5MB per image
  ARRAY['image/jpeg', 'image/png', 'image/webp']
)
ON CONFLICT (id) DO NOTHING;

-- Public read: anyone can view product images
CREATE POLICY "product_images_public_read"
  ON storage.objects
  FOR SELECT
  USING (bucket_id = 'product-images');

-- Write: only the service_role key can upload (bypasses RLS at the
-- DB level, but we still gate by admin auth in our API route).
-- No INSERT/UPDATE/DELETE policy for anon or authenticated —
-- uploads happen via the service-role client in
-- /api/admin/products/[id]/images.

-- ── 2) ai_runs table ────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS ai_runs (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  kind            text NOT NULL,           -- 'translate','regenerate','recs','chat','nl_search'
  model           text NOT NULL,           -- 'deepseek-chat' | 'deepseek-reasoner'
  source_table    text,                   -- e.g. 'products'
  source_id       text,                   -- e.g. products.source_id
  source_hash     text,                   -- sha256 of inputs — dedup key
  input_tokens    integer NOT NULL,
  output_tokens   integer NOT NULL,
  cost_usd        numeric(10,6) NOT NULL, -- estimated at the rates we know
  output          jsonb NOT NULL,         -- the model's structured output
  created_at      timestamptz NOT NULL DEFAULT now()
);

-- Dedup index: same (kind, source_id, source_hash) → return cached output
CREATE UNIQUE INDEX IF NOT EXISTS ai_runs_dedup_idx
  ON ai_runs (kind, source_id, source_hash)
  WHERE source_id IS NOT NULL;

-- For chat: no source_id, just index on (kind, source_hash) where source_id IS NULL
CREATE UNIQUE INDEX IF NOT EXISTS ai_runs_chat_dedup_idx
  ON ai_runs (kind, source_hash)
  WHERE source_id IS NULL;

CREATE INDEX IF NOT EXISTS ai_runs_created_idx
  ON ai_runs (created_at DESC);

CREATE INDEX IF NOT EXISTS ai_runs_source_idx
  ON ai_runs (source_table, source_id)
  WHERE source_id IS NOT NULL;

-- RLS: only service_role can read/write (admin views can query via API)
ALTER TABLE ai_runs ENABLE ROW LEVEL SECURITY;

-- No public read policy — admin views go through /api/admin/ai/runs
-- which uses service-role client.

-- ── 3) Helper RPC: get_untranslated_products ───────────────────
CREATE OR REPLACE FUNCTION get_untranslated_products(limit_n integer DEFAULT 50)
RETURNS TABLE(
  id bigint,
  source_id text,
  title_zh text,
  category text,
  price_min_fen integer
)
LANGUAGE sql STABLE
AS $$
  SELECT
    p.id,
    p.source_id,
    p.title_zh,
    p.category,
    COALESCE(
      (SELECT MIN(pt.price_cny_fen)
       FROM price_tiers pt
       WHERE pt.product_id = p.id),
      0
    )::integer AS price_min_fen
  FROM products p
  WHERE p.active = true
    AND (
      p.title_en = p.title_zh
      OR p.title_en IS NULL
      OR p.title_en = ''
    )
  ORDER BY p.id
  LIMIT limit_n;
$$;

COMMIT;
