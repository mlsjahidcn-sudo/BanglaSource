import Link from "next/link";
import { getServiceRoleClient } from "@/lib/supabase/server";
import { BulkActionsBar } from "./_bulk-bar";
import {
  DEFAULT_BUYER_MARKUP_PCT,
  FX_CNY_BDT,
  effectiveMarkupPct,
} from "@/lib/pricing";
import { AdminPage, AdminPageHeader } from "@/components/admin-page";

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

const KNOWN_CATEGORIES = [
  "gadgets",
  "eyewear",
  "shoes",
  "bags",
  "watches",
  "beauty",
] as const;
type CategoryFilter = (typeof KNOWN_CATEGORIES)[number] | "all";
type StatusFilter = "all" | "active" | "inactive";

/**
 * Phase 33: filters added. 167 rows was unusable. URL-driven
 * (server-rendered, no client JS):
 *   ?q=<text>        — matches title_en, source_id, supplier_name
 *   ?status=active|inactive|all
 *   ?cat=<category>  — single category or "all"
 *
 * All filters are server-side. The "clear filters" link appears
 * whenever any filter is active.
 */
async function loadProducts(
  q: string,
  status: StatusFilter,
  cat: CategoryFilter,
): Promise<{
  rows: ProductRow[];
  totalAll: number;
  totalActive: number;
  allActiveSourceIds: string[];
  allInactiveSourceIds: string[];
}> {
  const supabase = getServiceRoleClient();
  const [rowsRes, totalAllRes, totalActiveRes] = await Promise.all([
    supabase
      .from("products")
      .select(
        "id,source_id,title_zh,title_en,category,factory_moq,supplier_name,supplier_city,active,images,markup_pct,price_tiers(qty_min,qty_max,price_cny_fen)",
      )
      .order("id", { ascending: true })
      .limit(500),
    supabase
      .from("products")
      .select("id", { count: "exact", head: true }),
    supabase
      .from("products")
      .select("id", { count: "exact", head: true })
      .eq("active", true),
  ]);
  const allRows = (rowsRes.data ?? []) as unknown as ProductRow[];
  // JS-side filter: the dataset is 167 rows, so an in-memory filter
  // is trivially fast (sub-ms) and lets us OR across text columns
  // without relying on Supabase's `or()` syntax quirks.
  const ql = q.trim().toLowerCase();
  const filtered = allRows.filter((p) => {
    if (status === "active" && !p.active) return false;
    if (status === "inactive" && p.active) return false;
    if (cat !== "all" && p.category !== cat) return false;
    if (ql) {
      const hay = [
        p.title_en ?? "",
        p.title_zh,
        p.source_id,
        p.supplier_name ?? "",
        p.supplier_city ?? "",
      ]
        .join(" ")
        .toLowerCase();
      if (!hay.includes(ql)) return false;
    }
    return true;
  });
  return {
    rows: filtered,
    totalAll: totalAllRes.count ?? 0,
    totalActive: totalActiveRes.count ?? 0,
    // For the bulk-action bar: source_ids in the active/inactive
    // buckets across the WHOLE catalog (not just the current
    // filter). Admin uses this to mass-deactivate an inactive
    // batch or mass-activate a fresh batch.
    allActiveSourceIds: allRows.filter((p) => p.active).map((p) => p.source_id),
    allInactiveSourceIds: allRows.filter((p) => !p.active).map((p) => p.source_id),
  };
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
 * will charge, and the one admin will recognize from the source
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

export default async function AdminProductsIndex({
  searchParams,
}: {
  searchParams: Promise<{
    q?: string;
    status?: string;
    cat?: string;
  }>;
}) {
  const sp = await searchParams;
  const q = (sp.q ?? "").toString();
  const status: StatusFilter = (
    ["active", "inactive", "all"].includes(sp.status ?? "")
      ? (sp.status as StatusFilter)
      : "all"
  );
  const cat: CategoryFilter = (
    [...KNOWN_CATEGORIES, "all"].includes(sp.cat ?? "")
      ? (sp.cat as CategoryFilter)
      : "all"
  );

  const {
    rows: products,
    totalAll,
    totalActive,
    allActiveSourceIds,
    allInactiveSourceIds,
  } = await loadProducts(q, status, cat);

  const byCategory = new Map<string, ProductRow[]>();
  for (const p of products) {
    const arr = byCategory.get(p.category) ?? [];
    arr.push(p);
    byCategory.set(p.category, arr);
  }

  const hasFilters = q !== "" || status !== "all" || cat !== "all";

  return (
    <AdminPage size="wide">
      <AdminPageHeader
        eyebrow="Catalog"
        title="Products"
        dotColor="emerald"
        subtitle={
          <>
            {totalActive} active of {totalAll} total
            {hasFilters ? (
              <>
                {" "}
                · showing <span className="text-fg font-medium">{products.length}</span>{" "}
                after filters
              </>
            ) : null}
            . Factory FOB is the supplier-listed ¥/pc; the After-markup
            column is the buyer-facing product price (৳); Markup % is
            editable per-product.
          </>
        }
      />

      {/* Filter bar (Phase 33) — URL-driven, server-rendered. */}
      <form
        action="/admin/products"
        method="GET"
        className="mt-6 card p-3 flex flex-wrap items-end gap-3"
      >
        <div className="flex-1 min-w-[220px]">
          <label className="block text-[10.5px] uppercase tracking-wider font-medium text-fg-subtle mb-1">
            Search
          </label>
          <input
            type="text"
            name="q"
            defaultValue={q}
            placeholder="title, source_id, supplier, city…"
            className="w-full h-9 px-3 text-[13px] rounded-md border border-border bg-bg focus:border-border-strong outline-none"
          />
        </div>
        <div>
          <label className="block text-[10.5px] uppercase tracking-wider font-medium text-fg-subtle mb-1">
            Status
          </label>
          <select
            name="status"
            defaultValue={status}
            className="h-9 px-2 text-[13px] rounded-md border border-border bg-bg"
          >
            <option value="all">All ({totalAll})</option>
            <option value="active">Active ({totalActive})</option>
            <option value="inactive">
              Inactive ({Math.max(0, totalAll - totalActive)})
            </option>
          </select>
        </div>
        <div>
          <label className="block text-[10.5px] uppercase tracking-wider font-medium text-fg-subtle mb-1">
            Category
          </label>
          <select
            name="cat"
            defaultValue={cat}
            className="h-9 px-2 text-[13px] rounded-md border border-border bg-bg"
          >
            <option value="all">All categories</option>
            {KNOWN_CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="submit"
            className="h-9 px-4 text-[13px] rounded-md bg-emerald-600 text-white hover:bg-emerald-700 font-medium"
          >
            Apply
          </button>
          {hasFilters && (
            <Link
              href="/admin/products"
              className="h-9 px-3 text-[13px] text-fg-muted hover:text-fg flex items-center"
            >
              Clear
            </Link>
          )}
        </div>
      </form>

      <BulkActionsBar
        sourceIds={products.map((p) => p.source_id)}
        activeSourceIds={allActiveSourceIds}
        inactiveSourceIds={allInactiveSourceIds}
        totalActive={totalActive}
        totalAll={totalAll}
      />

      {products.length === 0 && (
        <div className="mt-6 card p-8 text-center text-[13px] text-fg-muted">
          No products match these filters.
          {hasFilters && (
            <>
              {" "}
              <Link
                href="/admin/products"
                className="text-emerald-700 hover:underline"
              >
                Clear filters
              </Link>
              .
            </>
          )}
        </div>
      )}

      <div className="space-y-8 mt-6">
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
    </AdminPage>
  );
}
