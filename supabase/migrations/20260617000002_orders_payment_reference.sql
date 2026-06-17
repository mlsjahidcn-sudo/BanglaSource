-- Migration 20260617000002_orders_payment_reference.sql
--
-- AUDIT FIX 2026-06-17 (C3): the /api/orders/[id]/paid endpoint
-- previously flipped orders to status='paid' based purely on a
-- buyer self-report (no payment verification). Until Phase 29
-- (real payment integration with bKash/Stripe webhook), the
-- closest mitigation is to require a `payment_reference` —
-- the bKash transaction ID, bank transfer reference, or similar
-- the buyer supplies at mark-paid time.
--
-- The admin can verify the reference against their bank/bKash
-- statement before marking the order `in_transit`. This is
-- the standard B2B flow (buyer self-reports → ops verifies).
--
-- Migration:
--   - Add nullable payment_reference text column (nullable
--     because: 1) existing orders don't have one, and 2) the
--     column will be set on every mark-paid going forward, but
--     older paid orders stay without it).
--   - No index — used for one-row lookup only (by order id).

alter table public.orders
  add column if not exists payment_reference text;