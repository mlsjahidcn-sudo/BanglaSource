// GET /api/quote/landed?productId=...&qty=...&mode=air|sea|express
// Real landed-cost quote from the Supabase product catalog.
//
// Rate-limited: 100 req/IP/min.

import { NextRequest, NextResponse } from "next/server";
import { getProduct, dbProductToLegacy, type DbProduct } from "@/lib/catalog";
import { landedCost, type ShippingMode } from "@/lib/pricing";
import { rateLimit, clientKey } from "@/lib/rate-limit";

const RATE_LIMIT = 100;
const RATE_WINDOW_MS = 60_000;

export async function GET(req: NextRequest) {
  // ── Rate limit
  const rl = rateLimit({
    key: `quote.landed:${clientKey(req)}`,
    capacity: RATE_LIMIT,
    windowMs: RATE_WINDOW_MS,
  });
  if (!rl.allowed) {
    return NextResponse.json(
      {
        error: "rate_limited",
        message: `Too many quote requests. Try again in ${Math.ceil(rl.resetIn / 1000)}s.`,
        resetIn: rl.resetIn,
      },
      {
        status: 429,
        headers: { "Retry-After": String(Math.ceil(rl.resetIn / 1000)) },
      },
    );
  }

  const url = new URL(req.url);
  const productId = url.searchParams.get("productId");
  const qtyRaw = url.searchParams.get("qty");
  const modeRaw = (url.searchParams.get("mode") ?? "air").toLowerCase();

  if (!productId) {
    return NextResponse.json(
      { error: "missing_productId", message: "productId is required" },
      { status: 400 },
    );
  }

  const dbProduct = await getProduct(productId);
  if (!dbProduct) {
    return NextResponse.json(
      { error: "product_not_found", productId },
      { status: 404 },
    );
  }

  const qty = Math.max(
    1,
    Math.floor(Number(qtyRaw ?? dbProduct.factory_moq) || 1),
  );

  const allowedModes: ShippingMode[] = ["air", "sea", "express"];
  const mode: ShippingMode = (allowedModes as string[]).includes(modeRaw)
    ? (modeRaw as ShippingMode)
    : "air";

  const moqWarning = qty < dbProduct.factory_moq;

  // landedCost() needs the legacy Product shape (which has weight_kg, volume_cbm,
  // markup_pct, price_tiers — all present on the DB row). Map it.
  const product = dbProductToLegacy(dbProduct);
  const quote = landedCost(
    product as unknown as Parameters<typeof landedCost>[0],
    qty,
    mode,
  );

  // Compose user-facing warnings from the engine's diagnostics
  const warnings: string[] = [];
  if (moqWarning) {
    warnings.push(
      `Below factory MOQ of ${dbProduct.factory_moq} units — factory may not accept this order.`,
    );
  }
  if (quote.shippingDominantPct >= 30) {
    warnings.push(
      `Shipping is ${quote.shippingDominantPct}% of landed cost. Order more pieces to bring shipping under 20%.`,
    );
  }
  if (quote.tooSmallForAir) {
    warnings.push(
      `Small-parcel premium: at ${quote.chargeableKg.toFixed(2)} kg you're in the air-freight ¥${quote.rateTier?.rateCnyPerKg ?? 80}/kg tier. Order 5+ kg to drop to the ¥50/kg tier and cut shipping ~40% — or use sea LCL for orders under 30 kg.`,
    );
  }
  if (
    quote.volumetricKg > quote.chargeableKg * 1.5 &&
    quote.volumetricKg > 0.5
  ) {
    // Volumetric weight is significantly higher than actual —
    // the box is too big for its weight. Suggest better packing.
    const savingsBdt = Math.round(
      ((quote.volumetricKg - quote.chargeableKg) *
        (quote.rateTier?.rateCnyPerKg ?? 35) *
        16.85),
    );
    warnings.push(
      `Box is bulky — volumetric weight (${quote.volumetricKg.toFixed(2)} kg) is much higher than actual (${quote.chargeableKg.toFixed(2)} kg). Ask the factory for tighter packaging — could save ~৳${savingsBdt.toLocaleString()} in shipping.`,
    );
  }

  return NextResponse.json(
    {
      ok: true,
      product: {
        id: dbProduct.source_id,
        title_en: dbProduct.title_en,
        title_bn: dbProduct.title_bn,
        weight_kg: dbProduct.weight_kg,
        volume_cbm: dbProduct.volume_cbm,
        factory_moq: dbProduct.factory_moq,
        markup_pct: dbProduct.markup_pct,
      },
      warnings,
      quote,
    },
    {
      headers: {
        "Cache-Control": "no-store, max-age=0",
        "X-RateLimit-Limit": String(RATE_LIMIT),
        "X-RateLimit-Remaining": String(rl.remaining),
      },
    },
  );
}
