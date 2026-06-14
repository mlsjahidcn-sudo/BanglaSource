import { HomeClient } from "./_home-client";
import { Container } from "@/components/ui/container";
import { ProductCarousel } from "@/components/product-carousel";
import { getServiceRoleClient } from "@/lib/supabase/server";
import {
  jsonLdScript,
  organizationJsonLd,
  websiteJsonLd,
} from "@/lib/seo";
import {
  popularByViews,
  recentlyChanged,
  type PopularProduct,
} from "@/lib/popular";

// refresh every 5 minutes
export const revalidate = 60;

async function loadSyncStats() {
  // Phase 27 (hand-picked pivot, 2026-06-15): the catalog is no
  // longer auto-synced from 1688. We show the live count of
  // hand-picked + still-active products and a "last updated"
  // stamp from the most recent product write. No more sync_runs
  // queries (we kept the table for ops history but it isn't
  // authoritative anymore).
  try {
    const supabase = getServiceRoleClient();
    // Count only the products that are actually visible to public
    // buyers — i.e. NOT from 1688. (Phase 27 hand-picked pivot:
    // 1688 imports are kept in the DB for ops history but hidden
    // from the catalog.) Without this filter, the eyebrow would
    // claim "168 products" but the public surface would show 1.
    const { count: active, error: activeErr } = await supabase
      .from("products")
      .select("id", { count: "exact", head: true })
      .eq("active", true)
      .not("source_url", "ilike", "%1688.com%");
    if (activeErr) {
      console.error("[loadSyncStats] products count failed:", activeErr.message);
    }
    // Most recent write, also restricted to non-1688 so we don't
    // show "updated 11h ago" when the only update was an admin
    // deactivating 1688 stock.
    const { data: lastWrite, error: lastErr } = await supabase
      .from("products")
      .select("updated_at")
      .eq("active", true)
      .not("source_url", "ilike", "%1688.com%")
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (lastErr) {
      console.error("[loadSyncStats] lastWrite query failed:", lastErr.message);
    }
    return {
      activeCount: active ?? 0,
      lastUpdateIso: lastWrite?.updated_at ?? null,
    };
  } catch (e) {
    console.error("[loadSyncStats] thrown:", (e as Error).message);
    return { activeCount: 0, lastUpdateIso: null };
  }
}

// Phase 23: load both carousels in parallel. Each call is a
// single SQL query (popular_by_views RPC) or one tight
// group-by (recentlyChanged). Total wall-time is the
// slower of the two. Cached for `revalidate` seconds
// (=60s) at the page level.
async function loadCarousels() {
  const [popular, recent] = await Promise.all([
    popularByViews(7, 12).catch(() => [] as PopularProduct[]),
    recentlyChanged(7, 12).catch(() => [] as PopularProduct[]),
  ]);
  return { popular, recent };
}

export default async function HomePage() {
  const [syncStats, carousels] = await Promise.all([
    loadSyncStats(),
    loadCarousels(),
  ]);
  // Phase 25: Organization + WebSite JSON-LD so Google has
  // a single canonical entity + a sitelinks search box.
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: jsonLdScript(organizationJsonLd()),
        }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: jsonLdScript(websiteJsonLd()),
        }}
      />
      <HomeClient
        syncStats={syncStats}
        heroProduct={carousels.popular[0] ?? null}
      />
      {/* Phase 23: the two new home carousels. Both are
          server-rendered (data fetched above) and rendered
          with the same client component the PDP uses. The
          carousels fall back silently to nothing when
          the queries return empty (early days of the
          site) — that's by design, not an error. */}
      <Container className="pb-20">
        {carousels.popular.length > 0 && (
          <ProductCarousel
            eyebrow="Trending"
            title="Popular this week"
            items={carousels.popular}
            hrefAll="/search?sort=popularity"
            hrefAllLabel="See all popular →"
          />
        )}
        {carousels.recent.length > 0 && (
          <ProductCarousel
            eyebrow="Just moved"
            title="Recently restocked"
            items={carousels.recent}
            hrefAll="/search?sort=newest"
            hrefAllLabel="See all recent →"
          />
        )}
      </Container>
    </>
  );
}
