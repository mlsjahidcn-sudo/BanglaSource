// /lib/source-filter.ts
//
// 1688 source products are still in the DB (the Apify pipeline can
// keep running, the admin can keep them active), but we don't show
// them to public buyers. The model is now hand-picked products from
// Pinduoduo / Taobao / other trendy sources — these are added via
// /admin/products/new with a synthesized `https://manual.local/<slug>`
// source_url. Apify-derived products have `https://detail.1688.com/...`
// source_url, which is the signal we use to filter them out at the
// read layer.
//
// This module exports:
//   - `NOT_FROM_1688` — the `.not("source_url", "ilike", ...)` filter
//     to compose into any supabase query that powers a user-facing
//     surface
//   - `isNotFrom1688()` — a pure boolean check for in-memory filtering
//     after a fetch (for arrays that came back without the filter
//     already applied, e.g. watchlist that joins `products`)
//
// All admin/ops routes should NOT use this filter — ops still needs
// to see the full inventory.

export const SOURCE_URL_FROM_1688 = "%1688.com%";

/**
 * Apply this to any supabase query that powers a user-facing surface
 * (home, search, categories, PDP-similar, recommendations, carousels).
 *
 *   const { data } = await supabase
 *     .from("products")
 *     .select(...)
 *     .eq("active", true)
 *     .not("source_url", "ilike", SOURCE_URL_FROM_1688);
 *
 * The filter is intentionally a `not ilike` rather than a column
 * check because we want to keep the existing `source_url` schema
 * (1688 was the first source, so it never got its own column). If
 * we ever add a second automated source, add a `source` enum column
 * and migrate to that.
 */
export const NOT_FROM_1688 = (query: any) =>
  query.not("source_url", "ilike", SOURCE_URL_FROM_1688);

/** Pure boolean check for arrays that came back without the SQL filter. */
export function isNotFrom1688(p: { source_url: string | null }): boolean {
  if (!p.source_url) return false;
  return !p.source_url.toLowerCase().includes("1688.com");
}
