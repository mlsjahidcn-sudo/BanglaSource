"use client";
import { notFound } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { useMemo, useState } from "react";
import { useLang } from "@/lib/i18n";
import { Container } from "@/components/ui/container";
import { ProductCard } from "@/components/product-card";
import { useCatalog } from "@/lib/use-catalog";
import { categories, type CategoryKey } from "@/lib/categories";
import { IconArrowRight, IconChevron } from "@/components/portal-icons";

type SortKey = "popular" | "cheap" | "expensive";

export function CategoryClient({ slug }: { slug: string }) {
  const { t, lang } = useLang();
  const { products: allProducts, loaded } = useCatalog();
  const [activeSub, setActiveSub] = useState<string>("__all__");
  const [sort, setSort] = useState<SortKey>("popular");

  const c = categories[slug as CategoryKey];
  const items = useMemo(
    () => (c ? allProducts.filter((p) => p.category === c.key) : []),
    [c, allProducts],
  );

  // Filter + sort. (All hooks must run before any conditional return.)
  const visible = useMemo(() => {
    const sorted = [...items].sort((a, b) => {
      if (sort === "popular") {
        if (b.order_count_30d !== a.order_count_30d) {
          return b.order_count_30d - a.order_count_30d;
        }
        return a.source_id.localeCompare(b.source_id);
      }
      const aPrice =
        a.price_tiers[a.price_tiers.length - 1].price_cny_fen;
      const bPrice =
        b.price_tiers[b.price_tiers.length - 1].price_cny_fen;
      if (sort === "cheap") return aPrice - bPrice;
      return bPrice - aPrice;
    });
    return sorted;
  }, [items, sort]);

  // Stats: live from the product list.
  // Phase 56: removed `suppliers` + `provinces` counts — they
  // depended on supplier_name / supplier_province which are now
  // empty strings for the public catalog. We expose the same
  // numbers under different names that don't reveal the source
  // factory. `factories` here is the count of unique
  // (supplier_name, supplier_province) pairs in the underlying
  // data, but the actual names are not surfaced in the UI.
  const stats = useMemo(() => {
    const factories = new Set(
      items.map((p) => `${p.supplier_name}|${p.supplier_province}`),
    );
    const avgWeightKg =
      items.length > 0
        ? items.reduce((s, p) => s + p.weight_kg, 0) / items.length
        : 0;
    const avgUnitCny =
      items.length > 0
        ? items.reduce(
            (s, p) =>
              s +
              p.price_tiers[p.price_tiers.length - 1].price_cny_fen / 100,
            0,
          ) / items.length
        : 0;
    return {
      // Subtract 1 for the (empty, empty) bucket that every
      // stripped product now lands in. We want "0 factories"
      // in the stripped view, not "1 factory".
      factories: factories.size > 0 ? factories.size - 1 : 0,
      avgWeightKg,
      avgUnitCny,
    };
  }, [items]);

  // Other categories for the footer.
  const otherCategories = useMemo(
    () =>
      Object.values(categories).filter(
        (cat) =>
          c !== undefined &&
          cat.key !== c.key &&
          allProducts.some((p) => p.category === cat.key),
      ),
    [c, allProducts],
  );

  // ── Conditional returns AFTER all hooks ────────────────────────────
  if (!c) {
    notFound();
  }
  if (!loaded) {
    return (
      <Container className="py-16">
        <p className="text-[13px] text-fg-muted">Loading…</p>
      </Container>
    );
  }

  // Cover image = first product in this category (real, authentic).
  const cover = items[0]?.images?.[0] ?? c.cover;

  // Subcategory chips (we don't have a typed subcategory field on
  // products, so all subs currently show the same product list — but
  // surfacing the chips is still useful for category exploration).
  const subChips = [
    { slug: "__all__", name_en: t("cat.filter_all"), name_bn: t("cat.filter_all") },
    ...c.subs,
  ];

  return (
    <>
      {/* ── HERO ─────────────────────────────────────────────────────── */}
      <section className="relative bg-slate-50/60 overflow-hidden">
        <div className="absolute inset-y-0 right-0 w-1/3 hidden md:block">
          {cover ? (
            <Image
              src={cover}
              alt=""
              fill
              sizes="33vw"
              className="object-cover opacity-50"
            />
          ) : null}
          <div className="absolute inset-0 bg-gradient-to-r from-slate-50/60 via-slate-50/40 to-transparent" />
        </div>
        <Container className="pt-12 md:pt-20 pb-12 relative">
          <nav className="text-[12px] text-fg-subtle mb-6 font-mono tnum">
            <Link href="/categories" className="hover:text-fg">
              catalog
            </Link>
            <span className="mx-2 text-slate-300">/</span>
            <span className="text-fg-muted">{c.slug}</span>
          </nav>
          <div className="flex items-center gap-3">
            <span className={`w-1.5 h-1.5 rounded-full ${c.accent}`} />
            <p className="text-[12px] font-medium tracking-wider uppercase text-cyan-700">
              {t("cat.products").replace(/s$/, "")}{" "}
              <span className="font-mono tnum">{items.length}</span>
            </p>
          </div>
          <h1 className="mt-3 max-w-2xl">
            {lang === "bn" ? c.name_bn : c.name_en}
          </h1>
          <p className="mt-4 lead max-w-2xl">
            {lang === "bn" ? c.blurb_bn : c.blurb_en}
          </p>

          {/* Stats row */}
          <div className="mt-7 flex flex-wrap items-center gap-x-7 gap-y-3 text-[12px] text-fg-muted">
            <span className="font-mono tnum">
              <span className="text-fg font-semibold text-[14px] mr-1 price-tag">
                {stats.factories}
              </span>
              {t("cat.stats.factories")}
            </span>
            <span className="text-slate-300">·</span>
            <span>
              {t("cat.stats.provinces")}{" "}
              <span className="font-medium text-fg">China</span>
            </span>
            <span className="text-slate-300">·</span>
            <span className="font-mono tnum">
              {t("cat.stats.avg_weight")}{" "}
              <span className="font-medium text-fg">
                {stats.avgWeightKg.toFixed(2)} kg
              </span>
            </span>
            <span className="text-slate-300">·</span>
            <span className="font-mono tnum">
              {t("cat.stats.avg_price")}{" "}
              <span className="font-medium text-fg price-tag">
                ¥{stats.avgUnitCny.toFixed(2)}
              </span>
            </span>
          </div>
        </Container>
      </section>

      {/* ── SUB-CHIPS + SORT ─────────────────────────────────────────── */}
      <Container className="pt-8 pb-3">
        <div className="flex flex-wrap items-center gap-2">
          {subChips.map((s) => {
            const active = activeSub === s.slug;
            return (
              <button
                key={s.slug}
                type="button"
                onClick={() => setActiveSub(s.slug)}
                className={`inline-flex items-center min-h-[36px] px-3.5 rounded-full text-[13px] font-medium transition-colors ${
                  active
                    ? "bg-slate-900 text-white"
                    : "bg-white border border-border text-fg hover:border-border-strong"
                }`}
              >
                {lang === "bn" ? s.name_bn : s.name_en}
              </button>
            );
          })}
        </div>
        <div className="mt-5 flex items-center gap-1 text-[12px] text-fg-muted">
          <span>{t("cat.filter_all")}:</span>
          <div className="relative">
            <select
              value={sort}
              onChange={(e) => setSort(e.target.value as SortKey)}
              className="appearance-none bg-transparent border border-border rounded-md pl-2.5 pr-7 py-1.5 text-[12px] font-medium text-fg hover:border-border-strong focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500 min-h-[36px]"
            >
              <option value="popular">{t("cat.sort.popular")}</option>
              <option value="cheap">{t("cat.sort.cheap")}</option>
              <option value="expensive">{t("cat.sort.expensive")}</option>
            </select>
            <IconChevron className="w-3.5 h-3.5 absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none text-fg-muted" />
          </div>
          <span className="ml-auto text-[12px] text-fg-subtle font-mono tnum">
            {visible.length} {t("cat.products")}
          </span>
        </div>
      </Container>

      {/* ── PRODUCT GRID ─────────────────────────────────────────────── */}
      <Container className="pb-16">
        {visible.length === 0 ? (
          <div className="card p-12 text-center">
            <p className="text-[14px] text-fg-muted">{t("cat.empty")}</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {visible.map((p) => (
              <ProductCard key={p.source_id} product={p} />
            ))}
          </div>
        )}
      </Container>

      {/* ── OTHER CATEGORIES FOOTER ──────────────────────────────────── */}
      {otherCategories.length > 0 ? (
        <Container className="pb-24">
          <p className="text-[12px] font-medium tracking-wider uppercase text-cyan-700">
            {t("cat.other.title")}
          </p>
          <div className="mt-5 grid grid-cols-2 md:grid-cols-5 gap-3">
            {otherCategories.map((oc) => {
              const ocItems = allProducts.filter(
                (p) => p.category === oc.key,
              );
              const ocCover = ocItems[0]?.images?.[0] ?? oc.cover;
              return (
                <Link
                  key={oc.key}
                  href={`/categories/${oc.slug}`}
                  className="card group block overflow-hidden hover:border-border-strong"
                >
                  <div className="relative aspect-[4/3] bg-slate-50">
                    {ocCover ? (
                      <Image
                        src={ocCover}
                        alt={lang === "bn" ? oc.name_bn : oc.name_en}
                        fill
                        sizes="(min-width: 768px) 20vw, 50vw"
                        className="object-cover transition-transform duration-500 group-hover:scale-[1.03]"
                      />
                    ) : null}
                  </div>
                  <div className="p-3.5">
                    <h3 className="!text-[13px] !font-semibold !tracking-tight">
                      {lang === "bn" ? oc.name_bn : oc.name_en}
                    </h3>
                    <p className="mt-1 text-[10px] text-fg-subtle font-mono tnum">
                      {ocItems.length} {t("cat.products")}
                    </p>
                  </div>
                </Link>
              );
            })}
          </div>
          <div className="mt-6">
            <Link
              href="/categories"
              className="text-[13px] font-medium text-cyan-700 hover:text-cyan-800 inline-flex items-center gap-1.5 min-h-[44px]"
            >
              {t("cat.view")} {t("cat.title")}
              <IconArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>
        </Container>
      ) : null}
    </>
  );
}
