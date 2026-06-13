-- Migration 0021: per-kg customs duty
--
-- Bangladesh Customs air-cargo duties are mostly *specific* (per kg
-- of imported weight), not ad-valorem (% of CIF). The previous
-- DUTY_BY_CATEGORY in the pricing engine was using rough ad-valorem
-- rates (10-25%) that approximated the average case but were wrong
-- for high-duty specific items like sunglasses (৳3,500/kg).
--
-- This migration adds a per-product customs_duty_per_kg field that
-- the pricing engine reads. Each product gets a default value auto-
-- classified from the product title at insert/update time (see
-- scripts/backfill-customs-duty.mts); admins can override per
-- product in the editor.
--
-- Schema:
--   - customs_duty_per_kg: numeric(8,2) — ৳ per kg of imported
--     weight (which is what Bangladesh Customs charges for
--     specific-duty HS codes). Default 750 (Category A baseline).
--   - customs_duty_class: text — human label like "cat-a", "cat-b",
--     "sunglasses-c", "smart-watch-c", "bluetooth-c", etc. Useful
--     for analytics and for the admin UI to show "you can probably
--     skip this override unless the title is unusual".

ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS customs_duty_per_kg numeric(8, 2) NOT NULL DEFAULT 750;

ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS customs_duty_class text;

-- Backfill happens via scripts/backfill-customs-duty.mts (committed
-- alongside this migration). It does a one-time title-keyword pass
-- to assign per_kg + class for all 166 active products.
--
-- Sanity constraints (defensive — backfill will keep us in range):
ALTER TABLE public.products
  ADD CONSTRAINT products_customs_duty_per_kg_check
  CHECK (customs_duty_per_kg >= 0 AND customs_duty_per_kg <= 50000);

CREATE INDEX IF NOT EXISTS idx_products_customs_duty_class
  ON public.products (customs_duty_class)
  WHERE customs_duty_class IS NOT NULL;

COMMENT ON COLUMN public.products.customs_duty_per_kg IS
  'Bangladesh air-cargo specific customs duty in ৳/kg. Computed by title keyword at insert; admin can override in the editor.';

COMMENT ON COLUMN public.products.customs_duty_class IS
  'Customs class label: cat-a, cat-b, sunglasses-c, smart-watch-c, bluetooth-c, etc. Set by auto-classifier; admin can override.';
