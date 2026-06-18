"use client";
// /app/buyer/saved/_client.tsx
//
// Watchlist grid with:
//   - 4 sort tabs: Newest, Price ↑, MOQ ↓, Rating
//   - Bulk select + "Add all to order list"
//   - Per-row price-change chip (▲/▼ vs the price when first saved)
//   - Per-row social proof
//   - Per-row "Save-the-look" cross-sell (when present)
//
// The price-change chip is computed client-side using a tiny
// in-memory price-snapshot table we receive on the page. The
// server reads the products table at request time and joins the
// current `min_bdt` to the saved item; the `last_price_bdt` is
// what the user first saw. We don't have a price_history_at_saved
// table yet — Phase 9. For now we fall back to a soft hint.

import { useMemo, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useLang } from "@/lib/i18n";
import { fmtBdt } from "@/lib/pricing";

export type SavedItem = {
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
  rating_overall: number;
  order_count_30d: number;
  // price when first saved (best-effort estimate from
  // the latest price_history BEFORE the saved_at timestamp;
  // null if we don't have data)
  saved_price_bdt?: number | null;
};

type SortKey = "newest" | "price_asc" | "moq_asc" | "rating_desc";

const SORT_LABELS: Record<SortKey, string> = {
  newest: "Newest",
  price_asc: "Price ↑",
  moq_asc: "MOQ ↓",
  rating_desc: "Rating",
};

export function WatchlistGrid({ items: initial }: { items: SavedItem[] }) {
  const { lang } = useLang();
  const router = useRouter();
  const [items, setItems] = useState<SavedItem[]>(initial);
  const [removing, setRemoving] = useState<string | null>(null);
  const [sort, setSort] = useState<SortKey>("newest");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkLoading, setBulkLoading] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  const sorted = useMemo(() => {
    const arr = [...items];
    arr.sort((a, b) => {
      if (sort === "newest") {
        return new Date(b.saved_at).getTime() - new Date(a.saved_at).getTime();
      }
      if (sort === "price_asc") return a.min_bdt - b.min_bdt;
      if (sort === "moq_asc") return a.factory_moq - b.factory_moq;
      if (sort === "rating_desc") return b.rating_overall - a.rating_overall;
      return 0;
    });
    return arr;
  }, [items, sort]);

  const allSelected =
    items.length > 0 && items.every((i) => selected.has(i.source_id));

  function toggle(sourceId: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(sourceId)) next.delete(sourceId);
      else next.add(sourceId);
      return next;
    });
  }

  function toggleAll() {
    if (allSelected) {
      setSelected(new Set());
    } else {
      setSelected(new Set(items.map((i) => i.source_id)));
    }
  }

  async function remove(sourceId: string) {
    setRemoving(sourceId);
    const prevItems = items;
    setItems((cur) => cur.filter((i) => i.source_id !== sourceId));
    try {
      const r = await fetch(
        `/api/watchlist?source_id=${encodeURIComponent(sourceId)}`,
        { method: "DELETE" },
      );
      if (!r.ok) setItems(prevItems);
      else router.refresh();
    } catch {
      setItems(prevItems);
    } finally {
      setRemoving(null);
    }
  }

  async function addToOrderList() {
    const ids = Array.from(selected);
    if (ids.length === 0) return;
    setBulkLoading(true);
    let ok = 0;
    for (const id of ids) {
      const item = items.find((i) => i.source_id === id);
      if (!item) continue;
      try {
        const r = await fetch("/api/cart", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            source_id: id,
            qty: Math.max(item.factory_moq, 1),
          }),
        });
        if (r.ok) ok += 1;
      } catch {
        /* skip */
      }
    }
    setBulkLoading(false);
    setSelected(new Set());
    setToast(`${ok} item${ok === 1 ? "" : "s"} added to order list`);
    setTimeout(() => setToast(null), 2500);
  }

  if (items.length === 0) return null;

  return (
    <div>
      {/* Sort tabs + bulk action bar */}
      <div className="mb-4 flex flex-wrap items-center gap-2 justify-between">
        <div className="flex items-center gap-1 bg-bg-soft border border-border rounded-md p-0.5">
          {(Object.keys(SORT_LABELS) as SortKey[]).map((k) => (
            <button
              key={k}
              onClick={() => setSort(k)}
              className={`h-7 px-2.5 rounded text-[12px] font-medium ${
                sort === k
                  ? "bg-bg text-fg shadow-sm"
                  : "text-fg-muted hover:text-fg"
              }`}
            >
              {SORT_LABELS[k]}
            </button>
          ))}
        </div>
        {selected.size > 0 && (
          <button
            onClick={addToOrderList}
            disabled={bulkLoading}
            className="h-8 inline-flex items-center gap-1.5 px-3 rounded-md bg-cyan-600 text-white text-[12px] font-medium hover:bg-cyan-700 disabled:opacity-50"
          >
            {bulkLoading ? "Adding…" : `+ Add ${selected.size} to order list`}
          </button>
        )}
      </div>

      {/* Bulk-select header */}
      <div className="mb-2 flex items-center gap-2 text-[11.5px] text-fg-subtle">
        <input
          type="checkbox"
          checked={allSelected}
          onChange={toggleAll}
          className="w-3.5 h-3.5 rounded border-border text-cyan-700"
          aria-label="Select all"
        />
        <span>{selected.size} of {items.length} selected</span>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
        {sorted.map((i) => {
          const title = lang === "bn" ? i.title_bn : i.title_en;
          const isSelected = selected.has(i.source_id);
          // Price-change chip (best-effort)
          const savedPrice = i.saved_price_bdt ?? null;
          const changePct =
            savedPrice && savedPrice > 0
              ? ((i.min_bdt - savedPrice) / savedPrice) * 100
              : null;
          return (
            <div
              key={i.source_id}
              className={`card group overflow-hidden flex flex-col relative ${
                isSelected ? "ring-2 ring-cyan-500" : ""
              }`}
            >
              {/* Selection checkbox top-left */}
              <button
                onClick={() => toggle(i.source_id)}
                className="absolute top-2 left-2 z-10 w-6 h-6 rounded-md bg-bg/95 backdrop-blur border border-border flex items-center justify-center hover:bg-bg"
                aria-label={isSelected ? "Unselect" : "Select"}
              >
                {isSelected && (
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" className="text-cyan-600">
                    <path d="M5 12l5 5 9-9" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                )}
              </button>

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
                {/* Price-change chip */}
                {changePct !== null && Math.abs(changePct) >= 5 && (
                  <div className="absolute bottom-2 left-2">
                    <span
                      className={`px-1.5 py-0.5 rounded text-[9.5px] font-semibold ${
                        changePct < 0
                          ? "bg-cyan-600 text-white"
                          : "bg-rose-600 text-white"
                      }`}
                    >
                      {changePct < 0 ? "▼" : "▲"}{" "}
                      {Math.abs(Math.round(changePct))}%
                    </span>
                  </div>
                )}
                {/* Sold count */}
                {i.order_count_30d > 0 && (
                  <div className="absolute bottom-2 right-2">
                    <span className="px-1.5 py-0.5 rounded bg-bg/90 backdrop-blur-sm border border-border text-[9.5px] font-medium text-fg-muted">
                      {i.order_count_30d > 999
                        ? `${Math.floor(i.order_count_30d / 100) / 10}k sold`
                        : `${i.order_count_30d} sold`}
                    </span>
                  </div>
                )}
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
                    / pc · landed
                  </span>
                </p>
                <p className="mt-0.5 text-[10.5px] text-fg-subtle font-mono tnum">
                  MOQ {i.factory_moq}
                  {i.rating_overall > 0 && (
                    <span className="ml-2">★ {i.rating_overall.toFixed(1)}</span>
                  )}
                  <span className="ml-2">saved {formatAgo(i.saved_at)}</span>
                </p>
                <div className="mt-2.5 flex items-center gap-2">
                  <Link
                    href={`/products/${i.source_id}`}
                    className="flex-1 h-8 inline-flex items-center justify-center text-[11.5px] font-medium rounded-md bg-cyan-600 text-white hover:bg-cyan-700"
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

      {/* Toast */}
      {toast && (
        <div className="fixed bottom-6 right-6 z-50 px-4 py-2.5 rounded-lg bg-cyan-600 text-white text-[13px] font-medium shadow-lg">
          {toast}
        </div>
      )}
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
