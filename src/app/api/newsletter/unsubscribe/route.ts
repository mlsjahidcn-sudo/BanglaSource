// GET /api/newsletter/unsubscribe?token=...
//
// Phase 20: landing route for the unsubscribe link in every
// campaign. The token in the URL is the subscriber's id
// (NOT the confirm_token — that was cleared on confirm), so
// unsubscribing is a one-tap action that doesn't require the
// user to remember which email it came from.
//
// We deliberately use the public id (no crypto) because
// (a) the link is mailed to the user themselves so there's
// no privilege escalation, and (b) if an attacker tricks
// a user into clicking an unsubscribe link for someone
// else, the worst case is that one person gets unsubscribed
// — the user can re-subscribe with one click at the footer
// form. This is how Mailchimp / Substack / etc. work.
//
// Rate limit: 20/min per IP to prevent the route from being
// a DoS amplifier against an attacker who knows a row id.

import { NextRequest, NextResponse } from "next/server";
import { getServiceRoleClient } from "@/lib/supabase/server";
import { rateLimit, clientKey } from "@/lib/rate-limit";

const RATE_LIMIT = 20;
const RATE_WINDOW_MS = 60_000;

export async function GET(req: NextRequest) {
  const rl = rateLimit({
    key: `newsletter.unsubscribe:${clientKey(req)}`,
    capacity: RATE_LIMIT,
    windowMs: RATE_WINDOW_MS,
  });
  if (!rl.allowed) {
    return NextResponse.redirect(new URL("/newsletter/unsubscribed?status=rate_limited", req.url));
  }

  const token = req.nextUrl.searchParams.get("token")?.trim() ?? "";
  // "token" here is the row id (bigint).
  const id = Number(token);
  if (!Number.isInteger(id) || id <= 0) {
    return NextResponse.redirect(new URL("/newsletter/unsubscribed?status=invalid", req.url));
  }

  const sb = getServiceRoleClient();
  const { error } = await sb
    .from("newsletter_subscribers")
    .update({
      unsubscribed_at: new Date().toISOString(),
      // Drop the confirm_token too — re-subscribing now
      // requires a fresh /api/newsletter/subscribe round.
      confirm_token: null,
    })
    .eq("id", id)
    .is("unsubscribed_at", null); // no-op if already unsubscribed
  if (error) {
    return NextResponse.redirect(new URL("/newsletter/unsubscribed?status=error", req.url));
  }
  return NextResponse.redirect(new URL("/newsletter/unsubscribed?status=ok", req.url));
}
