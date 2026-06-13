"use client";
// /components/same-factory.tsx
//
// "Same factory" — other active products from the same supplier_name
// on the PDP. Helps the buyer add a wider range of goods from a
// trusted supplier in one consolidated shipment, which is the main
// economic win of B2B sourcing (shared freight).
//
// Loads on mount via /api/products/by-supplier. Renders a 4-up
// carousel. Falls back to a 2-up grid on mobile. Returns null
// if the supplier has no other active products.

import { useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { fmtBdt, FX_CNY_BDT } from "@/lib/pricing";
import { useLang } from "@/lib/i18n";

type Item = {
  source_id: string;
  title_en: string;
  title_bn: string;
  image: string;
  min_bdt: number;
  factory_moq: number;
};

export function SameFactory({
  supplierName,
  excludeSourceId,
}: {
  supplierName: string;
  excludeSourceId: string;
}) {
  const { lang } = useLang();
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const r = await fetch(
          `/api/products/by-supplier?name=${encodeURIComponent(supplierName)}&exclude=${encodeURIComponent(excludeSourceId)}&limit=8`,
          { cache: "no-store" },
        );
        if (!r.ok) return;
        const j = (await r.json()) as { items?: Item[] };
        if (!cancelled) setItems(j.items ?? []);
      } catch {
        /* ignore */
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [supplierName, excludeSourceId]);

  if (loading) return null;
  if (items.length === 0) return null;

  return (
    <section className="mt-10">
      <div className="mb-4 flex items-end justify-between gap-4">
        <div>
          <p className="text-[11px] text-fg-subtle uppercase tracking-wider font-medium">
            Save on shipping
          </p>
          <h2 className="mt-1 text-[18px] font-semibold tracking-tight">
            Same factory, more products
          </h2>
          <p className="mt-1 text-[12.5px] text-fg-muted max-w-lg">
            Add these to your order to consolidate shipment from{" "}
            <span className="font-medium text-fg">{supplierName}</span>.
            You'll split the freight with this one.
          </p>
        </div>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {items.map((it) => {
          const displayTitle = lang === "bn" ? it.title_bn : it.title_en;
          return (
            <Link
              key={it.source_id}
              href={`/products/${it.source_id}`}
              className="card group block overflow-hidden"
            >
              <div className="relative aspect-[4/3] bg-slate-50 overflow-hidden">
                {it.image && (
                  <Image
                    src={it.image}
                    alt={displayTitle}
                    fill
                    sizes="(max-width: 768px) 50vw, 25vw"
                    className="object-cover group-hover:scale-[1.02] transition-transform duration-300"
                  />
                )}
              </div>
              <div className="p-3">
                <p className="text-[12.5px] font-medium leading-snug line-clamp-2 min-h-[2.6em]">
                  {displayTitle}
                </p>
                <div className="mt-2 flex items-baseline gap-1.5">
                  <span className="price-tag text-[14px] font-semibold">
                    {fmtBdt(it.min_bdt)}
                  </span>
                  <span className="text-[10px] text-fg-subtle">
                    / pc · Dhaka
                  </span>
                </div>
                <p className="mt-0.5 text-[10.5px] text-fg-subtle font-mono tnum">
                  MOQ {it.factory_moq}
                </p>
              </div>
            </Link>
          );
        })}
      </div>
    </section>
  );
}
