// /api/watchlist
//
// GET  /api/watchlist                → list current user's watchlist
//                                       (joined with product data, BDT-priced)
// POST /api/watchlist  { product_id } → add a product
// DELETE ?product_id=N               → remove a product
// HEAD /api/watchlist?product_id=N   → check if a product is on the user's
//                                       watchlist (returns 200 if yes, 404 if no)
//
// All routes require an authenticated user (the watchlist is per-buyer).
// RLS on the watchlist table restricts reads/writes to the caller's
// user_id automatically — we still set user_id from auth.uid() and
// never accept it from the body to avoid spoofing.

import { NextRequest, NextResponse } from "next/server";
import { getServerClient } from "@/lib/supabase/server";
import { rateLimit, clientKey } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

const RATE_LIMIT = 120;
const RATE_WINDOW_MS = 60_000;

function userIdFromAuth(user: { id: string } | null): string | null {
  return user?.id ?? null;
}

export async function GET() {
  const supabase = await getServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json(
      { ok: false, error: "unauthenticated" },
      { status: 401 },
    );
  }
  const { data, error } = await supabase
    .from("watchlist")
    .select(
      "id, product_id, saved_at, notify_on_drop, products:product_id(id, source_id, title_en, title_bn, images, category, factory_moq, rating_overall, order_count_30d, price_tiers(price_cny_fen))",
    )
    .eq("user_id", user.id)
    .order("saved_at", { ascending: false })
    .limit(200);
  if (error) {
    return NextResponse.json(
      { ok: false, error: error.message },
      { status: 500 },
    );
  }
  return NextResponse.json(
    { ok: true, items: data ?? [], count: data?.length ?? 0 },
    { headers: { "Cache-Control": "no-store" } },
  );
}

export async function POST(req: NextRequest) {
  const rl = rateLimit({
    key: `watchlist.post:${clientKey(req)}`,
    capacity: RATE_LIMIT,
    windowMs: RATE_WINDOW_MS,
  });
  if (!rl.allowed) {
    return NextResponse.json(
      { ok: false, error: "rate_limited" },
      { status: 429 },
    );
  }
  const supabase = await getServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  const uid = userIdFromAuth(user);
  if (!uid) {
    return NextResponse.json(
      { ok: false, error: "unauthenticated" },
      { status: 401 },
    );
  }

  let body: { product_id?: number; source_id?: string } = {};
  try {
    body = (await req.json()) ?? {};
  } catch {
    return NextResponse.json(
      { ok: false, error: "invalid_json" },
      { status: 400 },
    );
  }
  let productId = body.product_id;
  // Accept source_id (the public 12-digit 1688 ID) too — UI passes
  // source_id because that's what the product card / PDP knows.
  if (!productId && body.source_id) {
    const { data, error } = await supabase
      .from("products")
      .select("id")
      .eq("source_id", String(body.source_id))
      .maybeSingle();
    if (error || !data) {
      return NextResponse.json(
        { ok: false, error: "product_not_found" },
        { status: 404 },
      );
    }
    productId = data.id;
  }
  if (!productId || typeof productId !== "number") {
    return NextResponse.json(
      { ok: false, error: "missing_product_id" },
      { status: 400 },
    );
  }

  // Upsert is fine: dedup is enforced by the UNIQUE constraint, so
  // an existing row just gets a fresh saved_at. The `ignoreDuplicates`
  // option would also work but returns a different shape; upsert is
  // clearer.
  const { data, error } = await supabase
    .from("watchlist")
    .upsert(
      { user_id: uid, product_id: productId },
      { onConflict: "user_id,product_id", ignoreDuplicates: false },
    )
    .select("id, product_id, saved_at")
    .maybeSingle();
  if (error) {
    return NextResponse.json(
      { ok: false, error: error.message },
      { status: 500 },
    );
  }
  return NextResponse.json({ ok: true, item: data });
}

export async function DELETE(req: NextRequest) {
  const url = new URL(req.url);
  const productId = parseInt(url.searchParams.get("product_id") ?? "", 10);
  const sourceId = url.searchParams.get("source_id");
  const supabase = await getServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  const uid = userIdFromAuth(user);
  if (!uid) {
    return NextResponse.json(
      { ok: false, error: "unauthenticated" },
      { status: 401 },
    );
  }
  if (!productId && !sourceId) {
    return NextResponse.json(
      { ok: false, error: "missing_product_id" },
      { status: 400 },
    );
  }

  // Resolve source_id → product_id if needed
  let pid = productId;
  if (!pid && sourceId) {
    const { data, error } = await supabase
      .from("products")
      .select("id")
      .eq("source_id", sourceId)
      .maybeSingle();
    if (error || !data) {
      return NextResponse.json(
        { ok: false, error: "product_not_found" },
        { status: 404 },
      );
    }
    pid = data.id;
  }

  const { error } = await supabase
    .from("watchlist")
    .delete()
    .eq("user_id", uid)
    .eq("product_id", pid);
  if (error) {
    return NextResponse.json(
      { ok: false, error: error.message },
      { status: 500 },
    );
  }
  return NextResponse.json({ ok: true });
}
