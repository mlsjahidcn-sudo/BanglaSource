"use client";
// /components/for-you.tsx
//
// "For You" personalized recommendations grid. Fetches
// /api/ai/for-you on mount. Shows reason chips on each card.
// Falls back gracefully if the user is anonymous or the feed
// is empty (we just hide the section).
//
// Layout: 4-up grid on desktop, 2-up on mobile, matching the
// rest of the catalog.

import { useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { useLang } from "@/lib/i18n";
import { fmtBdt, FX_CNY_BDT } from "@/lib/pricing";
import { SaveButton } from "@/components/save-button";

type Hit = {
  id: string;
  title_en: string;
  title_bn: string;
  image: string;
  price_cny_fen: number;
  category: string;
  factory_moq: number;
  rating_overall: number;
  order_count_30d: number;
  score?: number;
  reasons?: string[];
};

type Props = {
  limit?: number;
  title?: string;
  eyebrow?: string;
  className?: string;
};

export function ForYou({ limit = 12, title = "For you", eyebrow, className = "" }: Props) {
  const { lang } = useLang();
  const [items, setItems] = useState<Hit[]>([]);
  const [loading, setLoading] = useState(true);
  const [empty, setEmpty] = useState(false);
  const [personalized, setPersonalized] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const r = await fetch(`/api/ai/for-you?limit=${limit}`, {
          cache: "no-store",
        });
        if (!r.ok) {
          if (!cancelled) setEmpty(true);
          return;
        }
        const j = (await r.json()) as {
          ok: boolean;
          personalized?: boolean;
          empty_personalized?: boolean;
          items?: Hit[];
        };
        if (cancelled) return;
        setPersonalized(j.personalized ?? false);
        setItems(j.items ?? []);
        if ((j.items ?? []).length === 0) setEmpty(true);
      } catch {
        if (!cancelled) setEmpty(true);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [limit]);

  if (loading) {
    return (
      <section className={className}>
        <div className="mb-6 pb-4 border-b border-border">
          <p className="section-eyebrow">
            {eyebrow ?? (personalized ? "Personalized" : "Popular this week")}
          </p>
          <h2 className="section-title">{title}</h2>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="card overflow-hidden">
              <div className="aspect-[4/3] bg-slate-100 animate-pulse" />
              <div className="p-3 space-y-2">
                <div className="heading-3 bg-slate-100 rounded animate-pulse w-3/4" />
                <div className="heading-3 bg-slate-100 rounded animate-pulse w-1/2" />
              </div>
            </div>
          ))}
        </div>
      </section>
    );
  }

  if (empty || items.length === 0) return null;

  return (
    <section className={className}>
      <div className="mb-6 pb-4 border-b border-border flex items-end justify-between gap-4">
        <div className="min-w-0">
          <p className="section-eyebrow flex items-center gap-1.5">
            {eyebrow ?? (personalized ? "Personalized" : "Popular this week")}
            {personalized && (
              <span className="px-1.5 py-0.5 rounded bg-cyan-50 text-cyan-800 text-[9.5px] font-mono tnum">
                AI
              </span>
            )}
          </p>
          <h2 className="section-title">{title}</h2>
        </div>
        <Link
          href="/categories"
          className="text-[12.5px] text-cyan-600 hover:underline shrink-0"
        >
          See all →
        </Link>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {items.map((h) => {
          const displayTitle = lang === "bn" ? h.title_bn : h.title_en;
          const bdt = Math.ceil((h.price_cny_fen / 100) * FX_CNY_BDT);
          return (
            <Link
              key={h.id}
              href={`/products/${h.id}`}
              className="card group block overflow-hidden"
            >
              <div className="relative aspect-[4/3] bg-slate-50 overflow-hidden">
                {h.image && (
                  <Image
                    src={h.image}
                    alt={displayTitle}
                    fill
                    sizes="(max-width: 768px) 50vw, 25vw"
                    className="object-cover group-hover:scale-[1.02] transition-transform duration-300"
                  />
                )}
                {/* Reason chip overlay (top-left) */}
                {h.reasons && h.reasons.length > 0 && (
                  <div className="absolute top-2 left-2 max-w-[80%]">
                    <span className="inline-block px-2 py-0.5 rounded bg-cyan-600 text-white text-[9.5px] font-medium uppercase tracking-wider">
                      {h.reasons[0]}
                    </span>
                  </div>
                )}
                {/* Save button (top-right) */}
                <div className="absolute top-2 right-2">
                  <SaveButton sourceId={h.id} variant="icon" />
                </div>
                {/* Order count badge bottom-right (social proof) */}
                {h.order_count_30d > 0 && (
                  <div className="absolute bottom-2 right-2">
                    <span className="px-1.5 py-0.5 rounded bg-bg/90 backdrop-blur-sm border border-border text-[9.5px] font-medium text-fg-muted">
                      {h.order_count_30d > 999
                        ? `${Math.floor(h.order_count_30d / 100) / 10}k sold`
                        : `${h.order_count_30d} sold`}
                    </span>
                  </div>
                )}
              </div>
              <div className="p-3">
                <p className="text-[12.5px] font-medium line-clamp-2 min-h-[2.6em]">
                  {displayTitle}
                </p>
                <div className="mt-2 flex items-baseline gap-1.5">
                  <span className="price-tag text-[15px] font-semibold">
                    {fmtBdt(bdt)}
                  </span>
                  <span className="text-[10.5px] text-fg-subtle">/ pc · landed</span>
                </div>
                <p className="mt-1 text-[10.5px] text-fg-subtle font-mono tnum">
                  MOQ {h.factory_moq}
                </p>
              </div>
            </Link>
          );
        })}
      </div>
    </section>
  );
}
