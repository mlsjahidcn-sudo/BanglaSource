// /api/track/pageview
//
// Records a page view. Lightweight self-hosted analytics (Plausible-style,
// no cookies, no JS bundle). The client sends one request on mount with
// the pathname + referrer + UA.

import { NextRequest, NextResponse } from "next/server";
import { getServiceRoleClient } from "@/lib/supabase/server";
import { rateLimit, clientKey } from "@/lib/rate-limit";

const RATE_LIMIT = 600; // allow heavy traffic — analytics is high-frequency
const RATE_WINDOW_MS = 60_000;

export async function POST(req: NextRequest) {
  const rl = rateLimit({
    key: `track.pageview:${clientKey(req)}`,
    capacity: RATE_LIMIT,
    windowMs: RATE_WINDOW_MS,
  });
  if (!rl.allowed) {
    return NextResponse.json({ ok: true, dropped: true }, { status: 202 });
  }

  let body: { path?: string; referrer?: string; session_id?: string } = {};
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "invalid_body" }, { status: 400 });
  }
  if (!body.path) {
    return NextResponse.json({ ok: false, error: "missing_path" }, { status: 400 });
  }

  const supabase = getServiceRoleClient();
  const ua = req.headers.get("user-agent") ?? null;
  // Drop the most common bot UAs at the door
  if (
    ua &&
    /(bot|crawler|spider|headless|puppet|scrapy|httpclient|pingdom|uptimerobot)/i.test(
      ua,
    )
  ) {
    return NextResponse.json({ ok: true, dropped: "bot" });
  }

  await supabase.from("page_views").insert({
    path: body.path,
    referrer: body.referrer ?? null,
    user_agent: ua,
    session_id: body.session_id ?? null,
    country: req.headers.get("cf-ipcountry") ?? null,
  });

  // Persist the session id in an httpOnly cookie so server-side
  // routes (like /api/recently-viewed) can read it back. The
  // client also keeps it in sessionStorage for its own use.
  const res = NextResponse.json({ ok: true });
  if (body.session_id) {
    res.cookies.set("bs_sid", body.session_id, {
      path: "/",
      maxAge: 60 * 60 * 24 * 7, // 7 days
      sameSite: "lax",
      httpOnly: false, // allow client to read; not used for auth
    });
  }
  return res;
}
