// POST /api/admin/import/scrape
//
// Phase 43 — admin pastes a Taobao/Tmall URL, this route scrapes
// it via Apify (actor zen-studio/taobao-detail-scraper), and
// returns a product draft the existing /admin/products/new form
// can pre-fill. Admin edits and submits → goes through the
// existing /api/admin/products POST.
//
// NOT a real-time "fill this in for me" endpoint — the Apify
// run takes 5-20s, and the route waits up to 90s before timing
// out. The /admin/import page shows a loading state.
//
// Rate-limited at 10/min per IP (this is an expensive external
// API call; we don't want a runaway admin clicking Fetch 50x).
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

  // ── APIFY_TOKEN check
  const apifyToken = process.env.APIFY_TOKEN;
  if (!apifyToken) {
    return bad("apify_token_not_set", 500, {
      code: "APIFY_TOKEN_MISSING",
      message: "Set APIFY_TOKEN in env to enable Taobao import.",
    });
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
      return "Only Taobao and Tmall URLs are supported. Try item.taobao.com, detail.tmall.com, or world.taobao.com.";
    case "missing_item_id":
      return "Couldn't extract the item ID from that URL. Make sure it looks like https://item.taobao.com/item.htm?id=123456.";
    default:
      return reason;
  }
}