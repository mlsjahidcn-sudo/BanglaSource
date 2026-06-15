-- 2026-06-15: drop the "jewelry" category
-- Hard delete: 1 product + 1 price_tier + 0 watchlist + 0 order_items.
-- Constraint is replaced with the 6-category set so any future row
-- can only be one of {gadgets, eyewear, shoes, bags, watches, beauty}.

-- 1. Delete the product. ON DELETE CASCADE handles price_tiers.
--    watchlist + order_items already had 0 rows for jewelry; verified.
delete from public.products
where category = 'jewelry';

-- 2. Replace the CHECK constraint.
alter table public.products
  drop constraint products_category_check;

alter table public.products
  add constraint products_category_check
  check (category = any (array[
    'gadgets'::text,
    'eyewear'::text,
    'shoes'::text,
    'bags'::text,
    'watches'::text,
    'beauty'::text
  ]));
