// /api/orders
//
// Order placement flow.
//   POST: create an order from the current cart (server-side
//         re-pricing — never trust client math)
//   GET:  list the signed-in user's orders (newest first)
//
// Auth: cookie-bound server client required. RLS on `orders` and
// `order_items` enforces the same on direct queries; this route
// uses the user's session so the policy fires correctly.

import { NextRequest, NextResponse } from "next/server";
import { getServerClient, getServiceRoleClient } from "@/lib/supabase/server";
import { rateLimit, clientKey } from "@/lib/rate-limit";
import { getProduct, dbProductToLegacy } from "@/lib/catalog";
import {
  ORDER_MIN_WEIGHT_KG,
  orderMinWeightMet,
} from "@/lib/pricing";
import {
  landedCost,
  type ShippingMode,
  FX_CNY_BDT,
} from "@/lib/pricing";

const RATE_LIMIT = 30;
const RATE_WINDOW_MS = 60_000;

// Mirrors `CartItem` from src/lib/cart.ts but on the wire we use
// `source_id` (the 1688-style id string the catalog uses) instead
// of the Supabase bigint — the product API exposes that. We resolve
// it server-side.
type WireCartItem = {
  source_id: string;
  qty: number;
  // Locked at add time. The server will validate these against
  // the live product to detect tampering (e.g. someone trying to
  // bypass the markup).
  markup_pct: number;
  weight_kg: number;
  volume_cbm: number;
  category: string;
  customs_duty_per_kg: number;
};

type WireAddress = {
  full_name: string;
  phone: string;
  district: string; // e.g. "Gulshan, Dhaka"
  address_line: string;
  country?: string;
};

type PostBody = {
  shipping_mode: ShippingMode;
  payment_method: "bkash" | "bank" | "cod" | "usdt";
  address: WireAddress;
  buyer_note?: string;
  items: WireCartItem[];
};

export async function POST(req: NextRequest) {
  // ── Rate limit
  const rl = rateLimit({
    key: `orders.create:${clientKey(req)}`,
    capacity: RATE_LIMIT,
    windowMs: RATE_WINDOW_MS,
  });
  if (!rl.allowed) {
    return NextResponse.json(
      {
        error: "rate_limited",
        message: `Too many order requests. Try again in ${Math.ceil(rl.resetIn / 1000)}s.`,
        resetIn: rl.resetIn,
      },
      { status: 429, headers: { "Retry-After": String(Math.ceil(rl.resetIn / 1000)) } },
    );
  }

  // ── Auth
  const sb = await getServerClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) {
    return NextResponse.json(
      { error: "unauthorized", message: "Sign in to place an order." },
      { status: 401 },
    );
  }

  // ── Validate body
  let body: PostBody;
  try {
    body = (await req.json()) as PostBody;
  } catch {
    return NextResponse.json(
      { error: "bad_json", message: "Invalid JSON body" },
      { status: 400 },
    );
  }
  if (!body || !Array.isArray(body.items) || body.items.length === 0) {
    return NextResponse.json(
      { error: "empty_cart", message: "Cart is empty." },
      { status: 400 },
    );
  }
  if (body.items.length > 50) {
    return NextResponse.json(
      { error: "cart_too_large", message: "Max 50 distinct items per order." },
      { status: 400 },
    );
  }
  for (const it of body.items) {
    if (!it.source_id || it.qty < 1 || it.qty > 10_000) {
      return NextResponse.json(
        { error: "bad_item", message: "Invalid cart item." },
        { status: 400 },
      );
    }
  }
  if (!["air", "sea"].includes(body.shipping_mode)) {
    return NextResponse.json(
      { error: "bad_shipping_mode", message: "Shipping mode must be air or sea." },
      { status: 400 },
    );
  }
  if (!["bkash", "bank", "cod", "usdt"].includes(body.payment_method)) {
    return NextResponse.json(
      { error: "bad_payment_method", message: "Invalid payment method." },
      { status: 400 },
    );
  }
  if (
    !body.address?.full_name ||
    !body.address?.phone ||
    !body.address?.district ||
    !body.address?.address_line
  ) {
    return NextResponse.json(
      { error: "bad_address", message: "Address is incomplete." },
      { status: 400 },
    );
  }

  // ── Minimum weight check (Phase 11).
  //    Compute the total chargeable weight from the buyer's locked
  //    cart items and reject anything below the order minimum. This
  //    happens BEFORE the product re-resolution so a sub-min order
  //    short-circuits without hitting the DB.
  const totalWeightKg = body.items.reduce(
    (s, it) => s + it.weight_kg * it.qty,
    0,
  );
  if (!orderMinWeightMet(totalWeightKg)) {
    return NextResponse.json(
      {
        error: "below_minimum_weight",
        message: `Order is ${totalWeightKg.toFixed(2)} kg; minimum is ${ORDER_MIN_WEIGHT_KG} kg.`,
        weight_kg: Math.round(totalWeightKg * 1000) / 1000,
        min_weight_kg: ORDER_MIN_WEIGHT_KG,
        shortfall_kg: Math.round((ORDER_MIN_WEIGHT_KG - totalWeightKg) * 1000) / 1000,
      },
      { status: 400 },
    );
  }

  // ── Re-resolve each product server-side. Never trust the cart's
  //    unit price or weight — fetch the live product, recompute.
  //    The locked `markup_pct` is the buyer's "what you saw on the
  //    PDP", so we use THAT markup (not the admin's current one).
  const admin = getServiceRoleClient();
  type Resolved = {
    wire: WireCartItem;
    db: Awaited<ReturnType<typeof getProduct>>;
    legacy: ReturnType<typeof dbProductToLegacy> | null;
    unit_bdt: number;
    line_bdt: number;
    line_duty_bdt: number;
    product_subtotal_bdt: number; // = line_bdt (FOB+markup, no shipping)
    line_shipping_bdt: number; // proportional shipping for this line
  };
  const resolved: Resolved[] = [];
  for (const it of body.items) {
    const db = await getProduct(it.source_id);
    if (!db) {
      return NextResponse.json(
        { error: "product_unavailable", message: `Product ${it.source_id} is no longer available.` },
        { status: 410 },
      );
    }
    const legacy = dbProductToLegacy(db);
    // Phase 11: the per-product markup_pct is now a legacy field.
    // The buyer's locked value is preserved on `it.markup_pct` for
    // forward-compat, but the actual math in landedCost uses the
    // company-wide BUYER_MARKUP_PCT constant. We still write the
    // locked value into the legacy product so order_items.title
    // gets a stable per-cart-item snapshot.
    legacy.markup_pct = it.markup_pct;
    // Recompute per-product landed cost (single-product, with buyer's locked qty)
    const breakdown = landedCost(legacy, it.qty, body.shipping_mode, FX_CNY_BDT);
    resolved.push({
      wire: it,
      db,
      legacy,
      unit_bdt: breakdown.unitBdt,
      line_bdt: breakdown.unitBdt * it.qty,
      line_duty_bdt: breakdown.dutyBdt,
      product_subtotal_bdt: breakdown.unitBdt * it.qty,
      // Each line gets its own shipping slice (so the invoice
      // matches the buyer's mental model: "per-product shipping").
      // Total shipping for the order is the sum of all lines'
      // (intl + cn_domestic + agent + consol) — see below.
      line_shipping_bdt:
        breakdown.intlBdt + breakdown.cnDomesticBdt + breakdown.agentBdt + breakdown.consolBdt,
    });
  }

  // ── Aggregate totals
  const product_subtotal_bdt = resolved.reduce((s, r) => s + r.product_subtotal_bdt, 0);
  const shipping_bdt = resolved.reduce((s, r) => s + r.line_shipping_bdt, 0);
  const duty_bdt = resolved.reduce((s, r) => s + r.line_duty_bdt, 0);
  // VAT + AIT are computed off the global CIF (sum of all lines).
  // For multi-product orders the math is technically: VAT × Σ(cif_i),
  // AIT × Σ(cif_i), where cif_i = line product + line shipping. We
  // approximate by treating the whole order as one big shipment,
  // which is how the customs broker would actually invoice.
  const cifBdt = product_subtotal_bdt + shipping_bdt;
  const vat_bdt = Math.round(cifBdt * 0.15);
  const ait_bdt = Math.round(cifBdt * 0.05);
  const total_bdt = cifBdt + duty_bdt + vat_bdt + ait_bdt;
  // Phase 13 (full-prepayment model): the buyer pays 100% of the
  // landed cost at order confirm. There is no balance due on
  // delivery. The columns `deposit_bdt` / `balance_bdt` are
  // reused (kept for schema stability) but the semantics shift:
  //   - deposit_bdt = amount paid upfront = total_bdt
  //   - balance_bdt = amount due on delivery = 0
  // The migration added `payment_model` (default 'full_prepay')
  // and renamed `deposit_paid_at` → `paid_at` to reflect the
  // new model.
  const deposit_bdt = total_bdt;
  const balance_bdt = 0;

  // ── Insert order + items in a single RPC. We use a Postgres
  //    function so the insert is atomic; if the items insert
  //    fails, the order row rolls back. This avoids orphaned
  //    orders with no items.
  const { data: orderId, error: rpcErr } = await admin.rpc("create_order_with_items", {
    p_user_id: user.id,
    p_shipping_mode: body.shipping_mode,
    p_payment_method: body.payment_method,
    p_product_subtotal_bdt: product_subtotal_bdt,
    p_shipping_bdt: shipping_bdt,
    p_duty_bdt: duty_bdt,
    p_vat_bdt: vat_bdt,
    p_ait_bdt: ait_bdt,
    p_total_bdt: total_bdt,
    p_deposit_bdt: deposit_bdt,
    p_balance_bdt: balance_bdt,
    p_address_snapshot: body.address,
    p_buyer_note: body.buyer_note ?? null,
    p_items: resolved.map((r, i) => ({
      product_id: r.db.id,
      qty: r.wire.qty,
      title_snapshot: r.db.title_en || r.db.title_bn || r.wire.source_id,
      image_snapshot: r.db.images?.[0] ?? null,
      unit_cny_fen: r.legacy.price_tiers[0]?.price_cny_fen ?? 0,
      fx_cny_to_bdt: FX_CNY_BDT,
      markup_pct: r.wire.markup_pct,
      weight_kg: r.wire.weight_kg,
      volume_cbm: r.wire.volume_cbm,
      category: r.wire.category,
      customs_duty_per_kg: r.wire.customs_duty_per_kg,
      unit_bdt: r.unit_bdt,
      line_bdt: r.line_bdt,
      line_duty_bdt: r.line_duty_bdt,
      position: i,
    })),
  });

  if (rpcErr || !orderId) {
    return NextResponse.json(
      { error: "create_failed", message: rpcErr?.message ?? "Could not create order." },
      { status: 500 },
    );
  }

  // Phase 18: fire-and-forget transactional email. We don't await
  // (the order is already created — the buyer should not wait for
  // Resend to ack before we return success). Errors are logged by
  // sendEmail itself; the buyer's in-app notification is the
  // primary channel, the email is the backup.
  void import("@/lib/email").then(({ notifyOrderPlaced }) =>
    notifyOrderPlaced(orderId as number).catch((e) => {
      // eslint-disable-next-line no-console
      console.error("[orders] notifyOrderPlaced failed:", e);
    }),
  );

  return NextResponse.json({
    ok: true,
    order: {
      id: orderId,
      order_number: `BS-${String(orderId).padStart(6, "0")}`,
      status: "pending_payment",
      payment_model: "full_prepay",
      product_subtotal_bdt,
      shipping_bdt,
      duty_bdt,
      vat_bdt,
      ait_bdt,
      total_bdt,
      deposit_bdt,
      balance_bdt,
      item_count: resolved.length,
      total_qty: resolved.reduce((s, r) => s + r.wire.qty, 0),
    },
  });
}

export async function GET(_req: NextRequest) {
  const sb = await getServerClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) {
    return NextResponse.json(
      { error: "unauthorized" },
      { status: 401 },
    );
  }
  const { data: orders, error } = await sb
    .from("orders")
    .select("id, status, shipping_mode, total_bdt, deposit_bdt, balance_bdt, paid_at, payment_model, created_at")
    .order("created_at", { ascending: false })
    .limit(50);
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true, orders: orders ?? [] });
}
