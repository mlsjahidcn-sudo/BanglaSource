"use client";
import Link from "next/link";
import Image from "next/image";
import { useState, useEffect, useRef } from "react";
import { useLang } from "@/lib/i18n";
import { Container } from "@/components/ui/container";
import { Badge } from "@/components/ui/badge";
import { useCatalog, type CatalogProduct } from "@/lib/use-catalog";
import { fmtCny, fmtBdt, FX_CNY_BDT, landedCost } from "@/lib/pricing";
import { categoryList, categories, type CategoryKey } from "@/lib/categories";
import { ForYou } from "@/components/for-you";
import { RecentlyViewed } from "@/components/recently-viewed";
import { NewsletterSignup } from "@/components/newsletter-signup";
import { TrustBar } from "@/components/trust-bar";
import { ValueProps } from "@/components/value-props";
import { Testimonials } from "@/components/testimonials";

const SLIDES: Array<{
  eyebrowKey: string;
  titleKey: string;
  bodyKey: string;
  ctaKey: string;
  href: string;
  bg: string;
  accent: string;
  visual:
    | "earbuds"
    | "earrings"
    | "kitchen"
    | "led"
    | "tshirt"
    | "juicer"
    | "tws"
    | "kurti"
    | "charger";
}> = [
  {
    eyebrowKey: "home.slider.s1.eyebrow",
    titleKey: "home.slider.s1.title",
    bodyKey: "home.slider.s1.body",
    ctaKey: "home.slider.s1.cta",
    href: "/categories",
    bg: "from-slate-900 to-slate-800",
    accent: "bg-emerald-500",
    visual: "earbuds",
  },
  {
    eyebrowKey: "home.slider.s2.eyebrow",
    titleKey: "home.slider.s2.title",
    bodyKey: "home.slider.s2.body",
    ctaKey: "home.slider.s2.cta",
    href: "/how-it-works",
    bg: "from-emerald-900 to-slate-900",
    accent: "bg-amber-400",
    visual: "kitchen",
  },
  {
    eyebrowKey: "home.slider.s3.eyebrow",
    titleKey: "home.slider.s3.title",
    bodyKey: "home.slider.s3.body",
    ctaKey: "home.slider.s3.cta",
    href: "/contact",
    bg: "from-slate-800 to-emerald-900",
    accent: "bg-emerald-400",
    visual: "led",
  },
];

export function HomeClient({
  syncStats,
}: {
  syncStats: {
    activeCount: number;
    lastSyncIso: string | null;
    failedLast: boolean;
  };
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
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
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
                lastSyncIso={syncStats.lastSyncIso}
                failedLast={syncStats.failedLast}
              />
            </span>
          </div>
          <div className="flex items-center gap-4 shrink-0">
            <span className="hidden sm:inline font-mono tnum">
              1 CNY = {FX_CNY_BDT.toFixed(2)} BDT
            </span>
            <span className="hidden sm:inline text-slate-300">·</span>
            <a href="https://wa.me/8801732576417" className="hover:text-fg">
              WhatsApp
            </a>
          </div>
        </Container>
      </div>

      {/* ─────────────────  RAIL + HERO SLIDER  ──────────────── */}
      <section className="bg-bg-soft border-b border-border">
        <Container className="py-5 overflow-visible">
          <div className="grid md:grid-cols-12 gap-4 overflow-visible">
            <SidebarRail products={allProducts} />
            <div className="md:col-span-9">
              <HeroSlider />
            </div>
          </div>
        </Container>
      </section>

      {/* ────────────────────  RECENTLY VIEWED  ──────────────────── */}
      {loaded && (
        <section className="bg-bg">
          <Container className="py-8">
            <RecentlyViewed limit={8} />
          </Container>
        </section>
      )}

      {/* ────────────────────  FOR YOU (personalized)  ──────────────────── */}
      {loaded && (
        <section className="bg-bg">
          <Container className="py-10">
            <ForYou limit={12} />
          </Container>
        </section>
      )}

      {/* ────────────────────  PER-CATEGORY STRIPS  ──────────────────── */}
      <section className="bg-bg">
        <Container className="py-10">
          {loaded
            ? categoryList.map((c) => (
                <CategoryStrip
                  key={c.key}
                  categoryKey={c.key}
                  products={allProducts}
                />
              ))
            : null}
        </Container>
      </section>

      {/* ────────────────────  TRUST BAR  ──────────────────── */}
      <section className="bg-bg-soft border-y border-border">
        <Container className="py-10">
          <TrustBar
            activeCount={syncStats.activeCount}
            productCount={allProducts.length}
          />
        </Container>
      </section>

      {/* ────────────────────  VALUE PROPS  ──────────────────── */}
      <section className="bg-bg">
        <Container className="py-12">
          <ValueProps />
        </Container>
      </section>

      {/* ────────────────────  TESTIMONIALS  ──────────────────── */}
      <section className="bg-bg">
        <Container className="py-12">
          <Testimonials />
        </Container>
      </section>

      {/* ────────────────────  NEWSLETTER  ──────────────────── */}
      <section className="bg-bg-soft border-t border-border">
        <Container className="py-12">
          <NewsletterSignup />
        </Container>
      </section>
    </>
  );
}

/* ───────────────────────────  SIDEBAR RAIL  ─────────────────────────── */

function SidebarRail({ products: allProducts }: { products: CatalogProduct[] }) {
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
                            FX_CNY_BDT,
                        ),
                      )}
                    </p>
                  </Link>
                ))}
              </div>
            </div>
            <Link
              href={`/categories/${hoveredCat.slug}`}
              className="block p-3 text-center text-[12.5px] font-medium text-fg hover:text-emerald-700 border-t border-border bg-bg-soft"
            >
              {lang === "bn" ? "সব দেখুন" : "Browse all"} {lang === "bn" ? hoveredCat.name_bn : hoveredCat.name_en} →
            </Link>
          </div>
        )}
      </div>
    </aside>
  );
}

/* ───────────────────────────  HERO SLIDER  ─────────────────────────── */

function HeroSlider() {
  const { t } = useLang();
  const [idx, setIdx] = useState(0);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    timer.current = setInterval(() => {
      setIdx((i) => (i + 1) % SLIDES.length);
    }, 6000);
    return () => {
      if (timer.current) clearInterval(timer.current);
    };
  }, []);

  return (
    <div className="relative overflow-hidden rounded-xl border border-border h-[420px]">
      {SLIDES.map((s, i) => (
        <div
          key={i}
          className={`absolute inset-0 transition-opacity duration-700 ${
            i === idx ? "opacity-100" : "opacity-0 pointer-events-none"
          }`}
          aria-hidden={i !== idx}
        >
          <HeroSlide
            eyebrow={t(s.eyebrowKey)}
            title={t(s.titleKey)}
            body={t(s.bodyKey)}
            cta={t(s.ctaKey)}
            href={s.href}
            bg={s.bg}
            accent={s.accent}
            visual={s.visual}
          />
        </div>
      ))}

      <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-2 z-20">
        {SLIDES.map((_, i) => (
          <button
            key={i}
            onClick={() => setIdx(i)}
            aria-label={`Go to slide ${i + 1}`}
            className={`h-1.5 rounded-full transition-all ${
              i === idx ? "w-8 bg-white" : "w-1.5 bg-white/40 hover:bg-white/70"
            }`}
          />
        ))}
      </div>
    </div>
  );
}

function HeroSlide({
  eyebrow,
  title,
  body,
  cta,
  href,
  bg,
  accent,
  visual,
}: {
  eyebrow: string;
  title: string;
  body: string;
  cta: string;
  href: string;
  bg: string;
  accent: string;
  visual: (typeof SLIDES)[number]["visual"];
}) {
  return (
    <div
      className={`relative h-full bg-gradient-to-br ${bg} text-white overflow-hidden`}
    >
      <div
        className="absolute inset-0 opacity-[0.05]"
        style={{
          backgroundImage:
            "linear-gradient(rgba(255,255,255,.6) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.6) 1px, transparent 1px)",
          backgroundSize: "56px 56px",
        }}
      />
      <div className="relative h-full grid md:grid-cols-2 gap-6 p-8 md:p-12">
        <div className="flex flex-col justify-center">
          <span
            className={`inline-flex w-fit items-center gap-2 px-2.5 py-1 text-[10px] font-semibold tracking-wider uppercase rounded-full ${accent} text-slate-900`}
          >
            <span className="w-1 h-1 rounded-full bg-slate-900" />
            {eyebrow}
          </span>
          <h2 className="mt-4 text-[30px] md:text-[40px] leading-[1.05] font-semibold tracking-[-0.025em] max-w-md">
            {title}
          </h2>
          <p className="mt-4 text-[15px] text-slate-300 leading-relaxed max-w-md">
            {body}
          </p>
          <div className="mt-7 flex items-center gap-3">
            <Link
              href={href}
              className="inline-flex items-center h-11 px-5 text-[14px] font-medium rounded-md bg-white text-slate-900 hover:bg-slate-100 transition-colors"
            >
              {cta} →
            </Link>
            <Link
              href="/how-it-works"
              className="inline-flex items-center h-11 px-4 text-[14px] font-medium rounded-md text-white/90 hover:text-white"
            >
              Learn more
            </Link>
          </div>
        </div>
        <div className="hidden md:flex items-center justify-center relative">
          <HeroVisual kind={visual} />
        </div>
      </div>
    </div>
  );
}

function HeroVisual({ kind }: { kind: (typeof SLIDES)[number]["visual"] }) {
  if (kind === "earbuds") {
    return (
      <div className="relative w-full h-full flex items-center justify-center">
        <div className="relative w-72 h-72 md:w-80 md:h-80 rounded-2xl overflow-hidden border border-white/10 shadow-2xl bg-white">
          <Image
            src="https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=800&auto=format&fit=crop&q=80"
            alt=""
            fill
            sizes="320px"
            className="object-cover"
            priority
          />
        </div>
        <div className="absolute -bottom-2 -right-2 md:right-4 bg-white text-slate-900 px-4 py-3 rounded-lg shadow-2xl border border-slate-200">
          <p className="text-[10px] font-semibold tracking-wider uppercase text-emerald-600">
            Bulk deal
          </p>
          <p className="price-tag text-[20px] font-semibold leading-none mt-0.5">
            ৳329
          </p>
          <p className="text-[10px] text-fg-muted mt-0.5">landed in Dhaka · 500+ pcs</p>
        </div>
      </div>
    );
  }
  if (kind === "kitchen") {
    return (
      <div className="relative w-full h-full flex items-center justify-center">
        <div className="relative w-72 h-72 md:w-80 md:h-80 rounded-2xl overflow-hidden border border-white/10 shadow-2xl bg-white">
          <Image
            src="https://images.unsplash.com/photo-1556909114-f6e7ad7d3136?w=800&auto=format&fit=crop&q=80"
            alt=""
            fill
            sizes="320px"
            className="object-cover"
          />
        </div>
        <div className="absolute top-4 -left-2 md:-left-4 bg-emerald-500 text-slate-900 px-3 py-2 rounded-lg shadow-2xl">
          <p className="text-[10px] font-semibold tracking-wider uppercase">
            QC passed
          </p>
          <p className="text-[12px] font-medium mt-0.5">
            100/100 · Color matched
          </p>
        </div>
      </div>
    );
  }
  // led / payment
  return (
    <div className="relative w-full h-full flex items-center justify-center">
      <div className="relative w-72 h-72 md:w-80 md:h-80 rounded-2xl overflow-hidden border border-white/10 shadow-2xl bg-white">
        <Image
          src="https://images.unsplash.com/photo-1565538810643-b5bdb714032a?w=800&auto=format&fit=crop&q=80"
          alt=""
          fill
          sizes="320px"
          className="object-cover"
        />
      </div>
      <div className="absolute bottom-4 left-4 md:left-8 bg-white text-slate-900 px-4 py-3 rounded-lg shadow-2xl border border-slate-200">
        <p className="text-[10px] font-semibold tracking-wider uppercase text-fg-subtle">
          Escrow balance
        </p>
        <p className="price-tag text-[22px] font-semibold leading-none mt-1">
          ৳44,665
        </p>
        <p className="text-[10.5px] text-fg-muted mt-1">
          Holds until you confirm
        </p>
      </div>
    </div>
  );
}

/* ───────────────────────────  CATEGORY STRIP  ──────────────────────── */

function CategoryStrip({
  categoryKey,
  products: allProducts,
}: {
  categoryKey: CategoryKey;
  products: CatalogProduct[];
}) {
  const { t, lang } = useLang();
  const cat = categories[categoryKey];
  const items = allProducts
    .filter((p) => p.category === categoryKey)
    .slice(0, 4);

  return (
    <div className="mb-12">
      <div className="flex items-end justify-between mb-6 pb-4 border-b border-border">
        <div className="flex items-end gap-3">
          <span
            className={`w-1.5 h-1.5 rounded-full ${cat.accent} mb-2`}
          />
          <h2 className="text-[22px] md:text-[26px] font-semibold tracking-[-0.01em]">
            {lang === "bn" ? cat.name_bn : cat.name_en}
          </h2>
          <span className="text-[12px] text-fg-subtle font-mono tnum pb-1 hidden sm:inline">
            {items.length} {t("cat.products")}
          </span>
        </div>
        <Link
          href={`/categories/${cat.slug}`}
          className="text-[13px] font-medium text-fg hover:text-emerald-700"
        >
          {t("home.strip.see_all")} →
        </Link>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {items.map((p) => (
          <StripCard key={p.source_id} product={p} />
        ))}
      </div>
    </div>
  );
}

function StripCard({ product }: { product: CatalogProduct }) {
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
      className="group block rounded-lg border border-border bg-bg overflow-hidden hover:border-emerald-600/40 hover:shadow-[0_2px_4px_rgba(15,23,42,0.04),0_12px_28px_-12px_rgba(15,23,42,0.12)] transition-all duration-200"
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
            <span className="inline-flex items-center px-2 py-0.5 text-[10px] font-semibold tracking-wider uppercase rounded-full bg-emerald-500 text-slate-900">
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
        <p className="mt-1 text-[10.5px] text-fg-subtle truncate">
          {product.supplier_city}, {product.supplier_province}
        </p>
        <div className="mt-3 flex items-baseline gap-1.5">
          <span className="price-tag text-[16px] font-semibold text-fg">
            {fmtBdt(landed.unitBdt)}
          </span>
          <span className="text-[10.5px] text-fg-subtle">/ pc · Dhaka</span>
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
  lastSyncIso,
  failedLast,
}: {
  activeCount: number;
  lastSyncIso: string | null;
  failedLast: boolean;
}) {
  if (!lastSyncIso) {
    return (
      <span className="inline-flex items-center gap-1.5 text-fg-muted">
        <span className="w-1.5 h-1.5 rounded-full bg-fg-subtle" />
        catalog from 1688 wholesale
      </span>
    );
  }
  const ageMs = Date.now() - new Date(lastSyncIso).getTime();
  const ageH = Math.floor(ageMs / (60 * 60 * 1000));
  let ageLabel: string;
  if (ageH < 1) ageLabel = "< 1 hour ago";
  else if (ageH < 24) ageLabel = `${ageH}h ago`;
  else ageLabel = `${Math.floor(ageH / 24)}d ago`;
  return (
    <span className="inline-flex items-center gap-1.5 text-fg-muted">
      <span
        className={`w-1.5 h-1.5 rounded-full ${
          failedLast
            ? "bg-rose-500"
            : ageH < 36
              ? "bg-emerald-500"
              : "bg-amber-500"
        }`}
      />
      prices live from {activeCount} verified factories · synced {ageLabel}
    </span>
  );
}
