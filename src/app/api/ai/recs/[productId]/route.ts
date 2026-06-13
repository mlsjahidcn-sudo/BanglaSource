// GET /api/ai/recs/[productId]
//
// "You might also like" recommendations for a product page.
//
// Scoring (pure SQL, no LLM, no Redis):
//   +5  same category as the seed product
//   +2  similar price band (min price within ±60% of seed's min)
//   +1  per unique session that viewed the seed AND the candidate
//        in the last 14 days
//   tie-break: order_count_30d DESC, rating_overall DESC
//
// Returns at most 8 products. Falls back to popular in-category
// products when co-view signal is sparse (early days, low traffic).
//
// Source id can be the numeric products.id OR the public source_id
// (e.g. "873514490218"). Auto-detected.
//
// Public endpoint. Rate-limited like /api/catalog (200/min).

import { NextRequest, NextResponse } from "next/server";
import { getServiceRoleClient } from "@/lib/supabase/server";
import { rateLimit, clientKey } from "@/lib/rate-limit";

const RATE_LIMIT = 200;
const RATE_WINDOW_MS = 60_000;
const CO_VIEW_WINDOW = "14 days";
const MAX_RESULTS = 8;
const MIN_RESULTS = 4;

type RecRow = {
  source_id: string;
  title_en: string;
  title_bn: string;
  images: string[];
  category: string;
  supplier_name: string;
  supplier_city: string;
  supplier_province: string;
  price_min: number;
  price_max: number;
  factory_moq: number;
  markup_pct: number;
  badges: string[];
  rating_overall: number;
  order_count_30d: number;
  score: number;
  reasons: string[];
};

// One shot of the public catalog. Cached for the request lifetime so
// the rec route doesn't trigger a full table scan on the hot path.
const CATALOG_TTL_MS = 5_000;
let _catalog: { at: number; list: RecRow[] } | null = null;
async function getCatalogLite(): Promise<RecRow[]> {
  if (_catalog && Date.now() - _catalog.at < CATALOG_TTL_MS) {
    return _catalog.list;
  }
  const supabase = getServiceRoleClient();
  const { data: prods, error: pErr } = await supabase
    .from("products")
    .select(
      "id, source_id, title_en, title_bn, images, category, supplier_name, supplier_city, supplier_province, factory_moq, markup_pct, badges, rating_overall, order_count_30d, price_tiers(price_cny_fen)",
    )
    .eq("active", true);
  if (pErr) throw pErr;
  const list: RecRow[] = (prods ?? []).map((p: any) => {
    const tiers = (p.price_tiers ?? []) as Array<{ price_cny_fen: number }>;
    const prices = tiers.map((t) => t.price_cny_fen);
    return {
      source_id: p.source_id,
      title_en: p.title_en,
      title_bn: p.title_bn,
      images: p.images ?? [],
      category: p.category,
      supplier_name: p.supplier_name,
      supplier_city: p.supplier_city,
      supplier_province: p.supplier_province,
      price_min: prices.length > 0 ? Math.min(...prices) : 0,
      price_max: prices.length > 0 ? Math.max(...prices) : 0,
      factory_moq: p.factory_moq,
      markup_pct: p.markup_pct,
      badges: p.badges ?? [],
      rating_overall: Number(p.rating_overall ?? 0),
      order_count_30d: p.order_count_30d ?? 0,
      score: 0,
      reasons: [],
    };
  });
  _catalog = { at: Date.now(), list };
  return list;
}

// Score a list of candidates against the seed. Pure JS, no SQL roundtrip.
function score(
  seed: RecRow,
  cands: RecRow[],
  coViewCounts: Map<string, number>,
): RecRow[] {
  const seedMin = seed.price_min;
  const lo = seedMin * 0.4;
  const hi = seedMin * 1.6;
  for (const c of cands) {
    let s = 0;
    const reasons: string[] = [];
    if (c.category === seed.category) {
      s += 5;
      reasons.push("same_category");
    }
    if (c.price_min >= lo && c.price_min <= hi) {
      s += 2;
      reasons.push("similar_price");
    }
    const cv = coViewCounts.get(c.source_id) ?? 0;
    if (cv > 0) {
      s += cv;
      reasons.push(`co_viewed_${cv}`);
    }
    c.score = s;
    c.reasons = reasons;
  }
  return cands
    .filter((c) => c.source_id !== seed.source_id)
    .sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      if (b.order_count_30d !== a.order_count_30d) {
        return b.order_count_30d - a.order_count_30d;
      }
      return b.rating_overall - a.rating_overall;
    });
}

// Co-view lookup. SQL aggregates page_views by session_id; for each
// session that saw the seed, we add 1 to every other product they
// saw. Returns Map<source_id, count>.
async function buildCoViewMap(
  supabase: ReturnType<typeof getServiceRoleClient>,
  seedSourceId: string,
): Promise<Map<string, number>> {
  const seedPath = `/products/${seedSourceId}`;
  // Pull all page_views for the last 14 days. For a small project
  // this is fine; if traffic grows past ~50k rows/day we'll want
  // a materialized summary table.
  const since = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString();
  const { data, error } = await supabase
    .from("page_views")
    .select("session_id, path")
    .gte("recorded_at", since)
    .not("session_id", "is", null);
  if (error || !data) return new Map();

  // bucket: session_id → Set<source_id>
  const sessions = new Map<string, Set<string>>();
  for (const row of data) {
    const path = (row as { path: string; session_id: string | null })
      .path;
    const sid = (row as { path: string; session_id: string | null })
      .session_id;
    if (!sid || !path.startsWith("/products/")) continue;
    const src = path.slice("/products/".length);
    if (!src) continue;
    if (!sessions.has(sid)) sessions.set(sid, new Set());
    sessions.get(sid)!.add(src);
  }
  // For every session that saw the seed, +1 to every other product
  // they saw. We don't care about frequency, just overlap.
  const map = new Map<string, number>();
  const seenSeed = sessions.get(seedSourceId);
  if (!seenSeed) {
    // Fall back: any session whose path includes the seed path
    for (const [, set] of sessions) {
      if (!set.has(seedSourceId)) continue;
      for (const s of set) {
        if (s === seedSourceId) continue;
        map.set(s, (map.get(s) ?? 0) + 1);
      }
    }
  } else {
    for (const s of seenSeed) {
      if (s === seedSourceId) continue;
      map.set(s, (map.get(s) ?? 0) + 1);
    }
  }
  return map;
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ productId: string }> },
) {
  const rl = rateLimit({
    key: `recs:${clientKey(req)}`,
    capacity: RATE_LIMIT,
    windowMs: RATE_WINDOW_MS,
  });
  if (!rl.allowed) {
    return NextResponse.json(
      { ok: false, error: "rate_limited" },
      { status: 429 },
    );
  }

  const { productId: raw } = await params;
  // 1688 source_ids are 12-digit numeric strings like "873514490218"
  // — these are NOT products.id. We always look up by source_id.
  // (A pure-numeric `id` lookup would also work, but source_id is the
  // public URL slug and the only path used by the catalog.)

  try {
    const supabase = getServiceRoleClient();
    let seed: RecRow | null = null;
    // Always look up by source_id (the public URL slug).
    const { data } = await supabase
      .from("products")
      .select(
        "source_id, title_en, title_bn, images, category, supplier_name, supplier_city, supplier_province, factory_moq, markup_pct, badges, rating_overall, order_count_30d, price_tiers(price_cny_fen)",
      )
      .eq("source_id", raw)
      .eq("active", true)
      .maybeSingle();
    if (data) {
      const tiers = (data.price_tiers ?? []) as Array<{
        price_cny_fen: number;
      }>;
      const prices = tiers.map((t) => t.price_cny_fen);
      seed = {
        source_id: (data as any).source_id,
        title_en: (data as any).title_en,
        title_bn: (data as any).title_bn,
        images: (data as any).images ?? [],
        category: (data as any).category,
        supplier_name: (data as any).supplier_name,
        supplier_city: (data as any).supplier_city,
        supplier_province: (data as any).supplier_province,
        price_min: prices.length > 0 ? Math.min(...prices) : 0,
        price_max: prices.length > 0 ? Math.max(...prices) : 0,
        factory_moq: (data as any).factory_moq,
        markup_pct: (data as any).markup_pct,
        badges: (data as any).badges ?? [],
        rating_overall: Number((data as any).rating_overall ?? 0),
        order_count_30d: (data as any).order_count_30d ?? 0,
        score: 0,
        reasons: [],
      };
    }
    if (!seed) {
      return NextResponse.json(
        { ok: false, error: "seed_not_found" },
        { status: 404 },
      );
    }

    // Co-view map for this seed
    const coView = await buildCoViewMap(supabase, seed.source_id);

    // Pull the active catalog (small, cached 5s)
    const catalog = await getCatalogLite();

    // Score all candidates
    const ranked = score(seed, catalog.slice(), coView).slice(0, MAX_RESULTS);

    // Fallback: if co-view signal is sparse, top up from popular
    // in-category products. Don't repeat.
    if (ranked.length < MIN_RESULTS) {
      const seen = new Set(ranked.map((r) => r.source_id));
      const fillers = catalog
        .filter(
          (c) =>
            c.source_id !== seed.source_id &&
            c.category === seed.category &&
            !seen.has(c.source_id),
        )
        .sort(
          (a, b) =>
            b.order_count_30d - a.order_count_30d ||
            b.rating_overall - a.rating_overall,
        )
        .slice(0, MIN_RESULTS - ranked.length)
        .map((c) => ({ ...c, reasons: ["popular_in_category"] }));
      ranked.push(...fillers);
    }

    return NextResponse.json(
      {
        ok: true,
        seed_source_id: seed.source_id,
        seed_category: seed.category,
        recommendations: ranked,
        meta: {
          co_view_signals: coView.size,
          candidates_scored: catalog.length,
          returned: ranked.length,
        },
      },
      {
        headers: {
          // Per-product carousel. Vary by product id so two PDPs
          // don't share a cache slot.
          "Cache-Control": "public, max-age=60, s-maxage=300",
        },
      },
    );
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: (e as Error).message },
      { status: 500 },
    );
  }
}
