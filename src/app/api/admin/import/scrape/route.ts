// POST /api/admin/import/scrape
//
// Phase 15a: paste a Pinduoduo or Taobao share URL, hit
// "Scrape", get the normalized data back. The admin then
// reviews / edits the form (title, factory FOB, weight,
// category, images to keep) and POSTs to
// /api/admin/import/save to create the product.
//
// Auth: admin only.
//
// Body: { url: string }
// Response: { ok: true, product: ScrapedProduct } |
//           { ok: false, error: "unsupported_url" |
//                                "scrape_failed: ..." |
//                                "rate_limited" }

import { NextRequest, NextResponse } from "next/server";
import { requireAdminApi } from "@/lib/portal-auth";
import { rateLimit, clientKey } from "@/lib/rate-limit";
import { detectSource, scrapeProduct, type Source } from "@/lib/ingest/pinduoduo";

const RATE_LIMIT = 10;
const RATE_WINDOW_MS = 60_000;

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
    key: `admin.import.scrape:${clientKey(req)}`,
    capacity: RATE_LIMIT,
    windowMs: RATE_WINDOW_MS,
  });
  if (!rl.allowed) {
    return NextResponse.json(
      {
        ok: false,
        error: "rate_limited",
        message: `Too many scrape requests. Try again in ${Math.ceil(
          rl.resetIn / 1000,
        )}s.`,
      },
      {
        status: 429,
        headers: {
          "Retry-After": String(Math.ceil(rl.resetIn / 1000)),
        },
      },
    );
  }

  // ── Body
  let body: { url?: string } = {};
  try {
    body = (await req.json()) ?? {};
  } catch {
    return NextResponse.json(
      { ok: false, error: "invalid_json" },
      { status: 400 },
    );
  }
  const url = (body.url ?? "").trim();
  if (!url) {
    return NextResponse.json(
      { ok: false, error: "url_required" },
      { status: 400 },
    );
  }

  // ── Detect platform
  const source: Source | null = detectSource(url);
  if (!source) {
    return NextResponse.json(
      {
        ok: false,
        error: "unsupported_url",
        message:
          "URL must be a Pinduoduo (pinduoduo.com, yangkeduo.com, temu.com) or Taobao (taobao.com, tmall.com) link.",
      },
      { status: 400 },
    );
  }

  // ── Scrape
  try {
    const product = await scrapeProduct(url, source);
    return NextResponse.json({ ok: true, product });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Unknown scrape error";
    return NextResponse.json(
      {
        ok: false,
        error: "scrape_failed",
        message: msg,
      },
      { status: 500 },
    );
  }
}
