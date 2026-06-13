// /api/notifications
//
// GET   /api/notifications                 → list current user's
//                                            notifications (most recent 50)
// PATCH /api/notifications                 → mark one or all read
//                                            body: { id: number } or
//                                                  { all: true }
//
// Auth: requires signed-in user. RLS handles the per-user filter,
// but we still pull user from auth.uid() to give a clean 401.
//
// The bell badge polls this endpoint on mount; the notifications
// page does a single fetch.

import { NextRequest, NextResponse } from "next/server";
import { getServerClient } from "@/lib/supabase/server";
import { rateLimit, clientKey } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

const RATE_LIMIT = 60;
const RATE_WINDOW_MS = 60_000;

export async function GET() {
  const supabase = await getServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json(
      { ok: false, error: "unauthenticated" },
      { status: 401 },
    );
  }
  // Fetch the 50 most recent notifications, plus a separate count
  // of unread so the bell badge can render without scanning all rows.
  const [{ data: items, error }, { count: unread }] = await Promise.all([
    supabase
      .from("notifications")
      .select("id, kind, title, body, href, read_at, created_at, related_alert_id, related_product_id")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(50),
    supabase
      .from("notifications")
      .select("id", { count: "exact", head: true })
      .eq("user_id", user.id)
      .is("read_at", null),
  ]);
  if (error) {
    return NextResponse.json(
      { ok: false, error: error.message },
      { status: 500 },
    );
  }
  return NextResponse.json(
    {
      ok: true,
      items: items ?? [],
      unread: unread ?? 0,
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}

export async function PATCH(req: NextRequest) {
  const rl = rateLimit({
    key: `notifications.patch:${clientKey(req)}`,
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
  if (!user) {
    return NextResponse.json(
      { ok: false, error: "unauthenticated" },
      { status: 401 },
    );
  }
  let body: { id?: number; all?: boolean } = {};
  try {
    body = (await req.json()) ?? {};
  } catch {
    return NextResponse.json(
      { ok: false, error: "invalid_json" },
      { status: 400 },
    );
  }
  const now = new Date().toISOString();
  if (body.all === true) {
    const { error } = await supabase
      .from("notifications")
      .update({ read_at: now })
      .eq("user_id", user.id)
      .is("read_at", null);
    if (error) {
      return NextResponse.json(
        { ok: false, error: error.message },
        { status: 500 },
      );
    }
    return NextResponse.json({ ok: true, marked: "all" });
  }
  if (typeof body.id !== "number") {
    return NextResponse.json(
      { ok: false, error: "missing_id_or_all" },
      { status: 400 },
    );
  }
  const { error } = await supabase
    .from("notifications")
    .update({ read_at: now })
    .eq("id", body.id)
    .eq("user_id", user.id)
    .is("read_at", null);
  if (error) {
    return NextResponse.json(
      { ok: false, error: error.message },
      { status: 500 },
    );
  }
  return NextResponse.json({ ok: true, marked: body.id });
}
