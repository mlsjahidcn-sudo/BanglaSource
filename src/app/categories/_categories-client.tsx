"use client";
import Link from "next/link";
import Image from "next/image";
import { useMemo, useState } from "react";
import { useLang } from "@/lib/i18n";
import { Container } from "@/components/ui/container";
import { ProductCard } from "@/components/product-card";
import { useCatalog } from "@/lib/use-catalog";
import { categoryList } from "@/lib/categories";
import { IconArrowRight, IconWhatsApp } from "@/components/portal-icons";
import { whatsappLink } from "@/lib/contact";

export function CategoriesIndexClient() {
  const { t, lang } = useLang();
  const { products: allProducts, loaded } = useCatalog();
  const [showAll, setShowAll] = useState(false);

  /**
   * For each category, find the first product image to use as the card
   * cover. This is more authentic than a stock photo — the cover is
   * literally a product the buyer can browse. If a category has zero
   * products we fall back to the Unsplash URL in categories.ts.
   */
  const coverByKey = useMemo(() => {
    const map: Record<string, string | undefined> = {};
    for (const c of categoryList) {
      const first = allProducts.find((p) => p.category === c.key);
      map[c.key] = first?.images?.[0] ?? c.cover;
    }
    return map;
  }, [allProducts]);

  /**
   * Featured = the 8 products with the highest 30-day order count
   * across all categories. These are the picks shown in the "Top
   * picks" section instead of dumping all 167 products. Ties broken
   * alphabetically by source_id for stability.
   */
  const featured = useMemo(() => {
    return [...allProducts]
      .sort((a, b) => {
        if (b.order_count_30d !== a.order_count_30d) {
          return b.order_count_30d - a.order_count_30d;
        }
        return a.source_id.localeCompare(b.source_id);
      })
      .slice(0, 8);
  }, [allProducts]);

  if (!loaded) {
    return (
      <Container className="py-16">
        <p className="text-[13px] text-fg-muted">Loading…</p>
      </Container>
    );
  }

  return (
    <>
      {/* ── HERO ─────────────────────────────────────────────────────── */}
      <Container className="section">
        <p className="eyebrow">{t("cat.hero.eyebrow")}</p>
        <h1 className="mt-3 max-w-3xl">{t("cat.hero.title")}</h1>
        <p className="mt-5 lead max-w-2xl">{t("cat.hero.subtitle")}</p>
        <div className="mt-7 flex flex-wrap items-center gap-3">
          <a
            href="#categories"
            className="bg-slate-900 hover:bg-slate-800 text-white min-h-[44px] inline-flex items-center gap-2 px-5 rounded-md text-[14px] font-medium transition-colors"
          >
            {t("cat.hero.cta_browse")}
            <IconArrowRight className="w-4 h-4" />
          </a>
          <a
            href={whatsappLink()}
            target="_blank"
            rel="noopener noreferrer"
            className="border border-border hover:border-border-strong text-fg min-h-[44px] inline-flex items-center gap-2 px-5 rounded-md text-[14px] font-medium transition-colors"
          >
            <IconWhatsApp className="w-4 h-4" />
            {t("cat.hero.cta_help")}
          </a>
        </div>
        <p className="mt-5 text-[12px] text-fg-subtle font-mono tnum">
          {t("cat.subtitle")}
        </p>
      </Container>

      {/* ── CATEGORY GRID (with cover images) ────────────────────────── */}
      <Container className="pb-16">
        <div id="categories" />
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {categoryList.map((c) => {
            const items = allProducts.filter((p) => p.category === c.key);
            const count = items.length;
            const fromPrice =
              count > 0
                ? Math.min(
                    ...items.map(
                      (p) =>
                        p.price_tiers[p.price_tiers.length - 1].price_cny_fen,
                    ),
                  ) / 100
                : 0;
            const cover = coverByKey[c.key];
            return (
              <Link
                key={c.key}
                href={`/categories/${c.slug}`}
                className="card group block overflow-hidden hover:border-border-strong focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500"
              >
                <div className="relative aspect-[16/9] bg-slate-50 overflow-hidden">
                  {cover ? (
                    <Image
                      src={cover}
                      alt={lang === "bn" ? c.name_bn : c.name_en}
                      fill
                      sizes="(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw"
                      className="object-cover transition-transform duration-500 group-hover:scale-[1.03]"
                    />
                  ) : (
                    <div className="absolute inset-0 bg-slate-100" />
                  )}
                  <div className="absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-black/30 to-transparent pointer-events-none" />
                  <div className="absolute top-3 left-3 inline-flex items-center gap-1.5 bg-white/95 backdrop-blur px-2.5 py-1 rounded-full">
                    <span className={`w-1.5 h-1.5 rounded-full ${c.accent}`} />
                    <span className="text-[10px] font-mono tnum uppercase tracking-wider text-fg">
                      {count} {t("cat.products")}
                    </span>
                  </div>
                </div>
                <div className="p-5">
                  <h3>
                    {lang === "bn" ? c.name_bn : c.name_en}
                  </h3>
                  <p className="mt-1.5 text-[13px] text-fg-muted line-clamp-2 min-h-[2.6em]">
                    {lang === "bn" ? c.blurb_bn : c.blurb_en}
                  </p>
                  <div className="mt-4 flex flex-wrap gap-1.5">
                    {c.subs.slice(0, 3).map((s) => (
                      <span
                        key={s.slug}
                        className="text-[10px] uppercase tracking-wider text-fg-subtle border border-border px-2 py-0.5 rounded-full"
                      >
                        {lang === "bn" ? s.name_bn : s.name_en}
                      </span>
                    ))}
                    {c.subs.length > 3 ? (
                      <span className="text-[10px] uppercase tracking-wider text-fg-subtle px-1">
                        +{c.subs.length - 3}
                      </span>
                    ) : null}
                  </div>
                  <div className="mt-5 pt-4 border-t border-border flex items-end justify-between">
                    <div>
                      <p className="text-[10px] text-fg-subtle uppercase tracking-wider">
                        {t("cat.from")}
                      </p>
                      <p className="price-tag text-[16px] font-semibold mt-0.5">
                        {count > 0 ? `¥${fromPrice.toFixed(2)}` : "—"}
                      </p>
                    </div>
                    <span className="text-[13px] font-medium text-cyan-700 inline-flex items-center gap-1.5 group-hover:gap-2 transition-all">
                      {t("cat.view")}
                      <IconArrowRight className="w-3.5 h-3.5" />
                    </span>
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      </Container>

      {/* ── TOP PICKS (featured products) ────────────────────────────── */}
      <Container className="pb-16">
        <div className="flex items-end justify-between gap-4 mb-6 flex-wrap">
          <div>
            <p className="text-[12px] font-medium tracking-wider uppercase text-cyan-700">
              {t("cat.featured.title")}
            </p>
            <h2 className="mt-2 max-w-2xl">
              {t("cat.featured.subtitle")}
            </h2>
          </div>
          {!showAll ? (
            <button
              type="button"
              onClick={() => setShowAll(true)}
              className="text-[13px] font-medium text-cyan-700 hover:text-cyan-800 inline-flex items-center gap-1.5 min-h-[44px] px-2"
            >
              {t("cat.featured.browse_all")}
            </button>
          ) : null}
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {(showAll ? allProducts : featured).map((p) => (
            <ProductCard
              key={p.source_id}
              product={p as unknown as Parameters<typeof ProductCard>[0]["product"]}
            />
          ))}
        </div>
      </Container>

      {/* ── WHY ONLY 6 CATEGORIES ────────────────────────────────────── */}
      <Container className="pb-16">
        <div className="card p-7 md:p-10 bg-slate-50/60">
          <p className="text-[12px] font-medium tracking-wider uppercase text-cyan-700">
            {t("cat.why.title")}
          </p>
          <h2 className="mt-2 max-w-2xl">
            {t("cat.why.subtitle")}
          </h2>
          <div className="mt-7 grid sm:grid-cols-2 lg:grid-cols-4 gap-5">
            {[
              { key: "r1", tone: "bg-cyan-500" },
              { key: "r2", tone: "bg-emerald-500" },
              { key: "r3", tone: "bg-violet-500" },
              { key: "r4", tone: "bg-amber-500" },
            ].map((r) => (
              <div key={r.key}>
                <span className={`inline-block w-1.5 h-1.5 rounded-full ${r.tone} mb-3`} />
                <h3 className="h-4 !text-[12px] !font-medium uppercase tracking-wider !text-fg-muted">
                  {t(`cat.why.${r.key}.title`)}
                </h3>
                <p className="mt-1.5 text-[12px] text-fg-muted leading-relaxed">
                  {t(`cat.why.${r.key}.body`)}
                </p>
              </div>
            ))}
          </div>
        </div>
      </Container>

      {/* ── BOTTOM DARK CTA ──────────────────────────────────────────── */}
      <Container className="pb-24">
        <div className="bg-slate-900 text-white rounded-2xl p-8 md:p-12">
          <h2 className="text-white max-w-2xl">
            {t("cat.cta.title")}
          </h2>
          <p className="mt-3 text-[15px] text-slate-300 max-w-2xl leading-relaxed">
            {t("cat.cta.body")}
          </p>
          <div className="mt-7 flex flex-wrap items-center gap-3">
            <a
              href={whatsappLink()}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 bg-cyan-500 hover:bg-cyan-400 text-slate-900 font-semibold px-5 py-3 rounded-md min-h-[44px] text-[14px] transition-colors"
            >
              <IconWhatsApp className="w-4 h-4" />
              {t("cat.cta.whatsapp")}
            </a>
            <Link
              href="/rfq"
              className="inline-flex items-center gap-2 border border-slate-600 hover:border-slate-400 text-white font-medium px-5 py-3 rounded-md min-h-[44px] text-[14px] transition-colors"
            >
              {t("cat.cta.rfq")}
              <IconArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </div>
      </Container>
    </>
  );
}
