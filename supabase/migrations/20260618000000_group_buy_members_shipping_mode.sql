-- 20260618000000_group_buy_members_shipping_mode.sql
--
-- Phase 41 — let buyers pick their preferred shipping mode (air,
-- sea, express) per group buy commitment. The formation cron
-- (2026-06-18, src/lib/group-buy-cron.ts runFormationPass) reads
-- this column instead of hard-coding 'air'. Default 'air' for
-- back-compat with all rows written by Phases 36-40.

alter table public.group_buy_members
  add column if not exists shipping_mode text not null default 'air';

-- CHECK constraint: same enum as orders.shipping_mode. Idempotent
-- so re-running the migration is safe.
do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'group_buy_members_shipping_mode_check'
  ) then
    alter table public.group_buy_members
      add constraint group_buy_members_shipping_mode_check
      check (shipping_mode in ('air', 'sea', 'express'));
  end if;
end $$;