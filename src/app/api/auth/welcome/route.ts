// POST /api/auth/welcome
//
// Phase 20: target for the Supabase DB webhook on
// `auth.users` INSERT. The webhook fires the moment a new
// buyer signs up; this route calls `notifyWelcome(userId)`
// to send the introduction email.
//
// Auth: none. Supabase DB webhooks sign with the
// `webhook secret` configured in the dashboard — we
// validate via the `x-supabase-webhook-secret` header (or
// accept the payload in dev when the header is missing).
// The handler is intentionally fire-and-forget: a slow or
// failed email must not cause Supabase to retry the
// webhook indefinitely.

import { NextRequest, NextResponse } from "next/server";
import { notifyWelcome } from "@/lib/email";

const WEBHOOK_SECRET = process.env.SUPABASE_WEBHOOK_SECRET;

export async function POST(req: NextRequest) {
  let payload: { record?: { id?: string }; type?: string; event?: string };
  try {
    payload = (await req.json()) as typeof payload;
  } catch {
    return NextResponse.json({ error: "bad_json" }, { status: 400 });
  }

  // Auth: validate the webhook secret if set.
  // Supabase Studio → Database → Webhooks → "Add Webhook" →
  // the request body has the option to add HTTP headers.
  // Set `X-Webhook-Secret: <your-secret>` there. In dev
  // (WEBHOOK_SECRET unset) we accept the request.
  if (WEBHOOK_SECRET) {
    const sent = req.headers.get("x-webhook-secret");
    if (sent !== WEBHOOK_SECRET) {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }
  }

  // The DB webhook on auth.users passes `{ record: { id, email, ... } }`.
  // Some setups wrap in `{ event, data: { record: {...} } }`. Support both.
  const userId =
    payload?.record?.id ??
    (payload as any)?.data?.record?.id ??
    null;
  if (!userId) {
    return NextResponse.json(
      { error: "no_user_id", message: "Webhook payload missing record.id" },
      { status: 400 },
    );
  }

  // Fire-and-forget. sendEmail returns its own result envelope;
  // we surface it in the response for debugging but the webhook
  // is already 200'd by then.
  const result = await notifyWelcome(userId);
  return NextResponse.json({ ok: result.ok, provider: result.provider, ...(result.ok ? {} : { error: result.error }) });
}
