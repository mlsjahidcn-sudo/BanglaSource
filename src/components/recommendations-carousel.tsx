"use client";
// /components/recommendations-carousel.tsx
//
// "You might also like" carousel shown on the PDP. Fetches from
// /api/ai/recs/[productId] (Phase 4 endpoint) which returns 8
// products scored by:
//   +5  same category
//   +2  similar price band
//   +N  co-viewed in last 14 days
//
// Pure SQL, no LLM. The carousel re-fetches when the user switches
// PDPs (keyed by productId).

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { fmtBdt, FX_CNY_BDT, landedCost } from "@/lib/pricing";
import { useLang } from "@/lib/i18n";

type RecReasons = ("same_category" | "similar_price" | `co_viewed_${number}` | "popular_in_category")[];

type RecProduct = {
  source_id: string;
  title_en: string;
  title_bn: string;
  images: string[];
  category: string;
  supplier_name: string;
  supplier_city: string;
  supplier_province: string;
  price_min: number;
  price_max: number;
  factory_moq: number;
  markup_pct: number;
  badges: string[];
  rating_overall: number;
  order_count_30d: number;
  score: number;
  reasons: RecReasons;
};

type RecsResponse = {
  ok: boolean;
  seed_source_id: string;
  seed_category: string;
  recommendations: RecProduct[];
  meta?: { co_view_signals: number; candidates_scored: number; returned: number };
};

export function RecommendationsCarousel({
  productId,
}: {
  productId: string;
}) {
  const [data, setData] = useState<RecsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const scrollerRef = useRef<HTMLDivElement | null>(null);
  const { lang } = useLang();

  useEffect(() => {
    let alive = true;
    setLoading(true);
    setErr(null);
    fetch(`/api/ai/recs/${encodeURIComponent(productId)}`, {
      cache: "no-store",
    })
      .then((r) => r.json())
      .then((j: RecsResponse) => {
        if (!alive) return;
        if (!j.ok) {
          setErr("recs_unavailable");
          return;
        }
        setData(j);
      })
      .catch(() => {
        if (!alive) return;
        setErr("network");
      })
      .finally(() => {
        if (!alive) return;
        setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [productId]);

  function scrollBy(dir: -1 | 1) {
    const el = scrollerRef.current;
    if (!el) return;
    const cardWidth = 220; // approximate
    el.scrollBy({ left: dir * cardWidth * 2.2, behavior: "smooth" });
  }

  // Loading skeleton
  if (loading) {
    return (
      <section className="mt-12">
        <h2 className="text-[18px] font-semibold tracking-tight">
          You might also like
        </h2>
        <div className="mt-4 flex gap-3 overflow-x-auto pb-2">
          {Array.from({ length: 6 }).map((_, i) => (
            <div
              key={i}
              className="shrink-0 w-52 aspect-[4/3] bg-slate-100 rounded-lg animate-pulse"
            />
          ))}
        </div>
      </section>
    );
  }

  if (err || !data || data.recommendations.length === 0) {
    return null; // silent fail — PDP still works without recs
  }

  const recs = data.recommendations;

  return (
    <section className="mt-12">
      <div className="flex items-baseline justify-between">
        <div>
          <h2 className="text-[18px] font-semibold tracking-tight">
            You might also like
          </h2>
          <p className="mt-1 text-[12px] text-fg-subtle">
            {data.meta?.co_view_signals ? (
              <>
                {data.meta.co_view_signals} co-view signal
                {data.meta.co_view_signals === 1 ? "" : "s"} in the last 14
                days
              </>
            ) : (
              <>Based on category & price</>
            )}
          </p>
        </div>
        <div className="hidden sm:flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => scrollBy(-1)}
            className="w-9 h-9 rounded-md border border-border bg-bg hover:bg-slate-50 text-fg-muted transition-colors flex items-center justify-center"
            aria-label="Scroll left"
          >
            ←
          </button>
          <button
            type="button"
            onClick={() => scrollBy(1)}
            className="w-9 h-9 rounded-md border border-border bg-bg hover:bg-slate-50 text-fg-muted transition-colors flex items-center justify-center"
            aria-label="Scroll right"
          >
            →
          </button>
        </div>
      </div>

      <div
        ref={scrollerRef}
        className="mt-5 flex gap-3 overflow-x-auto pb-3 snap-x snap-mandatory scrollbar-thin"
        style={{ scrollbarWidth: "thin" }}
      >
        {recs.map((r) => {
          // Reuse landedCost() to get the per-piece BDT at MOQ.
          // We only have min/max here (not full price tiers), so we
          // approximate with a 1-tier price_tiers array at price_min.
          const landed = landedCost(
            {
              source_id: r.source_id,
              title_zh: "",
              title_en: r.title_en,
              title_bn: r.title_bn,
              category: r.category,
              price_min_cny: r.price_min,
              price_max_cny: r.price_max,
              factory_moq: r.factory_moq,
              price_tiers: [
                {
                  qty_min: r.factory_moq,
                  qty_max: 99999,
                  price_cny_fen: r.price_min,
                },
              ],
              weight_kg: 0.1,
              volume_cbm: 0.0005,
              supplier_name: r.supplier_name,
              supplier_province: r.supplier_province,
              supplier_city: r.supplier_city,
              stock_total: 0,
              order_count_30d: r.order_count_30d,
              rating_overall: r.rating_overall,
              badges: r.badges,
              images: r.images,
              description_en: "",
              description_bn: "",
              source_url: "",
              markup_pct: r.markup_pct,
            } as Parameters<typeof landedCost>[0],
            r.factory_moq,
            "air",
            FX_CNY_BDT,
          );
          const title = lang === "bn" ? r.title_bn : r.title_en;
          return (
            <Link
              key={r.source_id}
              href={`/products/${r.source_id}`}
              className="shrink-0 w-52 snap-start card group block overflow-hidden"
            >
              <div className="relative aspect-[4/3] bg-slate-50 overflow-hidden">
                {r.images[0] ? (
                  <Image
                    src={r.images[0]}
                    alt={title}
                    fill
                    sizes="208px"
                    className="object-cover group-hover:scale-[1.03] transition-transform duration-300"
                  />
                ) : (
                  <div className="absolute inset-0 flex items-center justify-center text-fg-subtle text-[11px]">
                    no image
                  </div>
                )}
                {/* Reason chips on the top-right of the image */}
                <div className="absolute top-1.5 right-1.5 flex flex-col items-end gap-1">
                  {r.reasons.includes("same_category") && (
                    <span className="px-1.5 py-0.5 text-[9px] font-medium tracking-wider uppercase bg-cyan-600 text-white rounded">
                      Same category
                    </span>
                  )}
                  {r.reasons.includes("similar_price") && (
                    <span className="px-1.5 py-0.5 text-[9px] font-medium tracking-wider uppercase bg-slate-900/85 text-white rounded">
                      Similar price
                    </span>
                  )}
                  {r.reasons.some((x) => typeof x === "string" && x.startsWith("co_viewed_")) && (
                    <span className="px-1.5 py-0.5 text-[9px] font-medium tracking-wider uppercase bg-amber-500 text-white rounded">
                      {r.reasons.find((x) => x.startsWith("co_viewed_"))?.replace("co_viewed_", "×")}{" "}
                      co-viewed
                    </span>
                  )}
                  {r.reasons.includes("popular_in_category") && (
                    <span className="px-1.5 py-0.5 text-[9px] font-medium tracking-wider uppercase bg-cyan-600 text-white rounded">
                      Popular
                    </span>
                  )}
                </div>
              </div>
              <div className="p-3">
                <p className="text-[12.5px] font-medium leading-snug line-clamp-2 min-h-[2.6em]">
                  {title}
                </p>
                <div className="mt-1.5 flex items-baseline justify-between">
                  <span className="price-tag text-[14px] font-semibold text-fg">
                    {fmtBdt(landed.unitBdt)}
                  </span>
                  <span className="text-[10.5px] text-fg-subtle font-mono tnum">
                    / pc
                  </span>
                </div>
                <p className="mt-1 text-[10.5px] text-fg-subtle truncate">
                  MOQ {r.factory_moq} · {r.supplier_city}
                </p>
              </div>
            </Link>
          );
        })}
      </div>
    </section>
  );
}
