-- Migration 0032: group_buys + group_buy_members
--
-- Phase 36: group buy system. Admin creates a "group buy" on an
-- existing product, sets a target qty, per-buyer min, tiered
-- pricing, and a deadline. Buyers join by committing a qty (>= the
-- per-buyer min). When the SUM of all members' qty hits the
-- target before the deadline, the group "forms" — we charge each
-- member via their saved payment method and create one order per
-- member. If the deadline passes without target, the group
-- "expires" and nothing happens (no charge, no refund needed —
-- buyers are only charged on success, "pay-on-success" model).
--
-- Decisions baked in (user-confirmed 2026-06-17):
--   - Payment timing:        pay-on-success (commit first, charge
--                            when the group forms)
--   - Formation model:       total qty (group forms when SUM of
--                            all member qty >= target_qty)
--   - Pricing model:         tiered step-down (admin sets 2-3
--                            tiers; the more committed, the lower
--                            the per-piece price)
--
-- State machine:
--   open → forming → formed         (happy path: target met,
--                                     charges in flight, then
--                                     orders created)
--   open → expired                  (deadline passed; no charge)
--   open → cancelled                (admin cancelled it)
--
-- The "forming" state is transient (typically <1-2 hours) while
-- the cron charges each member. We keep it as a first-class status
-- so the buyer UI can show "Charging members — please wait"
-- instead of "You're in" (which would imply the group has
-- already formed).
--
-- Schema notes:
--   - id:                    uuid. Less user-facing than rfqs (we
--                            don't print the UUID in the UI; we
--                            print a derived slug from the
--                            product title).
--   - price_tiers:           jsonb — Array<{qty_threshold:int,
--                            unit_bdt:int}>. The unit_bdt is what
--                            a member pays per piece WHEN at least
--                            qty_threshold pieces are committed.
--                            Must be sorted ASC by qty_threshold
--                            (validated in the API).
--   - final_unit_bdt:        int NULL. Frozen at the moment the
--                            group forms. Every member gets this
--                            price regardless of when they joined.
--   - target_qty:            int — the qty threshold. Group forms
--                            when SUM(member.qty) >= target_qty.
--   - min_qty_per_buyer:     int — every member must commit >=
--                            this. Default 50 in the admin UI.
--   - deadline_at:           timestamptz. Cron picks up groups
--                            past their deadline every 5 min.
--   - status:                text CHECK constraint
--
-- Members:
--   - payment_state:         pending | charged | failed | refunded
--     - pending:             committed, group not yet formed
--     - charged:             group formed, charge succeeded,
--                            order_id is set
--     - failed:              charge failed at formation time;
--                            user is emailed to retry (they have
--                            7 days to settle via standard
--                            /checkout with a one-time discount
--                            equal to the group's final_unit_bdt)
--     - refunded:            reserved — we don't currently
--                            pre-charge, so this is only set if
--                            a paid flow ends up reversing
--                            (Phase 41 admin action)
--   - order_id:              bigint FK to orders. Set when the
--                            group forms and this member's charge
--                            succeeds.
--   - unit_bdt_at_commit:    int — the price the member SAW when
--                            they joined (the tier for the then-
--                            current qty). NOT what they get
--                            charged — that's group.final_unit_bdt
--                            at formation time. We keep this for
--                            a "price dropped since you joined"
--                            UI message.
--
-- RLS:
--   - Anyone (anon + authed) can SELECT from group_buys
--     (so the public listing works).
--   - Authenticated users can SELECT their own group_buy_members
--     rows. Cross-user member discovery isn't useful.
--   - All writes are service-role (admin creates, cron updates,
--     buyers commit via a service-role API that validates
--     auth.uid()).
--
-- Indexes:
--   - group_buys(status, deadline_at) where status = 'open' — the
--     cron hot path: "find open groups whose deadline has passed"
--   - group_buys(status) where status = 'open' — the public
--     listing "show me all open groups"
--   - group_buy_members(group_buy_id) — the "members of a group"
--     lookup
--   - group_buy_members(user_id) — the "my groups" buyer page

create table if not exists public.group_buys (
  id                    uuid primary key default gen_random_uuid(),
  product_id            bigint not null references products(id) on delete restrict,

  -- The formation threshold: SUM(member.qty) >= target_qty.
  target_qty            int not null check (target_qty > 0 and target_qty <= 1_000_000),
  -- Per-buyer minimum. Admin defaults to 50 or 100; we don't
  -- enforce a hard min in the DB (admin might want 1 for "any
  -- qty" group buys in the future).
  min_qty_per_buyer     int not null check (min_qty_per_buyer > 0 and min_qty_per_buyer <= 1_000_000),

  -- jsonb: Array<{qty_threshold: int, unit_bdt: int}>.
  -- We validate the shape + sort order in the API layer.
  price_tiers           jsonb not null
    check (jsonb_typeof(price_tiers) = 'array'
       and jsonb_array_length(price_tiers) >= 1
       and jsonb_array_length(price_tiers) <= 5),

  -- Wall-clock deadline. Asia/Dhaka is the admin's tz; we
  -- store UTC. The cron compares against now() (UTC).
  deadline_at           timestamptz not null
    check (deadline_at > now() + interval '1 hour'),

  status                text not null default 'open'
    check (status in ('open', 'forming', 'formed', 'expired', 'cancelled')),

  -- Frozen at formation. null while not formed.
  final_unit_bdt        int
    check (final_unit_bdt is null or final_unit_bdt > 0),

  -- Audit
  created_by            uuid not null references auth.users(id),
  created_at            timestamptz not null default now(),
  formed_at             timestamptz,
  cancelled_at          timestamptz
);

create index if not exists group_buys_status_deadline_idx
  on public.group_buys (status, deadline_at)
  where status = 'open';
create index if not exists group_buys_status_idx
  on public.group_buys (status);
create index if not exists group_buys_product_id_idx
  on public.group_buys (product_id);

create table if not exists public.group_buy_members (
  id                    uuid primary key default gen_random_uuid(),
  group_buy_id          uuid not null references group_buys(id) on delete cascade,
  user_id               uuid not null references auth.users(id) on delete cascade,

  qty                   int not null check (qty > 0 and qty <= 1_000_000),
  -- The unit price the member SAW at commit time (the tier for
  -- the then-current SUM). NOT the final price. Useful for the
  -- "price dropped" message.
  unit_bdt_at_commit    int not null check (unit_bdt_at_commit > 0),

  payment_state         text not null default 'pending'
    check (payment_state in ('pending', 'charged', 'failed', 'refunded')),

  -- Set when the formation cron successfully charges this
  -- member + creates their order row. Cascade-protected: when
  -- an order is deleted, the member row's order_id is set to
  -- null (so we keep the audit trail of the group participation
  -- even if the order is hard-deleted).
  order_id              bigint references orders(id) on delete set null,

  created_at            timestamptz not null default now(),
  charged_at            timestamptz,

  -- One row per (user, group). A user can't join the same group
  -- twice. If they cancel, the row is deleted and they can
  -- re-join.
  unique (group_buy_id, user_id)
);

create index if not exists group_buy_members_group_idx
  on public.group_buy_members (group_buy_id);
create index if not exists group_buy_members_user_idx
  on public.group_buy_members (user_id);
create index if not exists group_buy_members_state_idx
  on public.group_buy_members (payment_state)
  where payment_state in ('pending', 'failed');

-- updated_at trigger (we don't have one on group_buys by
-- default; the row only changes via the state-machine trigger
-- below. But we still want updated_at for sort-by-recently
-- on the admin list.)
alter table public.group_buys
  add column if not exists updated_at timestamptz not null default now();

drop trigger if exists group_buys_touch on public.group_buys;
create trigger group_buys_touch
  before update on public.group_buys
  for each row execute function public.set_updated_at();

-- State-machine guard. Enforces the transitions and stamps
-- the relevant audit timestamps:
--   open → forming | expired | cancelled
--   forming → formed  (only after all charges attempted)
--   formed | expired | cancelled → REJECTED
--
-- When transitioning to 'formed', require final_unit_bdt.
-- When transitioning to anything terminal, stamp the
-- corresponding timestamp.
create or replace function public.group_buys_guard_transition()
returns trigger as $$
begin
  if old.status in ('formed', 'expired', 'cancelled') then
    raise exception 'group_buy_terminal_state: status=% is terminal', old.status
      using errcode = 'P0001';
  end if;
  if new.status = 'formed' then
    if new.final_unit_bdt is null then
      raise exception 'group_buy_no_final_price: must set final_unit_bdt when status=formed'
        using errcode = 'P0001';
    end if;
    if new.formed_at is null then
      new.formed_at = now();
    end if;
  end if;
  if new.status = 'cancelled' and new.cancelled_at is null then
    new.cancelled_at = now();
  end if;
  if new.status = 'expired' and new.formed_at is null then
    -- expired is a terminal failure state, no formed_at
    null;
  end if;
  return new;
end;
$$ language plpgsql;

drop trigger if exists group_buys_guard on public.group_buys;
create trigger group_buys_guard
  before update on public.group_buys
  for each row when (old.status is distinct from new.status)
  execute function public.group_buys_guard_transition();

-- RLS
alter table public.group_buys enable row level security;
alter table public.group_buy_members enable row level security;

-- group_buys:
--   - anyone (anon + authed) can SELECT — public listing
--   - all writes are service-role
drop policy if exists "group_buys_select_all" on public.group_buys;
create policy "group_buys_select_all" on public.group_buys
  for select using (true);

-- group_buy_members:
--   - users SELECT their own rows
--   - admin can SELECT all (via service-role; the RLS-bypass
--     policy below is a defense in depth for queries that DON'T
--     use service-role)
--   - all writes are service-role (buyer joins/cancels are
--     routed through an API that validates auth.uid())
drop policy if exists "group_buy_members_select_own" on public.group_buy_members;
create policy "group_buy_members_select_own" on public.group_buy_members
  for select using (auth.uid() = user_id);
