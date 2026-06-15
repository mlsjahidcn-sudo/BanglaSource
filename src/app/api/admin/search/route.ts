// GET /api/admin/search?q=<text>&limit=5
//
// Phase 33 admin topbar search. Returns up to N matches per kind:
//   - products (title_en / title_zh / source_id / supplier_name)
//   - users (email / full_name / company)
//   - orders (id, buyer email)
//
// Server-rendered, no client JS needed. The TopbarSearch client
// component does the input + dropdown + ⌘K, but the API itself
// could be hit from anywhere (it's a normal search route).
//
// Admin-only via requireAdminApi. Rate-limited at 60/min/IP.

import { NextRequest, NextResponse } from "next/server";
import { getServiceRoleClient } from "@/lib/supabase/server";
import { requireAdminApi } from "@/lib/portal-auth";
import { rateLimit, clientKey } from "@/lib/rate-limit";

const RATE_LIMIT = 60;
const RATE_WINDOW_MS = 60_000;
const MAX_LIMIT = 8;

type ProductHit = {
  kind: "product";
  id: number;
  source_id: string;
  title: string;
  category: string;
  href: string;
};
type UserHit = {
  kind: "user";
  id: string;
  email: string;
  full_name: string | null;
  company: string | null;
  href: string;
};
type OrderHit = {
  kind: "order";
  id: number;
  num: string;
  total_bdt: number;
  status: string;
  href: string;
};
type Hit = ProductHit | UserHit | OrderHit;

export async function GET(req: NextRequest) {
  const rl = rateLimit({
    key: `admin.search:${clientKey(req)}`,
    capacity: RATE_LIMIT,
    windowMs: RATE_WINDOW_MS,
  });
  if (!rl.allowed) {
    return NextResponse.json(
      { error: "rate_limited" },
      { status: 429, headers: { "Retry-After": String(Math.ceil(rl.resetIn / 1000)) } },
    );
  }

  const guard = await requireAdminApi(req);
  if (!guard.ok) {
    return NextResponse.json(
      { error: guard.error },
      { status: guard.status },
    );
  }

  const url = new URL(req.url);
  const q = (url.searchParams.get("q") ?? "").trim();
  const limit = Math.min(
    MAX_LIMIT,
    Math.max(1, parseInt(url.searchParams.get("limit") ?? "5", 10) || 5),
  );

  if (!q || q.length < 2) {
    return NextResponse.json({ ok: true, q, results: [] });
  }

  const sb = getServiceRoleClient();
  const qlike = `%${q}%`;
  const isNumeric = /^\d+$/.test(q);

  // Three parallel queries: products, users, orders. Each capped
  // at `limit`. JS-side OR isn't needed — Supabase's `or` works
  // well across text columns.
  const [products, users, orders] = await Promise.all([
    sb
      .from("products")
      .select("id, source_id, title_en, title_zh, category")
      .or(
        `title_en.ilike.${qlike},title_zh.ilike.${qlike},source_id.ilike.${qlike},supplier_name.ilike.${qlike}`,
      )
      .limit(limit),
    sb
      .from("profiles")
      .select("id, email, full_name, company")
      .or(`email.ilike.${qlike},full_name.ilike.${qlike},company.ilike.${qlike}`)
      .limit(limit),
    // Orders: search by id (exact prefix match if numeric) OR by
    // buyer email. We can't search "this order contains product
    // with title X" without a join — limit to id + email.
    isNumeric
      ? sb
          .from("orders")
          .select("id, total_bdt, status")
          .eq("id", parseInt(q, 10))
          .limit(1)
      : sb
          .from("orders")
          .select("id, total_bdt, status, user_id")
          .limit(0), // disabled on text search — see users().in() below
  ]);

  // For text-search orders, look up by buyer email. We grab user_ids
  // from the user search above (if any) and look up their orders.
  let orderResults = (orders.data ?? []) as Array<{
    id: number;
    total_bdt: number;
    status: string;
    user_id?: string;
  }>;
  if (!isNumeric) {
    const userIds = (users.data ?? []).map((u: any) => u.id);
    if (userIds.length > 0) {
      const { data: ord } = await sb
        .from("orders")
        .select("id, total_bdt, status, user_id")
        .in("user_id", userIds)
        .order("created_at", { ascending: false })
        .limit(limit);
      orderResults = (ord ?? []) as any[];
    } else {
      orderResults = [];
    }
  }

  const results: Hit[] = [];
  for (const p of (products.data ?? []) as Array<{
    id: number;
    source_id: string;
    title_en: string | null;
    title_zh: string;
    category: string;
  }>) {
    results.push({
      kind: "product",
      id: p.id,
      source_id: p.source_id,
      title: p.title_en || p.title_zh,
      category: p.category,
      href: `/admin/products/${p.source_id}`,
    });
  }
  for (const u of (users.data ?? []) as Array<{
    id: string;
    email: string;
    full_name: string | null;
    company: string | null;
  }>) {
    results.push({
      kind: "user",
      id: u.id,
      email: u.email,
      full_name: u.full_name,
      company: u.company,
      href: `/admin/users?q=${encodeURIComponent(u.email)}`,
    });
  }
  for (const o of orderResults) {
    results.push({
      kind: "order",
      id: o.id,
      num: `BS-${String(o.id).padStart(6, "0")}`,
      total_bdt: Number(o.total_bdt ?? 0),
      status: o.status,
      href: `/admin/orders/${o.id}`,
    });
  }

  return NextResponse.json({ ok: true, q, results });
}
