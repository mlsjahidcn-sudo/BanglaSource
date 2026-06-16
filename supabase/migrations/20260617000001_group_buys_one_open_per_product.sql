-- Migration 20260617000001: enforce "one open group buy per product"
--
-- C2 audit fix (2026-06-17): without this index, an admin can create
-- multiple simultaneous 'open' group buys for the same product_id. A
-- buyer then sees two parallel offers ("Group A: ৳450/pc, target 1000"
-- AND "Group B: ৳420/pc, target 2000") and has no way to know which
-- to join. The two would also fight over formation cron, share member
-- rows that aren't supposed to be shared, and confuse the public
-- listing's sort-by-deadline.
--
-- Fix: a partial UNIQUE index on product_id WHERE status = 'open'.
-- The DB enforces it atomically; the API catches the 23505 unique-
-- violation and returns a clean 409 with the actionable message
-- "product X already has an open group buy (id Y) — cancel or wait
-- for it to expire first".
--
-- Why a partial index, not a full UNIQUE constraint:
--   - When a group buy is 'cancelled' or 'expired', it's terminal.
--     The admin should be free to launch a new one for the same
--     product after the old one ends. A full UNIQUE would block
--     that forever.
--   - When 'forming' or 'formed', the group is locked anyway (the
--     trigger forbids re-opening), so we don't strictly need the
--     index to fire on those states. The 'open' partial is enough.
--
-- Backfill: 0 rows currently exist (test cleanup deleted them), so
-- no deduplication needed. If this index is ever added to a DB with
-- existing duplicates, Postgres will refuse to create it and report
-- the offending rows — the operator must cancel/expire them first.

create unique index if not exists group_buys_one_open_per_product_idx
  on public.group_buys (product_id)
  where status = 'open';
