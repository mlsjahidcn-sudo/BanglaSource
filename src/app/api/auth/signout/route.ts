// POST /api/auth/signout
// Signs the user out and redirects to /. Accepts both form-encoded
// and JSON (so the user-menu form-action works).

import { NextRequest, NextResponse } from "next/server";
import { getServerClient } from "@/lib/supabase/server";

export async function POST(req: NextRequest) {
  const supabase = await getServerClient();
  await supabase.auth.signOut();

  // If it was a form submit (form action), redirect. Otherwise return JSON.
  const accept = req.headers.get("accept") ?? "";
  if (accept.includes("text/html")) {
    return NextResponse.redirect(new URL("/", req.url), { status: 303 });
  }
  return NextResponse.json({ ok: true });
}
