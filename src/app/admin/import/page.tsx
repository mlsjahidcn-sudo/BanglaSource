// /admin/import
//
// Phase 43 — Taobao/Tmall product import. Admin pastes a URL,
// the page scrapes it via Apify (zen-studio/taobao-detail-scraper)
// and pre-fills the product form below. Admin edits any missing
// or wrong fields, then submits to the existing /api/admin/products
// POST — same downstream pipeline as /admin/products/new.
//
// Pinduoduo URLs are rejected at the parser; admin sees a clear
// message + a "switch to manual" link.

import { requireAdmin } from "@/lib/portal-auth";
import { ImportClient } from "./_client";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function AdminImportPage() {
  await requireAdmin("/admin/import");
  return <ImportClient />;
}