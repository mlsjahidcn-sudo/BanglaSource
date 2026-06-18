"use client";
// /components/same-factory.tsx
//
// "Same factory" — other active products from the same supplier
// on the PDP. Helps the buyer add a wider range of goods from a
// trusted supplier in one consolidated shipment, which is the main
// economic win of B2B sourcing (shared freight).
//
// CLIENT component that takes items as a prop. The PDP page
// fetches the items server-side using the service-role client and
// passes them in. We never expose the supplier name on the public
// site, and the by-supplier lookup API has been retired.
//
// The component only displays titles + prices + MOQ + a generic
// "same factory" framing. The factory identity stays in the DB
// and admin.

import Link from "next/link";
import Image from "next/image";
import { fmtBdt } from "@/lib/pricing";
import { useLang } from "@/lib/i18n";
import { Container } from "@/components/ui/container";

export type SameFactoryItem = {
  source_id: string;
  title_en: string;
  title_bn: string;
  image: string;
  min_bdt: number;
  factory_moq: number;
};

export function SameFactory({ items }: { items: SameFactoryItem[] }) {
  const { lang } = useLang();
  if (items.length === 0) return null;

  return (
    <Container className="mt-10">
      <div className="mb-4 flex items-end justify-between gap-4">
        <div>
          <p className="text-[11px] text-fg-subtle uppercase tracking-wider font-medium">
            Save on shipping
          </p>
          <h2 className="mt-1 text-[18px] font-semibold tracking-tight">
            Same factory, more products
          </h2>
          <p className="mt-1 text-[12.5px] text-fg-muted max-w-lg">
            Add these to your order to consolidate shipment from one factory.
            You'll split the freight with one pickup.
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
    </Container>
  );
}
