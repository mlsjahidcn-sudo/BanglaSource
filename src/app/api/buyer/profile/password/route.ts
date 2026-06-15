// POST /api/buyer/profile/password
//
// Phase 21 close-out (Phase 33, 2026-06-15). Lets the signed-in
// buyer change their own password.
//
// Flow:
//   1. Validate new password length (8+ chars).
//   2. Verify the CURRENT password by attempting a sign-in
//      with the user's email + provided current password.
//      (Supabase doesn't expose a "verify password" RPC;
//      signInWithPassword is the canonical way.)
//   3. Call supabase.auth.updateUser({ password: newPassword }).
//
// The signed-in session client is used for step 3 (must be
// the user's own session, not service-role, to avoid surprising
// cross-account changes). The verification step uses a fresh
// client to avoid mutating the active session.

import { NextRequest, NextResponse } from "next/server";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { getServerClient } from "@/lib/supabase/server";
import { requireUserApi } from "@/lib/portal-auth";
import { rateLimit, clientKey } from "@/lib/rate-limit";

const RATE_LIMIT = 10;
const RATE_WINDOW_MS = 60_000;

const MIN_LEN = 8;
const MAX_LEN = 128;

type Body = {
  current_password?: string;
  new_password?: string;
};

export async function POST(req: NextRequest) {
  const rl = rateLimit({
    key: `buyer.profile.password:${clientKey(req)}`,
    capacity: RATE_LIMIT,
    windowMs: RATE_WINDOW_MS,
  });
  if (!rl.allowed) {
    return NextResponse.json(
      { error: "rate_limited" },
      { status: 429, headers: { "Retry-After": String(Math.ceil(rl.resetIn / 1000)) } },
    );
  }

  const guard = await requireUserApi(req);
  if (!guard.ok) {
    return NextResponse.json(
      { error: guard.error },
      { status: guard.status },
    );
  }

  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return NextResponse.json({ error: "bad_json" }, { status: 400 });
  }

  const current = body.current_password?.toString() ?? "";
  const next = body.new_password?.toString() ?? "";

  if (!current || !next) {
    return NextResponse.json(
      { error: "missing_field", message: "current_password and new_password are both required" },
      { status: 400 },
    );
  }
  if (next.length < MIN_LEN) {
    return NextResponse.json(
      { error: "password_too_short", min: MIN_LEN },
      { status: 400 },
    );
  }
  if (next.length > MAX_LEN) {
    return NextResponse.json(
      { error: "password_too_long", max: MAX_LEN },
      { status: 400 },
    );
  }
  if (next === current) {
    return NextResponse.json(
      { error: "same_password", message: "New password must differ from current" },
      { status: 400 },
    );
  }

  // Step 1: verify the current password. A fresh anon client so
  // we don't disturb the active session.
  const verify = createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  );
  const { error: verifyErr } = await verify.auth.signInWithPassword({
    email: guard.user.email,
    password: current,
  });
  if (verifyErr) {
    return NextResponse.json(
      { error: "current_password_wrong" },
      { status: 401 },
    );
  }

  // Step 2: change the password using the active session client.
  // The server client reads cookies set by the browser, so the
  // user's session is the one mutating their own auth record.
  const session = await getServerClient();
  const { error: updateErr } = await session.auth.updateUser({
    password: next,
  });
  if (updateErr) {
    return NextResponse.json(
      { error: "update_failed", message: updateErr.message },
      { status: 500 },
    );
  }

  return NextResponse.json({ ok: true });
}
