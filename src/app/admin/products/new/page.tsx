// /admin/products/new
//
// Phase 15c: manual product create. Admin fills the form
// (title, description, factory FOB, weight, etc.) plus a
// paste-in list of image URLs, hits Save -> POST /api/admin/products.
//
// No Apify step, no URL scrape. Different intent from /admin/import
// (which scrapes Pinduoduo/Taobao). The two flows share the
// downstream product-create pipeline.

import { requireAdmin } from "@/lib/portal-auth";
import { ManualProductClient } from "./_client";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function AdminNewProductPage() {
  await requireAdmin("/admin/products/new");
  return <ManualProductClient />;
}
