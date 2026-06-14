-- Migration 0027: rfqs (Request-for-Quote)
--
-- Phase 22: buyers can request quotes for things the catalog
-- can't fill (private-label runs, specific specs, quantities
-- the standard SKUs don't cover). An RFQ is open-ended
-- negotiation; a `quote` (table from 0001) is a price-locked
-- preview of a catalog cart.
--
-- Lifecycle:
--   open → quoted → accepted   (happy path)
--                 → rejected   (buyer passes; we log it for analytics)
--                 → cancelled  (buyer changes mind; admin unmarks)
--   open → rejected             (admin can't fulfill)
--   open → cancelled            (admin explicitly closes)
--
-- Schema:
--   - id:              bigserial — public-facing ID, e.g.
--                      "RFQ-000012" in the UI
--   - user_id:         auth.users FK CASCADE
--   - title:           short title (e.g. "Private-label
--                      cotton t-shirts, Gildan 5000 blank")
--   - spec_text:       free-form spec (materials, sizes, colors,
--                      branding, packaging). The buyer's
--                      must-fills.
--   - target_qty:      int — buyer's target quantity
--   - target_price_cny_fen:  bigint NULL — buyer's target
--                      factory FOB in CNY fen. Optional;
--                      "I don't have a target" is a valid
--                      answer.
--   - image_urls:      text[] — up to 4 reference photos
--                      (links to whatever the buyer has —
--                      Alibaba, Google Drive, WeChat screenshots).
--   - destination_country:  text 2-letter, default 'BD'
--   - notes:           text — free-form admin/buyer comments
--                      on the negotiation thread
--   - status:          open | quoted | accepted | rejected |
--                      cancelled
--   - quoted_price_cny_fen:  bigint NULL — admin's quoted FOB
--                      per-unit (set when status flips to
--                      'quoted')
--   - quoted_min_qty:  int NULL — admin's minimum order
--                      quantity for the quoted price
--   - quoted_lead_days: int NULL — admin's lead time estimate
--                      (factory production + ship prep)
--   - quoted_notes:    text NULL — admin's notes to the buyer
--                      (terms, payment, samples, etc.)
--   - quoted_at:       timestamptz NULL — when admin quoted
--   - closed_at:       timestamptz NULL — when status flipped
--                      to a terminal state
--   - admin_owner_id:  uuid NULL — admin user who picked up
--                      the RFQ (optional, for future
--                      assignment)
--   - timestamps
--
-- RLS:
--   - users SELECT their own rows
--   - users INSERT their own rows (no UPDATE — they can
--     comment via the notes field on a fresh follow-up, but
--     status is admin-driven)
--   - admins read/update everything via service-role
--
-- Indexes:
--   - btree (status, created_at desc) — "all open RFQs,
--     newest first" is the admin list page hot path
--   - btree (user_id, created_at desc) — buyer's own list

create table if not exists public.rfqs (
  id              bigserial primary key,
  user_id         uuid not null references auth.users(id) on delete cascade,
  title           text not null check (char_length(title) between 4 and 200),
  spec_text       text not null check (char_length(spec_text) between 10 and 4000),
  target_qty      int not null check (target_qty between 1 and 1_000_000),
  target_price_cny_fen  bigint
    check (target_price_cny_fen is null or target_price_cny_fen between 1 and 100_000_000),
  image_urls      text[] not null default '{}'::text[]
    check (array_length(image_urls, 1) <= 8),
  destination_country  text not null default 'BD'
    check (char_length(destination_country) = 2),
  notes           text check (notes is null or char_length(notes) <= 4000),

  status          text not null default 'open'
    check (status in ('open', 'quoted', 'accepted', 'rejected', 'cancelled')),

  -- Admin's quote payload. All three (price, min_qty, lead)
  -- are set together when status flips to 'quoted'.
  quoted_price_cny_fen  bigint
    check (quoted_price_cny_fen is null or quoted_price_cny_fen between 1 and 100_000_000),
  quoted_min_qty  int
    check (quoted_min_qty is null or quoted_min_qty between 1 and 1_000_000),
  quoted_lead_days int
    check (quoted_lead_days is null or quoted_lead_days between 1 and 365),
  quoted_notes    text check (quoted_notes is null or char_length(quoted_notes) <= 4000),
  quoted_at       timestamptz,
  closed_at       timestamptz,
  admin_owner_id  uuid references auth.users(id) on delete set null,

  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index if not exists rfqs_status_created_at_idx
  on public.rfqs (status, created_at desc);
create index if not exists rfqs_user_id_idx
  on public.rfqs (user_id, created_at desc);

-- updated_at trigger
drop trigger if exists rfqs_touch on public.rfqs;
create trigger rfqs_touch
  before update on public.rfqs
  for each row execute function public.set_updated_at();

-- Status-transition guard. Enforces "once terminal, can't
-- reopen" at the DB level (defense in depth — the API route
-- also validates, but two layers is better than one). The
-- trigger allows:
--   open → quoted | rejected | cancelled
--   quoted → accepted | rejected | cancelled
-- and rejects:
--   accepted | rejected | cancelled → anything
-- Plus: when transitioning to 'quoted', require all three
-- quote fields to be set. When transitioning to anything
-- terminal, stamp closed_at.
create or replace function public.rfqs_guard_transition()
returns trigger as $$
begin
  if old.status in ('accepted', 'rejected', 'cancelled') then
    raise exception 'rfq_terminal_state: status=% is terminal', old.status
      using errcode = 'P0001';
  end if;
  if new.status = 'quoted' then
    if new.quoted_price_cny_fen is null
       or new.quoted_min_qty is null
       or new.quoted_lead_days is null
    then
      raise exception 'rfq_quote_incomplete: must set price + min_qty + lead_days when status=quoted'
        using errcode = 'P0001';
    end if;
    if new.quoted_at is null then
      new.quoted_at = now();
    end if;
  end if;
  if new.status in ('accepted', 'rejected', 'cancelled') then
    if new.closed_at is null then
      new.closed_at = now();
    end if;
  end if;
  return new;
end;
$$ language plpgsql;

drop trigger if exists rfqs_guard on public.rfqs;
create trigger rfqs_guard
  before update on public.rfqs
  for each row when (old.status is distinct from new.status)
  execute function public.rfqs_guard_transition();

-- RLS
alter table public.rfqs enable row level security;

drop policy if exists "rfqs_select_own" on public.rfqs;
create policy "rfqs_select_own" on public.rfqs
  for select using (auth.uid() = user_id);

drop policy if exists "rfqs_insert_own" on public.rfqs;
create policy "rfqs_insert_own" on public.rfqs
  for insert with check (auth.uid() = user_id);

-- No UPDATE / DELETE for users. All mutations are service-role
-- (admin marks quoted / accepted / etc.).
