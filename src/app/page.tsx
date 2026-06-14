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
  try {
    const supabase = getServiceRoleClient();
    const { data: last, error: lastErr } = await supabase
      .from("sync_runs")
      .select("started_at,finished_at,error")
      .eq("source", "apify-1688-scraper")
      .order("started_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (lastErr) {
      console.error("[loadSyncStats] sync_runs query failed:", lastErr.message);
    }
    const { count: active, error: activeErr } = await supabase
      .from("products")
      .select("id", { count: "exact", head: true })
      .eq("active", true);
    if (activeErr) {
      console.error("[loadSyncStats] products count failed:", activeErr.message);
    }
    return {
      activeCount: active ?? 0,
      lastSyncIso: last?.finished_at ?? last?.started_at ?? null,
      failedLast: !!last?.error,
    };
  } catch (e) {
    console.error("[loadSyncStats] thrown:", (e as Error).message);
    return { activeCount: 0, lastSyncIso: null, failedLast: false };
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
      <HomeClient syncStats={syncStats} />
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
