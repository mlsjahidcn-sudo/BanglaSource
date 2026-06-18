-- Migration 0010: Restructure categories to 7-cat public catalog
-- ──────────────────────────────────────────────────────────────
-- Old: apparel, electronics, jewelry, home, beauty, toys, automotive
-- New: gadgets, eyewear, shoes, bags, watches, beauty, jewelry
--
-- Notes:
--   * "electronics" → "gadgets" (renamed in place)
--   * "jewelry" stays as-is; watches were a subcategory of jewelry before,
--     they're now their own top-level category. The 1 existing jewelry
--     product is a bracelet, stays in jewelry.
--   * "apparel", "toys", "home", "automotive" are removed entirely.
--     All their products are deleted. price_tiers / price_history /
--     price_alert_log cascade-delete. discovered_products are orphan
--     (product_id IS NULL for all 22) so we wipe them too.

BEGIN;

-- 1) Widen the check constraint to a list that includes the new categories
--    alongside the old ones. We'll narrow it after migration.
ALTER TABLE products
  DROP CONSTRAINT products_category_check;
ALTER TABLE products
  ADD CONSTRAINT products_category_check
  CHECK (category = ANY (ARRAY[
    'apparel','electronics','jewelry','home','beauty','toys','automotive',
    'gadgets','eyewear','shoes','bags','watches'
  ]));

-- 2) Reclassify existing rows
--    electronics → gadgets (the 56 products in there are all true gadgets:
--    TWS earbuds, MagSafe chargers, cables, phone cases — no smartwatches)
UPDATE products SET category = 'gadgets' WHERE category = 'electronics';

-- 3) Wipe categories that are leaving the public catalog
DELETE FROM discovered_products;            -- 22 orphan queue items
DELETE FROM products WHERE category IN ('apparel','toys','home','automotive');

-- 4) Tighten the check constraint to ONLY the new 7-category set
ALTER TABLE products
  DROP CONSTRAINT products_category_check;
ALTER TABLE products
  ADD CONSTRAINT products_category_check
  CHECK (category = ANY (ARRAY[
    'gadgets','eyewear','shoes','bags','watches','beauty','jewelry'
  ]));

COMMIT;
