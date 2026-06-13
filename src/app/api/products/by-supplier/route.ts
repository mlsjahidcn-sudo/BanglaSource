// /api/products/by-supplier
//
// GET /api/products/by-supplier?name=<supplier_name>&exclude=<source_id>&limit=8
//
// Returns up to `limit` other active products from the same
// supplier_name. Excludes the given source_id (the current PDP).
// Used by the "Same factory" component on the PDP.
//
// We dedupe by supplier_name (not supplier_id) because not every
// product has a stable supplier_id — the Apify ingest sometimes
// only fills the human-readable name.

import { NextRequest, NextResponse } from "next/server";
import { getServiceRoleClient } from "@/lib/supabase/server";
import { FX_CNY_BDT } from "@/lib/pricing";
import { rateLimit, clientKey } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

const RATE_LIMIT = 200;
const RATE_WINDOW_MS = 60_000;

export async function GET(req: NextRequest) {
  const rl = rateLimit({
    key: `by-supplier:${clientKey(req)}`,
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
  const name = url.searchParams.get("name")?.trim() ?? "";
  const exclude = url.searchParams.get("exclude") ?? "";
  const limit = Math.min(
    24,
    Math.max(1, parseInt(url.searchParams.get("limit") ?? "8", 10) || 8),
  );
  if (!name) {
    return NextResponse.json({ ok: false, error: "missing_name" }, { status: 400 });
  }
  const supabase = getServiceRoleClient();
  const { data, error } = await supabase
    .from("products")
    .select(
      "source_id, title_en, title_bn, images, factory_moq, price_tiers(price_cny_fen)",
    )
    .eq("supplier_name", name)
    .eq("active", true)
    .neq("source_id", exclude)
    .order("rating_overall", { ascending: false })
    .order("order_count_30d", { ascending: false })
    .limit(limit);
  if (error || !data) {
    return NextResponse.json(
      { ok: false, error: error?.message ?? "db_error" },
      { status: 500 },
    );
  }
  const items = (data as Array<{
    source_id: string;
    title_en: string;
    title_bn: string;
    images: string[];
    factory_moq: number;
    price_tiers: Array<{ price_cny_fen: number }>;
  }>).map((p) => {
    const tiers = p.price_tiers ?? [];
    const minFen = tiers.length
      ? Math.min(...tiers.map((t) => t.price_cny_fen))
      : 0;
    return {
      source_id: p.source_id,
      title_en: p.title_en,
      title_bn: p.title_bn,
      image: (p.images ?? [])[0] ?? "",
      min_bdt: Math.ceil((minFen / 100) * FX_CNY_BDT),
      factory_moq: p.factory_moq,
    };
  });
  return NextResponse.json(
    { ok: true, items },
    { headers: { "Cache-Control": "public, max-age=300" } },
  );
}
