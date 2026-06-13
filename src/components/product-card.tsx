"use client";
import Link from "next/link";
import Image from "next/image";
import { useLang } from "@/lib/i18n";
import { Badge } from "@/components/ui/badge";
import { SaveButton } from "@/components/save-button";
import { fmtBdt, fmtCny, FX_CNY_BDT } from "@/lib/pricing";
import type { Product } from "@/lib/pricing";

export function ProductCard({
  product,
  compact = false,
}: {
  product: Product;
  compact?: boolean;
}) {
  const { lang } = useLang();
  const title = lang === "bn" ? product.title_bn : product.title_en;
  const lowestPrice = product.price_tiers[product.price_tiers.length - 1].price_cny_fen;
  const highestPrice = product.price_tiers[0].price_cny_fen;
  return (
    <Link
      href={`/products/${product.source_id}`}
      className="card group block overflow-hidden"
    >
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
        {/* Social proof: orders count (bottom-left) */}
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
      <div className="p-4">
        <div className="flex items-start justify-between gap-3">
          <h3 className="text-[14px] font-medium leading-snug line-clamp-2 min-h-[2.6em]">
            {title}
          </h3>
        </div>

        {!compact && (
          <p className="mt-1.5 text-[11.5px] text-fg-subtle line-clamp-1 flex items-center gap-1">
            <span className="inline-block w-1 h-1 rounded-full bg-emerald-500" />
            {product.supplier_city}, {product.supplier_province}
            {product.rating_overall > 0 && (
              <span className="ml-auto font-mono tnum">
                ★ {product.rating_overall.toFixed(1)}
              </span>
            )}
          </p>
        )}

        <div className="mt-4 flex items-end justify-between">
          <div>
            <div className="flex items-baseline gap-1.5">
              <span className="price-tag text-[15px] font-semibold text-fg">
                {fmtBdt(Math.ceil((lowestPrice / 100) * FX_CNY_BDT))}
              </span>
              <span className="text-[11px] text-fg-subtle">/ pc · Dhaka</span>
            </div>
            <p className="text-[11px] text-fg-subtle mt-0.5 font-mono tnum">
              factory {fmtCny(highestPrice)} → {fmtCny(lowestPrice)}
            </p>
          </div>
          <div className="text-right">
            <p className="text-[10px] text-fg-subtle uppercase tracking-wider">
              MOQ
            </p>
            <p className="text-[13px] font-mono tnum text-fg-muted">
              {product.factory_moq}
            </p>
          </div>
        </div>
      </div>
    </Link>
  );
}
