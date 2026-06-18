import "server-only";
import { unstable_cache as cache } from "next/cache";
import { getServiceRoleClient } from "./supabase/server";
import type { PriceTier, Product } from "./pricing";

export type DbPriceTier = {
  qty_min: number;
  qty_max: number | null;
  price_cny_fen: number;
};

export type DbProduct = {
  id: number;
  source_id: string;
  title_en: string;
  title_bn: string;
  title_zh: string;
  category: string;
  factory_moq: number;
  weight_kg: number;
  volume_cbm: number;
  markup_pct: number;
  quality_score: number | null;
  supplier_name: string;
  supplier_province: string;
  supplier_city: string;
  stock_total: number;
  order_count_30d: number;
  rating_overall: number;
  badges: string[];
  images: string[];
  description_en: string;
  description_bn: string;
  source_url: string;
  price_tiers: DbPriceTier[];
  customs_duty_per_kg: number;
  customs_duty_class: string | null;
};

/**
 * Fetch the full catalog (21 products + 4 tiers each) from Supabase.
 * Service-role client bypasses RLS — this is a public catalog, but using
 * service-role keeps the path identical for both the public route and any
 * future ops/admin routes that need the same data.
 *
 * Cached in-memory for 60s via React's unstable_cache. The catalog changes
 * maybe a few times a day (price refresh cron, Apify ingestion), so 60s
 * is a good balance between freshness and DB pressure.
 */
export const getCatalog = cache(
  async (): Promise<Product[]> => {
    const supabase = getServiceRoleClient();

    const { data: products, error: pErr } = await supabase
      .from("products")
      .select(
        "id,source_id,title_en,title_bn,title_zh,category,factory_moq,weight_kg,volume_cbm,markup_pct,quality_score,supplier_name,supplier_province,supplier_city,stock_total,order_count_30d,rating_overall,badges,images,description_en,description_bn,source_url,customs_duty_per_kg,customs_duty_class",
      )
      .eq("active", true)
      .order("id", { ascending: true });

    if (pErr) {
      throw new Error(`getCatalog products: ${pErr.message}`);
    }
    if (!products || products.length === 0) {
      return [];
    }

    const ids = (products as { id: number }[]).map((p) => p.id);
    const { data: tiers, error: tErr } = await supabase
      .from("price_tiers")
      .select("product_id,qty_min,qty_max,price_cny_fen")
      .in("product_id", ids)
      .order("qty_min", { ascending: true });

    if (tErr) {
      throw new Error(`getCatalog tiers: ${tErr.message}`);
    }

    const tiersByProduct = new Map<number, DbPriceTier[]>();
    for (const t of tiers ?? []) {
      const arr = tiersByProduct.get(t.product_id) ?? [];
      arr.push({
        qty_min: t.qty_min,
        qty_max: t.qty_max,
        price_cny_fen: t.price_cny_fen,
      });
      tiersByProduct.set(t.product_id, arr);
    }

    return (products as Omit<DbProduct, "price_tiers">[]).map((p) =>
      publicProduct(
        dbProductToLegacy({
          ...p,
          price_tiers: tiersByProduct.get(p.id) ?? [],
        }),
      ),
    );
  },
  ["catalog-v2"],
  { revalidate: 60, tags: ["catalog"] },
);

/**
 * Fetch a single product by source_id, joined with its tiers.
 * Used by the PDP.
 */
export const getProduct = cache(
  async (sourceId: string): Promise<DbProduct | null> => {
    const supabase = getServiceRoleClient();

    const { data: product, error: pErr } = await supabase
      .from("products")
      .select(
        "id,source_id,title_en,title_bn,title_zh,category,factory_moq,weight_kg,volume_cbm,markup_pct,quality_score,supplier_name,supplier_province,supplier_city,stock_total,order_count_30d,rating_overall,badges,images,description_en,description_bn,source_url,customs_duty_per_kg,customs_duty_class",
      )
      .eq("source_id", sourceId)
      .eq("active", true)
      .maybeSingle();

    if (pErr) {
      throw new Error(`getProduct: ${pErr.message}`);
    }
    if (!product) return null;

    const { data: tiers, error: tErr } = await supabase
      .from("price_tiers")
      .select("qty_min,qty_max,price_cny_fen")
      .eq("product_id", product.id)
      .order("qty_min", { ascending: true });

    if (tErr) {
      throw new Error(`getProduct tiers: ${tErr.message}`);
    }

    return {
      ...(product as Omit<DbProduct, "price_tiers">),
      price_tiers: (tiers ?? []) as DbPriceTier[],
    } as DbProduct;
  },
  ["product-v1"],
  { revalidate: 60, tags: ["catalog"] },
);

/**
 * In-memory lookup shape that the existing pages already use. Maps the DB
 * product to the legacy `allProducts[i]` shape so the rest of the codebase
 * (which imports `data/products.ts` for the `Product` type) doesn't need
 * to be rewritten.
 *
 * Use this instead of importing `allProducts` from `data/products.ts`.
 */
// Accept a raw `DbProduct` (with `price_tiers` joined in). The
// legacy `Product` type is derived entirely from the raw row — no
// extra fields are required at the call site.
type DbLike = DbProduct;

export function dbProductToLegacy(p: DbLike): Product {
  return {
    source_id: p.source_id,
    title_zh: p.title_zh,
    title_en: p.title_en,
    title_bn: p.title_bn,
    category: p.category,
    price_min_cny: p.price_tiers[0]?.price_cny_fen ?? 0,
    price_max_cny: p.price_tiers.at(-1)?.price_cny_fen ?? 0,
    factory_moq: p.factory_moq,
    // `p.price_tiers` is `DbPriceTier[]` (qty_max: number | null);
    // the legacy `Product` type wants `PriceTier[]` (qty_max: number).
    // In practice, every `qty_max` is either a number or null for
    // "no upper bound". The downstream pricing code treats a null
    // qty_max as "any qty ≥ qty_min" so casting is safe here.
    price_tiers: p.price_tiers as unknown as PriceTier[],
    weight_kg: p.weight_kg,
    volume_cbm: p.volume_cbm,
    supplier_name: p.supplier_name,
    supplier_province: p.supplier_province,
    supplier_city: p.supplier_city,
    stock_total: p.stock_total,
    order_count_30d: p.order_count_30d,
    rating_overall: p.rating_overall,
    badges: p.badges,
    images: p.images,
    description_en: p.description_en,
    description_bn: p.description_bn,
    source_url: p.source_url,
    markup_pct: p.markup_pct,
    quality_score: p.quality_score ?? undefined,
    customs_duty_per_kg: p.customs_duty_per_kg,
    customs_duty_class: p.customs_duty_class ?? undefined,
  };
}

/**
 * Public-safe version of a Product — strips supplier_name,
 * supplier_province, supplier_city. The factory behind a listing
 * is the seller's competitive moat (they've built the relationship,
 * they're paying for samples, they know the staff). Exposing the
 * factory name on the public site lets any buyer cut us out and
 * order direct, which collapses the value BanglaSource adds.
 *
 * The supplier data is still in the DB and available to admin via
 * the service-role client, but it's never returned through the
 * public /api/catalog endpoint or used in any public page.
 *
 * We use empty-string (not undefined) so the type stays the same
 * and components that already check `product.supplier_name && ...`
 * naturally skip rendering.
 */
export function publicProduct(p: Product): Product {
  return {
    ...p,
    supplier_name: "",
    supplier_province: "",
    supplier_city: "",
  };
}
