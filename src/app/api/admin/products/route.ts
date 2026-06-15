// POST /api/admin/products
//
// Phase 15c: manual product create (no URL scrape). Admin fills
// the form on /admin/products/new and submits. Same validation +
// image-download + storage-upload + price_tier-create + cache-bust
// pipeline as /api/admin/import/save, minus the source='pinduoduo'/
// 'taobao' step.
//
// Auth: admin only.
//
// Body (all required unless noted):
//   {
//     sourceId: string,                  // free-text slug, e.g. "leather-wallet-001"
//                                        //   must be unique across products
//     titleEn: string,                   // English title
//     titleZh?: string,                  // optional (manual mode often skips zh)
//     titleBn?: string,
//     descriptionEn?: string,
//     descriptionBn?: string,
//     descriptionZh?: string,
//     category: "gadgets" | "eyewear" | "shoes" | "bags" |
//               "watches" | "beauty",
//     weightKg: number,                  // kg per piece
//     volumeCbm: number,                 // m³ per piece
//     factoryCnyPerPc: number,           // ¥/pc, factory FOB
//     factoryMoq: number,                // min order qty
//     markupPct?: number,                // 0-50, default 10
//     customsDutyPerKg: number,          // ৳/kg, BD customs
//     supplierName: string,
//     supplierCity: string,
//     supplierProvince: string,
//     images: string[],                  // 1-12 remote URLs (jpg/png/webp/avif, max 8MB each)
//     autoTranslate?: boolean,           // if true AND titleZh is set, run DeepSeek V4-Flash
//                                        //   to fill empty EN/BN fields from zh
//   }
//
// Response:
//   { ok: true, product: { id, source_id, imageCount, failedImageCount } } |
//   { ok: false, error: "...", failed?: string[] }

import { NextRequest, NextResponse } from "next/server";
import { revalidatePath, revalidateTag } from "next/cache";
import { randomUUID } from "crypto";
import { getServiceRoleClient } from "@/lib/supabase/server";
import { requireAdminApi } from "@/lib/portal-auth";
import { rateLimit, clientKey } from "@/lib/rate-limit";
import { deepseekChat } from "@/lib/deepseek";

const BUCKET = "product-images";
const MAX_IMAGES = 12;
const MAX_IMAGE_BYTES = 8 * 1024 * 1024;
const ALLOWED_REMOTE_MIME = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/avif",
]);

const RATE_LIMIT = 20;
const RATE_WINDOW_MS = 60_000;

const ALLOWED_CATEGORIES = new Set([
  "gadgets",
  "eyewear",
  "shoes",
  "bags",
  "watches",
  "beauty",
]);

type ManualBody = {
  sourceId: string;
  titleZh?: string;
  titleEn: string;
  titleBn?: string;
  descriptionZh?: string;
  descriptionEn?: string;
  descriptionBn?: string;
  category: string;
  weightKg: number;
  volumeCbm: number;
  factoryCnyPerPc: number;
  factoryMoq: number;
  markupPct?: number;
  customsDutyPerKg: number;
  supplierName: string;
  supplierCity: string;
  supplierProvince: string;
  images: string[];
  autoTranslate?: boolean;
};

async function downloadImage(url: string): Promise<{
  buffer: Buffer;
  contentType: string;
  ext: string;
}> {
  const res = await fetch(url, {
    redirect: "follow",
    signal: AbortSignal.timeout(30_000),
  });
  if (!res.ok) {
    throw new Error(`image_download_failed ${res.status} for ${url}`);
  }
  const contentType = (res.headers.get("content-type") ?? "image/jpeg")
    .toLowerCase()
    .split(";")[0]
    .trim();
  if (!ALLOWED_REMOTE_MIME.has(contentType)) {
    throw new Error(`image_unsupported_mime ${contentType} for ${url}`);
  }
  const ab = await res.arrayBuffer();
  if (ab.byteLength > MAX_IMAGE_BYTES) {
    throw new Error(
      `image_too_large ${ab.byteLength} bytes (max ${MAX_IMAGE_BYTES}) for ${url}`,
    );
  }
  const ext =
    contentType === "image/png"
      ? "png"
      : contentType === "image/webp"
        ? "webp"
        : contentType === "image/avif"
          ? "avif"
          : "jpg";
  return { buffer: Buffer.from(ab), contentType, ext };
}

function safeName(s: string): string {
  return (
    s.replace(/[^a-zA-Z0-9._-]+/g, "-").toLowerCase().slice(0, 60) || "image"
  );
}

export async function POST(req: NextRequest) {
  const guard = await requireAdminApi(req);
  if (!guard.ok) {
    return NextResponse.json(
      { ok: false, error: guard.error },
      { status: guard.status },
    );
  }

  const rl = rateLimit({
    key: `admin.products.create:${clientKey(req)}`,
    capacity: RATE_LIMIT,
    windowMs: RATE_WINDOW_MS,
  });
  if (!rl.allowed) {
    return NextResponse.json(
      { ok: false, error: "rate_limited" },
      {
        status: 429,
        headers: { "Retry-After": String(Math.ceil(rl.resetIn / 1000)) },
      },
    );
  }

  let body: ManualBody;
  try {
    body = (await req.json()) as ManualBody;
  } catch {
    return NextResponse.json(
      { ok: false, error: "invalid_json" },
      { status: 400 },
    );
  }

  // ── Validate
  const sourceId = (body.sourceId ?? "").trim();
  if (!sourceId) {
    return NextResponse.json(
      { ok: false, error: "sourceId_required" },
      { status: 400 },
    );
  }
  if (!/^[a-zA-Z0-9._-]{2,80}$/.test(sourceId)) {
    return NextResponse.json(
      {
        ok: false,
        error: "sourceId_invalid",
        message:
          "sourceId must be 2-80 chars, only letters, digits, dots, dashes, underscores.",
      },
      { status: 400 },
    );
  }
  if (!body.titleEn?.trim() && !(body.autoTranslate && body.titleZh?.trim())) {
    return NextResponse.json(
      {
        ok: false,
        error: "titleEn_required",
        message:
          "Either provide an English title, or enable auto-translate with a Chinese title.",
      },
      { status: 400 },
    );
  }
  if (!ALLOWED_CATEGORIES.has(body.category)) {
    return NextResponse.json(
      { ok: false, error: "invalid_category" },
      { status: 400 },
    );
  }
  if (!Number.isFinite(body.factoryCnyPerPc) || body.factoryCnyPerPc <= 0) {
    return NextResponse.json(
      { ok: false, error: "factoryCnyPerPc_required" },
      { status: 400 },
    );
  }
  if (!Array.isArray(body.images) || body.images.length === 0) {
    return NextResponse.json(
      { ok: false, error: "images_required" },
      { status: 400 },
    );
  }
  if (body.images.length > MAX_IMAGES) {
    return NextResponse.json(
      { ok: false, error: "too_many_images", max: MAX_IMAGES },
      { status: 400 },
    );
  }
  for (const u of body.images) {
    if (typeof u !== "string" || !/^https?:\/\//i.test(u)) {
      return NextResponse.json(
        { ok: false, error: "image_url_invalid", badUrl: u.slice(0, 80) },
        { status: 400 },
      );
    }
  }

  const supabase = getServiceRoleClient();

  // ── Optional: auto-translate from zh
  let titleEn = body.titleEn.trim();
  let titleBn = (body.titleBn ?? "").trim();
  let descriptionEn = (body.descriptionEn ?? "").trim();
  let descriptionBn = (body.descriptionBn ?? "").trim();
  if (body.autoTranslate && body.titleZh?.trim()) {
    try {
      const t = await translateAll(body.titleZh, body.descriptionZh ?? "");
      // Only fill what's empty; never overwrite admin-typed strings
      if (!titleEn) titleEn = t.titleEn;
      if (!titleBn) titleBn = t.titleBn;
      if (!descriptionEn) descriptionEn = t.descriptionEn;
      if (!descriptionBn) descriptionBn = t.descriptionBn;
    } catch (e) {
      console.warn(
        "[admin/products POST] auto-translate failed:",
        e instanceof Error ? e.message : e,
      );
    }
  }

  // ── Reject duplicate source_id
  const { data: existing } = await supabase
    .from("products")
    .select("id")
    .eq("source_id", sourceId)
    .maybeSingle();
  if (existing) {
    return NextResponse.json(
      {
        ok: false,
        error: "duplicate_source_id",
        message: `A product with source_id "${sourceId}" already exists (id=${existing.id}). Edit that one instead.`,
      },
      { status: 409 },
    );
  }

  // ── Insert product row
  const factoryCnyFen = Math.round(body.factoryCnyPerPc * 100);
  const { data: created, error: insertErr } = await supabase
    .from("products")
    .insert({
      source_id: sourceId,
      title_en: titleEn,
      title_bn: titleBn || titleEn,
      title_zh: body.titleZh ?? null,
      category: body.category,
      factory_moq: Math.max(1, Math.round(body.factoryMoq || 1)),
      weight_kg: body.weightKg || 0.5,
      volume_cbm: body.volumeCbm || 0.0001,
      markup_pct: Math.min(50, Math.max(0, body.markupPct ?? 10)),
      supplier_name: body.supplierName || "Unknown supplier",
      supplier_city: body.supplierCity || "Guangzhou",
      supplier_province: body.supplierProvince || "Guangdong",
      images: [],
      description_en: descriptionEn || titleEn,
      description_bn: descriptionBn || titleEn,
      // Manual mode has no upstream source URL; we synthesize one
      // (the `source_url` column is NOT NULL in the schema) so
      // anything filtering on this field still finds the row.
      source_url: `https://manual.local/${sourceId}`,
      customs_duty_per_kg: body.customsDutyPerKg || 750,
    })
    .select("id")
    .single();
  if (insertErr || !created) {
    return NextResponse.json(
      { ok: false, error: insertErr?.message ?? "insert_failed" },
      { status: 500 },
    );
  }
  const productId = created.id as number;

  // ── Download + upload images
  const uploadedUrls: string[] = [];
  const failedImages: string[] = [];
  const sourceSlug = safeName(sourceId);
  for (let i = 0; i < body.images.length; i++) {
    const url = body.images[i];
    try {
      const { buffer, ext } = await downloadImage(url);
      const objectKey = `imported/${sourceSlug}/${i}-${randomUUID().slice(0, 8)}.${ext}`;
      const { error: upErr } = await supabase.storage
        .from(BUCKET)
        .upload(objectKey, buffer, {
          contentType: `image/${ext === "jpg" ? "jpeg" : ext}`,
          upsert: false,
          cacheControl: "public, max-age=31536000, immutable",
        });
      if (upErr) {
        failedImages.push(`${url}: ${upErr.message}`);
        continue;
      }
      const { data: pub } = supabase.storage
        .from(BUCKET)
        .getPublicUrl(objectKey);
      uploadedUrls.push(pub.publicUrl);
    } catch (e) {
      failedImages.push(
        `${url}: ${e instanceof Error ? e.message : "download failed"}`,
      );
    }
  }

  if (uploadedUrls.length === 0) {
    await supabase.from("products").delete().eq("id", productId);
    return NextResponse.json(
      {
        ok: false,
        error: "all_images_failed",
        failed: failedImages.slice(0, 5),
      },
      { status: 500 },
    );
  }

  // ── Update product with public URLs
  const { error: updErr } = await supabase
    .from("products")
    .update({ images: uploadedUrls })
    .eq("id", productId);
  if (updErr) {
    return NextResponse.json(
      {
        ok: false,
        error: updErr.message,
        warning: "Product created but images[] write failed",
      },
      { status: 500 },
    );
  }

  // ── Price tiers (same FOB across all 4)
  const moq = Math.max(1, Math.round(body.factoryMoq || 1));
  const tiers = [
    { qty_min: 1, qty_max: Math.max(1, moq - 1), price_cny_fen: factoryCnyFen },
    { qty_min: Math.max(2, moq), qty_max: 49, price_cny_fen: factoryCnyFen },
    { qty_min: 50, qty_max: 199, price_cny_fen: factoryCnyFen },
    { qty_min: 200, qty_max: null, price_cny_fen: factoryCnyFen },
  ].filter((t) => t.qty_max === null || t.qty_max >= t.qty_min);
  const { error: tierErr } = await supabase
    .from("price_tiers")
    .insert(
      tiers.map((t) => ({
        product_id: productId,
        qty_min: t.qty_min,
        qty_max: t.qty_max,
        price_cny_fen: t.price_cny_fen,
      })),
    );
  if (tierErr) {
    console.warn(
      "[admin/products POST] price_tiers insert failed:",
      tierErr.message,
    );
  }

  revalidateTag("catalog");
  revalidatePath("/");
  revalidatePath("/categories");
  revalidatePath("/admin/products");

  return NextResponse.json({
    ok: true,
    product: {
      id: productId,
      source_id: sourceId,
      imageCount: uploadedUrls.length,
      failedImageCount: failedImages.length,
    },
    failedImages: failedImages.length > 0 ? failedImages : undefined,
  });
}

async function translateAll(
  titleZh: string,
  descriptionZh: string,
): Promise<{
  titleEn: string;
  titleBn: string;
  descriptionEn: string;
  descriptionBn: string;
}> {
  const system = `You are a product listing translator for a Bangladesh B2B marketplace. The source is Chinese wholesale — Pinduoduo, Taobao, or other trending China sources. Output ONLY valid JSON in this exact shape, no prose:

{
  "titleEn": "<English title, max 80 chars, natural for a buyer in Bangladesh>",
  "titleBn": "<Bangla title in Bengali script, max 80 chars>",
  "descriptionEn": "<English description, 1-3 sentences, factual, no marketing fluff>",
  "descriptionBn": "<Bangla description matching the English, in Bengali script>"
}

Rules:
- Use Bangla script (not Latin transliteration) for titleBn / descriptionBn.
- Translate "材质" → "Material", "颜色" → "Color", "尺寸" → "Size" when present.
- Don't invent specs you can't see. Keep numbers, weights, sizes verbatim.
- If the input is empty, return empty strings.`;

  const userPrompt = `Title (zh): ${titleZh}

${descriptionZh ? `Description (zh): ${descriptionZh}` : "(no description)"}`;

  const raw = await deepseekChat(
    [
      { role: "system", content: system },
      { role: "user", content: userPrompt },
    ],
    { jsonMode: true, temperature: 0.3, maxTokens: 1024 },
  );

  // Defensive parse — model may wrap in markdown
  const cleaned = raw.content
    .trim()
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/```\s*$/i, "");
  let parsed: {
    titleEn?: string;
    titleBn?: string;
    descriptionEn?: string;
    descriptionBn?: string;
  } = {};
  try {
    parsed = JSON.parse(cleaned);
  } catch {
    const m = cleaned.match(/\{[\s\S]*\}/);
    if (m) {
      try {
        parsed = JSON.parse(m[0]);
      } catch {
        /* fall through */
      }
    }
  }
  return {
    titleEn: (parsed.titleEn ?? "").trim() || titleZh,
    titleBn: (parsed.titleBn ?? "").trim() || titleZh,
    descriptionEn: (parsed.descriptionEn ?? "").trim() || descriptionZh,
    descriptionBn: (parsed.descriptionBn ?? "").trim() || descriptionZh,
  };
}
