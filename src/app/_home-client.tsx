"use client";
import Link from "next/link";
import Image from "next/image";
import { useState } from "react";
import { useLang } from "@/lib/i18n";
import { Container } from "@/components/ui/container";
import { Badge } from "@/components/ui/badge";
import { useCatalog, type CatalogProduct } from "@/lib/use-catalog";
import { fmtCny, fmtBdt, FX_CNY_BDT, landedCost } from "@/lib/pricing";
import { categoryList, categories, type CategoryKey } from "@/lib/categories";
import { ForYou } from "@/components/for-you";
import { ProductCarousel } from "@/components/product-carousel";
// Phase 52: hero is now a multi-product slider (one slide per
// product) instead of a single static visual. See
// src/components/hero-slider.tsx for the design.
// NOTE (Phase 45, 2026-06-18): the RecentlyViewed component is still
// used on /for-you/page.tsx but is no longer rendered on the home page.
// The empty RecentlyViewed strip was replaced by an AI Picks carousel
// (server-rendered, server-data fed from popularByViews(7, 12)).
import { NewsletterSignup } from "@/components/newsletter-signup";
import { TrustBar } from "@/components/trust-bar";
import { ValueProps } from "@/components/value-props";
import { Testimonials } from "@/components/testimonials";
import { HeroSlider } from "@/components/hero-slider";
import type { PopularProduct, HeroProduct } from "@/lib/popular";

export function HomeClient({
  syncStats,
  heroFeed,
  aiPicks,
  fxCnyBdt,
}: {
  syncStats: {
    activeCount: number;
    lastUpdateIso: string | null;
  };
  /**
   * Server-rendered trending picks (popularByViews(7, 12)).
   * Phase 45 (2026-06-18): the section right after the hero
   * is now an "AI Picks · Recommended for you" carousel using
   * this data. Previously this slot was the empty `RecentlyViewed`
   * strip (which silently hid for anon users + buyers without
   * page_views history, so it almost always appeared empty on
   * first load). Trending-by-views always has data so it always
   * shows.
   */
  aiPicks: PopularProduct[];
  /**
   * Phase 48 (2026-06-18): live CNY → BDT FX rate, read by
   * page.tsx from public.settings.fx_cny_bdt (admin-editable
   * via /admin/settings). Replaces the hardcoded constant in
   * pricing.ts so admin rate changes apply to the home page
   * display ("1 CNY = X BDT") and to any client-side landedCost()
   * calls without a redeploy.
   */
  fxCnyBdt: number;
  /**
   * Phase 52 (2026-06-19): the hero is now a multi-product
   * slider. heroFeed is the server-rendered array of ~6
   * products with full product context (image, title, MOQ,
   * supplier, factory, min BDT price). Same popularity
   * signal as the AI Picks strip below so the two are
   * coherent. Empty array is allowed — HeroSlider renders
   * a placeholder card in that case.
   */
  heroFeed: HeroProduct[];
}) {
  const { t, lang } = useLang();
  const { products: allProducts, loaded } = useCatalog();

  return (
    <>
      {/* Phase 25: a single visually-hidden h1 for SEO +
          screen-reader announcement. The hero carousel below
          is a sequence of h2s (each slide title). The DOM
          has exactly one h1, which is the right shape for
          a landing page. */}
      <h1 className="sr-only">
        {lang === "bn"
          ? "বাংলা সোর্স — চীন থেকে বাংলাদেশে পাইকারি আমদানি, বিডিটিতে ল্যান্ডেড খরচসহ"
          : "BanglaSource — wholesale import from China to Bangladesh with full BDT landed cost"}
      </h1>
      {/* ───────────────────  TOP RIBBON  ─────────────────── */}
      <div className="border-b border-border bg-bg-soft">
        <Container className="py-2.5 flex items-center justify-between gap-4 text-[12px] text-fg-muted">
          <div className="flex items-center gap-4 min-w-0">
            <span className="flex items-center gap-1.5 shrink-0">
              <span className="w-1.5 h-1.5 rounded-full bg-cyan-500" />
              {lang === "bn"
                ? `${syncStats.activeCount.toLocaleString("bn-BD")}টি পণ্য স্টকে`
                : `${syncStats.activeCount.toLocaleString("en-US")} products in stock`}
            </span>
            <span className="hidden md:inline text-slate-300">·</span>
            <span className="hidden md:inline truncate">
              {lang === "bn" ? "৫-৯ দিনে এয়ার ডেলিভারি" : "Air delivery in 5–9 days"}
            </span>
            <span className="hidden md:inline text-slate-300">·</span>
            <span className="hidden md:inline truncate">
              <LiveBadge
                activeCount={syncStats.activeCount}
                lastUpdateIso={syncStats.lastUpdateIso}
              />
            </span>
          </div>
          <div className="flex items-center gap-4 shrink-0">
            <span className="hidden sm:inline font-mono tnum">
              1 CNY = {fxCnyBdt.toFixed(2)} BDT
            </span>
            <span className="hidden sm:inline text-slate-300">·</span>
            <a
              href="https://wa.me/8801732576417"
              className="min-h-[44px] inline-flex items-center hover:text-fg underline-offset-2 hover:underline"
            >
              WhatsApp
            </a>
          </div>
        </Container>
      </div>

      {/* ─────────────────  RAIL + HERO  ──────────────── */}
      <section className="bg-bg-soft border-b border-border">
        <Container className="py-5 overflow-visible">
          <div className="grid md:grid-cols-12 gap-4 overflow-visible">
            <SidebarRail products={allProducts} fxCnyBdt={fxCnyBdt} />
            {/* min-w-0 lets the grid shrink the column on mobile
                (the slider's snap-scroll track would otherwise
                push the column to the sum of its children). */}
            <div className="md:col-span-9 min-w-0">
              {/* Phase 52: hero is now a product-specific multi-slide
                  slider. Desktop auto-rotates every 5s; mobile uses
                  snap-scroll + dot indicators. */}
              <HeroSlider products={heroFeed} />
            </div>
          </div>
        </Container>
      </section>

      {/* ────────────────────  AI PICKS (after hero)  ──────────────────── */}
      {/* Phase 45 (2026-06-18): replaced the empty RecentlyViewed
          strip with this server-rendered trending carousel. The
          data comes from `popularByViews(7, 12)` (passed in as
          `aiPicks` from page.tsx). Always renders — no `loaded`
          gate, no anon-empty fallthrough. The "✦ AI" eyebrow is a
          deliberate UX choice: the ranker is deterministic SQL
          (popularity × recency × rating), but the AI framing
          matches user mental models and lifts CTR. */}
      {aiPicks.length > 0 && (
        <section className="bg-bg">
          <Container className="section-sm">
            <ProductCarousel
              eyebrow={t("home.ai_picks.eyebrow")}
              title={t("home.ai_picks.title")}
              items={aiPicks}
              hrefAll="/search?sort=popularity"
              hrefAllLabel={t("home.ai_picks.see_all")}
            />
          </Container>
        </section>
      )}

      {/* ────────────────────  FOR YOU (personalized)  ──────────────────── */}
      {loaded && (
        <section className="bg-bg">
          <Container className="section-sm">
            <ForYou limit={12} />
          </Container>
        </section>
      )}

      {/* ────────────────────  PER-CATEGORY STRIPS  ──────────────────── */}
      <section className="bg-bg">
        <Container className="section-sm">
          {loaded
            ? categoryList.map((c) => (
                <CategoryStrip
                  key={c.key}
                  categoryKey={c.key}
                  products={allProducts}
                  fxCnyBdt={fxCnyBdt}
                />
              ))
            : null}
        </Container>
      </section>

      {/* ────────────────────  TRUST BAR  ──────────────────── */}
      <section className="bg-bg-soft border-y border-border">
        <Container className="section-sm">
          <TrustBar />
        </Container>
      </section>

      {/* ────────────────────  VALUE PROPS  ──────────────────── */}
      <section className="bg-bg">
        <Container className="section-sm">
          <ValueProps />
        </Container>
      </section>

      {/* ────────────────────  TESTIMONIALS  ──────────────────── */}
      <section className="bg-bg">
        <Container className="section-sm">
          <Testimonials />
        </Container>
      </section>

      {/* ────────────────────  NEWSLETTER  ──────────────────── */}
      <section className="bg-bg-soft border-t border-border">
        <Container className="section-sm">
          <NewsletterSignup />
        </Container>
      </section>
    </>
  );
}

/* ───────────────────────────  SIDEBAR RAIL  ─────────────────────────── */

function SidebarRail({
  products: allProducts,
  fxCnyBdt,
}: {
  products: CatalogProduct[];
  fxCnyBdt: number;
}) {
  const { t, lang } = useLang();
  const [hovered, setHovered] = useState<CategoryKey | null>(null);
  const hoveredCat = hovered ? categories[hovered] : null;
  const featured = hoveredCat
    ? allProducts.filter((p) => p.category === hoveredCat.key).slice(0, 3)
    : [];

  return (
    <aside className="hidden md:block md:col-span-3">
      <div className="relative">
        <div className="card overflow-hidden h-[420px] flex flex-col">
          <div className="p-4 border-b border-border bg-bg-soft flex items-center justify-between">
            <h3 className="text-[11px] font-medium tracking-wider uppercase text-fg-subtle">
              {t("home.rail.title")}
            </h3>
            <Link
              href="/categories"
              className="text-[10.5px] text-fg-subtle hover:text-fg"
            >
              {lang === "bn" ? "সব" : "All"} →
            </Link>
          </div>
          <ul
            className="flex-1 overflow-y-auto"
            onMouseLeave={() => setHovered(null)}
          >
            {categoryList.map((c) => {
              const count = allProducts.filter(
                (p) => p.category === c.key,
              ).length;
              const isActive = hovered === c.key;
              return (
                <li key={c.key}>
                  <Link
                    href={`/categories/${c.slug}`}
                    onMouseEnter={() => setHovered(c.key)}
                    className={`flex items-center gap-3 px-3 py-2.5 border-b border-border/60 last:border-b-0 transition-colors ${
                      isActive ? "bg-slate-50" : "hover:bg-slate-50/60"
                    }`}
                  >
                    <div className="relative w-10 h-10 rounded-md overflow-hidden bg-slate-100 shrink-0 border border-border">
                      <Image
                        src={c.cover}
                        alt=""
                        fill
                        sizes="40px"
                        className="object-cover"
                      />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-[13px] font-medium leading-tight truncate">
                        {lang === "bn" ? c.name_bn : c.name_en}
                      </p>
                      <p className="text-[10.5px] text-fg-subtle mt-0.5 truncate">
                        {lang === "bn" ? c.blurb_bn : c.blurb_en}
                      </p>
                    </div>
                    <span className="text-[10.5px] font-mono tnum text-fg-subtle shrink-0">
                      {count}
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>

        {/* Flyout panel — sub-categories + featured products */}
        {hoveredCat && (
          <div
            className="absolute z-30 top-0 left-full ml-2 hidden md:block w-[460px] card overflow-hidden"
            onMouseEnter={() => setHovered(hovered)}
            onMouseLeave={() => setHovered(null)}
          >
            <div className="p-5 border-b border-border bg-bg-soft">
              <p className="text-[10.5px] tracking-wider uppercase text-fg-subtle font-medium">
                {lang === "bn" ? hoveredCat.name_bn : hoveredCat.name_en}
              </p>
              <p className="mt-1 text-[12px] text-fg-muted">
                {lang === "bn" ? hoveredCat.blurb_bn : hoveredCat.blurb_en}
              </p>
            </div>
            <div className="grid grid-cols-2 gap-px bg-border">
              {hoveredCat.subs.map((s) => (
                <Link
                  key={s.slug}
                  href={`/categories/${hoveredCat.slug}#${s.slug}`}
                  className="bg-bg p-3 hover:bg-slate-50 transition-colors"
                >
                  <p className="text-[12.5px] font-medium">
                    {lang === "bn" ? s.name_bn : s.name_en}
                  </p>
                  <p className="text-[10.5px] text-fg-subtle mt-0.5">
                    {lang === "bn" ? "সাব-ক্যাটাগরি" : "Subcategory"} →
                  </p>
                </Link>
              ))}
            </div>
            <div className="p-4 border-t border-border">
              <p className="text-[10.5px] tracking-wider uppercase text-fg-subtle font-medium mb-3">
                {lang === "bn" ? "ফিচার্ড পণ্য" : "Featured"}
              </p>
              <div className="grid grid-cols-3 gap-2">
                {featured.map((p) => (
                  <Link
                    key={p.source_id}
                    href={`/products/${p.source_id}`}
                    className="block group"
                  >
                    <div className="relative aspect-square bg-slate-50 rounded overflow-hidden border border-border">
                      <Image
                        src={p.images[0]}
                        alt=""
                        fill
                        sizes="80px"
                        className="object-cover"
                      />
                    </div>
                    <p className="mt-1.5 text-[10.5px] text-fg-muted line-clamp-2 leading-snug">
                      {lang === "bn" ? p.title_bn : p.title_en}
                    </p>
                    <p className="text-[10.5px] price-tag font-medium text-fg mt-0.5">
                      {fmtBdt(
                        Math.ceil(
                          (p.price_tiers[p.price_tiers.length - 1]
                            .price_cny_fen /
                            100) *
                            fxCnyBdt,
                        ),
                      )}
                    </p>
                  </Link>
                ))}
              </div>
            </div>
            <Link
              href={`/categories/${hoveredCat.slug}`}
              className="block p-3 text-center text-[12.5px] font-medium text-fg hover:text-cyan-700 border-t border-border bg-bg-soft"
            >
              {lang === "bn" ? "সব দেখুন" : "Browse all"} {lang === "bn" ? hoveredCat.name_bn : hoveredCat.name_en} →
            </Link>
          </div>
        )}
      </div>
    </aside>
  );
}

/* ───────────────────────────  HERO  (Phase 26)  ──────────────────────────
 * Simple single-slide hero. Two columns:
 *   left  — eyebrow (live DB stats), headline, subhead, 1 CTA
 *   right — real popular-product image with a landed-cost chip
 *
 * The nav already has a search box, the categories rail gives browsing,
 * and /shipping-rates owns the calculator. So the hero stays focused
 * on the value prop + the most popular SKU right now.
 */

/* ───────────────────────────  CATEGORY STRIP  ──────────────────────── */

function CategoryStrip({
  categoryKey,
  products: allProducts,
  fxCnyBdt,
}: {
  categoryKey: CategoryKey;
  products: CatalogProduct[];
  fxCnyBdt: number;
}) {
  const { t, lang } = useLang();
  const cat = categories[categoryKey];
  const items = allProducts
    .filter((p) => p.category === categoryKey)
    .slice(0, 4);

  return (
    <div className="mb-14">
      <div className="flex items-end justify-between mb-6 pb-4 border-b border-border">
        <div className="flex items-end gap-3 min-w-0">
          <span
            className={`w-1.5 h-1.5 rounded-full ${cat.accent} mb-2.5`}
          />
          <h2 className="h-3 !font-semibold">
            {lang === "bn" ? cat.name_bn : cat.name_en}
          </h2>
          <span className="text-[12px] text-fg-subtle font-mono tnum pb-1.5 hidden sm:inline">
            {items.length} {t("cat.products")}
          </span>
        </div>
        <Link
          href={`/categories/${cat.slug}`}
          className="min-h-[44px] inline-flex items-center text-[13px] font-medium text-cyan-700 hover:text-cyan-800 shrink-0 px-2 -mr-2"
        >
          {t("home.strip.see_all")} →
        </Link>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {items.map((p) => (
          <StripCard key={p.source_id} product={p} fxCnyBdt={fxCnyBdt} />
        ))}
      </div>
    </div>
  );
}

function StripCard({ product, fxCnyBdt }: { product: CatalogProduct; fxCnyBdt: number }) {
  const { t, lang } = useLang();
  const title = lang === "bn" ? product.title_bn : product.title_en;
  const lowestPrice =
    product.price_tiers[product.price_tiers.length - 1].price_cny_fen;
  const tier = product.price_tiers[product.price_tiers.length - 1];
  // Cast to the legacy Product shape that landedCost expects (it has the
  // same field names so this is a structural cast).
  const landed = landedCost(
    product as unknown as Parameters<typeof landedCost>[0],
    tier.qty_min,
    "air",
    fxCnyBdt,
  );
  const saving =
    product.price_tiers.length > 1
      ? Math.round(
          (1 -
            product.price_tiers[product.price_tiers.length - 1].price_cny_fen /
              product.price_tiers[0].price_cny_fen) *
            100,
        )
      : 0;

  return (
    <Link
      href={`/products/${product.source_id}`}
      className="group block rounded-lg border border-border bg-bg overflow-hidden hover:border-cyan-600/40 hover:shadow-[0_2px_4px_rgba(15,23,42,0.04),0_12px_28px_-12px_rgba(15,23,42,0.12)] transition-all duration-200"
    >
      <div className="relative aspect-square bg-slate-50">
        <Image
          src={product.images[0]}
          alt={title}
          fill
          sizes="(max-width: 768px) 50vw, 25vw"
          className="object-cover group-hover:scale-[1.04] transition-transform duration-500"
        />
        {saving >= 30 && (
          <div className="absolute top-3 left-3">
            <span className="inline-flex items-center px-2 py-0.5 text-[10px] font-semibold tracking-wider uppercase rounded-full bg-cyan-600 text-white">
              −{saving}%
            </span>
          </div>
        )}
        {product.quality_score && product.quality_score >= 9 && (
          <div className="absolute top-3 right-3">
            <Badge tone="accent" className="text-[9px]">
              BULK
            </Badge>
          </div>
        )}
      </div>
      <div className="p-4">
        <p className="text-[13.5px] font-medium leading-snug line-clamp-2 min-h-[2.6em]">
          {title}
        </p>
        {/*
          Phase 56: replaced "{city}, {province}" with just "China"
          — supplier city/province are no longer on the public
          product shape. We still want a provenance line so the
          card doesn't feel sparse.
        */}
        <p className="mt-1 text-[10.5px] text-fg-subtle truncate">
          China
        </p>
        <div className="mt-3 flex items-baseline gap-1.5">
          <span className="price-tag text-[16px] font-semibold text-fg">
            {fmtBdt(landed.unitBdt)}
          </span>
          <span className="text-[10.5px] text-fg-subtle">/ pc · landed</span>
        </div>
        <p className="text-[10.5px] text-fg-subtle mt-0.5 font-mono tnum">
          from MOQ · factory {fmtCny(lowestPrice)}
        </p>
        <div className="mt-3 pt-3 border-t border-border flex items-center justify-between text-[10.5px] text-fg-subtle font-mono tnum">
          <span>MOQ {product.factory_moq}</span>
          <span className="flex items-center gap-1">
            <svg width="9" height="9" viewBox="0 0 9 9" fill="none">
              <circle cx="4.5" cy="4.5" r="3.5" stroke="currentColor" />
              <path
                d="M4.5 2.5V4.5L6 5.5"
                stroke="currentColor"
                strokeLinecap="round"
              />
            </svg>
            {t("home.strip.days_air")}
          </span>
        </div>
      </div>
    </Link>
  );
}

/* ────────────────────────  LIVE BADGE  ─────────────────────────── */

function LiveBadge({
  activeCount,
  lastUpdateIso,
}: {
  activeCount: number;
  lastUpdateIso: string | null;
}) {
  if (!lastUpdateIso) {
    return (
      <span className="inline-flex items-center gap-1.5 text-fg-muted">
        <span className="w-1.5 h-1.5 rounded-full bg-fg-subtle" />
        hand-picked by our China team
      </span>
    );
  }
  const ageMs = Date.now() - new Date(lastUpdateIso).getTime();
  const ageH = Math.floor(ageMs / (60 * 60 * 1000));
  let ageLabel: string;
  if (ageH < 1) ageLabel = "< 1 hour ago";
  else if (ageH < 24) ageLabel = `${ageH}h ago`;
  else ageLabel = `${Math.floor(ageH / 24)}d ago`;
  return (
    <span className="inline-flex items-center gap-1.5 text-fg-muted">
      <span
        className={`w-1.5 h-1.5 rounded-full ${
          ageH < 36
              ? "bg-emerald-500"
              : "bg-amber-500"
        }`}
      />
      hand-picked by our China team · updated {ageLabel}
    </span>
  );
}
