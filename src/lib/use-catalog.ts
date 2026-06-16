"use client";
import { useEffect, useState } from "react";

export type CatalogProduct = {
  source_id: string;
  title_en: string;
  title_bn: string;
  title_zh: string;
  category: string;
  factory_moq: number;
  price_tiers: { qty_min: number; qty_max: number; price_cny_fen: number }[];
  weight_kg: number;
  volume_cbm: number;
  markup_pct: number;
  quality_score?: number;
  // Legacy / derived fields populated by the API mapper
  price_min_cny: number;
  price_max_cny: number;
  customs_duty_per_kg: number;
  customs_duty_class?: string;
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
};

let _cache: CatalogProduct[] | null = null;
let _inflight: Promise<CatalogProduct[]> | null = null;

async function fetchCatalog(): Promise<CatalogProduct[]> {
  if (_cache) return _cache;
  if (_inflight) return _inflight;
  _inflight = fetch("/api/catalog")
    .then((r) => r.json())
    .then((j) => {
      if (!j.ok) throw new Error("catalog fetch failed");
      _cache = j.products;
      return _cache!;
    })
    .finally(() => {
      _inflight = null;
    });
  return _inflight;
}

/**
 * Hook that returns the full catalog. Caches in module-scope so multiple
 * components on the same page share one fetch.
 */
export function useCatalog(): {
  products: CatalogProduct[];
  loaded: boolean;
} {
  const [products, setProducts] = useState<CatalogProduct[]>(_cache ?? []);
  const [loaded, setLoaded] = useState(_cache !== null);

  useEffect(() => {
    if (_cache) {
      setProducts(_cache);
      setLoaded(true);
      return;
    }
    let alive = true;
    fetchCatalog().then(
      (p) => {
        if (!alive) return;
        setProducts(p);
        setLoaded(true);
      },
      () => {
        if (!alive) return;
        setLoaded(true); // surface empty state instead of forever loading
      },
    );
    return () => {
      alive = false;
    };
  }, []);

  return { products, loaded };
}
