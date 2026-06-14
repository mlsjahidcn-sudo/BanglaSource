// GET /api/newsletter/confirm?token=...
//
// Phase 20: landing route for the double opt-in confirmation
// link in the email body. GET (not POST) so the link works in
// any browser without JavaScript. We:
//   1. Look up the row by confirm_token.
//   2. If found + not yet confirmed, flip confirmed_at = now().
//   3. Clear the token (one-shot — the link can't be replayed).
//   4. Redirect to /newsletter/confirmed with a status query.
//
// Unsubscribe path: /api/newsletter/unsubscribe?token=... mirrors
// this but flips unsubscribed_at.

import { NextRequest, NextResponse } from "next/server";
import { getServiceRoleClient } from "@/lib/supabase/server";

export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get("token")?.trim() ?? "";
  if (!token || token.length > 64) {
    return NextResponse.redirect(new URL("/newsletter/confirmed?status=invalid", req.url));
  }

  const sb = getServiceRoleClient();
  const { data: row } = await sb
    .from("newsletter_subscribers")
    .select("id, email, confirmed_at, unsubscribed_at")
    .eq("confirm_token", token)
    .maybeSingle();

  if (!row) {
    return NextResponse.redirect(new URL("/newsletter/confirmed?status=invalid", req.url));
  }
  if (row.unsubscribed_at) {
    // Previously unsubscribed — re-subscribing requires a
    // new signup; the link no longer works.
    return NextResponse.redirect(new URL("/newsletter/confirmed?status=unsubscribed", req.url));
  }
  if (row.confirmed_at) {
    // Already confirmed (link re-clicked). Idempotent.
    return NextResponse.redirect(new URL("/newsletter/confirmed?status=already", req.url));
  }

  const { error } = await sb
    .from("newsletter_subscribers")
    .update({
      confirmed_at: new Date().toISOString(),
      // One-shot: clear the token so the link can't be replayed.
      confirm_token: null,
    })
    .eq("id", row.id);
  if (error) {
    return NextResponse.redirect(new URL("/newsletter/confirmed?status=error", req.url));
  }
  return NextResponse.redirect(new URL("/newsletter/confirmed?status=ok", req.url));
}
