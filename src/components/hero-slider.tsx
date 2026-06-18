"use client";
/**
 * Phase 52: HeroSlider — product-specific, multiple slides,
 * mobile-optimized.
 *
 * Design:
 * - One product per slide, 5-6 slides.
 * - Each slide: square product image (left/top) + info card
 *   (right/bottom) with title, supplier, MOQ, min price, CTA.
 * - Auto-rotation: 5s on desktop, paused on hover/touch.
 * - Manual controls: prev/next arrows (44x44 desktop) + dot
 *   indicators (44x44 tap targets) at the bottom.
 * - Mobile (≤ md): full-bleed image on top, info card below;
 *   auto-rotation off, swipe via CSS snap-scroll; dots
 *   sit below the card.
 * - Keyboard: ← / → when the slider is focused or hovered.
 *
 * Why not a third-party slider lib (swiper/embla): we only
 * need N slides + auto-rotate + snap. ~120 lines of code is
 * smaller and zero JS-bundle cost beyond what Next already
 * ships. Touch swipe is native CSS scroll-snap.
 */

import Link from "next/link";
import Image from "next/image";
import { useCallback, useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import { useLang } from "@/lib/i18n";
import type { HeroProduct } from "@/lib/popular";

type Props = {
  products: HeroProduct[];
  className?: string;
};

const ROTATE_MS = 5000;

export function HeroSlider({ products, className }: Props) {
  const { t, lang } = useLang();
  const [active, setActive] = useState(0);
  const [paused, setPaused] = useState(false);
  // ref for the mobile snap-scroll track so the dot indicator
  // can mirror the user's manual scroll position.
  const trackRef = useRef<HTMLDivElement | null>(null);
  // ref for the desktop slides container so keyboard ←/→
  // can also control the active slide from any focus.
  const containerRef = useRef<HTMLDivElement | null>(null);

  const count = products.length;

  // Auto-rotation. Pauses on hover (desktop) or while the
  // user is touching (mobile). Restarts on leave.
  useEffect(() => {
    if (count <= 1 || paused) return;
    const id = window.setInterval(() => {
      setActive((a) => (a + 1) % count);
    }, ROTATE_MS);
    return () => window.clearInterval(id);
  }, [count, paused]);

  const go = useCallback(
    (next: number) => {
      if (count === 0) return;
      const wrapped = ((next % count) + count) % count;
      setActive(wrapped);
      // Also scroll the mobile snap track to the matching slide.
      const track = trackRef.current;
      if (track) {
        const slide = track.children[wrapped] as HTMLElement | undefined;
        if (slide) {
          // Use 'instant' so a tap on a dot doesn't get stuck
          // mid-animation on the user's manual scroll.
          slide.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "start" });
        }
      }
    },
    [count],
  );

  // Mirror the mobile snap-scroll position back into the dot
  // indicator so swiping updates the active slide.
  useEffect(() => {
    const track = trackRef.current;
    if (!track) return;
    let raf = 0;
    const onScroll = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        const w = track.clientWidth;
        if (w === 0) return;
        const idx = Math.round(track.scrollLeft / w);
        if (idx !== active) setActive(idx);
      });
    };
    track.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      track.removeEventListener("scroll", onScroll);
      cancelAnimationFrame(raf);
    };
  }, [active]);

  // Keyboard ←/→ when the slider is focused.
  const onKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "ArrowLeft") {
        e.preventDefault();
        go(active - 1);
      } else if (e.key === "ArrowRight") {
        e.preventDefault();
        go(active + 1);
      }
    },
    [active, go],
  );

  // Touch pauses auto-rotation while a finger is down.
  const onTouchStart = useCallback(() => setPaused(true), []);
  const onTouchEnd = useCallback(() => setPaused(false), []);

  if (count === 0) {
    return (
      <div
        className={cn(
          "rounded-xl border border-border bg-bg-soft p-8 text-center text-fg-muted text-[14px]",
          className,
        )}
      >
        {t("home.hero_slider.empty")}
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className={cn(
        "relative rounded-xl border border-border bg-bg overflow-hidden",
        className,
      )}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onTouchStart={onTouchStart}
      onTouchEnd={onTouchEnd}
      onKeyDown={onKeyDown}
      tabIndex={0}
      role="region"
      aria-roledescription="carousel"
      aria-label={t("home.hero_slider.eyebrow")}
    >
      {/* ─────────────  DESKTOP  ─────────────
          One slide at a time, opacity transition.
          Each slide is a focusable <article> with the
          full image + info card laid out side-by-side.
          On mobile this whole stack is hidden — we use
          the snap-scroll track below instead. */}
      <div className="hidden md:block relative h-[420px]">
        {products.map((p, i) => (
          <HeroSlide
            key={p.source_id}
            product={p}
            visible={i === active}
            ariaHidden={i !== active}
            t={t}
            lang={lang}
          />
        ))}
      </div>

      {/* Prev / next arrows (desktop only) — 44x44 */}
      <button
        type="button"
        onClick={() => go(active - 1)}
        aria-label={t("home.hero_slider.prev")}
        className="hidden md:inline-flex min-w-[44px] min-h-[44px] absolute left-3 top-1/2 -translate-y-1/2 z-20 rounded-full bg-bg/85 backdrop-blur border border-border shadow-sm items-center justify-center text-fg-muted hover:text-fg hover:bg-bg active:bg-bg-soft"
      >
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden>
          <path d="M10 3L5 8l5 5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
      <button
        type="button"
        onClick={() => go(active + 1)}
        aria-label={t("home.hero_slider.next")}
        className="hidden md:inline-flex min-w-[44px] min-h-[44px] absolute right-3 top-1/2 -translate-y-1/2 z-20 rounded-full bg-bg/85 backdrop-blur border border-border shadow-sm items-center justify-center text-fg-muted hover:text-fg hover:bg-bg active:bg-bg-soft"
      >
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden>
          <path d="M6 3l5 5-5 5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>

      {/* ─────────────  MOBILE  ─────────────
          Horizontal snap-scroll track. Each slide is
          100% of the container width. CSS scroll-snap
          handles the swipe gesture. The dot row at
          the bottom mirrors the scroll position. */}
      <div
        ref={trackRef}
        className="md:hidden flex overflow-x-auto snap-x snap-mandatory scroll-smooth no-scrollbar"
        style={{ scrollbarWidth: "none" }}
        aria-label={t("home.hero_slider.eyebrow")}
      >
        {products.map((p, i) => (
          <div
            key={p.source_id}
            className="w-full shrink-0 snap-start"
            aria-roledescription="slide"
            aria-label={t("home.hero_slider.slide_of", { n: i + 1, total: count })}
          >
            <MobileHeroSlide product={p} t={t} lang={lang} />
          </div>
        ))}
      </div>

      {/* Dot indicators — 44x44 tap target, 8px visible dot */}
      <div className="absolute left-0 right-0 bottom-3 z-20 flex items-center justify-center gap-1.5 pointer-events-none">
        {products.map((_, i) => {
          const isActive = i === active;
          return (
            <button
              key={i}
              type="button"
              onClick={() => go(i)}
              aria-label={t("home.hero_slider.slide_of", { n: i + 1, total: count })}
              aria-current={isActive ? "true" : undefined}
              className="pointer-events-auto min-w-[44px] min-h-[44px] flex items-center justify-center"
            >
              <span
                className={cn(
                  "block rounded-full transition-all duration-200",
                  isActive
                    ? "bg-cyan-600 w-6 h-1.5"
                    : "bg-fg-subtle/40 w-1.5 h-1.5 hover:bg-fg-muted",
                )}
              />
            </button>
          );
        })}
      </div>
    </div>
  );
}

/* ───────────────────────  DESKTOP SLIDE  ─────────────────────── */

function HeroSlide({
  product,
  visible,
  ariaHidden,
  t,
  lang,
}: {
  product: HeroProduct;
  visible: boolean;
  ariaHidden: boolean;
  t: (k: string, vars?: Record<string, string | number>) => string;
  lang: "en" | "bn";
}) {
  return (
    <article
      aria-hidden={ariaHidden}
      aria-roledescription="slide"
      className={cn(
        "absolute inset-0 grid grid-cols-12 gap-6 p-10 transition-opacity duration-500",
        visible ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none",
      )}
    >
      {/* Info card — 7 cols. pl-14 leaves room for the 44x44
          prev arrow positioned at `left-3` so the title + price
          don't start under the arrow. */}
      <div className="col-span-7 flex flex-col justify-center min-w-0 pl-14">
        <span className="inline-flex w-fit items-center gap-2 px-2.5 py-1 text-[10px] font-semibold tracking-[0.1em] uppercase rounded-full bg-cyan-600 text-white">
          <span className="relative flex h-1.5 w-1.5">
            <span className="absolute inline-flex h-full w-full rounded-full bg-white opacity-60 animate-ping" />
            <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-white" />
          </span>
          {t("home.hero_slider.eyebrow")}
        </span>

        <h3 className="mt-4 text-[28px] leading-[1.1] font-semibold tracking-[-0.02em] text-fg line-clamp-2 max-w-[24ch]">
          {lang === "bn" ? product.title_bn : product.title_en}
        </h3>

        <p className="mt-2 text-[12px] text-fg-subtle tracking-wider uppercase">
          {product.category}
          {product.supplier_city && (
            <>
              {" · China"}
            </>
          )}
        </p>

        <div className="mt-5 flex items-baseline gap-2">
          <span className="text-[11px] text-fg-subtle uppercase tracking-wider">
            {t("home.hero_slider.from")}
          </span>
          <span className="price-tag text-[24px] font-semibold text-fg">
            ৳{product.min_bdt.toLocaleString(lang === "bn" ? "bn-BD" : "en-US")}
          </span>
          <span className="text-[12px] text-fg-muted">
            {t("home.hero_slider.per_pc", { qty: product.moq })}
          </span>
        </div>

        <p className="mt-2 text-[12px] text-fg-muted">{t("home.hero_slider.shipping")}</p>

        <div className="mt-5 flex items-center gap-3">
          <Link
            href={`/products/${product.source_id}`}
            className="inline-flex items-center h-11 px-5 text-[14px] font-medium rounded-md bg-cyan-600 text-white hover:bg-cyan-700 transition-colors shadow-[inset_0_-1px_0_rgba(0,0,0,0.08)]"
          >
            {t("home.hero_slider.cta.view")} →
          </Link>
        </div>
      </div>

      {/* Image — 5 cols */}
      <Link
        href={`/products/${product.source_id}`}
        className="col-span-5 relative rounded-lg overflow-hidden bg-slate-50 border border-border"
        tabIndex={ariaHidden ? -1 : 0}
      >
        {product.image ? (
          <Image
            src={product.image}
            alt={lang === "bn" ? product.title_bn : product.title_en}
            fill
            sizes="(max-width: 1024px) 100vw, 40vw"
            className="object-cover"
          />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center text-fg-subtle text-[12px]">
            {t("home.hero_slider.empty")}
          </div>
        )}
      </Link>
    </article>
  );
}

/* ───────────────────────  MOBILE SLIDE  ─────────────────────── */

function MobileHeroSlide({
  product,
  t,
  lang,
}: {
  product: HeroProduct;
  t: (k: string, vars?: Record<string, string | number>) => string;
  lang: "en" | "bn";
}) {
  return (
    <Link
      href={`/products/${product.source_id}`}
      className="block"
      aria-label={`${t("home.hero_slider.cta.view")}: ${
        lang === "bn" ? product.title_bn : product.title_en
      }`}
    >
      {/* Image on top, full-bleed */}
      <div className="relative aspect-[4/3] bg-slate-50 border-b border-border">
        {product.image ? (
          <Image
            src={product.image}
            alt={lang === "bn" ? product.title_bn : product.title_en}
            fill
            sizes="100vw"
            className="object-cover"
          />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center text-fg-subtle text-[12px]">
            {t("home.hero_slider.empty")}
          </div>
        )}
        <span className="absolute top-3 left-3 inline-flex items-center gap-1.5 px-2.5 py-1 text-[10px] font-semibold tracking-[0.1em] uppercase rounded-full bg-cyan-600 text-white">
          <span className="w-1.5 h-1.5 rounded-full bg-white" />
          {t("home.hero_slider.eyebrow").split("·")[0].trim()}
        </span>
      </div>

      {/* Info card below */}
      <div className="p-5 space-y-3">
        <h3 className="text-[18px] leading-[1.2] font-semibold tracking-[-0.01em] text-fg line-clamp-2">
          {lang === "bn" ? product.title_bn : product.title_en}
        </h3>
        <p className="text-[11px] text-fg-subtle tracking-wider uppercase">
          {product.category}
          {product.supplier_city && ` · China`}
        </p>
        <div className="flex items-baseline gap-2">
          <span className="text-[11px] text-fg-subtle uppercase tracking-wider">
            {t("home.hero_slider.from")}
          </span>
          <span className="price-tag text-[22px] font-semibold text-fg">
            ৳{product.min_bdt.toLocaleString(lang === "bn" ? "bn-BD" : "en-US")}
          </span>
          <span className="text-[11px] text-fg-muted">
            {t("home.hero_slider.per_pc", { qty: product.moq })}
          </span>
        </div>
        <div className="pt-2">
          <span className="inline-flex items-center h-11 px-5 text-[14px] font-medium rounded-md bg-cyan-600 text-white">
            {t("home.hero_slider.cta.view")} →
          </span>
        </div>
      </div>
    </Link>
  );
}
