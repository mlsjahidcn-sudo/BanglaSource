// POST /api/ai/search
//
// Natural-language search. The user types free-form text like
// "cheap wireless earphones for running under ৳500" or
// "leather backpacks in stock for men" — we use DeepSeek V4-Flash
// to parse the query into structured filters, then run a Supabase
// query against the products table.
//
// This is **alongside** the existing /api/search (ilike-only), not
// a replacement. The /search page can pick which one to call based
// on the query length or a UI toggle ("Smart search" vs "Keyword").
//
// Cost: ~$0.00003 per call. Cached in `ai_runs` for the same source
// query string. Typical session: a few calls.
//
// Idempotent: the parse step is cached by query text in ai_runs
// (kind='nl_search', source_id=NULL, source_hash=sha256(query)).

import { NextRequest, NextResponse } from "next/server";
import { getServiceRoleClient } from "@/lib/supabase/server";
import { rateLimit, clientKey } from "@/lib/rate-limit";
import { deepseekJson, sha256 } from "@/lib/deepseek";

const RATE_LIMIT = 60;
const RATE_WINDOW_MS = 60_000;
const MAX_RESULTS = 24;

const SYSTEM = `You are a search-query parser for a Bangladesh B2B wholesale marketplace (BanglaSource). The user types free-form English or Bangla queries. Your job is to extract structured filters as a JSON object.

CATEGORIES (one of these, or null):
- "gadgets"  → phones, earphones, chargers, smartwatches, cables, power banks
- "eyewear"  → sunglasses, optical frames
- "shoes"    → sneakers, heels, boots, sandals
- "bags"     → backpacks, handbags, luggage, wallets
- "watches"  → analog watches, mechanical watches (NOT smart watches — those are gadgets)
- "beauty"   → cosmetics, skincare, lipsticks, perfumes

PRICE: amounts are BDT. "under ৳500", "below ৳1000", "less than 500 taka" → price_max_bdt. "over ৳1000", "৳2000+" → price_min_bdt. Both can be set. Range like "৳300-৳500" → both.

BRANDS (or null): extract brand name like "JBL", "Pro6", "iPhone 15", "Lululemon", "Huawei", "Apple" if mentioned.

KEYWORDS: list 2-4 search terms the user is looking for. Skip stopwords ("for", "the", "with", "a", "under"). Transliterate Bangla keywords to English (e.g. "ব্লুটুথ ইয়ারফোন" → "bluetooth earphones").

SORT:
- "cheapest" / "lowest price" / "under X" / "budget" → "price_asc"
- "expensive" / "premium" / "luxury" / "high end" → "price_desc"
- "popular" / "best selling" / "most orders" → "popularity"
- "new" / "newest" / "latest" → "newest"
- otherwise null (default = popularity)

FLAGS:
- in_stock_only: true if user says "in stock", "available", "ready to ship"
- low_moq: true if user says "small MOQ", "low MOQ", "MOQ under 10"

Output JSON with these fields (use null when not specified):
- keywords: string[]
- category: string | null
- price_min_bdt: number | null
- price_max_bdt: number | null
- sort: "price_asc" | "price_desc" | "popularity" | "newest" | null
- in_stock_only: boolean
- low_moq: boolean

Note: brand/supplier identity is intentionally not extracted — that
information is internal. If the user asks for a brand by name, fold
it into the keywords array so the standard title/description search
picks it up.

Only output the JSON object. No prose, no markdown fences.`;

const FX = 16.85; // mirrors FX_CNY_BDT in pricing.ts

type ParsedQuery = {
  keywords: string[];
  category: string | null;
  price_min_bdt: number | null;
  price_max_bdt: number | null;
  sort: "price_asc" | "price_desc" | "popularity" | "newest" | null;
  in_stock_only: boolean;
  low_moq: boolean;
};

const ALLOWED_CATEGORIES = new Set([
  "gadgets",
  "eyewear",
  "shoes",
  "bags",
  "watches",
  "beauty",
]);

const ALLOWED_SORTS = new Set([
  "price_asc",
  "price_desc",
  "popularity",
  "newest",
]);

// Parse a Bangla/English/Chinese query with DeepSeek. Falls back to
// a best-effort regex parse on V4 failure (which would be rare).
async function parseQuery(
  query: string,
  supabase: ReturnType<typeof getServiceRoleClient>,
): Promise<ParsedQuery> {
  // Cache check
  const hash = await sha256(query.toLowerCase().trim());
  const { data: cached } = await supabase
    .from("ai_runs")
    .select("output")
    .eq("kind", "nl_search")
    .is("source_id", null)
    .eq("source_hash", hash)
    .maybeSingle();
  if (cached?.output) {
    return cached.output as unknown as ParsedQuery;
  }

  let parsed: ParsedQuery;
  try {
    const r = await deepseekJson<ParsedQuery>(
      [
        { role: "system", content: SYSTEM },
        { role: "user", content: query },
      ],
      { maxTokens: 800 },
    );
    parsed = {
      keywords: Array.isArray(r.keywords) ? r.keywords.slice(0, 6) : [],
      category:
        typeof r.category === "string" && ALLOWED_CATEGORIES.has(r.category)
          ? r.category
          : null,
      price_min_bdt:
        typeof r.price_min_bdt === "number" && r.price_min_bdt > 0
          ? r.price_min_bdt
          : null,
      price_max_bdt:
        typeof r.price_max_bdt === "number" && r.price_max_bdt > 0
          ? r.price_max_bdt
          : null,
      // Phase 56: supplier_brand field removed — the brand was
      // never a public surface and we never want to accidentally
      // leak the factory name through the AI parser. We still
      // get keyword + category + price from the parser; the
      // "brand" intent is folded into the keywords list.
      sort:
        typeof r.sort === "string" && ALLOWED_SORTS.has(r.sort)
          ? (r.sort as ParsedQuery["sort"])
          : null,
      in_stock_only: r.in_stock_only === true,
      low_moq: r.low_moq === true,
    };
  } catch (e) {
    // Fallback: treat the whole query as keywords
    parsed = {
      keywords: query
        .toLowerCase()
        .split(/\s+/)
        .filter((w) => w.length >= 2)
        .slice(0, 4),
      category: null,
      price_min_bdt: null,
      price_max_bdt: null,
      sort: null,
      in_stock_only: false,
      low_moq: false,
    };
  }

  // Log the run
  try {
    await supabase.from("ai_runs").insert({
      kind: "nl_search",
      model: "deepseek-v4-flash",
      source_table: null,
      source_id: null,
      source_hash: hash,
      input_tokens: 0, // deepseekJson already returned; we don't track here
      output_tokens: 0,
      cost_usd: 0,
      output: parsed,
    });
  } catch {
    // ignore logging errors
  }

  return parsed;
}

// Build the Supabase query for the parsed filters.
async function runQuery(parsed: ParsedQuery) {
  const supabase = getServiceRoleClient();
  let q = supabase
    .from("products")
    .select(
      "id, source_id, title_en, title_bn, images, category, supplier_name, supplier_city, supplier_province, factory_moq, markup_pct, badges, rating_overall, order_count_30d, stock_total, price_tiers(price_cny_fen)",
    )
    .eq("active", true);

  // Category filter
  if (parsed.category) {
    q = q.eq("category", parsed.category);
  }

  // Stock filter: hand-picked products don't have live per-product
  // stock, so most rows have stock_total=0. "in stock" in the NL
  // query just means "active listing" (already filtered). We DON'T
  // add a hard stock filter here — it would zero out results. Future
  // work: backfill stock_total from supplier feed updates.
  if (parsed.in_stock_only) {
    /* no-op: active = true is the effective "in stock" filter */
  }

  // Low MOQ
  if (parsed.low_moq) {
    q = q.lte("factory_moq", 10);
  }

  // Phase 56: brand keyword hit removed — supplier_brand is no
  // longer parsed from the AI response. If the user typed a brand
  // name, the parser folds it into `keywords`, which the standard
  // search filter below handles.

  // Keyword search: build a single ilike OR pattern from the parsed
  // keywords. If empty, no text filter (return by category/sort).
  const textPatterns: string[] = [];
  for (const kw of parsed.keywords) {
    if (kw && kw.length >= 2) {
      const pat = `%${kw}%`;
      textPatterns.push(`title_en.ilike.${pat}`);
      textPatterns.push(`title_bn.ilike.${pat}`);
      textPatterns.push(`description_en.ilike.${pat}`);
    }
  }
  if (textPatterns.length > 0) {
    q = q.or(textPatterns.join(","));
  }

  // Apply sort. Default: popularity. We can sort by any column or by a
  // computed expression (e.g. min price from price_tiers is tricky —
  // it requires a view or a separate fetch). For now we sort by the
  // top-level columns that exist.
  switch (parsed.sort) {
    case "price_asc":
      // No good way to sort by min price_cny_fen inline; fall back to rating
      q = q.order("rating_overall", { ascending: false });
      break;
    case "price_desc":
      q = q.order("rating_overall", { ascending: false });
      break;
    case "newest":
      q = q.order("id", { ascending: false });
      break;
    case "popularity":
    default:
      q = q.order("order_count_30d", { ascending: false });
      break;
  }

  // Fetch more than we need; we'll filter by price band on the client
  // side (post-filtering on price_tiers min). This is OK because we
  // only take MAX_RESULTS at the end and the price filter is just a
  // band check.
  q = q.limit(MAX_RESULTS * 2);

  const { data, error } = await q;
  if (error || !data) {
    return { error: error?.message ?? "db_error", rows: [] };
  }

  // Post-filter by price band (against the LOWEST price tier per product)
  let rows = (data ?? []) as Array<{
    id: number;
    source_id: string;
    title_en: string;
    title_bn: string;
    images: string[];
    category: string;
    supplier_name: string;
    supplier_city: string;
    supplier_province: string;
    factory_moq: number;
    markup_pct: number;
    badges: string[];
    rating_overall: number;
    order_count_30d: number;
    stock_total: number;
    price_tiers: Array<{ price_cny_fen: number }>;
  }>;

  if (parsed.price_min_bdt != null || parsed.price_max_bdt != null) {
    rows = rows.filter((p) => {
      const tiers = p.price_tiers ?? [];
      if (tiers.length === 0) return false;
      const minFen = Math.min(...tiers.map((t) => t.price_cny_fen));
      const minBdt = minFen * FX; // FX in BDT per CNY; fen/100*FX would be wrong since price_cny_fen is already fen
      // Wait: price_cny_fen is in FEN. So minBdt = (minFen/100) * FX
      const realMinBdt = (minFen / 100) * FX;
      if (parsed.price_min_bdt != null && realMinBdt < parsed.price_min_bdt) {
        return false;
      }
      if (parsed.price_max_bdt != null && realMinBdt > parsed.price_max_bdt) {
        return false;
      }
      return true;
    });
  }

  return { error: null, rows: rows.slice(0, MAX_RESULTS) };
}

export async function POST(req: NextRequest) {
  const rl = rateLimit({
    key: `ai.search:${clientKey(req)}`,
    capacity: RATE_LIMIT,
    windowMs: RATE_WINDOW_MS,
  });
  if (!rl.allowed) {
    return NextResponse.json(
      { ok: false, error: "rate_limited" },
      { status: 429 },
    );
  }

  if (!process.env.DEEPSEEK_API_KEY) {
    return NextResponse.json(
      { ok: false, error: "deepseek_not_configured" },
      { status: 503 },
    );
  }

  let body: { q?: string } = {};
  try {
    body = (await req.json()) ?? {};
  } catch {
    return NextResponse.json({ ok: false, error: "invalid_json" }, { status: 400 });
  }
  const query = (body.q ?? "").trim();
  if (!query || query.length < 2) {
    return NextResponse.json({ ok: false, error: "empty_query" }, { status: 400 });
  }
  if (query.length > 500) {
    return NextResponse.json(
      { ok: false, error: "query_too_long" },
      { status: 400 },
    );
  }

  try {
    const supabase = getServiceRoleClient();
    const parsed = await parseQuery(query, supabase);
    const { error, rows } = await runQuery(parsed);
    if (error) {
      return NextResponse.json({ ok: false, error }, { status: 500 });
    }

    return NextResponse.json(
      {
        ok: true,
        query,
        parsed,
        results: rows.map((r) => ({
          id: r.source_id,
          title_en: r.title_en,
          title_bn: r.title_bn,
          image: (r.images ?? [])[0] ?? "",
          price_cny_fen: (r.price_tiers ?? []).reduce(
            (a, b) => (a.price_cny_fen < b.price_cny_fen ? a : b),
            r.price_tiers[0] ?? { price_cny_fen: 0 },
          ).price_cny_fen,
          category: r.category,
          factory_moq: r.factory_moq,
          rating_overall: r.rating_overall,
          order_count_30d: r.order_count_30d,
          stock_total: r.stock_total,
        })),
        total: rows.length,
      },
      {
        headers: {
          "Cache-Control": "no-store, max-age=0",
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
