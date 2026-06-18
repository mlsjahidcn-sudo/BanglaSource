// GET /api/search?q=...&limit=...
// Full-text-ish search over the products table. Uses ilike on the relevant
// fields; for >100 products we'd add a tsvector column + GIN index.

import { NextRequest, NextResponse } from "next/server";
import { getServiceRoleClient } from "@/lib/supabase/server";

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const q = (url.searchParams.get("q") ?? "").trim();
  const limit = Math.min(
    20,
    Math.max(1, parseInt(url.searchParams.get("limit") ?? "8", 10) || 8),
  );

  if (!q || q.length < 2) {
    return NextResponse.json({ ok: true, q, results: [] });
  }

  const supabase = getServiceRoleClient();
  const pat = `%${q}%`;

  // Hit 3 columns with ilike, dedupe by id, take the limit. For each row,
  // the lowest price tier is the "headline" price.
  const { data, error } = await supabase
    .from("products")
    .select(
      "id,source_id,title_en,title_bn,category,images,price_tiers!inner(qty_min,qty_max,price_cny_fen)",
    )
    .eq("active", true)
    .or(
      // Search only the buyer-relevant fields. supplier_city /
      // supplier_name are excluded on purpose — exposing a
      // search-by-city lets a buyer enumerate which factories we
      // work with, then bypass us to order direct.
      `title_en.ilike.${pat},title_bn.ilike.${pat},description_en.ilike.${pat}`,
    )
    .order("id", { ascending: true })
    .limit(limit);

  if (error) {
    return NextResponse.json(
      { ok: false, error: "db_error", message: error.message },
      { status: 500 },
    );
  }

  // Compute the lowest tier price for the card display
  const results = (data ?? []).map((p) => {
    const tiers = (p.price_tiers ?? []) as Array<{
      qty_min: number;
      qty_max: number;
      price_cny_fen: number;
    }>;
    const lastTier = tiers.length
      ? tiers.reduce((a, b) => (a.price_cny_fen < b.price_cny_fen ? a : b))
      : { price_cny_fen: 0 };
    return {
      id: p.source_id,
      title_en: p.title_en,
      title_bn: p.title_bn,
      image: (p.images ?? [])[0] ?? "",
      price_cny_fen: lastTier.price_cny_fen,
      category: p.category,
    };
  });

  return NextResponse.json(
    { ok: true, q, total: results.length, results },
    { headers: { "Cache-Control": "no-store" } },
  );
}
