// POST /api/admin/import/screenshot
//
// Phase 60 — admin uploads a product page screenshot, this route
// sends it to GPT-4o vision via apinebula.com, and returns a
// product draft the existing /admin/products/new form can pre-fill.
//
// Same role as the Phase 43 /api/admin/import/scrape route, but
// for screenshots instead of Taobao URLs. Use this when:
//   - Apify can't scrape the source page (geo-blocked, login-walled,
//     non-Taobao sites like 1688.com / factory product pages).
//   - Admin already has screenshots saved from research.
//
// Auth: admin only.
// Rate-limited at 10/min per IP (vision API calls cost real money;
// a runaway admin clicking Extract 50x would burn budget).
//
// Accepts: multipart/form-data with a single `image` field.
// Returns: { ok: true, draft: ScreenshotDraft } or { error, message }.

import { NextRequest, NextResponse } from "next/server";
import { requireAdminApi } from "@/lib/portal-auth";
import { rateLimit, clientKey } from "@/lib/rate-limit";
import {
  extractFromScreenshot,
  mapVisionToDraft,
} from "@/lib/screenshot-import";
import { getServiceRoleClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

const RATE_LIMIT = 10;
const RATE_WINDOW_MS = 60_000;

// 12 MB hard cap. matrix_describe_images will accept larger but
// a 12 MB product page screenshot is already unusually large;
// cap early so we don't waste bandwidth on a 50 MB phone photo.
const MAX_BYTES = 12 * 1024 * 1024;

function bad(error: string, status = 400, extra: Record<string, unknown> = {}) {
  return NextResponse.json({ error, ...extra }, { status });
}

export async function POST(req: NextRequest) {
  // ── Rate limit
  const rl = rateLimit({
    key: `admin.import.screenshot:${clientKey(req)}`,
    capacity: RATE_LIMIT,
    windowMs: RATE_WINDOW_MS,
  });
  if (!rl.allowed) {
    return NextResponse.json(
      { error: "rate_limited", resetIn: rl.resetIn },
      {
        status: 429,
        headers: { "Retry-After": String(Math.ceil(rl.resetIn / 1000)) },
      },
    );
  }

  // ── Auth
  const auth = await requireAdminApi(req);
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  // ── Multipart parse
  let form: FormData;
  try {
    form = await req.formData();
  } catch (e) {
    return bad("invalid_form_data", 400, {
      message: `Could not parse multipart body: ${(e as Error).message}`,
    });
  }

  const imageField = form.get("image");
  if (!imageField || !(imageField instanceof File)) {
    return bad("image_required", 400, {
      code: "IMAGE_REQUIRED",
      message: "Upload a screenshot (PNG, JPG, WebP, or GIF).",
    });
  }

  const file = imageField as File;
  if (file.size === 0) {
    return bad("image_empty", 400, {
      code: "IMAGE_EMPTY",
      message: "The uploaded file is empty.",
    });
  }
  if (file.size > MAX_BYTES) {
    return bad("image_too_large", 413, {
      code: "IMAGE_TOO_LARGE",
      message: `Screenshot is ${(file.size / 1024 / 1024).toFixed(1)} MB; max is 12 MB.`,
    });
  }

  const mimeType = file.type || "image/png";
  const bytes = new Uint8Array(await file.arrayBuffer());

  // ── Call matrix MCP vision (subprocess via mavis CLI)
  const extraction = await extractFromScreenshot({
    imageBytes: bytes,
    mimeType,
    fileName: file.name || "screenshot.png",
  });

  if (!extraction.ok) {
    const status =
      extraction.reason === "vision_failed"
        ? 502
        : extraction.reason === "vision_timeout"
          ? 504
          : extraction.reason === "vision_unsupported_mime"
            ? 415
            : 422;
    return NextResponse.json(
      {
        error: extraction.reason,
        code: extraction.reason.toUpperCase(),
        message: extraction.message,
      },
      { status },
    );
  }

  const draft = mapVisionToDraft({
    raw: extraction.raw,
    fileName: file.name || "screenshot.png",
    provider: extraction.provider,
  });

  // ── Persist audit row (best-effort; we don't have token counts
  //    from matrix MCP, so we only log the metadata).
  try {
    const supabase = getServiceRoleClient();
    await supabase.from("ai_runs").insert({
      kind: "screenshot_extract",
      model: extraction.provider,
      source_table: null,
      source_id: auth.user.id,
      source_hash: null,
      input_tokens: 0,
      output_tokens: 0,
      cost_usd: 0,
      output: {
        file_name: file.name,
        file_bytes: file.size,
        mime_type: mimeType,
        title_en: draft.titleEn,
        category_guess: draft.categoryGuess,
        has_price: draft.factoryCnyPerPc != null,
      },
    });
  } catch {
    // ignore — audit is best-effort
  }

  return NextResponse.json({
    ok: true,
    draft,
  });
}