-- Migration 0004: Make price_tiers.qty_max nullable
--
-- Why: Apify 1688 scraper returns "≥500个" style tiers with no upper bound.
-- The DB schema previously required qty_max NOT NULL, so the sync
-- crashed on the very first live run.
--
-- This is a safe forward-only change: existing rows have integer values,
-- only new rows from the scraper will use NULL.

begin;

alter table public.price_tiers
  alter column qty_max drop not null;

-- The check (qty_max >= qty_min) still works when qty_max is NULL
-- (Postgres skips NULL comparisons in CHECK constraints by default).

-- Recreate the unique constraint to also support the "one row per
-- (product_id, qty_min) with possibly NULL qty_max" case. Already
-- (product_id, qty_min) — works fine with NULL on qty_max.

commit;
