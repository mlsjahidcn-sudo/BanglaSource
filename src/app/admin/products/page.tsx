import Link from "next/link";
import { getServiceRoleClient } from "@/lib/supabase/server";
import {
  DEFAULT_BUYER_MARKUP_PCT,
  FX_CNY_BDT,
  effectiveMarkupPct,
} from "@/lib/pricing";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type PriceTier = { qty_min: number; qty_max: number | null; price_cny_fen: number };

type ProductRow = {
  id: number;
  source_id: string;
  title_zh: string;
  title_en: string | null;
  category: string;
  factory_moq: number;
  supplier_name: string | null;
  supplier_city: string | null;
  active: boolean;
  images: string[] | null;
  markup_pct: number | null;
  price_tiers: PriceTier[];
};

async function loadProducts() {
  const supabase = getServiceRoleClient();
  const { data: products } = await supabase
    .from("products")
    .select(
      "id,source_id,title_zh,title_en,category,factory_moq,supplier_name,supplier_city,active,images,markup_pct,price_tiers(qty_min,qty_max,price_cny_fen)",
    )
    .order("id", { ascending: true });
  return (products ?? []) as ProductRow[];
}

function fmtMoq(moq: number) {
  if (moq <= 1) return "1 pc";
  return `${moq} pcs`;
}

function fmtFen(fen: number) {
  return `¥${(fen / 100).toFixed(2)}`;
}

/**
 * "Min factory" = the lowest CNY/pc across all tiers (typically
 * the highest-volume tier). We use that as the headline factory
 * price for the admin list — it's the floor of what the supplier
 * will charge, and the one admin will recognize from the 1688
 * listing.
 */
function factoryMinFen(p: ProductRow): number {
  if (!p.price_tiers?.length) return 0;
  return Math.min(...p.price_tiers.map((t) => t.price_cny_fen));
}

function factoryMinBdt(p: ProductRow): number {
  return Math.round((factoryMinFen(p) / 100) * FX_CNY_BDT);
}

/** Per-pc product price at the smallest qty (qty 1) for the admin. */
function afterMarkupBdt(p: ProductRow): number {
  const fen = p.price_tiers?.length
    ? // Smallest qty tier = highest factory price
      Math.max(...p.price_tiers.map((t) => t.price_cny_fen))
    : 0;
  const unitBdt = (fen / 100) * FX_CNY_BDT;
  const mul = 1 + effectiveMarkupPct(p as any) / 100;
  return Math.ceil(unitBdt * mul);
}

export default async function AdminProductsIndex() {
  const products = await loadProducts();
  const byCategory = new Map<string, ProductRow[]>();
  for (const p of products) {
    const arr = byCategory.get(p.category) ?? [];
    arr.push(p);
    byCategory.set(p.category, arr);
  }
  return (
    <div className="p-6 md:p-8 max-w-[1800px]">
      <div className="mb-8">
        <div className="flex items-end gap-3">
          <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 mb-3" />
          <p className="text-[12px] font-medium tracking-wider uppercase text-emerald-700">
            Catalog
          </p>
        </div>
        <h1 className="mt-3 text-[32px] md:text-[40px] leading-[1.05] font-semibold tracking-[-0.02em]">
          Products
        </h1>
        <p className="mt-3 text-[14px] text-fg-muted">
          {products.length} products across {byCategory.size} categories. The
          Factory and After-markup columns are the real FOB (¥) and the
          buyer-facing product price (৳); Markup % is editable per-product.
        </p>
      </div>

      <div className="space-y-8">
        {Array.from(byCategory.entries()).map(([cat, items]) => (
          <section key={cat}>
            <div className="flex items-end justify-between mb-3">
              <h2 className="text-[16px] font-semibold tracking-tight capitalize">
                {cat}
              </h2>
              <span className="text-[12px] text-fg-subtle font-mono tnum">
                {items.length} products
              </span>
            </div>
            <div className="card overflow-x-auto">
              <table className="w-full text-[13px] min-w-[1200px]">
                <thead className="text-[11px] uppercase tracking-wider text-fg-subtle border-b border-border">
                  <tr>
                    <th className="text-left font-medium px-4 py-3">Product</th>
                    <th className="text-left font-medium px-4 py-3">Source ID</th>
                    <th className="text-left font-medium px-4 py-3">Supplier</th>
                    <th className="text-right font-medium px-4 py-3">MOQ</th>
                    <th className="text-right font-medium px-4 py-3 whitespace-nowrap">
                      Factory FOB (¥)
                    </th>
                    <th className="text-right font-medium px-4 py-3">Markup</th>
                    <th className="text-right font-medium px-4 py-3 whitespace-nowrap">
                      After markup (৳)
                    </th>
                    <th className="text-right font-medium px-4 py-3">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((p) => {
                    const markup = effectiveMarkupPct(p as any);
                    const fobFen = factoryMinFen(p);
                    const fobBdt = factoryMinBdt(p);
                    const markedUp = afterMarkupBdt(p);
                    const marginBdt = markedUp - fobBdt;
                    return (
                      <tr
                        key={p.source_id}
                        className="border-b border-border last:border-b-0 hover:bg-bg-soft"
                      >
                        <td className="px-4 py-2.5 max-w-[280px]">
                          <Link
                            href={`/admin/products/${p.source_id}`}
                            className="flex items-center gap-2.5 hover:underline"
                          >
                            {p.images?.[0] ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img
                                src={p.images[0]}
                                alt=""
                                className="w-7 h-7 rounded object-cover border border-border shrink-0"
                              />
                            ) : (
                              <div className="w-7 h-7 rounded bg-bg-soft border border-border shrink-0" />
                            )}
                            <span className="truncate">
                              {p.title_en ?? p.title_zh}
                            </span>
                          </Link>
                        </td>
                        <td className="px-4 py-2.5 font-mono tnum text-[12px] text-fg-muted whitespace-nowrap">
                          {p.source_id}
                        </td>
                        <td className="px-4 py-2.5 text-[12px] text-fg-muted max-w-[180px]">
                          <div className="truncate">{p.supplier_name}</div>
                          {p.supplier_city ? (
                            <div className="text-fg-subtle truncate">
                              {p.supplier_city}
                            </div>
                          ) : null}
                        </td>
                        <td className="px-4 py-2.5 text-right font-mono tnum text-[12px] whitespace-nowrap">
                          {fmtMoq(p.factory_moq)}
                        </td>
                        <td className="px-4 py-2.5 text-right font-mono tnum text-[12px] whitespace-nowrap">
                          <span className="text-fg-muted">
                            {fmtFen(fobFen)}
                          </span>
                          <span className="block text-[10.5px] text-fg-subtle">
                            ≈ ৳{fobBdt.toLocaleString("en-IN")}
                          </span>
                        </td>
                        <td className="px-4 py-2.5 text-right font-mono tnum text-[12px]">
                          <span
                            className={
                              markup === 0
                                ? "text-fg-subtle"
                                : markup === DEFAULT_BUYER_MARKUP_PCT
                                  ? "text-emerald-700"
                                  : "text-cyan-700"
                            }
                          >
                            {markup}%
                          </span>
                          {markup !== DEFAULT_BUYER_MARKUP_PCT ? (
                            <span className="block text-[10.5px] text-cyan-700">
                              custom
                            </span>
                          ) : (
                            <span className="block text-[10.5px] text-fg-subtle">
                              default
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-2.5 text-right font-mono tnum text-[12px] whitespace-nowrap">
                          <span className="text-fg font-semibold">
                            ৳{markedUp.toLocaleString("en-IN")}
                          </span>
                          <span className="block text-[10.5px] text-emerald-700">
                            +৳{marginBdt.toLocaleString("en-IN")} margin
                          </span>
                        </td>
                        <td className="px-4 py-2.5 text-right text-[12px] whitespace-nowrap">
                          {p.active ? (
                            <span className="inline-flex items-center gap-1.5 text-emerald-700">
                              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                              active
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1.5 text-rose-600">
                              <span className="w-1.5 h-1.5 rounded-full bg-rose-500" />
                              inactive
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}
