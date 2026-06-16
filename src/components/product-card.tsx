"use client";
import Link from "next/link";
import Image from "next/image";
import { useLang } from "@/lib/i18n";
import { Badge } from "@/components/ui/badge";
import { SaveButton } from "@/components/save-button";
import { fmtBdt, fmtCny, unitProductBdt } from "@/lib/pricing";
import type { Product } from "@/lib/pricing";

/**
 * ProductCard — the canonical B2B catalog card.
 *
 * Layout (top to bottom):
 *   1. Image (4:3) with verified badge top-left, save icon top-right,
 *      social-proof sold count bottom-left.
 *   2. Title (2 lines, h3, 14px semibold).
 *   3. Supplier meta: city/province (emerald dot) + star rating
 *      pushed to the right.
 *   4. Price block: large BDT unit price (the lowest tier) + small
 *      "factory ৳X → ৳Y" range + MOQ column on the right.
 *
 * The BDT price is the "from" (lowest tier) price. The factory CNY
 * range is shown as a single line so the buyer can see the factory
 * cost upfront without making the card noisy.
 */
export function ProductCard({
  product,
  compact = false,
}: {
  product: Product;
  compact?: boolean;
}) {
  const { lang } = useLang();
  const title = lang === "bn" ? product.title_bn : product.title_en;
  // Per-piece buyer price for the lowest (bulk) tier. Same as
  // `unitProductBdt(product, 9999)` — the numeric arg forces the
  // "use the last tier" path. We keep both for clarity.
  const lowestPriceCnyFen =
    product.price_tiers[product.price_tiers.length - 1].price_cny_fen;
  const productPriceBdt = unitProductBdt(product, 9999);
  // Factory reference (CNY) for transparency. The card shows the
  // highest→lowest factory range so the buyer sees the volume
  // discount they'll get by moving up the tier table.
  const highestPriceCny = product.price_tiers[0].price_cny_fen;
  const lowestPriceCny = lowestPriceCnyFen;
  const lowestTierMinQty =
    product.price_tiers[product.price_tiers.length - 1].qty_min;
  const supplier = [product.supplier_city, product.supplier_province]
    .filter(Boolean)
    .join(", ");

  return (
    <Link
      href={`/products/${product.source_id}`}
      className="card group block overflow-hidden"
    >
      {/* Image */}
      <div className="relative aspect-[4/3] bg-slate-50 overflow-hidden">
        <Image
          src={product.images[0]}
          alt={title}
          fill
          sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
          className="object-cover group-hover:scale-[1.02] transition-transform duration-300"
        />
        {product.quality_score && product.quality_score >= 8 && (
          <div className="absolute top-3 left-3">
            <Badge tone="accent">★ Verified</Badge>
          </div>
        )}
        {product.order_count_30d > 0 && (
          <div className="absolute bottom-3 left-3">
            <span className="px-2 py-0.5 rounded bg-bg/90 backdrop-blur-sm border border-border text-[10px] font-medium text-fg-muted">
              {product.order_count_30d > 999
                ? `${Math.floor(product.order_count_30d / 100) / 10}k sold`
                : `${product.order_count_30d} sold`}
            </span>
          </div>
        )}
        <div className="absolute top-3 right-3">
          <SaveButton sourceId={product.source_id} variant="icon" />
        </div>
      </div>

      {/* Body */}
      <div className="p-4">
        <h3 className="text-[14px] font-medium leading-snug line-clamp-2 min-h-[2.6em]">
          {title}
        </h3>

        {!compact && supplier && (
          <p className="mt-1.5 text-[11.5px] text-fg-subtle line-clamp-1 flex items-center gap-1.5">
            <span className="inline-block w-1 h-1 rounded-full bg-emerald-500 shrink-0" />
            <span className="truncate">{supplier}</span>
            {product.rating_overall > 0 && (
              <span className="ml-auto font-mono tnum shrink-0">
                ★ {product.rating_overall.toFixed(1)}
              </span>
            )}
          </p>
        )}

        {/* Price row: BDT unit price (left) + MOQ column (right) */}
        <div className="mt-4 pt-3 border-t border-border-fine flex items-end justify-between">
          <div className="min-w-0">
            <p className="flex items-baseline gap-1">
              <span className="text-[10px] text-fg-subtle uppercase tracking-wider font-medium">
                From
              </span>
              <span className="price-tag text-[15px] font-semibold text-fg">
                {fmtBdt(productPriceBdt)}
              </span>
              <span className="text-[11px] text-fg-subtle">/ pc</span>
            </p>
            <p className="text-[10.5px] text-fg-subtle mt-0.5 font-mono tnum">
              factory {fmtCny(highestPriceCny)} → {fmtCny(lowestPriceCny)}
            </p>
          </div>
          <div className="text-right shrink-0 ml-3">
            <p className="text-[10px] text-fg-subtle uppercase tracking-wider font-medium">
              MOQ
            </p>
            <p className="text-[13px] font-mono tnum text-fg-muted">
              {product.factory_moq}
              {product.factory_moq > 1 ? " pcs" : " pc"}
            </p>
          </div>
        </div>
      </div>
    </Link>
  );
}
