// /sitemap.xml — generated at build/request time
//
// Indexes:
//   - Static pages (home, about, contact, etc.)
//   - All active product pages (so Google sees every PDP with prices)
//   - All category pages

import type { MetadataRoute } from "next";
import { getServiceRoleClient } from "@/lib/supabase/server";

const SITE = "https://banglasource.com";

export const revalidate = 3600; // 1h

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const now = new Date();
  const supabase = getServiceRoleClient();

  // Active products
  const { data: products } = await supabase
    .from("products")
    .select("source_id,updated_at")
    .eq("active", true);
  const productUrls: MetadataRoute.Sitemap = (products ?? []).map((p) => ({
    url: `${SITE}/products/${p.source_id}`,
    lastModified: p.updated_at ? new Date(p.updated_at) : now,
    changeFrequency: "daily",
    priority: 0.8,
  }));

  // Categories (static set)
  const { categoryList } = await import("@/lib/categories");
  const categoryUrls: MetadataRoute.Sitemap = categoryList.map((c) => ({
    url: `${SITE}/categories/${c.slug}`,
    lastModified: now,
    changeFrequency: "weekly",
    priority: 0.7,
  }));

  // Static pages
  const staticUrls: MetadataRoute.Sitemap = [
    { url: SITE, lastModified: now, changeFrequency: "hourly", priority: 1.0 },
    { url: `${SITE}/categories`, lastModified: now, changeFrequency: "weekly", priority: 0.9 },
    { url: `${SITE}/how-it-works`, lastModified: now, changeFrequency: "monthly", priority: 0.5 },
    { url: `${SITE}/shipping-rates`, lastModified: now, changeFrequency: "monthly", priority: 0.5 },
    { url: `${SITE}/about`, lastModified: now, changeFrequency: "monthly", priority: 0.5 },
    { url: `${SITE}/contact`, lastModified: now, changeFrequency: "monthly", priority: 0.5 },
    { url: `${SITE}/search`, lastModified: now, changeFrequency: "weekly", priority: 0.4 },
  ];

  return [...staticUrls, ...categoryUrls, ...productUrls];
}
