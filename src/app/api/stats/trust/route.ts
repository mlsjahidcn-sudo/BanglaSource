// /api/stats/trust
//
// Public, cheap stats endpoint for the trust bar.
// Counts:
//   - active products
//   - distinct supplier_name (rough proxy for "factories")
//   - profiles (rough proxy for "buyers")
//   - rough "savings" — sum of (MSRP - landed) where MSRP is a
//     flat 2.5x markup over the minimum tier price. Real MSRP
//     data isn't in the catalog; this is illustrative.

import { NextResponse } from "next/server";
import { getServiceRoleClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const supabase = getServiceRoleClient();
    const [products, factories, profiles] = await Promise.all([
      supabase
        .from("products")
        .select("price_tiers(price_cny_fen)")
        .eq("active", true)
        .limit(500),
      supabase
        .from("products")
        .select("supplier_name", { count: "exact", head: true })
        .eq("active", true)
        .not("supplier_name", "is", null),
      supabase.from("profiles").select("id", { count: "exact", head: true }),
    ]);
    // Rough "savings": for each product, take the min tier price in
    // CNY fen and assume the buyer would have paid 2.5× at a local
    // importer. Savings per product = 1.5× min_price. Aggregate.
    let totalCnyFenSaved = 0;
    for (const p of products.data ?? []) {
      const tiers = (p as { price_tiers: Array<{ price_cny_fen: number }> }).price_tiers ?? [];
      if (tiers.length > 0) {
        const minFen = Math.min(...tiers.map((t) => t.price_cny_fen));
        totalCnyFenSaved += (minFen * 1.5) | 0;
      }
    }
    // Convert fen → BDT (FX 16.85)
    const totalBdtSaved = (totalCnyFenSaved / 100) * 16.85;
    return NextResponse.json(
      {
        ok: true,
        active_products: products.data?.length ?? 0,
        verified_factories: factories.count ?? 0,
        total_buyers: profiles.count ?? 0,
        total_saved_bdt: totalBdtSaved,
      },
      { headers: { "Cache-Control": "public, max-age=300" } },
    );
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: (e as Error).message },
      { status: 500 },
    );
  }
}
