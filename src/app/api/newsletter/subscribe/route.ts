// POST /api/newsletter/subscribe
//
// Phase 20: newsletter double opt-in. A visitor pastes
// their email into the footer signup form. We:
//   1. Validate the email.
//   2. INSERT into public.newsletter_subscribers with a
//      fresh 32-char hex confirm_token. The DB upsert is
//      conflict-tolerant (UNIQUE on email): if the email
//      is already there, we either re-issue a fresh token
//      (if the prior signup was unconfirmed) or no-op
//      (if the prior signup was already confirmed).
//   3. Call notifyNewsletterConfirm which sends the
//      confirmation email with a one-click link.
//
// Auth: anon (the footer is public). Rate-limited: 10/min
// per IP to prevent the form from being a spam relay.

import { NextRequest, NextResponse } from "next/server";
import { getServiceRoleClient } from "@/lib/supabase/server";
import { rateLimit, clientKey } from "@/lib/rate-limit";
import { notifyNewsletterConfirm } from "@/lib/email";

const RATE_LIMIT = 10;
const RATE_WINDOW_MS = 60_000;

function generateToken(): string {
  // 32 hex chars = 16 bytes = 128 bits of entropy. Crypto-
  // safe via Node's webcrypto (Edge + Node compatible).
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

export async function POST(req: NextRequest) {
  const rl = rateLimit({
    key: `newsletter.subscribe:${clientKey(req)}`,
    capacity: RATE_LIMIT,
    windowMs: RATE_WINDOW_MS,
  });
  if (!rl.allowed) {
    return NextResponse.json(
      { error: "rate_limited" },
      { status: 429, headers: { "Retry-After": String(Math.ceil(rl.resetIn / 1000)) } },
    );
  }

  let body: { email?: string; source?: string };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "bad_json" }, { status: 400 });
  }
  const email = (body.email ?? "").trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254) {
    return NextResponse.json(
      { error: "bad_email", message: "Enter a valid email address." },
      { status: 400 },
    );
  }
  // Optional: short source tag (where the signup came from).
  const source = (body.source ?? "footer").slice(0, 32);

  const sb = getServiceRoleClient();

  // Check if this email already has a row. If confirmed,
  // short-circuit (idempotent — no second email).
  const { data: existing } = await sb
    .from("newsletter_subscribers")
    .select("id, confirmed_at, unsubscribed_at")
    .eq("email", email)
    .maybeSingle();

  if (existing) {
    if (existing.unsubscribed_at) {
      // Re-subscribe path: clear unsubscribed_at, re-issue
      // a token, send the confirmation email. Treat as
      // fresh signup.
      const token = generateToken();
      const { error } = await sb
        .from("newsletter_subscribers")
        .update({
          unsubscribed_at: null,
          confirmed_at: null,
          confirm_token: token,
          source,
        })
        .eq("id", existing.id);
      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
      }
      await notifyNewsletterConfirm(email, token);
      return NextResponse.json({ ok: true, status: "resubscribe_pending" });
    }
    if (existing.confirmed_at) {
      // Already confirmed. No-op.
      return NextResponse.json({ ok: true, status: "already_confirmed" });
    }
    // Unconfirmed: re-issue the token and re-send the email.
    const token = generateToken();
    const { error } = await sb
      .from("newsletter_subscribers")
      .update({ confirm_token: token, source })
      .eq("id", existing.id);
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    await notifyNewsletterConfirm(email, token);
    return NextResponse.json({ ok: true, status: "re_sent" });
  }

  // Fresh insert.
  const token = generateToken();
  const { error } = await sb
    .from("newsletter_subscribers")
    .insert({
      email,
      confirm_token: token,
      source,
    });
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  await notifyNewsletterConfirm(email, token);
  return NextResponse.json({ ok: true, status: "pending" });
}
