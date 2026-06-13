// /api/newsletter/subscribe
//
// POST /api/newsletter/subscribe
// body: { email: string, source?: string }
//
// Public, anon-friendly. Idempotent: ON CONFLICT (email) DO NOTHING
// so re-submissions just succeed silently.

import { NextRequest, NextResponse } from "next/server";
import { getServiceRoleClient } from "@/lib/supabase/server";
import { rateLimit, clientKey } from "@/lib/rate-limit";
import { createHash } from "node:crypto";

export const dynamic = "force-dynamic";

const RATE_LIMIT = 5;
const RATE_WINDOW_MS = 60_000;

function hashIp(ip: string | null): string | null {
  if (!ip) return null;
  return createHash("sha256").update(ip).digest("hex").slice(0, 16);
}

export async function POST(req: NextRequest) {
  const rl = rateLimit({
    key: `newsletter.subscribe:${clientKey(req)}`,
    capacity: RATE_LIMIT,
    windowMs: RATE_WINDOW_MS,
  });
  if (!rl.allowed) {
    return NextResponse.json(
      { ok: false, error: "rate_limited" },
      { status: 429 },
    );
  }
  let body: { email?: string; source?: string } = {};
  try {
    body = (await req.json()) ?? {};
  } catch {
    return NextResponse.json(
      { ok: false, error: "invalid_json" },
      { status: 400 },
    );
  }
  const email = String(body.email ?? "").trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json(
      { ok: false, error: "invalid_email" },
      { status: 400 },
    );
  }
  if (email.length > 320) {
    return NextResponse.json(
      { ok: false, error: "email_too_long" },
      { status: 400 },
    );
  }
  const supabase = getServiceRoleClient();
  const ip =
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    req.headers.get("x-real-ip") ??
    null;
  const ipHash = hashIp(ip);
  const { error } = await supabase
    .from("newsletter_subscribers")
    .insert({
      email,
      source: body.source?.slice(0, 64) ?? null,
      ip_hash: ipHash,
    });
  if (error && error.code !== "23505") {
    // 23505 is unique_violation; treat as success (already subscribed)
    return NextResponse.json(
      { ok: false, error: error.message },
      { status: 500 },
    );
  }
  return NextResponse.json({ ok: true, already_subscribed: error?.code === "23505" });
}
