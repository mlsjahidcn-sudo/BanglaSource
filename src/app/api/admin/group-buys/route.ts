// /api/admin/group-buys
//
// Phase 37. POST creates a new group_buy row. GET is intentionally
// NOT here — the list page is server-rendered against the service
// role directly, no client-side fetch needed.
//
// Auth: requireAdminApi (Phase 34 discriminated-union signature).
// All writes go through the service-role client so we can set
// `created_by` from the admin's session and bypass the
// "service-role only" RLS write policy on group_buys.
//
// Server-side re-validation is the authority — the client also
// validates via validateGroupBuyTiers for UX, but never trust
// the client. We re-run:
//   - target_qty in [1, 1_000_000]
//   - min_qty_per_buyer in [1, 1_000_000] and < target_qty
//   - deadline > now + 1h
//   - product exists, is active
//   - price_tiers: array length 1-5, sorted ASC, all positive

import { NextRequest, NextResponse } from "next/server";
import { requireAdminApi } from "@/lib/portal-auth";
import { getServiceRoleClient } from "@/lib/supabase/server";
import { validateGroupBuyTiers, type GroupBuyPriceTier } from "@/lib/pricing";

export const dynamic = "force-dynamic";

type CreateBody = {
  productId?: number;
  targetQty?: number;
  minQtyPerBuyer?: number;
  priceTiers?: GroupBuyPriceTier[];
  deadlineAt?: string; // ISO 8601 from datetime-local converted client-side
};

function bad(error: string, status = 400) {
  return NextResponse.json({ error }, { status });
}

export async function POST(req: NextRequest) {
  const auth = await requireAdminApi(req);
  if (!auth.ok) {
    return NextResponse.json(
      { error: auth.error },
      { status: auth.status },
    );
  }

  let body: CreateBody;
  try {
    body = (await req.json()) as CreateBody;
  } catch {
    return bad("Invalid JSON body");
  }

  // --- Field-by-field validation ---
  const productId =
    typeof body.productId === "number" && Number.isInteger(body.productId)
      ? body.productId
      : null;
  if (productId == null || productId <= 0) return bad("productId is required");

  const targetQty =
    typeof body.targetQty === "number" && Number.isInteger(body.targetQty)
      ? body.targetQty
      : null;
  if (targetQty == null || targetQty < 1 || targetQty > 1_000_000) {
    return bad("targetQty must be an integer in [1, 1,000,000]");
  }

  const minQtyPerBuyer =
    typeof body.minQtyPerBuyer === "number" && Number.isInteger(body.minQtyPerBuyer)
      ? body.minQtyPerBuyer
      : null;
  if (
    minQtyPerBuyer == null ||
    minQtyPerBuyer < 1 ||
    minQtyPerBuyer > 1_000_000
  ) {
    return bad("minQtyPerBuyer must be an integer in [1, 1,000,000]");
  }
  if (minQtyPerBuyer >= targetQty) {
    return bad("minQtyPerBuyer must be < targetQty");
  }

  const tiers: GroupBuyPriceTier[] = Array.isArray(body.priceTiers)
    ? body.priceTiers.filter(
        (t) =>
          t &&
          typeof t.qty_threshold === "number" &&
          Number.isInteger(t.qty_threshold) &&
          typeof t.unit_bdt === "number" &&
          Number.isInteger(t.unit_bdt),
      )
    : [];
  const v = validateGroupBuyTiers(tiers);
  if (!v.ok) return bad(`priceTiers: ${v.error}`);

  const deadlineAt =
    typeof body.deadlineAt === "string" ? new Date(body.deadlineAt) : null;
  if (!deadlineAt || Number.isNaN(deadlineAt.getTime())) {
    return bad("deadlineAt must be a valid ISO 8601 datetime");
  }
  const oneHourFromNow = Date.now() + 3600_000;
  if (deadlineAt.getTime() <= oneHourFromNow) {
    return bad("deadlineAt must be > 1 hour from now");
  }

  // --- Verify product exists and is active ---
  const sb = getServiceRoleClient();
  const { data: product, error: prodErr } = await sb
    .from("products")
    .select("id, active")
    .eq("id", productId)
    .maybeSingle();
  if (prodErr) return bad(`Product lookup failed: ${prodErr.message}`, 500);
  if (!product) return bad(`Product #${productId} does not exist`);
  if (!product.active) return bad(`Product #${productId} is inactive`);

  // --- Insert ---
  // The Database type's Insert shape requires final_unit_bdt /
  // formed_at / cancelled_at which we don't send at create time
  // (they're null by default). postgrest-js treats `.insert()`
  // as "must match Insert exactly". Cast around it — the trigger
  // defaults these to NULL anyway.
  const { data: created, error: insErr } = await sb
    .from("group_buys")
    .insert({
      product_id: productId,
      target_qty: targetQty,
      min_qty_per_buyer: minQtyPerBuyer,
      price_tiers: tiers as unknown as Record<string, unknown>[],
      deadline_at: deadlineAt.toISOString(),
      status: "open",
      created_by: auth.user.id,
    } as never)
    .select("id")
    .single();
  if (insErr) {
    // C2 audit fix: detect the partial unique index violation
    // (one open group buy per product) and turn it into a clean
    // 409 with the actionable message. Without this, an admin
    // trying to launch a second open group buy on a product
    // that's already in one would get a generic 500.
    if (insErr.code === "23505" && insErr.message.includes("group_buys_one_open_per_product_idx")) {
      // Look up the existing open group buy for this product so
      // the admin knows which one to cancel first.
      const { data: existing } = await sb
        .from("group_buys")
        .select("id, deadline_at")
        .eq("product_id", productId)
        .eq("status", "open")
        .maybeSingle();
      const existingId = existing?.id
        ? String(existing.id).slice(0, 8)
        : "an existing one";
      return NextResponse.json(
        {
          error: `Product #${productId} already has an open group buy (${existingId}). Cancel or wait for it to expire before launching a new one.`,
          existingGroupBuyId: existing?.id ?? null,
          code: "OPEN_GROUP_BUY_EXISTS",
        },
        { status: 409 },
      );
    }
    return bad(`Insert failed: ${insErr.message}`, 500);
  }

  return NextResponse.json({ id: created.id });
}
