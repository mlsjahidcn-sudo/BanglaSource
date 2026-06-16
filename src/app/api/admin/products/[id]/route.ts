// PATCH /api/admin/products/[id]
//
// Partial update on a product. Admin-only. Service-role under the hood.
//
// Body (any subset of these fields; missing fields are NOT touched):
//   {
//     "title_en":     string,
//     "title_bn":     string,
//     "description_en": string,
//     "description_bn": string,
//     "markup_pct":   number,   // 0-50 (% above factory FOB)
//     "active":       boolean,
//     "category":     CategoryKey,  // one of the 7 allowed values
//     "images":       string[],  // REPLACES the full image list
//     "weight_kg":    number,
//     "volume_cbm":   number,
//   }
//
// Response: { ok: true, product: <updated row> } | { ok: false, error }
//
// Side effects:
//   - Bumps products.updated_at via the products trigger (already in place)
//   - Revalidates the catalog cache so the change is visible immediately
//     (Next.js's unstable_cache doesn't pick up direct DB writes within
//     the 60s TTL window — we revalidate here)

import { NextRequest, NextResponse } from "next/server";
import { revalidatePath, revalidateTag } from "next/cache";
import { getServiceRoleClient } from "@/lib/supabase/server";
import { requireAdminApi } from "@/lib/portal-auth";

const ALLOWED_CATEGORIES = new Set([
  "gadgets",
  "eyewear",
  "shoes",
  "bags",
  "watches",
  "beauty",
]);

const MAX_TITLE_LEN = 200;
const MAX_DESC_LEN = 4000;
const MAX_IMAGES = 12;
const MAX_IMAGE_URL_LEN = 1000;

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const guard = await requireAdminApi(req);
  if (!guard.ok) {
    return NextResponse.json(
      { ok: false, error: guard.error },
      { status: guard.status },
    );
  }

  const { id: idStr } = await params;
  const productId = Number.parseInt(idStr, 10);
  if (!Number.isFinite(productId)) {
    return NextResponse.json(
      { ok: false, error: "invalid_id" },
      { status: 400 },
    );
  }

  let body: Record<string, unknown> = {};
  try {
    body = (await req.json()) ?? {};
  } catch {
    return NextResponse.json(
      { ok: false, error: "invalid_json" },
      { status: 400 },
    );
  }

  // Build the patch object, validating each field
  const patch: Record<string, unknown> = {};

  if (typeof body.title_en === "string") {
    const v = body.title_en.trim();
    if (v.length === 0 || v.length > MAX_TITLE_LEN) {
      return NextResponse.json(
        { ok: false, error: "title_en_too_long" },
        { status: 400 },
      );
    }
    patch.title_en = v;
  }
  if (typeof body.title_bn === "string") {
    const v = body.title_bn.trim();
    if (v.length > MAX_TITLE_LEN) {
      return NextResponse.json(
        { ok: false, error: "title_bn_too_long" },
        { status: 400 },
      );
    }
    patch.title_bn = v;
  }
  if (typeof body.description_en === "string") {
    if (body.description_en.length > MAX_DESC_LEN) {
      return NextResponse.json(
        { ok: false, error: "description_en_too_long" },
        { status: 400 },
      );
    }
    patch.description_en = body.description_en;
  }
  if (typeof body.description_bn === "string") {
    if (body.description_bn.length > MAX_DESC_LEN) {
      return NextResponse.json(
        { ok: false, error: "description_bn_too_long" },
        { status: 400 },
      );
    }
    patch.description_bn = body.description_bn;
  }
  // Phase 11: admins CAN set the per-product markup. Range
  // 0–50 (% above factory FOB). Setting 0 effectively disables
  // the margin on this product (the buyer sees factory FOB +
  // FX). The default fallback for products where this is missing
  // is DEFAULT_BUYER_MARKUP_PCT (10) — see effectiveMarkupPct()
  // in src/lib/pricing.ts.
  if (typeof body.markup_pct === "number") {
    if (body.markup_pct < 0 || body.markup_pct > 50) {
      return NextResponse.json(
        { ok: false, error: "markup_pct_out_of_range" },
        { status: 400 },
      );
    }
    patch.markup_pct = body.markup_pct;
  }
  if (typeof body.active === "boolean") {
    patch.active = body.active;
  }
  if (typeof body.category === "string") {
    if (!ALLOWED_CATEGORIES.has(body.category)) {
      return NextResponse.json(
        { ok: false, error: "invalid_category" },
        { status: 400 },
      );
    }
    patch.category = body.category;
  }
  if (Array.isArray(body.images)) {
    if (body.images.length > MAX_IMAGES) {
      return NextResponse.json(
        { ok: false, error: "too_many_images" },
        { status: 400 },
      );
    }
    const cleaned: string[] = [];
    for (const url of body.images) {
      if (typeof url !== "string") {
        return NextResponse.json(
          { ok: false, error: "invalid_image_url" },
          { status: 400 },
        );
      }
      if (url.length > MAX_IMAGE_URL_LEN) {
        return NextResponse.json(
          { ok: false, error: "image_url_too_long" },
          { status: 400 },
        );
      }
      // Allow empty strings only as placeholders, skip them
      if (url.trim().length > 0) cleaned.push(url.trim());
    }
    if (cleaned.length === 0) {
      return NextResponse.json(
        { ok: false, error: "at_least_one_image_required" },
        { status: 400 },
      );
    }
    patch.images = cleaned;
  }
  if (typeof body.weight_kg === "number") {
    if (body.weight_kg < 0 || body.weight_kg > 1000) {
      return NextResponse.json(
        { ok: false, error: "weight_kg_out_of_range" },
        { status: 400 },
      );
    }
    patch.weight_kg = body.weight_kg;
  }
  if (typeof body.customs_duty_per_kg === "number") {
    if (body.customs_duty_per_kg < 0 || body.customs_duty_per_kg > 50000) {
      return NextResponse.json(
        { ok: false, error: "customs_duty_per_kg_out_of_range" },
        { status: 400 },
      );
    }
    patch.customs_duty_per_kg = body.customs_duty_per_kg;
  }
  if (typeof body.customs_duty_class === "string") {
    patch.customs_duty_class = body.customs_duty_class.slice(0, 64);
  }
  if (typeof body.volume_cbm === "number") {
    if (body.volume_cbm < 0 || body.volume_cbm > 10) {
      return NextResponse.json(
        { ok: false, error: "volume_cbm_out_of_range" },
        { status: 400 },
      );
    }
    patch.volume_cbm = body.volume_cbm;
  }

  if (Object.keys(patch).length === 0) {
    return NextResponse.json(
      { ok: false, error: "no_fields_to_update" },
      { status: 400 },
    );
  }

  const supabase = getServiceRoleClient();
  const { data, error } = await supabase
    .from("products")
    // `patch` is built as `Record<string, unknown>` for incremental field
    // accumulation, but at the call site we know it matches the
    // `products` Update shape (every key was validated against the schema
    // in the branches above). Cast at the boundary to keep the build-shape
    // type-safe without dragging `Database` into this file.
    .update(patch as never)
    .eq("id", productId)
    .select(
      "id,source_id,title_en,title_bn,title_zh,category,active,markup_pct,images,description_en,description_bn,weight_kg,volume_cbm,factory_moq,supplier_name,supplier_city,supplier_province,quality_score,badges,source_url,updated_at",
    )
    .single();

  if (error) {
    return NextResponse.json(
      { ok: false, error: error.message },
      { status: 500 },
    );
  }
  if (!data) {
    return NextResponse.json(
      { ok: false, error: "not_found" },
      { status: 404 },
    );
  }

  // Invalidate the catalog cache so the change is visible to public
  // routes within seconds, not 60s. The catalog endpoint uses
  // revalidate=60; we tag it via revalidateTag so the next request
  // misses the cache.
  try {
    revalidateTag("catalog", "max");
  } catch {
    // ignore — revalidateTag may not be wired on the catalog cache key
  }
  revalidatePath("/");
  revalidatePath("/categories");
  if (data.category) {
    revalidatePath(`/categories/${data.category}`);
  }

  return NextResponse.json({ ok: true, product: data });
}
