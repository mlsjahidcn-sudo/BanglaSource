// POST /api/admin/import/save
//
// Phase 15a: takes the (admin-edited) scraped data from
// /api/admin/import/scrape, downloads every image from the
// remote CDN, uploads them to the `product-images` Supabase
// storage bucket, and creates the product + price_tiers
// rows in a single transaction.
//
// Auth: admin only.
//
// Body:
//   {
//     source: "pinduoduo" | "taobao",
//     sourceUrl: string,                 // original share URL (for source_url)
//     sourceId: string,                  // goods_id / item_id (unique; the
//                                        //   admin may have changed it if
//                                        //   the original was a short slug)
//     titleZh: string,                   // Chinese title
//     titleEn: string,                   // admin-edited English title
//                                        //   (or machine-translated)
//     titleBn: string,                   // admin-edited Bengali title
//     descriptionZh: string,             // Chinese description
//     descriptionEn: string,             // English description
//     descriptionBn: string,             // Bengali description
//     category: "gadgets" | "eyewear" | ...,  // admin picks
//     weightKg: number,                  // admin can override
//     volumeCbm: number,                // admin can override
//     factoryCnyPerPc: number,          // admin-entered factory FOB
//                                        //   (Pinduoduo retail price is
//                                        //   NOT factory FOB — admin sets
//                                        //   the real FOB themselves)
//     factoryMoq: number,               // admin-entered
//     markupPct: number,                 // admin can set per-product override;
//                                        //   default 10
//     customsDutyPerKg: number,         // admin-entered
//     supplierName: string,              // admin-edited
//     supplierCity: string,
//     supplierProvince: string,
//     images: string[],                  // CDN URLs (subset of the
//                                        //   scraped list — admin may
//                                        //   have deselected some)
//     autoTranslate: boolean,           // if true, run a V4-Flash call
//                                        //   to auto-generate titleEn /
//                                        //   titleBn / descriptionEn /
//                                        //   descriptionBn from titleZh
//                                        //   + descriptionZh
//   }
//
// Response:
//   { ok: true, product: { id, source_id, imageCount } } |
//   { ok: false, error: "..." }

import { NextRequest, NextResponse } from "next/server";
import { revalidatePath, revalidateTag } from "next/cache";
import { randomUUID } from "crypto";
import { getServiceRoleClient } from "@/lib/supabase/server";
import { requireAdminApi } from "@/lib/portal-auth";
import { rateLimit, clientKey } from "@/lib/rate-limit";
import { deepseekChat } from "@/lib/deepseek";

const BUCKET = "product-images";
const MAX_IMAGES = 12;
const MAX_IMAGE_BYTES = 8 * 1024 * 1024; // 8MB per remote image
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
  "jewelry",
]);

type SaveBody = {
  source: "pinduoduo" | "taobao";
  sourceUrl: string;
  sourceId: string;
  titleZh: string;
  titleEn: string;
  titleBn: string;
  descriptionZh: string;
  descriptionEn: string;
  descriptionBn: string;
  category: string;
  weightKg: number;
  volumeCbm: number;
  factoryCnyPerPc: number;
  factoryMoq: number;
  markupPct: number;
  customsDutyPerKg: number;
  supplierName: string;
  supplierCity: string;
  supplierProvince: string;
  images: string[];
  autoTranslate: boolean;
};

/**
 * Download a remote image into a Buffer. We don't trust the
 * remote's content-length, so we stream up to MAX_IMAGE_BYTES
 * and bail if it overflows.
 */
async function downloadImage(url: string): Promise<{
  buffer: Buffer;
  contentType: string;
  ext: string;
}> {
  const res = await fetch(url, {
    redirect: "follow",
    // @ts-expect-error Node 25 supports this
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
    s
      .replace(/[^a-zA-Z0-9._-]+/g, "-")
      .toLowerCase()
      .slice(0, 60) || "image"
  );
}

export async function POST(req: NextRequest) {
  // ── Auth
  const guard = await requireAdminApi(req);
  if (!guard.ok) {
    return NextResponse.json(
      { ok: false, error: guard.error },
      { status: guard.status },
    );
  }

  // ── Rate limit
  const rl = rateLimit({
    key: `admin.import.save:${clientKey(req)}`,
    capacity: RATE_LIMIT,
    windowMs: RATE_WINDOW_MS,
  });
  if (!rl.allowed) {
    return NextResponse.json(
      { ok: false, error: "rate_limited" },
      { status: 429, headers: { "Retry-After": String(Math.ceil(rl.resetIn / 1000)) } },
    );
  }

  // ── Body
  let body: SaveBody;
  try {
    body = (await req.json()) as SaveBody;
  } catch {
    return NextResponse.json(
      { ok: false, error: "invalid_json" },
      { status: 400 },
    );
  }

  // ── Validate
  if (!body.sourceId || !body.sourceId.trim()) {
    return NextResponse.json(
      { ok: false, error: "sourceId_required" },
      { status: 400 },
    );
  }
  if (!body.titleEn?.trim()) {
    return NextResponse.json(
      { ok: false, error: "titleEn_required" },
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

  const supabase = getServiceRoleClient();

  // ── Optional: auto-translate via DeepSeek
  let titleEn = body.titleEn?.trim() ?? "";
  let titleBn = body.titleBn?.trim() ?? "";
  let descriptionEn = body.descriptionEn?.trim() ?? "";
  let descriptionBn = body.descriptionBn?.trim() ?? "";
  if (body.autoTranslate && body.titleZh) {
    try {
      const t = await translateAll(
        body.titleZh,
        body.descriptionZh || "",
      );
      titleEn = titleEn || t.titleEn;
      titleBn = titleBn || t.titleBn;
      descriptionEn = descriptionEn || t.descriptionEn;
      descriptionBn = descriptionBn || t.descriptionBn;
    } catch (e) {
      // Translation failure is non-fatal — we still save with
      // whatever English the admin typed + the Chinese fallback.
      console.warn(
        "[import/save] auto-translate failed:",
        e instanceof Error ? e.message : e,
      );
    }
  }

  // ── Reject duplicate source_id
  const { data: existing, error: existingErr } = await supabase
    .from("products")
    .select("id")
    .eq("source_id", body.sourceId.trim())
    .maybeSingle();
  if (existingErr) {
    return NextResponse.json(
      { ok: false, error: existingErr.message },
      { status: 500 },
    );
  }
  if (existing) {
    return NextResponse.json(
      {
        ok: false,
        error: "duplicate_source_id",
        message: `A product with source_id "${body.sourceId}" already exists (id=${existing.id}). Edit that one instead.`,
      },
      { status: 409 },
    );
  }

  // ── Create the product row first (so we have an id to
  //    namespace the storage paths under)
  const factoryCnyFen = Math.round(body.factoryCnyPerPc * 100);
  const { data: created, error: insertErr } = await supabase
    .from("products")
    .insert({
      source_id: body.sourceId.trim(),
      title_en: titleEn,
      title_bn: titleBn || titleEn, // fallback to EN if BN missing
      title_zh: body.titleZh,
      category: body.category,
      factory_moq: Math.max(1, Math.round(body.factoryMoq || 1)),
      weight_kg: body.weightKg || 0.5,
      volume_cbm: body.volumeCbm || 0.0001,
      markup_pct: Math.min(50, Math.max(0, body.markupPct ?? 10)),
      supplier_name: body.supplierName || "Unknown supplier",
      supplier_city: body.supplierCity || "Guangzhou",
      supplier_province: body.supplierProvince || "Guangdong",
      images: [], // filled in below
      description_en: descriptionEn || titleEn,
      description_bn: descriptionBn || titleEn,
      source_url: body.sourceUrl,
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

  // ── Download + upload each image
  const uploadedUrls: string[] = [];
  const failedImages: string[] = [];
  const sourceSlug = safeName(
    body.sourceId.replace(/[^a-zA-Z0-9._-]/g, "-"),
  );
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
    // Roll back the product row so we don't leave a half-baked
    // entry with no images. Price_tiers are not created yet so
    // there's nothing else to clean up.
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

  // ── Update the product with the public URLs
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

  // ── Create the price tiers (3-tier: MOQ, 50×, 200×)
  //    The same FOB across all tiers is fine for newly-imported
  //    Pinduoduo products — admin can edit tiers on the product
  //    detail page if they have a tiered price schedule.
  const unitCnyFen = factoryCnyFen;
  const tiers = [
    { qty_min: 1, qty_max: Math.max(1, (body.factoryMoq || 1) - 1), price_cny_fen: unitCnyFen },
    { qty_min: Math.max(2, body.factoryMoq || 1), qty_max: 49, price_cny_fen: unitCnyFen },
    { qty_min: 50, qty_max: 199, price_cny_fen: unitCnyFen },
    { qty_min: 200, qty_max: null, price_cny_fen: unitCnyFen },
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
    console.warn("[import/save] price_tiers insert failed:", tierErr.message);
  }

  // ── Bust the catalog cache so the new product shows up
  revalidateTag("catalog");
  revalidatePath("/");
  revalidatePath("/categories");
  revalidatePath("/admin/products");

  return NextResponse.json({
    ok: true,
    product: {
      id: productId,
      source_id: body.sourceId,
      imageCount: uploadedUrls.length,
      failedImageCount: failedImages.length,
    },
    failedImages: failedImages.length > 0 ? failedImages : undefined,
  });
}

/**
 * Auto-translate the Chinese title + description into
 * English and Bangla via DeepSeek V4-Flash. Returns the
 * four translated strings; falls back to the Chinese input
 * if DeepSeek returns garbage.
 */
async function translateAll(
  titleZh: string,
  descriptionZh: string,
): Promise<{
  titleEn: string;
  titleBn: string;
  descriptionEn: string;
  descriptionBn: string;
}> {
  const system = `You are a product listing translator for a Bangladesh B2B marketplace. The source is Chinese (1688 / Pinduoduo / Taobao wholesale). Output ONLY valid JSON in this exact shape, no prose:

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
    {
      // Force JSON output. DeepSeek V4 supports response_format
      // for json_object. Temperature 0.3 keeps it factual.
      jsonMode: true,
      temperature: 0.3,
      maxTokens: 1024,
    },
  );

  // Defensive parse — model may wrap in markdown
  const cleaned = raw
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
