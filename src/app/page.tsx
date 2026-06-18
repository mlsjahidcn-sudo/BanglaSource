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
  heroProducts,
  type PopularProduct,
  type HeroProduct,
} from "@/lib/popular";
import { getFxCnyBdt } from "@/lib/settings";

// refresh every 5 minutes
export const revalidate = 60;

async function loadSyncStats() {
  // Phase 27 (hand-picked pivot, 2026-06-15): the catalog still
  // shows all active products (the 1688 imports stay visible until
  // they're hand-replaced via /admin/products/new). The "last
  // updated" stamp is the most recent product write — admin
  // edits, image regens, or 1688 syncs all count.
  try {
    const supabase = getServiceRoleClient();
    const { count: active, error: activeErr } = await supabase
      .from("products")
      .select("id", { count: "exact", head: true })
      .eq("active", true);
    if (activeErr) {
      console.error("[loadSyncStats] products count failed:", activeErr.message);
    }
    const { data: lastWrite, error: lastErr } = await supabase
      .from("products")
      .select("updated_at")
      .eq("active", true)
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
  // Phase 48: read the live FX rate FIRST so the hero slider
  // feed (Phase 52) can use it. Admin can change this at
  // /admin/settings without redeploying.
  const fxCnyBdt = await getFxCnyBdt();
  const [syncStats, carousels, heroFeed] = await Promise.all([
    loadSyncStats(),
    loadCarousels(),
    // Phase 52: hero slider feed (6 products with full product
    // context — MOQ, supplier, factory — so each slide can
    // render a real "Featured" card, not just a placeholder).
    // Uses the same popularity signal as the AI Picks strip
    // so the two are coherent. Live FX rate is threaded in so
    // the price stays consistent with the rest of the page.
    heroProducts(6, fxCnyBdt).catch(() => [] as HeroProduct[]),
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
        heroFeed={heroFeed}
        aiPicks={carousels.popular}
        fxCnyBdt={fxCnyBdt}
      />
      {/* Phase 45: the bottom carousel is now JUST the
          "Recently restocked" strip — the "Trending" carousel
          moved up into HomeClient right after the hero (where
          it gets more engagement). The "Just moved" strip
          surfaces freshly-synced items that don't have view
          velocity yet, so they sit below the fold as a
          discovery channel. Falls back silently to nothing
          when the query returns empty (early days of the
          site) — that's by design, not an error. */}
      <Container className="pb-20">
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
