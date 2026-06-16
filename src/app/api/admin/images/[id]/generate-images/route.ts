// POST /api/admin/images/[id]/generate-images
//
// Phase 15b (image agent) + Phase 15d (multi-prompt). Takes a
// product id, runs GPT Image 2 (via apinebula.com), uploads the
// generated PNGs to the product-images bucket, and returns the
// new public URLs. Optionally appends the generated URLs to
// products.images[].
//
// Two modes:
//   1. Single-prompt (legacy): body { prompt, n, reference_image_urls?,
//      append_to_product?, style? } — runs n parallel calls.
//   2. Multi-prompt (Phase 15d): body { prompts: string[],
//      reference_image_urls?, append_to_product? } — runs one
//      call per prompt (in parallel), per-prompt failures isolated.
//
// Phase 15d: also accepts a `prompts: string[]` array
// (1-6 entries). When set, runs ONE image-gen call per
// prompt in parallel and returns the merged result. Each
// prompt produces 1 image (n is forced to 1 per prompt).
// If both `prompts` and `prompt` are set, `prompts` wins.
//
// Auth: admin only.
//
// Body:
//   {
//     prompt?: string,                // single-prompt mode (legacy).
//                                      //   ignored when `prompts` is set.
//     prompts?: string[],             // multi-prompt mode (Phase 15d).
//                                      //   1-6 entries, each ≤ 1500 chars.
//     n?: number (1-4, default 1),    // single-prompt mode only
//     referenceImageUrls?: string[],  // if omitted, uses the
//                                      //   product's existing
//                                      //   images[0]
//     appendToProduct?: boolean,     // if true (default), append
//                                      //   generated URLs to
//                                      //   products.images[] in
//                                      //   the order generated
//     model?: string,                 // override the default
//                                      //   OPENAI_IMAGE_MODEL
//     size?: "1024x1024" | "1536x1024" | "1024x1536",
//   }
//
// Response:
//   {
//     ok: true,
//     product: { id, source_id, imagesAdded, totalImages },
//     images: Array<{ url, slug, index, sizeBytes, prompt }>,
//     referencesUsed: number,
//   }

import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { revalidatePath, revalidateTag } from "next/cache";
import { getServiceRoleClient } from "@/lib/supabase/server";
import { requireAdminApi } from "@/lib/portal-auth";
import { rateLimit, clientKey } from "@/lib/rate-limit";
import { generateProductImages } from "@/lib/ingest/imagegen";

const BUCKET = "product-images";
const MAX_N = 4;
const MAX_REFS = 4;
const MAX_PROMPT_LEN = 1500;
const MAX_PROMPTS = 6; // Phase 15d: 6-prompt carousel mode

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  // ── Auth
  const guard = await requireAdminApi(req);
  if (!guard.ok) {
    return NextResponse.json(
      { ok: false, error: guard.error },
      { status: guard.status },
    );
  }

  // ── Rate limit (image gen is expensive)
  const rl = rateLimit({
    key: `admin.imagegen:${clientKey(req)}`,
    capacity: 30,
    windowMs: 60_000,
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

  // ── Params
  const { id: idStr } = await params;
  const productId = Number.parseInt(idStr, 10);
  if (!Number.isFinite(productId)) {
    return NextResponse.json(
      { ok: false, error: "invalid_id" },
      { status: 400 },
    );
  }

  // ── Body
  let body: {
    prompt?: string;
    prompts?: string[];
    n?: number;
    referenceImageUrls?: string[];
    appendToProduct?: boolean;
    model?: string;
    size?: "1024x1024" | "1536x1024" | "1024x1536";
  } = {};
  try {
    body = (await req.json()) ?? {};
  } catch {
    return NextResponse.json(
      { ok: false, error: "invalid_json" },
      { status: 400 },
    );
  }

  // ── Prompt resolution: prefer `prompts[]` (Phase 15d) when present
  const rawPrompts = Array.isArray(body.prompts) ? body.prompts : null;
  let effectivePrompts: string[];
  if (rawPrompts && rawPrompts.length > 0) {
    if (rawPrompts.length > MAX_PROMPTS) {
      return NextResponse.json(
        { ok: false, error: "too_many_prompts", max: MAX_PROMPTS },
        { status: 400 },
      );
    }
    const cleaned = rawPrompts
      .map((p) => (typeof p === "string" ? p.trim() : ""))
      .filter((p) => p.length > 0);
    if (cleaned.length === 0) {
      return NextResponse.json(
        { ok: false, error: "prompts_empty" },
        { status: 400 },
      );
    }
    for (const p of cleaned) {
      if (p.length > MAX_PROMPT_LEN) {
        return NextResponse.json(
          { ok: false, error: "prompt_too_long", max: MAX_PROMPT_LEN },
          { status: 400 },
        );
      }
    }
    effectivePrompts = cleaned;
  } else {
    const single = (body.prompt ?? "").trim();
    if (!single) {
      return NextResponse.json(
        { ok: false, error: "prompt_required" },
        { status: 400 },
      );
    }
    if (single.length > MAX_PROMPT_LEN) {
      return NextResponse.json(
        { ok: false, error: "prompt_too_long", max: MAX_PROMPT_LEN },
        { status: 400 },
      );
    }
    effectivePrompts = [single];
  }

  const n = Math.min(Math.max(body.n ?? 1, 1), MAX_N);
  const refUrls = (body.referenceImageUrls ?? []).slice(0, MAX_REFS);
  const append = body.appendToProduct !== false; // default true

  // ── Load the product (so we can default refUrls to its
  //    first image when the admin didn't pass any)
  const supabase = getServiceRoleClient();
  const { data: product, error: prodErr } = await supabase
    .from("products")
    .select("id, source_id, title_en, images")
    .eq("id", productId)
    .maybeSingle();
  if (prodErr) {
    return NextResponse.json(
      { ok: false, error: prodErr.message },
      { status: 500 },
    );
  }
  if (!product) {
    return NextResponse.json(
      { ok: false, error: "product_not_found" },
      { status: 404 },
    );
  }

  const effectiveRefs = refUrls.length > 0
    ? refUrls
    : ((product.images ?? []).slice(0, 1) as string[]);

  // ── Run the image generation
  //
  // Two modes:
  //   - single prompt + n>1: parallel calls, each with the same prompt
  //   - multiple prompts: one call per prompt (n=1 each), parallel
  let images: Awaited<ReturnType<typeof generateProductImages>>;
  try {
    if (effectivePrompts.length === 1 && n > 1) {
      // Legacy single-prompt + n: pass through with n
      images = await generateProductImages({
        prompt: effectivePrompts[0],
        n,
        referenceImageUrls: effectiveRefs,
        model: body.model,
        size: body.size,
      });
    } else if (effectivePrompts.length > 1) {
      // Phase 15d: one call per prompt, all parallel
      const results = await Promise.all(
        effectivePrompts.map((p) =>
          generateProductImages({
            prompt: p,
            n: 1,
            referenceImageUrls: effectiveRefs,
            model: body.model,
            size: body.size,
          }).then((arr) => arr[0]).catch((e) => {
            // Per-prompt failure shouldn't kill the whole batch
            return {
              __failed: true as const,
              error: e instanceof Error ? e.message : String(e),
              prompt: p,
            };
          }),
        ),
      );
      // Flatten: drop failures, concat successes
      const successes: typeof images = [];
      const failedPrompts: { index: number; prompt: string; error: string }[] = [];
      results.forEach((r, i) => {
        if (r && "__failed" in r) {
          failedPrompts.push({ index: i, prompt: r.prompt, error: r.error });
        } else if (r) {
          successes.push(r);
        }
      });
      if (successes.length === 0) {
        return NextResponse.json(
          {
            ok: false,
            error: "all_imagegen_failed",
            failedPrompts: failedPrompts.slice(0, 3),
          },
          { status: 500 },
        );
      }
      images = successes;
      // Stash the failed list for the response (we don't use it
      // directly, just expose it below in `failedPrompts`).
      // (Re-using `failed` for upload failures too — need a new var.)
      (images as any).__failedPrompts = failedPrompts;
    } else {
      // Single prompt + n=1 (the common case)
      images = await generateProductImages({
        prompt: effectivePrompts[0],
        n: 1,
        referenceImageUrls: effectiveRefs,
        model: body.model,
        size: body.size,
      });
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : "imagegen_failed";
    return NextResponse.json(
      {
        ok: false,
        error: "imagegen_failed",
        message: msg,
      },
      { status: 500 },
    );
  }

  // ── Upload to Supabase
  const uploadedUrls: string[] = [];
  const failed: string[] = [];
  const sourceSlug =
    (product.source_id || String(productId))
      .replace(/[^a-zA-Z0-9._-]/g, "-")
      .slice(0, 40) || `p${productId}`;
  for (const img of images) {
    try {
      const objectKey = `generated/${sourceSlug}/${img.slug}-${randomUUID().slice(0, 8)}.png`;
      const { error: upErr } = await supabase.storage
        .from(BUCKET)
        .upload(objectKey, img.buffer, {
          contentType: "image/png",
          upsert: false,
          cacheControl: "public, max-age=31536000, immutable",
        });
      if (upErr) {
        failed.push(`${img.slug}: ${upErr.message}`);
        continue;
      }
      const { data: pub } = supabase.storage
        .from(BUCKET)
        .getPublicUrl(objectKey);
      uploadedUrls.push(pub.publicUrl);
    } catch (e) {
      failed.push(
        `${img.slug}: ${e instanceof Error ? e.message : "upload failed"}`,
      );
    }
  }

  if (uploadedUrls.length === 0) {
    return NextResponse.json(
      { ok: false, error: "all_uploads_failed", failed: failed.slice(0, 5) },
      { status: 500 },
    );
  }

  // ── Optionally append to the product's images[]
  let newImagesAdded = 0;
  if (append) {
    const { data: updated, error: updErr } = await supabase
      .from("products")
      .update({
        images: [...((product.images ?? []) as string[]), ...uploadedUrls],
      })
      .eq("id", productId)
      .select("images")
      .single();
    if (updErr) {
      return NextResponse.json(
        {
          ok: false,
          error: updErr.message,
          warning: "Generated images uploaded but product.images[] not updated",
        },
        { status: 500 },
      );
    }
    newImagesAdded = uploadedUrls.length;
    revalidateTag("catalog", "max");
    revalidatePath(`/products/${product.source_id}`);
    revalidatePath("/admin/products");
  }

  // Pull the per-prompt failures out of the stash (Phase 15d)
  const failedPrompts = ((images as any).__failedPrompts ?? []) as {
    index: number;
    prompt: string;
    error: string;
  }[];

  return NextResponse.json({
    ok: true,
    product: {
      id: productId,
      source_id: product.source_id,
      imagesAdded: newImagesAdded,
      totalImages:
        (product.images?.length ?? 0) + newImagesAdded,
    },
    images: uploadedUrls.map((url, i) => ({
      url,
      slug: images[i].slug,
      index: i,
      sizeBytes: images[i].buffer.byteLength,
      // Echo the prompt that produced this image (for the
      // multi-prompt UI to label the gallery card).
      prompt: effectivePrompts[i] ?? null,
    })),
    failedUploads: failed.length > 0 ? failed : undefined,
    failedPrompts: failedPrompts.length > 0 ? failedPrompts : undefined,
    // For single-prompt backward compat, echo the prompt string.
    // For multi-prompt, echo the array.
    prompts: effectivePrompts,
    referencesUsed: effectiveRefs.length,
  });
}
