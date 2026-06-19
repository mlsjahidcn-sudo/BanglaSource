// /lib/alibaba-import.ts
//
// Phase 60.1 — 1688.com URL paste import.
//
// Why this is a separate file from taobao-import.ts:
//   - 1688 (Alibaba's wholesale platform) uses a different URL shape
//     (`detail.1688.com/offer/{id}.html`) and a different scraper path.
//   - Apify's Taobao/Tmall actor doesn't handle 1688; we'd need a
//     separate 1688 actor.
//   - As of Phase 60, our Apify account is at $5/$5 monthly usage
//     limit. Even if we had a 1688 actor, we couldn't run it.
//   - 1688.com serves a CAPTCHA to server-side `fetch()` calls
//     (JavaScript challenge), so direct HTML scraping is also out.
//
// The workaround: open the 1688 URL in the local browser via
// Playwright MCP, screenshot the rendered page, then send the
// screenshot to matrix MCP vision (same path as Phase 60's
// screenshot upload flow). The local browser has the user's cookies
// and isn't seen as a bot, so 1688 lets it through.
//
// Trade-offs:
//   - Slower than Apify (~10-15s per paste because of the screenshot
//     + vision round-trip vs ~5s for Apify).
//   - The vision model can only OCR text from the screenshot — it
//     can't extract image URLs (those are pixels, not text). Admin
//     pastes image URLs on the form or uses Phase 61 AI image gen.
//   - If the page uses lazy-loading (some 1688 images only appear
//     after scroll), the screenshot may miss parts. We scroll the
//     page before screenshotting to load most of it.
//
// Same downstream shape as Phase 43 (Taobao) and Phase 60 (screenshot):
// the form pre-fill code on /admin/import doesn't care which flow
// ran — they all return the same `ProductDraft`-compatible shape.

import { spawn } from "node:child_process";
import { writeFileSync, mkdtempSync, rmSync, rmdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describeImage } from "./mcp-vision";

export type AlibabaPlatform = "1688" | "world_1688";

export type ParsedAlibabaUrl =
  | {
      ok: true;
      platform: AlibabaPlatform;
      offerId: string;
      /** Canonical URL — useful for the admin to copy back. */
      canonicalUrl: string;
    }
  | {
      ok: false;
      reason:
        | "unsupported_alibaba_host"
        | "missing_offer_id"
        | "invalid_url";
    };

const ALI_1688_HOSTS = new Set([
  "detail.1688.com",
  "m.1688.com",
  "1688.com",
  "www.1688.com",
]);
// "world.1688.com" / "item.world.1688.com" is the international
// 1688 site (mostly the same products, English-leaning copy). We
// accept it and route through the same scraper.
const WORLD_1688_HOSTS = new Set([
  "world.1688.com",
  "item.world.1688.com",
]);

/**
 * Parse a 1688.com product URL into a structured form.
 *
 * Accepts:
 *   https://detail.1688.com/offer/123456789.html
 *   https://detail.1688.com/offer/abc/123456789.html (with category)
 *   https://m.1688.com/offer/abc.html?offerId=123456789 (mobile)
 *   https://world.1688.com/offer/123456789.html
 *
 * Returns a discriminated union — `ok: false` carries a `reason`
 * the UI can render directly.
 */
export function parse1688Url(input: string): ParsedAlibabaUrl {
  const trimmed = input.trim();
  let url: URL;
  try {
    url = new URL(trimmed);
  } catch {
    return { ok: false, reason: "invalid_url" };
  }
  const host = url.hostname.toLowerCase().replace(/^www\./, "");

  let platform: AlibabaPlatform | null = null;
  if (WORLD_1688_HOSTS.has(host)) platform = "world_1688";
  else if (ALI_1688_HOSTS.has(host)) platform = "1688";
  if (!platform) return { ok: false, reason: "unsupported_alibaba_host" };

  // 1688 URL shapes:
  //   1) /offer/<digits>.html        (most common)
  //   2) /offer/<cat>/<digits>.html  (with category prefix)
  //   3) ?offerId=<digits>           (mobile/track links)
  let offerId: string | null = null;
  const pathMatch = url.pathname.match(/\/offer\/(\d+)(?:\/|\.|$)/);
  if (pathMatch) offerId = pathMatch[1];
  if (!offerId) {
    offerId = url.searchParams.get("offerId");
  }
  if (!offerId || !/^\d{3,20}$/.test(offerId)) {
    return { ok: false, reason: "missing_offer_id" };
  }

  const canonicalUrl =
    platform === "1688"
      ? `https://detail.1688.com/offer/${offerId}.html`
      : `https://world.1688.com/offer/${offerId}.html`;
  return { ok: true, platform, offerId, canonicalUrl };
}

/**
 * Test whether a URL belongs to the 1688.com / Alibaba family.
 * Used by the route to dispatch before parsing.
 */
export function isAlibabaUrl(url: string): boolean {
  try {
    const u = new URL(url);
    const host = u.hostname.toLowerCase().replace(/^www\./, "");
    return (
      ALI_1688_HOSTS.has(host) ||
      WORLD_1688_HOSTS.has(host)
    );
  } catch {
    return false;
  }
}

/**
 * Open the 1688 URL in the local browser via Playwright MCP,
 * screenshot the rendered page, then run vision extraction.
 *
 * This is the workhorse function for Phase 60.1. It does the
 * following:
 *   1. Spawn `mavis mcp call playwright browser_navigate` with the URL
 *   2. Spawn another call to scroll the page so lazy-loaded
 *      content appears
 *   3. Spawn a third call to take a full-page screenshot
 *   4. Read the screenshot file from /tmp
 *   5. Call `describeImage()` (matrix MCP vision) on it
 *   6. Return the parsed JSON or a typed error
 *
 * Total wall time: ~10-15s. The route's `maxDuration = 120`
 * gives plenty of headroom.
 */
export async function scrape1688ViaPlaywright(input: {
  url: string;
  mavisBin?: string;
}): Promise<
  | {
      ok: true;
      raw: Record<string, unknown>;
      screenshotPath: string;
      provider: string;
    }
  | {
      ok: false;
      reason:
        | "playwright_navigate_failed"
        | "playwright_screenshot_failed"
        | "playwright_not_configured"
        | "vision_failed"
        | "vision_no_json"
        | "vision_invalid_json"
        | "vision_timeout";
      message: string;
      screenshotPath?: string;
    }
> {
  const { url, mavisBin = "/Users/jahidabdullah/.mavis/bin/mavis" } = input;

  // ── 1. Open the URL
  //
  // We rely on the mavis subprocess exit code (non-zero = failure)
  // rather than parsing stdout for the word "error". Playwright's
  // success output often contains phrases like "Console: 12 errors"
  // which a naive substring check would mis-flag.
  try {
    await runMcpCall(mavisBin, "playwright", "browser_navigate", { url });
  } catch (e) {
    return {
      ok: false,
      reason: "playwright_navigate_failed",
      message: `Playwright navigate failed: ${(e as Error).message}`,
    };
  }

  // ── 2. Scroll the page so lazy-loaded images render before
  //      we screenshot. 1688 detail pages commonly lazy-load
  //      description images below the fold.
  try {
    await runMcpCall(mavisBin, "playwright", "browser_evaluate", {
      function: `async () => {
        const total = document.documentElement.scrollHeight;
        const step = window.innerHeight;
        for (let y = 0; y < total; y += step) {
          window.scrollTo(0, y);
          await new Promise(r => setTimeout(r, 250));
        }
        window.scrollTo(0, 0);
        await new Promise(r => setTimeout(r, 500));
        return { scrollHeight: total };
      }`,
    });
  } catch {
    // Scroll failure is non-fatal — the screenshot still captures
    // the visible viewport which usually includes the title + price.
  }

  // ── 3. Screenshot the page
  let screenshotPath: string | null = null;
  try {
    const out = await runMcpCall(
      mavisBin,
      "playwright",
      "browser_take_screenshot",
      {
        filename: "1688-import.png",
        fullPage: true,
        type: "png",
      },
    );
    // The mavis CLI returns the saved image path in a line like
    //   "[image saved: /Users/.../mcp-image-XXXXX.png (image/png)]"
    const m = out.match(/\[image saved:\s+(\S+)\s+\(/);
    if (m) screenshotPath = m[1];
  } catch (e) {
    return {
      ok: false,
      reason: "playwright_screenshot_failed",
      message: `Playwright screenshot failed: ${(e as Error).message}`,
    };
  }
  if (!screenshotPath) {
    return {
      ok: false,
      reason: "playwright_screenshot_failed",
      message:
        "Playwright screenshot did not return a saved-file path. The browser may be unresponsive.",
    };
  }

  // ── 4. Copy to our own /tmp dir so we own the lifecycle.
  //      matrix_describe_images reads from an absolute path; the
  //      Playwright tmp dir may be cleaned up between calls.
  const ourDir = mkdtempSync(join(tmpdir(), "alibaba-import-"));
  const safeName = `1688-${Date.now()}.png`;
  const ourPath = join(ourDir, safeName);
  try {
    const buf = (await import("node:fs")).readFileSync(screenshotPath);
    writeFileSync(ourPath, buf, { mode: 0o600 });
  } catch (e) {
    return {
      ok: false,
      reason: "playwright_screenshot_failed",
      message: `Could not read Playwright's screenshot at ${screenshotPath}: ${(e as Error).message}`,
      screenshotPath,
    };
  }

  // ── 5. Vision extraction
  const vision = await describeImage({
    file: ourPath,
    prompt: VISION_PROMPT,
  });

  // Clean up our /tmp copy. Playwright's own copy is left alone
  // (it'll be cleaned by the daemon's retention policy).
  try {
    rmSync(ourPath, { force: true });
    rmdirSync(ourDir, { recursive: true });
  } catch {
    // best-effort
  }

  if (!vision.ok) {
    return {
      ok: false,
      reason:
        vision.error === "vision_timeout" ? "vision_timeout" : "vision_failed",
      message: vision.message,
      screenshotPath,
    };
  }

  // ── 6. Parse the JSON response from vision
  let parsed: Record<string, unknown>;
  try {
    parsed = JSON.parse(vision.description);
  } catch {
    const m = vision.description.match(/\{[\s\S]*\}/);
    if (!m) {
      return {
        ok: false,
        reason: "vision_invalid_json",
        message: `Vision returned non-JSON (first 200 chars): ${vision.description.slice(0, 200)}`,
        screenshotPath,
      };
    }
    try {
      parsed = JSON.parse(m[0]);
    } catch {
      return {
        ok: false,
        reason: "vision_invalid_json",
        message: `Vision returned malformed JSON: ${vision.description.slice(0, 200)}`,
        screenshotPath,
      };
    }
  }

  return {
    ok: true,
    raw: parsed,
    screenshotPath,
    provider: "matrix_describe_images",
  };
}

/**
 * Same prompt as Phase 60's screenshot import — keep them in sync
 * so the JSON shape is identical and downstream form pre-fill code
 * can treat both flows uniformly.
 */
const VISION_PROMPT = `You are a product data extractor for a B2B wholesale marketplace called BanglaSource. The image shows a 1688.com (Alibaba wholesale) product page screenshot.

Extract the product information into a single JSON object with this exact shape:

{
  "titleZh": "<original Chinese title from the screenshot, or null if not visible>",
  "titleEn": "<English marketing title — translate the Chinese into a concise, professional B2B-style title>",
  "descriptionZh": "<Chinese description text visible on the page, or null>",
  "descriptionEn": "<English description — summarize the key selling points (material, features, use case) into 1-3 sentences>",
  "factoryCnyPerPc": <displayed unit price in CNY yuan as a number, or null if not visible>,
  "factoryMoq": <minimum order quantity as an integer, default 1 if not shown>,
  "categoryGuess": "<one of: gadgets, eyewear, shoes, bags, watches, beauty>",
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

export type ProductDraft = {
  sourceId: string;
  sourceUrl: string;
  sourcePlatform: "taobao" | "tmall" | "world_taobao" | "1688" | "world_1688" | "screenshot";
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
  notes?: string | null;
  provider?: string;
};

/**
 * Map the vision JSON output to the BanglaSource product draft
 * shape used by /admin/import + /api/admin/products POST. Same
 * pattern as Phase 43's mapApifyToProductDraft — string fields are
 * trimmed + nulled, numbers are coerced + nulled, category is
 * validated against the allowed set, and a stable sourceId is
 * synthesized from the offer ID.
 */
export function map1688ToProductDraft(input: {
  raw: Record<string, unknown>;
  parsed: ParsedAlibabaUrl & { ok: true };
  screenshotPath: string;
  provider: string;
}): ProductDraft {
  const { raw, parsed, screenshotPath, provider } = input;

  const s = (v: unknown): string | null => {
    if (typeof v !== "string") return null;
    const t = v.trim();
    return t.length > 0 ? t : null;
  };
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

  const ALLOWED_CATEGORIES = new Set([
    "gadgets",
    "eyewear",
    "shoes",
    "bags",
    "watches",
    "beauty",
  ]);
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

  // Same as Phase 60: vision can't read image URLs from pixels.
  // Admin pastes image URLs on the form or uses Phase 61 AI image gen.
  const images: string[] = [];

  return {
    sourceId: `1688-${parsed.offerId}`,
    sourceUrl: parsed.canonicalUrl,
    sourcePlatform: parsed.platform,
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
    notes: notes
      ? `${notes} (screenshot saved at ${screenshotPath})`
      : `screenshot saved at ${screenshotPath}`,
    provider,
  };
}

/**
 * Subprocess wrapper: spawn `mavis mcp call <server> <tool> --file
 * <args.json>` and return stdout. Used for both Playwright
 * (navigate, scroll, screenshot) and the matrix vision call.
 *
 * Returns the raw stdout as a string; callers parse the structured
 * fields they need (e.g. `[image saved: ...]` for screenshots).
 */
async function runMcpCall(
  mavisBin: string,
  server: string,
  tool: string,
  args: Record<string, unknown>,
): Promise<string> {
  const tmpDir = mkdtempSync(join(tmpdir(), "mcp-call-"));
  const argsFile = join(tmpDir, "args.json");
  writeFileSync(argsFile, JSON.stringify(args), "utf8");
  const child = spawn(
    mavisBin,
    ["mcp", "call", server, tool, "--file", argsFile],
    { stdio: ["ignore", "pipe", "pipe"] },
  );
  const stdoutP = drain(child.stdout);
  const stderrP = drain(child.stderr);
  const codeP = new Promise<number>((resolve) =>
    child.on("close", (c) => resolve(c ?? -1)),
  );
  const TIMEOUT_MS = 60_000;
  const timeout = new Promise<never>((_, reject) =>
    setTimeout(() => reject(new Error("mcp_call_timeout")), TIMEOUT_MS),
  );
  let stdout: string;
  let stderr: string;
  let code: number;
  try {
    [stdout, stderr, code] = await Promise.race([
      Promise.all([stdoutP, stderrP, codeP]),
      timeout,
    ]);
  } catch (e) {
    child.kill("SIGKILL");
    throw new Error(`mcp call timeout: ${(e as Error).message}`);
  }
  // Clean up tmp file.
  try {
    rmSync(argsFile, { force: true });
    rmdirSync(tmpDir, { recursive: true });
  } catch {
    // best-effort
  }
  if (code !== 0) {
    throw new Error(
      `mavis mcp call ${server} ${tool} exited with code ${code}. stderr: ${stderr.slice(0, 300)}`,
    );
  }
  return stdout;
}

function drain(stream: NodeJS.ReadableStream): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    stream.on("data", (c: Buffer) => chunks.push(c));
    stream.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
    stream.on("error", reject);
  });
}