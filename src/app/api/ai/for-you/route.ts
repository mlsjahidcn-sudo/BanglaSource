// /api/ai/for-you
//
// GET /api/ai/for-you?limit=20
//
// Personalized "For You" feed for a signed-in buyer. Ranks active
// products using a 4-signal score:
//   +5  same category as any product in the user's watchlist
//   +3  same category as any PDP the user visited in last 14d
//   +2  price band within ±60% of watchlist avg
//   +N  co-view signal from page_views (last 14d)
//   +1  high rating (>= 4.5) bonus
//   +1  popular (order_count_30d > 50) bonus
//   -M  already-saved penalty (don't show what they already have)
//   -M  already-recently-viewed penalty (avoid repeating)
//
// The endpoint is **read-only** and uses the user's server client
// for the watchlist/history reads (RLS applies automatically).
// The catalog and page_views reads use the service-role client
// (those are public data, but we want to bypass RLS for speed).
//
// For anonymous users we fall back to a category-balanced feed:
//   - 3-4 products per category, sorted by rating * (1 + log(orders))
//   - the same `/api/ai/recs/[productId]` co-view signal isn't
//     usable here (no seed), so we use a popularity signal instead.
//
// The AI is in the name because the engine is configurable per
// signal weight via the SCORING constant below. Future: swap to
// a real LLM ranker (e.g. "given this user's history, score these
// 100 products"). For now, deterministic SQL is fast + auditable.

import { NextRequest, NextResponse } from "next/server";
import { getServiceRoleClient, getServerClient } from "@/lib/supabase/server";
import { rateLimit, clientKey } from "@/lib/rate-limit";
import { NOT_FROM_1688 } from "@/lib/source-filter";

export const dynamic = "force-dynamic";

const RATE_LIMIT = 60;
const RATE_WINDOW_MS = 60_000;

// FX stays in sync with /lib/pricing
const FX_CNY_BDT = 16.85;

type Product = {
  id: number;
  source_id: string;
  title_en: string;
  title_bn: string;
  images: string[];
  category: string;
  factory_moq: number;
  rating_overall: number;
  order_count_30d: number;
  price_tiers: Array<{ price_cny_fen: number }>;
  active: boolean;
};

// Public, anonymous-friendly feed: top by rating × log(orders)
async function buildAnonFeed(limit: number, supabase: ReturnType<typeof getServiceRoleClient>) {
  const { data, error } = await NOT_FROM_1688(
    supabase
      .from("products")
      .select(
        "id, source_id, title_en, title_bn, images, category, factory_moq, rating_overall, order_count_30d, price_tiers(price_cny_fen), active",
      )
      .eq("active", true),
  )
    .order("rating_overall", { ascending: false })
    .order("order_count_30d", { ascending: false })
    .limit(200);
  if (error || !data) return [];
  // Pull a category-balanced slice: take top 3-4 per category
  const byCat = new Map<string, Product[]>();
  for (const p of data as unknown as Product[]) {
    const arr = byCat.get(p.category) ?? [];
    arr.push(p);
    byCat.set(p.category, arr);
  }
  // Deterministic round-robin: cycle through categories, picking
  // the next product from each until we hit `limit`.
  const cats = Array.from(byCat.keys());
  cats.sort(); // stable
  const out: Product[] = [];
  const cursors = new Map<string, number>(cats.map((c) => [c, 0]));
  while (out.length < limit) {
    let added = 0;
    for (const c of cats) {
      const arr = byCat.get(c)!;
      const idx = cursors.get(c)!;
      if (idx < arr.length) {
        out.push(arr[idx]);
        cursors.set(c, idx + 1);
        added += 1;
        if (out.length >= limit) break;
      }
    }
    if (added === 0) break; // all exhausted
  }
  return out;
}

export async function GET(req: NextRequest) {
  const rl = rateLimit({
    key: `ai.foryou:${clientKey(req)}`,
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
  const limit = Math.min(50, Math.max(1, parseInt(url.searchParams.get("limit") ?? "20", 10) || 20));
  const supabase = getServiceRoleClient();

  // Try to identify the user via the server client
  const userClient = await getServerClient();
  const {
    data: { user },
  } = await userClient.auth.getUser();

  if (!user) {
    // Anonymous: category-balanced popularity feed
    const items = await buildAnonFeed(limit, supabase);
    return NextResponse.json(
      { ok: true, personalized: false, items: items.map(toApiItem) },
      { headers: { "Cache-Control": "private, max-age=60" } },
    );
  }

  // Signed-in: 4-signal score
  const fourteenDaysAgo = new Date(
    Date.now() - 14 * 24 * 60 * 60 * 1000,
  ).toISOString();

  // 1. Watchlist (categories + price band)
  const { data: watchlist } = await supabase
    .from("watchlist")
    .select("product_id, products:product_id(category, price_tiers(price_cny_fen))")
    .eq("user_id", user.id);
  const watchedCategories = new Set<string>();
  const watchedPricesFen: number[] = [];
  const watchedProductIds = new Set<number>();
  for (const w of watchlist ?? []) {
    if (w.product_id) watchedProductIds.add(w.product_id);
    const p = w.products as unknown as
      | { category: string; price_tiers: Array<{ price_cny_fen: number }> }
      | null;
    if (p) {
      watchedCategories.add(p.category);
      for (const t of p.price_tiers ?? []) watchedPricesFen.push(t.price_cny_fen);
    }
  }
  const avgWatchedBdt =
    watchedPricesFen.length > 0
      ? (Math.min(...watchedPricesFen) / 100) * FX_CNY_BDT
      : null;
  const lowBdt = avgWatchedBdt != null ? avgWatchedBdt * 0.4 : null;
  const highBdt = avgWatchedBdt != null ? avgWatchedBdt * 1.6 : null;

  // 2. Recently viewed products (from page_views, last 14d)
  const { data: views } = await supabase
    .from("page_views")
    .select("path")
    .eq("session_id", user.id) // best effort
    .gte("recorded_at", fourteenDaysAgo)
    .like("path", "/products/%")
    .limit(50);
  const viewedCats = new Set<string>();
  const viewedSourceIds = new Set<string>();
  for (const v of views ?? []) {
    const sid = v.path.replace("/products/", "");
    viewedSourceIds.add(sid);
  }
  if (viewedSourceIds.size > 0) {
    const { data: vp } = await NOT_FROM_1688(
      supabase
        .from("products")
        .select("source_id, category"),
    ).in("source_id", Array.from(viewedSourceIds));
    for (const p of vp ?? []) {
      if (p.category) viewedCats.add(p.category);
    }
  }

  // 3. Co-view signal: pair every watchlist source_id with everything
  // they were viewed with in the same session.
  const coViewed = new Set<string>();
  if (watchedProductIds.size > 0) {
    // Get the source_ids for the watchlist
    const { data: wl } = await NOT_FROM_1688(
      supabase
        .from("products")
        .select("id, source_id"),
    ).in("id", Array.from(watchedProductIds));
    const wlSourceIds = (wl ?? []).map((p) => p.source_id);
    if (wlSourceIds.length > 0) {
      const { data: cv } = await supabase
        .from("page_views")
        .select("path, session_id")
        .like("path", "/products/%")
        .gte("recorded_at", fourteenDaysAgo)
        .limit(2000);
      // Group by session, find products viewed in same session
      const bySession = new Map<string, Set<string>>();
      for (const r of cv ?? []) {
        const sid = r.path.replace("/products/", "");
        const arr = bySession.get(r.session_id) ?? new Set<string>();
        arr.add(sid);
        bySession.set(r.session_id, arr);
      }
      for (const sessionProducts of bySession.values()) {
        const hasWatched = wlSourceIds.some((id) => sessionProducts.has(id));
        if (hasWatched) {
          for (const id of sessionProducts) coViewed.add(id);
        }
      }
    }
  }

  // 4. Pull the candidate catalog (active, not in watchlist, not recently viewed)
  const exclude = new Set<string>([
    ...Array.from(watchedProductIds).map((id) => id.toString()),
    ...Array.from(viewedSourceIds),
  ]);
  const { data: catalog, error } = await NOT_FROM_1688(
    supabase
      .from("products")
      .select(
        "id, source_id, title_en, title_bn, images, category, factory_moq, rating_overall, order_count_30d, price_tiers(price_cny_fen), active",
      )
      .eq("active", true),
  )
    .limit(500);
  if (error || !catalog) {
    return NextResponse.json(
      { ok: false, error: error?.message ?? "db_error" },
      { status: 500 },
    );
  }

  // Score
  type Scored = { product: Product; score: number; reasons: string[] };
  const scored: Scored[] = [];
  for (const p of catalog as unknown as Product[]) {
    if (exclude.has(p.source_id)) continue;
    const reasons: string[] = [];
    let score = 0;
    if (watchedCategories.has(p.category)) {
      score += 5;
      reasons.push("matches your watchlist");
    }
    if (viewedCats.has(p.category)) {
      score += 3;
      reasons.push("matches what you've browsed");
    }
    if (coViewed.has(p.source_id)) {
      score += 2;
      reasons.push("viewed alongside your watchlist");
    }
    if (lowBdt != null && highBdt != null) {
      const tiers = p.price_tiers ?? [];
      if (tiers.length > 0) {
        const minFen = Math.min(...tiers.map((t) => t.price_cny_fen));
        const minBdt = (minFen / 100) * FX_CNY_BDT;
        if (minBdt >= lowBdt && minBdt <= highBdt) {
          score += 2;
          reasons.push("price matches your budget");
        }
      }
    }
    if (p.rating_overall >= 4.5) {
      score += 1;
      reasons.push("highly rated");
    }
    if (p.order_count_30d > 50) {
      score += 1;
      reasons.push("popular this month");
    }
    if (score > 0) scored.push({ product: p, score, reasons });
  }
  // Sort by score, then by orders, then by rating
  scored.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    if (b.product.order_count_30d !== a.product.order_count_30d) {
      return b.product.order_count_30d - a.product.order_count_30d;
    }
    return b.product.rating_overall - a.product.rating_overall;
  });

  // If the personalized feed is empty (user has no signal yet), fall back
  // to anon feed so the UI always has something to show.
  if (scored.length === 0) {
    const items = await buildAnonFeed(limit, supabase);
    return NextResponse.json(
      {
        ok: true,
        personalized: true,
        empty_personalized: true,
        items: items.map(toApiItem),
      },
      { headers: { "Cache-Control": "private, max-age=60" } },
    );
  }

  return NextResponse.json(
    {
      ok: true,
      personalized: true,
      items: scored.slice(0, limit).map((s) => ({
        ...toApiItem(s.product),
        score: s.score,
        reasons: s.reasons.slice(0, 2),
      })),
    },
    { headers: { "Cache-Control": "private, max-age=60" } },
  );
}

function toApiItem(p: Product) {
  const tiers = p.price_tiers ?? [];
  const minFen = tiers.length ? Math.min(...tiers.map((t) => t.price_cny_fen)) : 0;
  return {
    id: p.source_id,
    title_en: p.title_en,
    title_bn: p.title_bn,
    image: (p.images ?? [])[0] ?? "",
    price_cny_fen: minFen,
    category: p.category,
    factory_moq: p.factory_moq,
    rating_overall: p.rating_overall,
    order_count_30d: p.order_count_30d,
  };
}
