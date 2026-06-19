// POST /api/admin/import/scrape
//
// Phase 43 + Phase 60.1 — admin pastes a product URL, this route
// scrapes it and returns a product draft the existing
// /admin/products/new form can pre-fill.
//
// DISPATCH (added Phase 60.1):
//   - 1688.com / world.1688.com URLs → Playwright + vision path
//     (uses the local browser via Playwright MCP, screenshots the
//     rendered page, then runs matrix MCP vision OCR). Used because
//     (a) Apify's 1688 actors are blocked by the platform's geo/IP
//     rules and (b) 1688.com serves a CAPTCHA to server-side `fetch()`
//     calls — only a real browser session can render the page.
//   - Taobao / Tmall / World Taobao URLs → existing Apify path
//     (Phase 43). Unchanged.
//
// NOT a real-time "fill this in for me" endpoint — the
// scrape takes 10-30s depending on path, and the route waits up
// to 120s before timing out. The /admin/import page shows a
// loading state.
//
// Rate-limited at 10/min per IP (these are expensive external
// API calls; we don't want a runaway admin clicking Fetch 50x).
//
// Auth: admin only.

import { NextRequest, NextResponse } from "next/server";
import { requireAdminApi } from "@/lib/portal-auth";
import { rateLimit, clientKey } from "@/lib/rate-limit";
import {
  parseTaobaoUrl,
  scrapeTaobao,
  mapApifyToProductDraft,
} from "@/lib/taobao-import";
import {
  isAlibabaUrl,
  parse1688Url,
  scrape1688ViaPlaywright,
  map1688ToProductDraft,
} from "@/lib/alibaba-import";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

const RATE_LIMIT = 10;
const RATE_WINDOW_MS = 60_000;

function bad(error: string, status = 400, extra: Record<string, unknown> = {}) {
  return NextResponse.json({ error, ...extra }, { status });
}

export async function POST(req: NextRequest) {
  // ── Rate limit
  const rl = rateLimit({
    key: `admin.import.scrape:${clientKey(req)}`,
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

  // ── Body
  let body: { url?: unknown } = {};
  try {
    body = (await req.json()) as { url?: unknown };
  } catch {
    return bad("invalid_json");
  }
  const url = typeof body.url === "string" ? body.url.trim() : "";
  if (!url) return bad("url_required", 400, { code: "URL_REQUIRED" });

  // ── Dispatch: 1688 (Alibaba) goes through Playwright + vision;
  //    Taobao/Tmall go through Apify.
  if (isAlibabaUrl(url)) {
    return await handle1688Scrape(url, auth.user.id);
  }
  return await handleTaobaoScrape(url, auth.user.id);
}

/**
 * Phase 60.1 — 1688.com URL paste via Playwright + matrix vision.
 *
 * No Apify usage on this path (we're at the monthly limit and
 * 1688 actors are unreliable anyway). Instead, we open the URL
 * in the local browser, screenshot, and run vision OCR.
 */
async function handle1688Scrape(url: string, userId: string) {
  const parsed = parse1688Url(url);
  if (!parsed.ok) {
    return bad(parsed.reason, 400, {
      code: parsed.reason.toUpperCase(),
      message: friendly1688ParseError(parsed.reason),
    });
  }

  const scrape = await scrape1688ViaPlaywright({
    url: parsed.canonicalUrl,
  });
  if (!scrape.ok) {
    return NextResponse.json(
      {
        error: scrape.reason,
        code: scrape.reason.toUpperCase(),
        message: scrape.message,
        screenshotPath: scrape.screenshotPath,
      },
      {
        status:
          scrape.reason === "vision_timeout"
            ? 504
            : scrape.reason === "playwright_screenshot_failed" ||
                scrape.reason === "playwright_navigate_failed"
              ? 502
              : 422,
      },
    );
  }

  const draft = map1688ToProductDraft({
    raw: scrape.raw,
    parsed,
    screenshotPath: scrape.screenshotPath,
    provider: scrape.provider,
  });

  // Audit row (best-effort).
  try {
    const { getServiceRoleClient } = await import("@/lib/supabase/server");
    const supabase = getServiceRoleClient();
    await supabase.from("ai_runs").insert({
      kind: "alibaba_1688_extract",
      model: scrape.provider,
      source_table: null,
      source_id: userId,
      source_hash: null,
      input_tokens: 0,
      output_tokens: 0,
      cost_usd: 0,
      output: {
        url: parsed.canonicalUrl,
        offer_id: parsed.offerId,
        screenshot_path: scrape.screenshotPath,
        title_en: draft.titleEn,
        category_guess: draft.categoryGuess,
        has_price: draft.factoryCnyPerPc != null,
      },
    });
  } catch {
    // ignore
  }

  return NextResponse.json({
    ok: true,
    draft,
    screenshotPath: scrape.screenshotPath,
  });
}

/**
 * Phase 43 — Taobao/Tmall URL paste via Apify actor.
 */
async function handleTaobaoScrape(url: string, userId: string) {
  // ── APIFY_TOKEN check
  const apifyToken = process.env.APIFY_TOKEN;
  if (!apifyToken) {
    return bad("apify_token_not_set", 500, {
      code: "APIFY_TOKEN_MISSING",
      message: "Set APIFY_TOKEN in env to enable Taobao import.",
    });
  }

  // ── Parse URL
  const parsed = parseTaobaoUrl(url);
  if (!parsed.ok) {
    return bad(parsed.reason, 400, {
      code: parsed.reason.toUpperCase(),
      message: friendlyParseError(parsed.reason),
    });
  }

  // ── Scrape via Apify
  const scrape = await scrapeTaobao({ url: parsed.canonicalUrl, apifyToken });
  if (!scrape.ok) {
    return NextResponse.json(
      {
        error: scrape.reason,
        code: scrape.reason.toUpperCase(),
        message: scrape.message,
        runId: scrape.runId,
      },
      { status: scrape.reason === "apify_timeout" ? 504 : 502 },
    );
  }

  // ── Map to product draft
  const draft = mapApifyToProductDraft({
    item: scrape.item,
    parsed,
    runId: scrape.runId,
  });

  // Audit row (best-effort)
  try {
    const { getServiceRoleClient } = await import("@/lib/supabase/server");
    const supabase = getServiceRoleClient();
    await supabase.from("ai_runs").insert({
      kind: "taobao_scrape",
      model: "sian.agency/taobao-tmall-product-scraper",
      source_table: null,
      source_id: userId,
      source_hash: null,
      input_tokens: 0,
      output_tokens: 0,
      cost_usd: 0,
      output: {
        run_id: scrape.runId,
        url: parsed.canonicalUrl,
        platform: parsed.platform,
        title_en: draft.titleEn,
        category_guess: draft.categoryGuess,
        has_price: draft.factoryCnyPerPc != null,
      },
    });
  } catch {
    // ignore
  }

  return NextResponse.json({
    ok: true,
    draft,
    apifyRunId: scrape.runId,
  });
}

function friendlyParseError(reason: string): string {
  switch (reason) {
    case "invalid_url":
      return "That doesn't look like a valid URL.";
    case "pinduoduo_unsupported":
      return "Pinduoduo URLs aren't supported (their pages are JS-rendered and the API requires app auth). Paste a Taobao/Tmall link instead, or use the manual form.";
    case "unsupported_platform":
      return "Only Taobao, Tmall, and 1688 URLs are supported here. Try item.taobao.com, detail.tmall.com, or detail.1688.com. For 1688 URLs the flow is different (no Apify involved) — paste any 1688 product link and the system will open it in the local browser, screenshot it, and extract the product data via vision.";
    case "missing_item_id":
      return "Couldn't extract the item ID from that URL. Make sure it looks like https://item.taobao.com/item.htm?id=123456.";
    default:
      return reason;
  }
}

function friendly1688ParseError(reason: string): string {
  switch (reason) {
    case "invalid_url":
      return "That doesn't look like a valid URL.";
    case "unsupported_alibaba_host":
      return "Only 1688.com URLs are supported here. Try detail.1688.com or world.1688.com. For Taobao/Tmall URLs, paste them in the same box — the system dispatches to the right scraper automatically.";
    case "missing_offer_id":
      return "Couldn't extract the offer ID from that 1688 URL. Make sure it looks like https://detail.1688.com/offer/123456789.html.";
    default:
      return reason;
  }
}