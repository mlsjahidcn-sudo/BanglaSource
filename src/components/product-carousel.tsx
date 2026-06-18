"use client";
// /components/product-carousel.tsx
//
// Phase 23: a small horizontal product carousel used on
// the home page (Popular this week, Recently restocked)
// and the PDP (Similar products). Built on the same
// pattern as the existing recommendations-carousel:
// horizontal scroll-snap row + nav buttons (when
// overflow exists) + per-card image + title + price.

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { fmtBdt, FX_CNY_BDT } from "@/lib/pricing";
import { useLang } from "@/lib/i18n";

export type CarouselItem = {
  source_id: string;
  title_en: string;
  title_bn: string;
  image: string;
  /** Pre-computed min BDT for the lowest tier. 0 if no tier. */
  min_bdt: number;
  category?: string;
};

export function ProductCarousel({
  eyebrow,
  title,
  items,
  hrefAll,
  hrefAllLabel,
}: {
  eyebrow?: string;
  title: string;
  items: CarouselItem[];
  hrefAll?: string;
  hrefAllLabel?: string;
}) {
  const { lang } = useLang();
  const scrollerRef = useRef<HTMLDivElement | null>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  // Update nav button visibility when scroll position
  // changes (after a resize, after a card click jumps
  // the scroll, etc.). Cheap — runs only on layout
  // changes via the ResizeObserver.
  useEffect(() => {
    const el = scrollerRef.current;
    if (!el) return;
    const update = () => {
      setCanScrollLeft(el.scrollLeft > 4);
      setCanScrollRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 4);
    };
    update();
    el.addEventListener("scroll", update, { passive: true });
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => {
      el.removeEventListener("scroll", update);
      ro.disconnect();
    };
  }, [items.length]);

  function scrollBy(direction: 1 | -1) {
    const el = scrollerRef.current;
    if (!el) return;
    el.scrollBy({ left: direction * el.clientWidth * 0.85, behavior: "smooth" });
  }

  if (items.length === 0) return null;

  return (
    <section className="mt-12">
      <div className="flex items-end justify-between gap-4 mb-4">
        <div>
          {eyebrow && (
            <p className="text-[11px] font-medium tracking-wider uppercase text-fg-subtle">
              {eyebrow}
            </p>
          )}
          <h2 className="mt-1 text-[20px] md:text-[24px] font-semibold tracking-[-0.005em]">
            {title}
          </h2>
        </div>
        {hrefAll && (
          <Link
            href={hrefAll}
            className="min-h-[44px] inline-flex items-center text-[12.5px] text-cyan-700 hover:underline shrink-0 px-2 -mr-2"
          >
            {hrefAllLabel ?? "Browse all →"}
          </Link>
        )}
      </div>

      <div className="relative group">
        <div
          ref={scrollerRef}
          className="flex gap-3 overflow-x-auto scroll-smooth scrollbar-none snap-x snap-mandatory pb-2 -mx-6 md:-mx-10 px-6 md:px-10"
          // Hide the scrollbar in webkit + firefox
          style={{ scrollbarWidth: "none" }}
        >
          {items.map((it) => (
            <Link
              key={it.source_id}
              href={`/products/${it.source_id}`}
              className="group/card block w-[180px] md:w-[210px] shrink-0 snap-start rounded-lg border border-border bg-bg overflow-hidden hover:border-cyan-300 transition-colors"
            >
              <div className="relative aspect-square bg-slate-50">
                {it.image ? (
                  <Image
                    src={it.image}
                    alt={lang === "bn" ? it.title_bn || it.title_en : it.title_en}
                    fill
                    sizes="210px"
                    className="object-cover"
                    loading="lazy"
                    decoding="async"
                  />
                ) : null}
              </div>
              <div className="p-2.5">
                <p className="text-[12.5px] font-medium line-clamp-2 min-h-[2.4em] leading-snug">
                  {lang === "bn" ? it.title_bn || it.title_en : it.title_en}
                </p>
                {it.min_bdt > 0 && (
                  <p className="mt-1.5 text-[13px] font-semibold price-tag">
                    {fmtBdt(it.min_bdt)}
                  </p>
                )}
              </div>
            </Link>
          ))}
        </div>

        {/* Nav buttons. We use a single Chevron SVG and
            rotate it for each side. Only render when
            the carousel is actually overflowable. */}
        {canScrollLeft && (
          <button
            type="button"
            onClick={() => scrollBy(-1)}
            aria-label="Scroll left"
            className="hidden md:flex absolute left-0 top-1/2 -translate-y-1/2 -translate-x-1/2 w-9 h-9 rounded-full bg-bg border border-border items-center justify-center text-fg-muted hover:text-fg shadow-sm"
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
              <path d="M10 3L5 8l5 5" />
            </svg>
          </button>
        )}
        {canScrollRight && (
          <button
            type="button"
            onClick={() => scrollBy(1)}
            aria-label="Scroll right"
            className="hidden md:flex absolute right-0 top-1/2 -translate-y-1/2 translate-x-1/2 w-9 h-9 rounded-full bg-bg border border-border items-center justify-center text-fg-muted hover:text-fg shadow-sm"
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
              <path d="M6 3l5 5-5 5" />
            </svg>
          </button>
        )}
      </div>
    </section>
  );
}
