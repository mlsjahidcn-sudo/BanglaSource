// /lib/screenshot-import.ts
//
// Phase 60 — admin uploads a product page screenshot (PNG/JPG), we
// run it through the local matrix MCP vision (matrix_describe_images)
// and extract a BanglaSource-compatible ProductDraft that the
// existing /admin/products/new form can pre-fill.

import { writeFileSync, mkdtempSync, rmSync, rmdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describeImage } from "./mcp-vision";
//
// Why this exists alongside Phase 43's URL paste flow:
//   - Apify's Taobao/Tmall actor gets geo-blocked for some items
//     ("Upstream error: This item is not supported.") and can't
//     scrape non-Taobao sites (1688.com, Alibaba.com, factory
//     wholesale pages, etc.).
//   - When admins already have screenshots saved from research
//     (e.g. they browsed 1688 in Chrome and saved 20 PNGs), forcing
//     them to find every URL again is wasted work.
//
// Why matrix MCP and not direct LLM API:
//   - We tried apinebula.com (already set up for GPT Image 2) but
//     it only serves the `vip_image2` group — image-generation
//     models only. GPT-4o / GPT-4-vision all return
//     "model_not_found".
//   - DeepSeek doesn't ship vision in our configured models.
//   - The matrix MCP daemon already runs locally and provides
//     vision via matrix_describe_images with file/url/base64 inputs.
//
// What we ask the vision model to extract:
//   - titleZh        (original Chinese title from the screenshot)
//   - titleEn        (English marketing title)
//   - descriptionZh  (original Chinese description)
//   - descriptionEn  (English description)
//   - factoryCnyPerPc (the displayed price, in CNY yuan)
//   - factoryMoq     (minimum order quantity, default 1)
//   - categoryGuess  (one of: gadgets, eyewear, shoes, bags, watches, beauty)
//   - weightKg       (if visible on the page)
//   - volumeCbm      (rarely visible)
//   - images         (image URLs the page links to; usually NOT in
//                     a screenshot — vision can't recover URLs from
//                     pixels, only OCR text. We return [] and let the
//                     admin paste image URLs manually.)
//
// Important honesty note: vision OCR can extract TEXT from a
// screenshot but can't extract IMAGE URLs (the URLs aren't pixels).
// So `images: []` will be the common case. Admin pastes the image
// URLs separately OR uses Phase 61's AI image gen after save.
//
// Flow:
//   1. Admin uploads screenshot via /admin/import (screenshot tab).
//   2. POST /api/admin/import/screenshot with multipart/form-data.
//   3. Route saves the file to /tmp, calls extractFromScreenshot(),
//      which spawns matrix_describe_images via the mavis CLI.
//   4. Parses the model's JSON response into a ScreenshotDraft
//      with the same shape as Phase 43's Apify draft so downstream
//      form pre-fill code doesn't need to know which flow ran.

export type ScreenshotDraft = {
  sourceId: string;
  sourceUrl: string;
  sourcePlatform: "screenshot";
  scrapedAt: string;
  titleZh: string | null;
  titleEn: string | null;
  descriptionZh: string | null;
  descriptionEn: string | null;
  categoryGuess: string | null;
  factoryCnyPerPc: number | null;
  factoryMoq: number | null;
  supplierName: string | null;
  images: string[];
  /** Free-text notes from the vision model — what it saw, what it guessed. */
  notes: string | null;
  /** Vision provider used (matrix MCP). */
  provider: string;
};

const ALLOWED_CATEGORIES = new Set([
  "gadgets",
  "eyewear",
  "shoes",
  "bags",
  "watches",
  "beauty",
]);

/** Same categories the URL import flow accepts. */
const CATEGORY_HINT = Array.from(ALLOWED_CATEGORIES).join(", ");

/**
 * Structured prompt to GPT-4o. Asks for a single JSON object
 * with the exact field names below. We don't use response_format
 * because apinebula's OpenAI-compatible proxy is sometimes finicky
 * with image content + json_object together; we just rely on the
 * prompt and post-parse the response.
 */
const SYSTEM_PROMPT = `You are a product data extractor for a B2B wholesale marketplace called BanglaSource. The admin has uploaded a screenshot of a product page (Chinese wholesale sites like 1688, Taobao, Tmall, or factory product pages).

Extract the product information into a single JSON object with this exact shape:

{
  "titleZh": "<original Chinese title from the screenshot, or null if not visible>",
  "titleEn": "<English marketing title — translate the Chinese into a concise, professional B2B-style title>",
  "descriptionZh": "<Chinese description text visible on the page, or null>",
  "descriptionEn": "<English description — summarize the key selling points (material, features, use case) into 1-3 sentences>",
  "factoryCnyPerPc": <displayed unit price in CNY yuan as a number, or null if not visible>,
  "factoryMoq": <minimum order quantity as an integer, default 1 if not shown>,
  "categoryGuess": "<one of: ${CATEGORY_HINT}>",
  "weightKg": <per-piece weight in kg as a number, or null if not visible>,
  "volumeCbm": <per-piece volume in cubic meters as a number, or null if not visible>,
  "supplierName": "<factory / shop name if visible, or null>",
  "notes": "<1-2 sentences describing what you saw and any uncertainties (e.g. 'price visible but MOQ unclear; defaulted to 1')>"
}

Rules:
- Be CONSERVATIVE: prefer null over guessing. A wrong number is worse than a missing field.
- For titleEn: short, professional, B2B tone. Not clickbait, not keyword-stuffed.
- For descriptionEn: factual, 1-3 sentences, no marketing fluff.
- For price: extract the per-piece display price. If price shows "¥15-20" range, use the lower bound.
- For categoryGuess: choose ONE from the allowed list. If unsure, return null.
- Return ONLY the JSON object. No prose, no markdown fences, no explanation outside the JSON.`;

const USER_PROMPT =
  "Here is a product page screenshot. Extract the product data as JSON.";

/**
 * Call matrix MCP vision (matrix_describe_images) with the uploaded
 * screenshot. Returns the raw parsed JSON object the model returned.
 *
 * Saves the bytes to /tmp first because matrix_describe_images
 * accepts file paths, not inline bytes. The tmp file is created
 * with mode 0600 and unlinked after the call so we don't leave
 * product screenshots lying around in /tmp indefinitely.
 */
export async function extractFromScreenshot(input: {
  imageBytes: Uint8Array;
  mimeType: string;
  fileName: string;
}): Promise<{
  ok: true;
  raw: Record<string, unknown>;
  provider: string;
} | {
  ok: false;
  reason: "vision_failed" | "vision_no_json" | "vision_invalid_json" | "vision_unsupported_mime" | "vision_timeout";
  message: string;
}> {
  const { imageBytes, mimeType, fileName } = input;

  // matrix_describe_images accepts: image/png, image/jpeg,
  // image/webp, image/gif. Reject anything else early so the
  // admin gets a clear error.
  const ALLOWED_MIME = new Set([
    "image/png",
    "image/jpeg",
    "image/jpg",
    "image/webp",
    "image/gif",
  ]);
  if (!ALLOWED_MIME.has(mimeType)) {
    return {
      ok: false,
      reason: "vision_unsupported_mime",
      message: `Unsupported image type: ${mimeType}. Use PNG, JPG, WebP, or GIF.`,
    };
  }

  // Save the upload to /tmp so matrix_describe_images can read it.
  // mkdtempSync ensures we don't collide with other concurrent
  // uploads; the file is unlinked after the call.
  const dir = mkdtempSync(join(tmpdir(), "screenshot-import-"));
  const safeName = fileName.replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 80);
  const tmpFile = join(dir, safeName || "screenshot.png");
  writeFileSync(tmpFile, imageBytes, { mode: 0o600 });

  let description: string;
  try {
    const result = await describeImage({
      file: tmpFile,
      prompt: SYSTEM_PROMPT + "\n\n" + USER_PROMPT,
    });
    if (!result.ok) {
      return {
        ok: false,
        reason:
          result.error === "vision_timeout" ? "vision_timeout" : "vision_failed",
        message: result.message,
      };
    }
    description = result.description;
  } finally {
    // Clean up tmp file + dir.
    try {
      rmSync(tmpFile, { force: true });
      rmdirSync(dir, { recursive: true });
    } catch {
      // best-effort
    }
  }

  if (!description || !description.trim()) {
    return {
      ok: false,
      reason: "vision_no_json",
      message: "Vision model returned empty content.",
    };
  }

  // Try strict JSON first, then fall back to extracting the first
  // {...} block (vision models sometimes wrap JSON in prose).
  let parsed: Record<string, unknown>;
  try {
    parsed = JSON.parse(description);
  } catch {
    const m = description.match(/\{[\s\S]*\}/);
    if (!m) {
      return {
        ok: false,
        reason: "vision_invalid_json",
        message: `Vision model returned non-JSON (first 200 chars): ${description.slice(0, 200)}`,
      };
    }
    try {
      parsed = JSON.parse(m[0]);
    } catch {
      return {
        ok: false,
        reason: "vision_invalid_json",
        message: `Vision model returned malformed JSON: ${description.slice(0, 200)}`,
      };
    }
  }

  return {
    ok: true,
    raw: parsed,
    provider: "matrix_describe_images",
  };
}

/**
 * Map the raw vision-model JSON to the BanglaSource `ScreenshotDraft`
 * shape used by the /admin/import form. Same field names as
 * `ProductDraft` (Phase 43) where they overlap, so the form's
 * pre-fill code can handle both flows uniformly.
 */
export function mapVisionToDraft(input: {
  raw: Record<string, unknown>;
  fileName: string;
  provider: string;
}): ScreenshotDraft {
  const { raw, fileName, provider } = input;

  // String fields — trim + null if empty.
  const s = (v: unknown): string | null => {
    if (typeof v !== "string") return null;
    const t = v.trim();
    return t.length > 0 ? t : null;
  };

  // Numeric fields — return null if not a positive finite number.
  const n = (v: unknown): number | null => {
    if (typeof v === "number" && Number.isFinite(v) && v > 0) return v;
    if (typeof v === "string") {
      const m = v.replace(/[^\d.]/g, "");
      if (!m) return null;
      const f = parseFloat(m);
      if (Number.isFinite(f) && f > 0) return f;
    }
    return null;
  };

  const titleZh = s(raw.titleZh);
  const titleEn = s(raw.titleEn);
  const descriptionZh = s(raw.descriptionZh);
  const descriptionEn = s(raw.descriptionEn);
  const factoryCnyPerPc = n(raw.factoryCnyPerPc);
  const factoryMoqRaw = n(raw.factoryMoq);
  const factoryMoq =
    factoryMoqRaw != null ? Math.max(1, Math.floor(factoryMoqRaw)) : 1;
  const categoryRaw = s(raw.categoryGuess);
  const categoryGuess =
    categoryRaw && ALLOWED_CATEGORIES.has(categoryRaw) ? categoryRaw : null;
  const supplierName = s(raw.supplierName);
  const notes = s(raw.notes);

  // We don't try to extract image URLs from a screenshot — the URLs
  // aren't visible in the pixels. Admin pastes them separately, or
  // uses Phase 61's AI image gen after save.
  const images: string[] = [];

  // Synthesize a stable sourceId from the file name. The admin can
  // edit it on the form before save. We strip the extension and
  // prefix with "ss-" to mark it as a screenshot import (different
  // from "taobao-XXX" so the sourcePlatform field is distinguishable).
  const baseName = fileName
    .replace(/\.(png|jpe?g|webp|gif)$/i, "")
    .replace(/[^a-zA-Z0-9._-]/g, "-")
    .slice(0, 60);
  const sourceId = baseName ? `ss-${baseName}` : `ss-${Date.now()}`;

  return {
    sourceId,
    sourceUrl: "",
    sourcePlatform: "screenshot",
    scrapedAt: new Date().toISOString(),
    titleZh,
    titleEn,
    descriptionZh,
    descriptionEn,
    categoryGuess,
    factoryCnyPerPc,
    factoryMoq,
    supplierName,
    images,
    notes,
    provider,
  };
}