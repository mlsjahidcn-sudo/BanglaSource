-- Migration 0023: lock all products to 10% markup
--
-- Phase 11: the company has a flat 10% buyer markup. The per-product
-- `markup_pct` column stays in the schema (admin used to be able to
-- override it) but we lock every existing row to 10 and remove the
-- admin UI for changing it. Pricing math now reads the constant
-- BUYER_MARKUP_PCT from src/lib/pricing.ts and ignores this column.
--
-- The column itself is kept so we don't need a destructive ALTER
-- (which would break any in-flight data import, the admin schema
-- introspection, and existing orders' order_items.markup_pct
-- snapshots). It's just always 10 now.

update public.products
set markup_pct = 10
where markup_pct is null or markup_pct <> 10;

-- Sanity check: every row should now be 10.
do $$
declare
  bad_rows int;
begin
  select count(*) into bad_rows
  from public.products
  where markup_pct is null or markup_pct <> 10;
  if bad_rows > 0 then
    raise warning 'Migration 0023: % rows still have non-10 markup_pct', bad_rows;
  end if;
end $$;
