-- Migration 0025b: extend create_order_with_items RPC to accept p_address_id
--
-- Phase 19: now that buyers can save addresses, the order
-- placement RPC needs to record the source address_id (FK to
-- the new addresses table). The address_snapshot (jsonb)
-- remains the source of truth for the order itself.
--
-- We DROP and RECREATE the function because Postgres doesn't
-- support changing function signatures in place. The old
-- signature's grants are revoked automatically when the
-- function is dropped, but we re-grant for safety.

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
  p_address_id         bigint,  -- NEW: FK to public.addresses, nullable
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
    address_id, address_snapshot, buyer_note
  ) values (
    p_user_id, p_shipping_mode, p_payment_method,
    p_product_subtotal_bdt, p_shipping_bdt, p_duty_bdt, p_vat_bdt, p_ait_bdt, p_total_bdt,
    p_deposit_bdt, p_balance_bdt,
    p_address_id, p_address_snapshot, p_buyer_note
  )
  returning id into v_order_id;

  if v_order_id is null then
    raise exception 'order_insert_failed';
  end if;

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

-- The function was originally granted only to service_role (not
-- the anon/authenticated roles). Drop+recreate wipes the old
-- grant, so we re-grant for safety. PUBLIC access is denied
-- because `revoke all ... from public` ran in the original
-- migration; we re-assert that here.
revoke all on function public.create_order_with_items(
  uuid, text, text,
  numeric, numeric, numeric, numeric, numeric, numeric, numeric, numeric,
  bigint, jsonb, text, jsonb
) from public;
grant execute on function public.create_order_with_items(
  uuid, text, text,
  numeric, numeric, numeric, numeric, numeric, numeric, numeric, numeric,
  bigint, jsonb, text, jsonb
) to service_role;
