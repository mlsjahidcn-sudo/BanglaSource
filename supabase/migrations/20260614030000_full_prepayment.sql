-- Migration 0024: switch to full-prepayment model.
--
-- Until this point, the orders model was a 70/30 split:
--   - deposit_bdt = 70% of product_subtotal_bdt (paid at order confirm)
--   - balance_bdt = 30% of product_subtotal_bdt (settles in Dhaka on delivery)
--   - shipping + duty + VAT + AIT settled to the courier on delivery
--   - deposit_paid_at captured the moment the buyer tapped "I sent the deposit"
--
-- The new model is full-prepayment: the buyer pays 100% of the
-- landed cost at order confirm, and the full landed cost
-- (product + shipping + duty + VAT + AIT) is visible to the
-- buyer before they pay. There is no balance due on delivery.
--
-- Schema changes:
--   - payment_model         text — 'full_prepay' (default) or
--                              'deposit_balance' (legacy, kept
--                              for back-compat reads only)
--   - paid_at               timestamptz — when the buyer marked
--                              the order paid (renamed from
--                              deposit_paid_at because "deposit"
--                              no longer describes what was paid)
--   - deposit_bdt           semantics now: "amount paid at order
--                              confirm". In full_prepay mode this
--                              equals total_bdt; in legacy
--                              deposit_balance mode it equals
--                              70% of product_subtotal.
--   - balance_bdt           semantics now: "amount due on
--                              delivery". In full_prepay mode
--                              this is 0; in legacy mode it's
--                              30% of product_subtotal.
--
-- We don't drop the old columns because (a) we want the
-- create_order_with_items RPC signature to stay stable across
-- the migration, and (b) historical order rows (if any) need
-- their existing values preserved for invoice stability.
--
-- The RLS update policy stays the same: the buyer can flip
-- pending_payment → paid, no other transition.

alter table public.orders
  add column if not exists payment_model text not null default 'full_prepay'
    check (payment_model in ('full_prepay', 'deposit_balance'));

-- Rename deposit_paid_at → paid_at (keeping the old column as a
-- read-only mirror so the API can still select it during the
-- transition).
do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'orders' and column_name = 'deposit_paid_at'
  ) and not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'orders' and column_name = 'paid_at'
  ) then
    alter table public.orders rename column deposit_paid_at to paid_at;
  end if;
end $$;

-- Backfill payment_model for any pre-existing orders that have
-- a non-zero balance_bdt (the legacy 70/30 model).
update public.orders
  set payment_model = 'deposit_balance'
  where balance_bdt > 0 and payment_model = 'full_prepay';

-- Comment for the new semantics
comment on column public.orders.deposit_bdt is
  'Amount paid at order confirm. In full_prepay mode this equals total_bdt. In legacy deposit_balance mode it was 70% of product_subtotal.';
comment on column public.orders.balance_bdt is
  'Amount due on delivery. 0 in full_prepay mode. 30% of product_subtotal in legacy deposit_balance mode.';
comment on column public.orders.paid_at is
  'When the buyer marked the order paid. Replaces the old deposit_paid_at column (renamed for clarity in Phase 13).';
comment on column public.orders.payment_model is
  'Payment model: full_prepay (default — buyer pays 100% of landed cost upfront) or deposit_balance (legacy 70/30, kept for back-compat).';
