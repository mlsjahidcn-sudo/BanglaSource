// /api/ai/cart-cross-sell
//
// POST /api/ai/cart-cross-sell
// body: { source_ids: string[] }
//
// Returns up to 5 products that are likely to pair with what's
// in the cart. Strategy:
//   1. Look up the categories of the source_ids in the cart
//   2. Pull the top 10 popular products in those categories
//      (popular = order_count_30d desc, tiebreaker rating desc)
//   3. Exclude the source_ids themselves
//   4. Dedupe by source_id and return the top 5
//
// This is intentionally simple — the cross-sell is "popular in
// the same category" not "bought together with X" because we
// don't have a transactional orders history yet. The "Bought
// together" / "Frequently in same order" model kicks in after
// the orders table is wired.

import { NextRequest, NextResponse } from "next/server";
import { getServiceRoleClient } from "@/lib/supabase/server";
import { rateLimit, clientKey } from "@/lib/rate-limit";
import { NOT_FROM_1688 } from "@/lib/source-filter";

export const dynamic = "force-dynamic";

const RATE_LIMIT = 60;
const RATE_WINDOW_MS = 60_000;

export async function POST(req: NextRequest) {
  const rl = rateLimit({
    key: `ai.cross-sell:${clientKey(req)}`,
    capacity: RATE_LIMIT,
    windowMs: RATE_WINDOW_MS,
  });
  if (!rl.allowed) {
    return NextResponse.json(
      { ok: false, error: "rate_limited" },
      { status: 429 },
    );
  }
  let body: { source_ids?: string[] } = {};
  try {
    body = (await req.json()) ?? {};
  } catch {
    return NextResponse.json(
      { ok: false, error: "invalid_json" },
      { status: 400 },
    );
  }
  const sourceIds = (body.source_ids ?? [])
    .map((s) => String(s))
    .filter(Boolean)
    .slice(0, 50);
  if (sourceIds.length === 0) {
    return NextResponse.json({ ok: true, items: [] });
  }
  const supabase = getServiceRoleClient();
  // Step 1: categories of the cart items. Public surface — never
  // 1688 source.
  const { data: inCart } = await NOT_FROM_1688(
    supabase
      .from("products")
      .select("source_id, category"),
  ).in("source_id", sourceIds).eq("active", true);
  if (!inCart || inCart.length === 0) {
    return NextResponse.json({ ok: true, items: [] });
  }
  const categories = Array.from(
    new Set(inCart.map((p) => p.category).filter(Boolean) as string[]),
  );
  const excludeIds = new Set(sourceIds);
  // Step 2: top popular in those categories
  const { data: candidates, error } = await NOT_FROM_1688(
    supabase
      .from("products")
      .select(
        "source_id, title_en, title_bn, images, category, markup_pct, weight_kg, volume_cbm, customs_duty_per_kg, price_tiers(price_cny_fen)",
      )
      .in("category", categories)
      .eq("active", true),
  )
    .order("order_count_30d", { ascending: false })
    .order("rating_overall", { ascending: false })
    .limit(50);
  if (error || !candidates) {
    return NextResponse.json(
      { ok: false, error: error?.message ?? "db_error" },
      { status: 500 },
    );
  }
  // Step 3-4: dedupe + exclude
  const out = (candidates as Array<{
    source_id: string;
    title_en: string;
    title_bn: string;
    images: string[];
    category: string;
    markup_pct: number;
    weight_kg: number;
    volume_cbm: number;
    customs_duty_per_kg: number;
    price_tiers: Array<{ price_cny_fen: number }>;
  }>)
    .filter((c) => !excludeIds.has(c.source_id))
    .slice(0, 5)
    .map((c) => {
      const tiers = c.price_tiers ?? [];
      const minFen = tiers.length
        ? Math.min(...tiers.map((t) => t.price_cny_fen))
        : 0;
      return {
        source_id: c.source_id,
        title_en: c.title_en,
        title_bn: c.title_bn,
        image: (c.images ?? [])[0] ?? "",
        price_cny_fen: minFen,
        markup_pct: c.markup_pct ?? 25,
        weight_kg: c.weight_kg ?? 0,
        volume_cbm: c.volume_cbm ?? 0,
        category: c.category,
        customs_duty_per_kg: c.customs_duty_per_kg ?? 0,
      };
    });
  return NextResponse.json(
    { ok: true, items: out },
    { headers: { "Cache-Control": "private, max-age=60" } },
  );
}
