// POST /api/contact
//
// Phase 24: the public contact form. Used by the
// /contact page. Inserts into public.contact_messages
// (migration 0029) and fires an email to ops.
//
// Auth: anon (the contact form is public). Rate
// limited to 5/min per IP to prevent the form from
// being a spam relay. We also do basic spam
// heuristics on the message body.

import { NextRequest, NextResponse } from "next/server";
import { getServiceRoleClient } from "@/lib/supabase/server";
import { rateLimit, clientKey } from "@/lib/rate-limit";
import { sendEmail } from "@/lib/email";
import { BRAND } from "@/lib/contact";

const RATE_LIMIT = 5;
const RATE_WINDOW_MS = 60_000;

type PostBody = {
  name?: string;
  phone?: string;
  email?: string;
  company?: string;
  message?: string;
  source?: string;
};

// Cheap spam heuristic: if the message contains
// more than 3 URLs OR > 5 exclamation marks OR is
// almost all-uppercase, treat as spam. The
// service-role client stores `status='spam'` and
// we still return 200 so the bot doesn't retry.
function looksLikeSpam(s: string): boolean {
  const urlCount = (s.match(/https?:\/\//gi) ?? []).length;
  const bangCount = (s.match(/!/g) ?? []).length;
  const letters = s.replace(/[^a-zA-Z]/g, "");
  const upperRatio =
    letters.length > 20
      ? letters.replace(/[^A-Z]/g, "").length / letters.length
      : 0;
  return urlCount > 3 || bangCount > 5 || upperRatio > 0.7;
}

export async function POST(req: NextRequest) {
  const rl = rateLimit({
    key: `contact.form:${clientKey(req)}`,
    capacity: RATE_LIMIT,
    windowMs: RATE_WINDOW_MS,
  });
  if (!rl.allowed) {
    return NextResponse.json(
      { error: "rate_limited" },
      { status: 429, headers: { "Retry-After": String(Math.ceil(rl.resetIn / 1000)) } },
    );
  }

  let body: PostBody;
  try {
    body = (await req.json()) as PostBody;
  } catch {
    return NextResponse.json({ error: "bad_json" }, { status: 400 });
  }

  // Validate
  const name = (body.name ?? "").trim();
  if (name.length < 2 || name.length > 120) {
    return NextResponse.json(
      { error: "bad_name", message: "Name must be 2-120 characters." },
      { status: 400 },
    );
  }
  const phone = (body.phone ?? "").trim();
  if (phone.length < 4 || phone.length > 20) {
    return NextResponse.json(
      { error: "bad_phone", message: "Phone must be 4-20 characters." },
      { status: 400 },
    );
  }
  const email = (body.email ?? "").trim() || null;
  if (email && (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))) {
    return NextResponse.json(
      { error: "bad_email", message: "Enter a valid email or leave it empty." },
      { status: 400 },
    );
  }
  const company = (body.company ?? "").trim() || null;
  if (company && company.length > 120) {
    return NextResponse.json(
      { error: "bad_company", message: "Company must be ≤ 120 characters." },
      { status: 400 },
    );
  }
  const message = (body.message ?? "").trim();
  if (message.length < 10 || message.length > 2000) {
    return NextResponse.json(
      { error: "bad_message", message: "Message must be 10-2000 characters." },
      { status: 400 },
    );
  }
  const sourceRaw = (body.source ?? "contact-page").trim();
  const source = ["footer", "contact-page", "rfq-fallback", "whatsapp-fallback", "other"].includes(
    sourceRaw,
  )
    ? sourceRaw
    : "other";
  const isSpam = looksLikeSpam(message);

  const sb = getServiceRoleClient();
  const { data, error } = await sb
    .from("contact_messages")
    .insert({
      name,
      phone,
      email,
      company,
      message,
      source,
      status: isSpam ? "spam" : "new",
      user_id: null,
      ip_hash: null,
      admin_owner_id: null,
    })
    .select("id")
    .single();
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Fan-out to ops. Reply-To is the visitor's email
  // (if provided) so ops can respond in 1 click.
  // If the message is spam-flagged, skip the email
  // (the spam row is still in the DB for review).
  if (!isSpam) {
    const opsTo = process.env.OPS_EMAIL ?? "support@banglasource.com";
    const subject = `New contact form: ${name} — ${message.slice(0, 60)}`;
    const html = `
      <div style="font-family: -apple-system, system-ui, sans-serif; max-width: 560px; margin: 0 auto; color: #0f172a;">
        <h1 style="font-size: 18px; margin-bottom: 4px;">New contact form submission</h1>
        <p><strong>${name}</strong> — ${phone}${email ? ` · <a href="mailto:${email}" style="color: #0891b2;">${email}</a>` : ""}${company ? ` · ${company}` : ""}</p>
        <p>Source: <code>${source}</code></p>
        <p style="margin-top: 20px; padding: 12px; background: #f1f5f9; border-radius: 6px; white-space: pre-wrap; line-height: 1.5;">${message}</p>
        <p style="margin-top: 16px;">View in DB: <code>contact_messages #${data.id}</code></p>
      </div>`;
    void sendEmail({
      to: opsTo,
      subject,
      html,
      replyTo: email ?? undefined,
      tags: [
        { name: "type", value: "contact_form" },
        { name: "source", value: source },
      ],
    }).catch((e) => {
      // eslint-disable-next-line no-console
      console.error("[contact] sendEmail failed:", e);
    });
  }

  return NextResponse.json({
    ok: true,
    id: data.id,
    brand: BRAND.name,
  });
}
