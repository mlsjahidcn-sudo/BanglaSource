-- Migration 20260617000003_group_buy_members_guards.sql
--
-- Phase 38 (buyer commit flow). Adds DB-level cross-row guards on
-- group_buy_members INSERT/UPDATE so a buggy API (or direct DB write
-- via service-role) can't bypass the per-group rules:
--
--   1. member.qty >= group_buys.min_qty_per_buyer
--      Admin sets a per-buyer minimum. The trigger enforces it
--      at write time so the partial unique index + this guard
--      make it impossible to insert a member row with too-few
--      pieces, regardless of where the insert came from.
--
--   2. group_buys.status = 'open' at insert time
--      Once a group is 'forming'/'formed'/'expired'/'cancelled',
--      no NEW members can join. The trigger rejects with the
--      same error code pattern as the existing state machine
--      trigger (P0001) so the API can map it to a 409.
--
-- The API (POST /api/group-buys/[id]/join) does both checks
-- client-side; the trigger is defense-in-depth.
--
-- Cancel is handled differently: when a buyer cancels their own
-- membership, we just DELETE the row. The group's status doesn't
-- change (other members may still be active). No trigger needed
-- for that path.

create or replace function public.group_buy_members_insert_guard()
returns trigger as $$
declare
  v_min_qty_per_buyer int;
  v_status            text;
begin
  select min_qty_per_buyer, status
    into v_min_qty_per_buyer, v_status
    from public.group_buys
    where id = new.group_buy_id;

  if not found then
    raise exception 'group_buy_members_orphan_group: group_buy % not found',
      new.group_buy_id using errcode = 'P0002';
  end if;

  if v_status <> 'open' then
    raise exception 'group_buy_not_open: status=% is not joinable', v_status
      using errcode = 'P0001';
  end if;

  if new.qty < v_min_qty_per_buyer then
    raise exception 'group_buy_member_qty_below_min: % < min_qty_per_buyer %',
      new.qty, v_min_qty_per_buyer
      using errcode = 'P0001';
  end if;

  return new;
end;
$$ language plpgsql;

drop trigger if exists group_buy_members_guard on public.group_buy_members;
create trigger group_buy_members_guard
  before insert on public.group_buy_members
  for each row execute function public.group_buy_members_insert_guard();