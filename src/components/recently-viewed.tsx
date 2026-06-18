"use client";
// /components/recently-viewed.tsx
//
// Shows the last 8 products the user has viewed (across all sessions,
// keyed by user.id when signed in, or by a local-storage token when
// anon). Reads from /api/recently-viewed. Shown on the home page
// for signed-in users only; for anon we just hide it.
//
// The endpoint stores page_views with user_id; on the client we
// re-fetch on mount and every 60s.

import { useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { useLang } from "@/lib/i18n";
import { fmtBdt, FX_CNY_BDT } from "@/lib/pricing";
import { SaveButton } from "@/components/save-button";

type Hit = {
  source_id: string;
  title_en: string;
  title_bn: string;
  image: string;
  category: string;
  min_bdt: number;
  factory_moq: number;
  viewed_at: string;
};

export function RecentlyViewed({ limit = 8 }: { limit?: number }) {
  const { lang } = useLang();
  const [items, setItems] = useState<Hit[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const r = await fetch(`/api/recently-viewed?limit=${limit}`, {
          cache: "no-store",
        });
        if (!r.ok) {
          if (!cancelled) setItems([]);
          return;
        }
        const j = (await r.json()) as { ok: boolean; items?: Hit[] };
        if (!cancelled) setItems(j.items ?? []);
      } catch {
        if (!cancelled) setItems([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [limit]);

  if (loading) return null;
  if (items.length === 0) return null;

  return (
    <section>
      <div className="mb-6 flex items-end justify-between gap-4 pb-4 border-b border-border">
        <div className="min-w-0">
          <p className="section-eyebrow">Pick up where you left off</p>
          <h2 className="section-title">Recently viewed</h2>
        </div>
        <Link
          href="/categories"
          className="text-[13px] font-medium text-cyan-700 hover:text-cyan-800 shrink-0"
        >
          See all →
        </Link>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {items.map((h) => {
          const displayTitle = lang === "bn" ? h.title_bn : h.title_en;
          return (
            <Link
              key={h.source_id + h.viewed_at}
              href={`/products/${h.source_id}`}
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
                <div className="absolute top-2 right-2">
                  <SaveButton sourceId={h.source_id} variant="icon" />
                </div>
              </div>
              <div className="p-3">
                <p className="text-[12.5px] font-medium line-clamp-2 min-h-[2.6em]">
                  {displayTitle}
                </p>
                <div className="mt-2 flex items-baseline gap-1.5">
                  <span className="price-tag text-[15px] font-semibold">
                    {fmtBdt(h.min_bdt)}
                  </span>
                  <span className="text-[10.5px] text-fg-subtle">
                    / pc · landed
                  </span>
                </div>
                <p className="mt-0.5 text-[10.5px] text-fg-subtle">
                  viewed {formatAgo(h.viewed_at)}
                </p>
              </div>
            </Link>
          );
        })}
      </div>
    </section>
  );
}

function formatAgo(iso: string): string {
  const d = new Date(iso);
  const now = Date.now();
  const diff = Math.floor((now - d.getTime()) / 1000);
  if (diff < 60) return "just now";
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  if (diff < 604800) return `${Math.floor(diff / 86400)}d ago`;
  return d.toLocaleDateString();
}
