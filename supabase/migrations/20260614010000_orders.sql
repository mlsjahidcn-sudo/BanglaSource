-- Migration 0022: orders + order_items
--
-- Order placement flow. The buyer's cart is a request; an order
-- is a commit. We snapshot every product-shape field at order
-- time so admin markup changes can't re-price committed orders,
-- and so the buyer's invoice stays consistent even if a product
-- is later deactivated, deleted, or repriced.
--
-- Schema (orders):
--   - id:               bigserial, public-facing order number
--                       (we'll format as BS-000123 in the UI)
--   - user_id:          auth.users FK CASCADE
--   - status:           'pending_payment' | 'paid' | 'in_transit' |
--                       'delivered' | 'cancelled'
--   - shipping_mode:    'air' | 'sea' (copied from cart at checkout)
--   - product_subtotal_bdt:  FOB×FX + markup, all lines summed
--   - shipping_bdt:          air/sea charge (from cart at checkout)
--   - duty_bdt:              customs duty ৳/kg × weight, all lines
--   - vat_bdt:               15% × (CIF + duty)
--   - ait_bdt:               5% × CIF
--   - total_bdt:             product_subtotal + shipping + duty + vat + ait
--   - deposit_bdt:           70% of product_subtotal (the "pay now" amount)
--   - balance_bdt:           30% of product_subtotal (settles in Dhaka on delivery)
--   - deposit_paid_at:       timestamptz NULL until buyer marks deposit paid
--                           (we don't integrate bKash — they send to a
--                           personal number and mark it themselves)
--   - delivery_address_id:   FK to addresses (or NULL = "I'll give it to
--                           the courier on delivery")
--   - address_snapshot:     jsonb — full address text copied at order
--                           time so address edits don't change past orders
--   - buyer_note:            text — free-form, e.g. "deliver after 6pm"
--   - payment_method:        'bkash' | 'bank' | 'cod' | 'usdt'
--   - tracking_number:       text — courier tracking #, set by admin
--   - internal_note:         text — admin-only notes
--   - created_at, updated_at
--
-- Schema (order_items):
--   - id, order_id (FK CASCADE), product_id (FK SET NULL — product
--     deletion shouldn't take order history with it)
--   - qty
--   - title_snapshot, image_snapshot — denormalised for the order
--     detail page so deactivated products still show what was bought
--   - unit_cny_fen, fx_cny_to_bdt, markup_pct, weight_kg,
--     volume_cbm, category, customs_duty_per_kg — all locked at
--     order time
--   - unit_bdt:        unit_cny_fen × fx × (1 + markup_pct/100)
--   - line_bdt:        unit_bdt × qty
--   - line_duty_bdt:   weight_kg × qty × customs_duty_per_kg
--   - position:        int — for stable ordering in the UI
--
-- RLS:
--   - users see only their own orders + items
--   - no UPDATE / INSERT policies for users — all writes go
--     through the service-role /api/orders route

create table if not exists public.orders (
  id              bigserial primary key,
  user_id         uuid not null references auth.users(id) on delete cascade,
  status          text not null default 'pending_payment'
                    check (status in ('pending_payment', 'paid', 'in_transit', 'delivered', 'cancelled')),
  shipping_mode   text not null check (shipping_mode in ('air', 'sea')),

  -- Locked-at-time totals (BDT)
  product_subtotal_bdt  numeric(12, 2) not null,
  shipping_bdt          numeric(12, 2) not null,
  duty_bdt              numeric(12, 2) not null,
  vat_bdt               numeric(12, 2) not null,
  ait_bdt               numeric(12, 2) not null,
  total_bdt             numeric(12, 2) not null,
  deposit_bdt           numeric(12, 2) not null,
  balance_bdt           numeric(12, 2) not null,

  -- Payment state
  deposit_paid_at   timestamptz,
  payment_method    text not null check (payment_method in ('bkash', 'bank', 'cod', 'usdt')),

  -- Delivery
  -- (no FK to addresses yet — the /buyer/addresses page is a
  -- placeholder. We snapshot the full address as jsonb so
  -- future address edits don't rewrite past orders.)
  address_snapshot     jsonb,
  buyer_note           text,

  -- Admin
  tracking_number   text,
  internal_note     text,

  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index if not exists orders_user_id_idx on public.orders (user_id, created_at desc);
create index if not exists orders_status_idx on public.orders (status);

alter table public.orders enable row level security;

drop policy if exists "orders_select_own" on public.orders;
create policy "orders_select_own" on public.orders
  for select using (auth.uid() = user_id);

-- Buyers can self-mark deposit paid (pending_payment → paid).
-- All other status transitions (in_transit, delivered, cancelled)
-- are service-role only — admin will get an /api/admin/orders
-- route to flip those.
drop policy if exists "orders_mark_paid" on public.orders;
create policy "orders_mark_paid" on public.orders
  for update
  using (auth.uid() = user_id and status = 'pending_payment')
  with check (auth.uid() = user_id and status = 'paid');

-- No INSERT policy for users — orders are created via the
-- create_order_with_items RPC (service-role).

create table if not exists public.order_items (
  id              bigserial primary key,
  order_id        bigint not null references public.orders(id) on delete cascade,
  product_id      bigint references public.products(id) on delete set null,
  qty             int not null check (qty > 0),

  -- Locked snapshots — buyer sees these, not the live product
  title_snapshot    text not null,
  image_snapshot    text,
  unit_cny_fen      bigint not null,
  fx_cny_to_bdt     numeric(10, 4) not null,
  markup_pct        numeric(5, 2) not null,
  weight_kg         numeric(10, 4) not null,
  volume_cbm        numeric(10, 6) not null,
  category          text,
  customs_duty_per_kg  numeric(10, 2) not null default 0,

  -- Computed at order time, kept for invoice stability
  unit_bdt          numeric(12, 2) not null,
  line_bdt          numeric(12, 2) not null,
  line_duty_bdt     numeric(12, 2) not null default 0,

  position          int not null default 0
);

create index if not exists order_items_order_id_idx on public.order_items (order_id, position);

alter table public.order_items enable row level security;

drop policy if exists "order_items_select_via_order" on public.order_items;
create policy "order_items_select_via_order" on public.order_items
  for select using (
    exists (
      select 1 from public.orders o
      where o.id = order_items.order_id and o.user_id = auth.uid()
    )
  );

-- updated_at trigger
create or replace function public.orders_touch_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists orders_touch on public.orders;
create trigger orders_touch
  before update on public.orders
  for each row execute function public.orders_touch_updated_at();

-- Atomic order creation. We bundle order + items in one RPC so a
-- partial failure can't leave an order with no items. The function
-- is called by /api/orders via the service-role client (the
-- user_id is passed in explicitly and must match auth.uid() — the
-- route already validates that).
create or replace function public.create_order_with_items(
  p_user_id            uuid,
  p_shipping_mode      text,
  p_payment_method     text,
  p_product_subtotal_bdt  numeric,
  p_shipping_bdt       numeric,
  p_duty_bdt           numeric,
  p_vat_bdt            numeric,
  p_ait_bdt            numeric,
  p_total_bdt          numeric,
  p_deposit_bdt        numeric,
  p_balance_bdt        numeric,
  p_address_snapshot   jsonb,
  p_buyer_note         text,
  p_items              jsonb
) returns bigint
language plpgsql
security definer
as $$
declare
  v_order_id bigint;
  v_item jsonb;
begin
  insert into public.orders (
    user_id, shipping_mode, payment_method,
    product_subtotal_bdt, shipping_bdt, duty_bdt, vat_bdt, ait_bdt, total_bdt,
    deposit_bdt, balance_bdt,
    address_snapshot, buyer_note
  ) values (
    p_user_id, p_shipping_mode, p_payment_method,
    p_product_subtotal_bdt, p_shipping_bdt, p_duty_bdt, p_vat_bdt, p_ait_bdt, p_total_bdt,
    p_deposit_bdt, p_balance_bdt,
    p_address_snapshot, p_buyer_note
  )
  returning id into v_order_id;

  if v_order_id is null then
    raise exception 'order_insert_failed';
  end if;

  -- Insert each line item. We use jsonb_to_record to expand the
  -- incoming jsonb array into a rowset.
  for v_item in select * from jsonb_array_elements(p_items)
  loop
    insert into public.order_items (
      order_id, product_id, qty,
      title_snapshot, image_snapshot,
      unit_cny_fen, fx_cny_to_bdt, markup_pct,
      weight_kg, volume_cbm, category, customs_duty_per_kg,
      unit_bdt, line_bdt, line_duty_bdt, position
    ) values (
      v_order_id,
      (v_item->>'product_id')::bigint,
      (v_item->>'qty')::int,
      v_item->>'title_snapshot',
      v_item->>'image_snapshot',
      (v_item->>'unit_cny_fen')::bigint,
      (v_item->>'fx_cny_to_bdt')::numeric,
      (v_item->>'markup_pct')::numeric,
      (v_item->>'weight_kg')::numeric,
      (v_item->>'volume_cbm')::numeric,
      v_item->>'category',
      (v_item->>'customs_duty_per_kg')::numeric,
      (v_item->>'unit_bdt')::numeric,
      (v_item->>'line_bdt')::numeric,
      (v_item->>'line_duty_bdt')::numeric,
      (v_item->>'position')::int
    );
  end loop;

  return v_order_id;
end;
$$;

revoke all on function public.create_order_with_items(uuid, text, text, numeric, numeric, numeric, numeric, numeric, numeric, numeric, numeric, jsonb, text, jsonb) from public;
grant execute on function public.create_order_with_items(uuid, text, text, numeric, numeric, numeric, numeric, numeric, numeric, numeric, numeric, jsonb, text, jsonb) to service_role;
