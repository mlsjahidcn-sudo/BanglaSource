"use client";
// /app/buyer/saved/_client.tsx
//
// Watchlist grid. Server-renders the initial list, client-side
// allows removing items (DELETE /api/watchlist). On remove we
// optimistically drop the row; on failure we restore it.

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useLang } from "@/lib/i18n";
import { fmtBdt } from "@/lib/pricing";

type Item = {
  id: number;
  product_id: number;
  saved_at: string;
  source_id: string;
  title_en: string;
  title_bn: string;
  image: string;
  category: string;
  factory_moq: number;
  min_bdt: number;
};

export function WatchlistGrid({ items: initial }: { items: Item[] }) {
  const { lang } = useLang();
  const router = useRouter();
  const [items, setItems] = useState<Item[]>(initial);
  const [removing, setRemoving] = useState<number | null>(null);

  async function remove(sourceId: string) {
    setRemoving(sourceId);
    // Optimistic: drop it from the list right away
    const next = items.filter((i) => i.source_id !== sourceId);
    setItems(next);
    try {
      const r = await fetch(
        `/api/watchlist?source_id=${encodeURIComponent(sourceId)}`,
        { method: "DELETE" },
      );
      if (!r.ok) {
        // Restore on failure
        setItems(items);
      } else {
        // Refresh server data so the badge counts update
        router.refresh();
      }
    } catch {
      setItems(items);
    } finally {
      setRemoving(null);
    }
  }

  if (items.length === 0) {
    return (
      <div className="card p-12 text-center">
        <p className="text-[14px] text-fg-muted">All cleared.</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
      {items.map((i) => {
        const title = lang === "bn" ? i.title_bn : i.title_en;
        return (
          <div
            key={i.source_id}
            className="card group overflow-hidden flex flex-col"
          >
            <Link
              href={`/products/${i.source_id}`}
              className="relative aspect-[4/3] bg-slate-50 overflow-hidden block"
            >
              {i.image && (
                <Image
                  src={i.image}
                  alt={title}
                  fill
                  sizes="(max-width: 768px) 50vw, 25vw"
                  className="object-cover group-hover:scale-[1.02] transition-transform duration-300"
                />
              )}
              <div className="absolute top-2 left-2 px-1.5 py-0.5 rounded bg-bg/90 text-[9.5px] text-fg-subtle uppercase tracking-wider font-medium">
                {i.category}
              </div>
            </Link>
            <div className="p-3 flex-1 flex flex-col">
              <Link
                href={`/products/${i.source_id}`}
                className="text-[13px] font-medium leading-snug line-clamp-2 min-h-[2.6em] hover:underline"
              >
                {title}
              </Link>
              <p className="mt-1.5 price-tag text-[15px] font-semibold">
                {fmtBdt(i.min_bdt)}
                <span className="text-[10.5px] text-fg-subtle ml-1 font-normal">
                  / pc
                </span>
              </p>
              <p className="mt-0.5 text-[10.5px] text-fg-subtle font-mono tnum">
                MOQ {i.factory_moq} · saved {formatAgo(i.saved_at)}
              </p>
              <div className="mt-2.5 flex items-center gap-2">
                <Link
                  href={`/products/${i.source_id}`}
                  className="flex-1 h-8 inline-flex items-center justify-center text-[11.5px] font-medium rounded-md bg-emerald-600 text-white hover:bg-emerald-700"
                >
                  View
                </Link>
                <button
                  type="button"
                  onClick={() => remove(i.source_id)}
                  disabled={removing === i.source_id}
                  className="h-8 px-2.5 inline-flex items-center justify-center text-[11.5px] font-medium rounded-md border border-border text-fg-muted hover:text-rose-600 hover:border-rose-200 hover:bg-rose-50 disabled:opacity-50"
                  aria-label="Remove from watchlist"
                >
                  {removing === i.source_id ? "…" : "✕"}
                </button>
              </div>
            </div>
          </div>
        );
      })}
    </div>
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
