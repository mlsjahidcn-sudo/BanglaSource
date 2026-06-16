// /api/recently-viewed
//
// GET /api/recently-viewed?limit=8
//
// Returns the most-recently-viewed products for the current user
// (or session). The page_view_tracker middleware already records
// each PDP visit. We dedupe by product (keep only the latest
// view per product) and join products for image/title/price.
//
// For anon: uses session_id. For signed-in: uses user_id.

import { NextRequest, NextResponse } from "next/server";
import { getServiceRoleClient } from "@/lib/supabase/server";
import { getServerClient } from "@/lib/supabase/server";
import { FX_CNY_BDT } from "@/lib/pricing";
import { rateLimit, clientKey } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

const RATE_LIMIT = 60;
const RATE_WINDOW_MS = 60_000;

export async function GET(req: NextRequest) {
  const rl = rateLimit({
    key: `recently-viewed:${clientKey(req)}`,
    capacity: RATE_LIMIT,
    windowMs: RATE_WINDOW_MS,
  });
  if (!rl.allowed) {
    return NextResponse.json(
      { ok: false, error: "rate_limited" },
      { status: 429 },
    );
  }
  const url = new URL(req.url);
  const limit = Math.min(
    24,
    Math.max(1, parseInt(url.searchParams.get("limit") ?? "8", 10) || 8),
  );
  const supabase = getServiceRoleClient();

  // Determine the session id (the only stable key in `page_views`).
  // The `page_views` table does NOT have a `user_id` column — the
  // middleware that records views looks up the active `bs_sid`
  // cookie at request time, so even for signed-in users we read by
  // session_id.
  let sessionId: string | null = null;
  // First, check the cookie (works for both anon and signed-in)
  sessionId = req.cookies.get("bs_sid")?.value ?? null;
  if (!sessionId) {
    // No cookie → nothing to read. (Signed-in users get a session
    // via Supabase auth but their page views are still keyed by
    // `bs_sid` from the middleware.)
    return NextResponse.json({ ok: true, items: [] });
  }

  // Pull recent page_views for PDPs
  const { data: views, error } = await supabase
    .from("page_views")
    .select("path, recorded_at")
    .eq("session_id", sessionId)
    .like("path", "/products/%")
    .order("recorded_at", { ascending: false })
    .limit(200);
  if (error || !views || views.length === 0) {
    return NextResponse.json({ ok: true, items: [] });
  }
  // Dedupe by source_id, keep the latest
  const bySource = new Map<string, string>();
  for (const v of views) {
    const sid = v.path.replace("/products/", "");
    if (!bySource.has(sid)) bySource.set(sid, v.recorded_at);
  }
  const sourceIds = Array.from(bySource.keys());
  if (sourceIds.length === 0) {
    return NextResponse.json({ ok: true, items: [] });
  }
  const { data: products, error: prodErr } = await supabase
    .from("products")
    .select(
      "source_id, title_en, title_bn, images, category, factory_moq, price_tiers(price_cny_fen), active",
    )
    .in("source_id", sourceIds)
    .eq("active", true);
  if (prodErr || !products) {
    return NextResponse.json(
      { ok: false, error: prodErr?.message ?? "db_error" },
      { status: 500 },
    );
  }
  // Hydrate + sort by view-recency
  const items = (products as Array<{
    source_id: string;
    title_en: string;
    title_bn: string;
    images: string[];
    category: string;
    factory_moq: number;
    price_tiers: Array<{ price_cny_fen: number }>;
  }>)
    .map((p) => {
      const tiers = p.price_tiers ?? [];
      const minFen = tiers.length
        ? Math.min(...tiers.map((t) => t.price_cny_fen))
        : 0;
      return {
        source_id: p.source_id,
        title_en: p.title_en,
        title_bn: p.title_bn,
        image: (p.images ?? [])[0] ?? "",
        category: p.category,
        factory_moq: p.factory_moq,
        min_bdt: Math.ceil((minFen / 100) * FX_CNY_BDT),
        viewed_at: bySource.get(p.source_id) ?? new Date().toISOString(),
      };
    })
    .sort(
      (a, b) =>
        new Date(b.viewed_at).getTime() - new Date(a.viewed_at).getTime(),
    )
    .slice(0, limit);
  return NextResponse.json(
    { ok: true, items },
    { headers: { "Cache-Control": "private, max-age=30" } },
  );
}
