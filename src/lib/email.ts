// /lib/email.ts
//
// Phase 18: transactional email pipeline.
//
// Single source of truth for sending any email from the BanglaSource
// backend. Currently supports Resend (https://resend.com) as the
// provider; falls back to console-log in dev when RESEND_API_KEY is
// not configured.
//
//   import { sendEmail } from "@/lib/email";
//   await sendEmail({ to: "buyer@example.com", subject: "Order BS-000123",
//                    html: "<p>...</p>", text: "..." });
//
// Design choices:
//   • Non-throwing: sendEmail returns a result envelope, never throws.
//     Callers can log failures to the in-app notifications log without
//     breaking the user-facing flow.
//   • Single retry with 2-second backoff for transient network errors.
//   • Plain text fallback always computed from html via a simple tag
//     stripper (no extra deps). If the html is null/empty, the text
//     field is required.
//   • In dev (NODE_ENV !== "production"), no API call is made — the
//     payload is logged to stdout instead, so the dev log shows every
//     "would-send" email. Production sends to Resend.
//
// Required env (in .env.local):
//   • RESEND_API_KEY    — re_xxx (https://resend.com/api-keys)
//   • EMAIL_FROM        — "BanglaSource <orders@banglasource.com>"
//   • EMAIL_REPLY_TO    — "support@banglasource.com" (optional)
//
// Resend is the recommended transactional email API for Next.js apps
// in 2026: free tier (3k emails/mo, 100/day), React Email templates
// supported, deliverability solid. If/when we need a different
// provider (Postmark, SES, etc.) we swap the implementation here —
// the rest of the app calls sendEmail with the same shape.

export type EmailPayload = {
  to: string | string[];
  subject: string;
  html?: string;
  text?: string;
  replyTo?: string;
  tags?: { name: string; value: string }[];
};

export type EmailResult =
  | { ok: true; provider: "resend" | "console"; id?: string; to: string[] }
  | { ok: false; error: string; to: string[]; provider: "resend" | "console" };

const FROM = process.env.EMAIL_FROM ?? "BanglaSource <noreply@banglasource.com>";
const REPLY_TO = process.env.EMAIL_REPLY_TO;
const RESEND_KEY = process.env.RESEND_API_KEY;
const IS_PROD = process.env.NODE_ENV === "production";

/**
 * Send a transactional email. Returns a result envelope; never throws.
 * In dev (no RESEND_API_KEY or NODE_ENV !== "production"), the payload
 * is logged to stdout and the function returns { ok: true, provider: "console" }.
 */
export async function sendEmail(payload: EmailPayload): Promise<EmailResult> {
  const to = Array.isArray(payload.to) ? payload.to : [payload.to];

  // Validate
  if (to.length === 0) {
    return { ok: false, error: "no_recipient", to, provider: "resend" };
  }
  for (const addr of to) {
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(addr)) {
      return { ok: false, error: `bad_email:${addr}`, to, provider: "resend" };
    }
  }
  if (!payload.subject || payload.subject.length > 200) {
    return { ok: false, error: "bad_subject", to, provider: "resend" };
  }
  const html = payload.html ?? "";
  const text =
    payload.text ?? (html ? htmlToText(html) : "");
  if (!html && !text) {
    return { ok: false, error: "no_body", to, provider: "resend" };
  }

  // Dev path — log instead of sending
  if (!IS_PROD || !RESEND_KEY) {
    // eslint-disable-next-line no-console
    console.log(
      `[email] would-send from=${FROM} to=${to.join(",")} subject="${payload.subject}"`,
    );
    return { ok: true, provider: "console", to };
  }

  // Prod path — Resend
  const body: Record<string, unknown> = {
    from: FROM,
    to,
    subject: payload.subject,
    html,
    text,
  };
  if (payload.replyTo ?? REPLY_TO) {
    body.reply_to = payload.replyTo ?? REPLY_TO;
  }
  if (payload.tags && payload.tags.length > 0) {
    body.tags = payload.tags;
  }

  // Single retry on transient failures
  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      const res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${RESEND_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      });
      if (res.ok) {
        const j = (await res.json()) as { id?: string };
        return { ok: true, provider: "resend", id: j.id, to };
      }
      const errText = await res.text().catch(() => `HTTP ${res.status}`);
      // 4xx other than 429 → don't retry (bad request, auth, etc.)
      if (res.status >= 400 && res.status < 500 && res.status !== 429) {
        return { ok: false, error: `resend_${res.status}:${errText.slice(0, 200)}`, to, provider: "resend" };
      }
      if (attempt === 1) {
        await sleep(2000);
        continue;
      }
      return { ok: false, error: `resend_${res.status}:${errText.slice(0, 200)}`, to, provider: "resend" };
    } catch (err) {
      if (attempt === 1) {
        await sleep(2000);
        continue;
      }
      return {
        ok: false,
        error: `network:${err instanceof Error ? err.message : String(err)}`,
        to,
        provider: "resend",
      };
    }
  }
  return { ok: false, error: "unreachable", to, provider: "resend" };
}

// ─── helpers ───────────────────────────────────────────────────

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

/**
 * Strip HTML to plain text. Naive but sufficient for the simple
 * emails we send (no tables, no nested divs). Strips tags, decodes
 * the most common entities, and squashes consecutive whitespace.
 */
function htmlToText(html: string): string {
  return html
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, " ")
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, " ")
    .replace(/<br\s*\/?>(?=)/gi, "\n")
    .replace(/<\/(p|div|h[1-6]|li)>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

// ─── High-level fan-out helpers ─────────────────────────────────
//
// These load context (buyer, product, order) and call sendEmail
// with a rendered template. Each returns a Promise<EmailResult>;
// callers don't need to wait for the result — fire-and-forget is
// fine. We still .catch() to avoid unhandled rejections.

import "server-only";
import { getServiceRoleClient } from "./supabase/server";
import { fmtBdt } from "./pricing";
import { FX_CNY_BDT } from "./pricing";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://banglasource.com";

/**
 * Phase 20: email sent the moment a buyer signs up. Called
 * from /api/auth/welcome (the Supabase DB webhook target on
 * auth.users INSERT). We use a webhook because signup itself
 * happens client-side via `supabase.auth.signUp` — there's no
 * server route we can intercept.
 *
 * The email introduces BanglaSource + gives the buyer the
 * 4 most-useful entry points: browse the catalog, save
 * addresses (Phase 19), check shipping rates, and place a
 * saved-orders quote.
 */
export async function notifyWelcome(userId: string): Promise<EmailResult> {
  const sb = getServiceRoleClient();
  // The buyer may not have a `profiles` row yet at this point
  // (the trigger that creates it fires on auth.users INSERT,
  // but there's a race — webhook may arrive first). If profiles
  // is missing, fall back to fetching email from auth.users.
  const { data: profile } = await sb
    .from("profiles")
    .select("email, full_name")
    .eq("id", userId)
    .maybeSingle();
  let email = profile?.email as string | undefined;
  let fullName = profile?.full_name as string | undefined;
  if (!email) {
    // Service-role can read auth.users
    const { data: authUser } = await sb.auth.admin.getUserById(userId);
    email = authUser?.user?.email ?? undefined;
  }
  if (!email) {
    return { ok: false, error: "buyer_no_email", to: [], provider: "resend" };
  }
  const greet = fullName ? `Hi ${fullName},` : "Hi,";

  const subject = "Welcome to BanglaSource — your wholesale import shortcut";
  const html = `
    <div style="font-family: -apple-system, system-ui, sans-serif; max-width: 560px; margin: 0 auto; color: #0f172a;">
      <h1 style="font-size: 22px; margin-bottom: 4px;">${greet}</h1>
      <p>Welcome to BanglaSource — hand-picked wholesale from Chinese factories (Pinduoduo, Taobao, and other trending China sources), with landed cost all the way to your Dhaka door.</p>

      <p style="margin-top: 20px;"><strong>Here's the playbook for your first 10 minutes:</strong></p>
      <ol style="padding-left: 20px; line-height: 1.7;">
        <li><a href="${SITE_URL}" style="color: #0891b2;">Browse the catalog</a> — 168 verified factories, 7 categories, tier pricing on every product.</li>
        <li><a href="${SITE_URL}/shipping-rates" style="color: #0891b2;">Check shipping rates</a> — air, sea, and the full BD customs breakdown.</li>
        <li>Add a few items to cart, then <strong>save a quote</strong> to share with your business partner before paying.</li>
        <li>When you're ready, place the order — we confirm the landed cost by email within an hour.</li>
      </ol>

      <p style="margin-top: 20px;">A few small things that are easy to miss:</p>
      <ul style="padding-left: 20px; line-height: 1.7;">
        <li>Save your shipping address once at <a href="${SITE_URL}/buyer/addresses" style="color: #0891b2;">/buyer/addresses</a> — every order pre-fills from it.</li>
        <li>Minimum order weight is 5 kg total (most wholesale orders clear this naturally).</li>
        <li>Pre-pay 100% of the landed cost at order confirm — no balance on delivery, no surprises.</li>
      </ul>

      <p>Questions? Reply to this email or hit us on WhatsApp: +86 173 2576 4171.</p>

      <p style="color: #94a3b8; font-size: 12px; margin-top: 32px;">BanglaSource · Wholesale from China to Bangladesh</p>
    </div>`;
  return sendEmail({
    to: email,
    subject,
    html,
    tags: [
      { name: "type", value: "welcome" },
      { name: "user", value: userId },
    ],
  });
}

/**
 * Phase 20: newsletter double opt-in. Called from
 * /api/newsletter/subscribe (when a visitor pastes their email
 * into the footer signup). Sends a confirmation email with a
 * one-click link. The link hits /api/newsletter/confirm which
 * flips `confirmed_at` on the row.
 *
 * Tokens are 32-char hex (16 bytes from gen_random_bytes), so
 * the 2^128 keyspace makes brute-forcing uninteresting.
 */
export async function notifyNewsletterConfirm(
  email: string,
  confirmToken: string,
): Promise<EmailResult> {
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return { ok: false, error: `bad_email:${email}`, to: [email], provider: "resend" };
  }
  const confirmHref = `${SITE_URL}/api/newsletter/confirm?token=${encodeURIComponent(confirmToken)}`;

  const subject = "Confirm your BanglaSource newsletter subscription";
  const html = `
    <div style="font-family: -apple-system, system-ui, sans-serif; max-width: 560px; margin: 0 auto; color: #0f172a;">
      <h1 style="font-size: 22px; margin-bottom: 4px;">Almost there.</h1>
      <p>Thanks for signing up for the BanglaSource newsletter. One click to confirm — and we'll send you:</p>
      <ul style="padding-left: 20px; line-height: 1.7;">
        <li>New arrivals (2-3 per week, no spam)</li>
        <li>Price drops on products you're watching</li>
        <li>Bulk-deal alerts when factories run limited-time offers</li>
        <li>Monthly landed-cost snapshots (FX, BD customs, shipping)</li>
      </ul>
      <p style="margin: 28px 0;">
        <a href="${confirmHref}" style="display: inline-block; background: #0891b2; color: white; padding: 12px 24px; border-radius: 6px; text-decoration: none; font-weight: 600;">
          Confirm subscription
        </a>
      </p>
      <p style="color: #64748b; font-size: 13px;">If the button doesn't work, paste this link into your browser:<br>
        <span style="word-break: break-all;">${confirmHref}</span>
      </p>
      <p style="color: #94a3b8; font-size: 12px; margin-top: 32px;">You can unsubscribe anytime via the link in any email we send. BanglaSource</p>
    </div>`;
  return sendEmail({
    to: email,
    subject,
    html,
    tags: [
      { name: "type", value: "newsletter_confirm" },
    ],
  });
}

/**
 * Email sent the moment a buyer places an order. Tells them:
 *   - their order number
 *   - the total to wire (Phase 13: 100% of landed cost)
 *   - payment methods (bKash, bank, USDT)
 *   - what happens next
 */
export async function notifyOrderPlaced(orderId: number): Promise<EmailResult> {
  const sb = getServiceRoleClient();
  const { data: order } = await sb
    .from("orders")
    .select("id, user_id, payment_method, total_bdt, address_snapshot, created_at")
    .eq("id", orderId)
    .maybeSingle();
  if (!order) {
    return { ok: false, error: "order_not_found", to: [], provider: "resend" };
  }
  const { data: profile } = await sb
    .from("profiles")
    .select("email, full_name")
    .eq("id", order.user_id)
    .maybeSingle();
  if (!profile?.email) {
    return { ok: false, error: "buyer_no_email", to: [], provider: "resend" };
  }

  const num = `BS-${String(orderId).padStart(6, "0")}`;
  const paymentMethod = (order.payment_method as string) ?? "bkash";
  const addr = (order.address_snapshot as any) ?? {};
  const greet = profile.full_name ? `Hi ${profile.full_name},` : "Hi,";

  const subject = `Order ${num} received — ${fmtBdt(Number(order.total_bdt))} to pay`;
  const html = `
    <div style="font-family: -apple-system, system-ui, sans-serif; max-width: 560px; margin: 0 auto; color: #0f172a;">
      <h1 style="font-size: 22px; margin-bottom: 4px;">${greet}</h1>
      <p style="color: #475569; margin-top: 0;">Your order <strong>${num}</strong> is in. Here's everything you need.</p>

      <div style="background: #f1f5f9; border: 1px solid #e2e8f0; border-radius: 8px; padding: 16px; margin: 20px 0;">
        <p style="margin: 0 0 4px; color: #64748b; font-size: 12px; text-transform: uppercase; letter-spacing: 0.05em;">Total to wire</p>
        <p style="margin: 0; font-size: 28px; font-weight: 600;">${fmtBdt(Number(order.total_bdt))}</p>
      </div>

      <p><strong>Payment method:</strong> ${paymentMethod.toUpperCase()}</p>
      <p>Wire the total to the matching account. Once your payment lands, we move the order to "Paid" and start packing.</p>

      <table style="width: 100%; border-collapse: collapse; margin: 16px 0; font-size: 14px;">
        <tr style="border-bottom: 1px solid #e2e8f0;">
          <td style="padding: 8px 0; color: #64748b;">bKash (personal)</td>
          <td style="padding: 8px 0; text-align: right; font-family: ui-monospace, monospace;">01732 576 4171</td>
        </tr>
        <tr style="border-bottom: 1px solid #e2e8f0;">
          <td style="padding: 8px 0; color: #64748b;">Bank (DBBL)</td>
          <td style="padding: 8px 0; text-align: right; font-family: ui-monospace, monospace;">on request via WhatsApp</td>
        </tr>
        <tr>
          <td style="padding: 8px 0; color: #64748b;">USDT (TRC20)</td>
          <td style="padding: 8px 0; text-align: right; font-family: ui-monospace, monospace;">on request via WhatsApp</td>
        </tr>
      </table>

      <p style="color: #64748b; font-size: 13px;">Shipping to: ${addr.full_name ?? ""}, ${addr.address_line ?? ""}, ${addr.district ?? ""}.</p>

      <p>Track the order anytime:<br>
        <a href="${SITE_URL}/orders/${orderId}" style="color: #0891b2;">${SITE_URL}/orders/${orderId}</a>
      </p>

      <p style="color: #94a3b8; font-size: 12px; margin-top: 32px;">
        BanglaSource · Wholesale from China to Bangladesh
      </p>
    </div>`;
  return sendEmail({
    to: profile.email,
    subject,
    html,
    tags: [
      { name: "type", value: "order_placed" },
      { name: "order", value: num },
    ],
  });
}

/**
 * Email sent the moment an order flips to 'paid' (either by the
 * buyer self-marking or by the admin via the orders PATCH API).
 */
export async function notifyOrderPaid(orderId: number): Promise<EmailResult> {
  const sb = getServiceRoleClient();
  const { data: order } = await sb
    .from("orders")
    .select("id, user_id, total_bdt, payment_method")
    .eq("id", orderId)
    .maybeSingle();
  if (!order) {
    return { ok: false, error: "order_not_found", to: [], provider: "resend" };
  }
  const { data: profile } = await sb
    .from("profiles")
    .select("email, full_name")
    .eq("id", order.user_id)
    .maybeSingle();
  if (!profile?.email) {
    return { ok: false, error: "buyer_no_email", to: [], provider: "resend" };
  }
  const num = `BS-${String(orderId).padStart(6, "0")}`;
  const greet = profile.full_name ? `Hi ${profile.full_name},` : "Hi,";
  const subject = `Order ${num} — payment received, processing now`;
  const html = `
    <div style="font-family: -apple-system, system-ui, sans-serif; max-width: 560px; margin: 0 auto; color: #0f172a;">
      <h1 style="font-size: 22px; margin-bottom: 4px;">${greet}</h1>
      <p>We've confirmed your <strong>${fmtBdt(Number(order.total_bdt))}</strong> payment for order <strong>${num}</strong>. Your order is now in our processing queue.</p>
      <p>Next step: we hand the line items to the supplier for packing. You'll get a tracking number as soon as it ships (typically 3-7 days for air, 30-45 for sea LCL).</p>
      <p>Track: <a href="${SITE_URL}/orders/${orderId}" style="color: #0891b2;">${SITE_URL}/orders/${orderId}</a></p>
      <p style="color: #94a3b8; font-size: 12px; margin-top: 32px;">BanglaSource</p>
    </div>`;
  return sendEmail({
    to: profile.email,
    subject,
    html,
    tags: [
      { name: "type", value: "order_paid" },
      { name: "order", value: num },
    ],
  });
}

/**
 * Email sent when admin flips an order to a buyer-visible state
 * (in_transit, delivered). We skip the admin-only transitions
 * (cancelled → silent because admin should call the buyer;
 * the status themselves).
 */
export async function notifyOrderStatusChange(
  orderId: number,
  newStatus: "in_transit" | "delivered",
  trackingNumber: string | null,
): Promise<EmailResult> {
  const visibleStatuses = new Set(["in_transit", "delivered"]);
  if (!visibleStatuses.has(newStatus)) {
    return { ok: true, provider: "console", to: [] };
  }
  const sb = getServiceRoleClient();
  const { data: order } = await sb
    .from("orders")
    .select("id, user_id, shipping_mode")
    .eq("id", orderId)
    .maybeSingle();
  if (!order) {
    return { ok: false, error: "order_not_found", to: [], provider: "resend" };
  }
  const { data: profile } = await sb
    .from("profiles")
    .select("email, full_name")
    .eq("id", order.user_id)
    .maybeSingle();
  if (!profile?.email) {
    return { ok: false, error: "buyer_no_email", to: [], provider: "resend" };
  }
  const num = `BS-${String(orderId).padStart(6, "0")}`;
  const greet = profile.full_name ? `Hi ${profile.full_name},` : "Hi,";
  const mode = order.shipping_mode === "air" ? "air freight" : "sea LCL";

  let subject: string;
  let body: string;
  if (newStatus === "in_transit") {
    subject = `Order ${num} — in transit (${mode})`;
    body = trackingNumber
      ? `Your order <strong>${num}</strong> has shipped. <strong>Tracking:</strong> <span style="font-family: ui-monospace, monospace;">${trackingNumber}</span>`
      : `Your order <strong>${num}</strong> has shipped via ${mode}. We'll add the tracking number as soon as the courier provides it.`;
  } else {
    subject = `Order ${num} — delivered`;
    body = `Your order <strong>${num}</strong> was delivered. Hope it sells well! Hit us on WhatsApp if anything arrived damaged or short.`;
  }

  const html = `
    <div style="font-family: -apple-system, system-ui, sans-serif; max-width: 560px; margin: 0 auto; color: #0f172a;">
      <h1 style="font-size: 22px; margin-bottom: 4px;">${greet}</h1>
      <p>${body}</p>
      <p>View: <a href="${SITE_URL}/orders/${orderId}" style="color: #0891b2;">${SITE_URL}/orders/${orderId}</a></p>
      <p style="color: #94a3b8; font-size: 12px; margin-top: 32px;">BanglaSource</p>
    </div>`;
  return sendEmail({
    to: profile.email,
    subject,
    html,
    tags: [
      { name: "type", value: `order_${newStatus}` },
      { name: "order", value: num },
    ],
  });
}

/**
 * Email sent when a price alert fires (>15% move on a product the
 * user is watching). One email per alert, going only to users
 * with a verified email who have the product in their watchlist.
 */
export async function notifyPriceAlert(
  alertId: number,
): Promise<EmailResult[]> {
  const sb = getServiceRoleClient();
  const { data: alert } = await sb
    .from("price_alert_log")
    .select("id, source_id, product_id, direction, change_pct, old_price_cny_fen, new_price_cny_fen")
    .eq("id", alertId)
    .maybeSingle();
  if (!alert) return [{ ok: false, error: "alert_not_found", to: [], provider: "resend" }];

  const { data: product } = await sb
    .from("products")
    .select("title_en, title_zh, images, factory_moq, supplier_name")
    .eq("source_id", alert.source_id)
    .maybeSingle();

  // Find watchlist users for this product. watchlist stores
  // product_id (bigint FK), not source_id, so we look up by
  // product_id. If the alert row is missing product_id (legacy
  // pre-Phase 8 row), resolve via source_id.
  let productId = alert.product_id as number | null;
  if (productId == null) {
    const { data: p } = await sb
      .from("products")
      .select("id")
      .eq("source_id", alert.source_id)
      .maybeSingle();
    productId = (p?.id as number) ?? null;
  }
  if (productId == null) {
    return [{ ok: false, error: "no_product_id", to: [], provider: "resend" }];
  }
  const { data: watch } = await sb
    .from("watchlist")
    .select("user_id, notify_on_drop")
    .eq("product_id", productId)
    .eq("notify_on_drop", true);
  if (!watch || watch.length === 0) {
    return [{ ok: true, provider: "console", to: [] }];
  }
  const userIds = watch.map((w) => w.user_id);
  const { data: profiles } = await sb
    .from("profiles")
    .select("id, email, full_name")
    .in("id", userIds);
  if (!profiles || profiles.length === 0) {
    return [{ ok: true, provider: "console", to: [] }];
  }

  const dir = alert.direction === "rise" ? "increased" : "dropped";
  const pct = Math.abs(Number(alert.change_pct)).toFixed(1);
  const productTitle =
    (product?.title_en as string) ?? (product?.title_zh as string) ?? alert.source_id;
  const oldCny = (Number(alert.old_price_cny_fen) / 100).toFixed(2);
  const newCny = (Number(alert.new_price_cny_fen) / 100).toFixed(2);
  const oldBdt = (Number(alert.old_price_cny_fen) / 100 * FX_CNY_BDT).toLocaleString("en-IN");
  const newBdt = (Number(alert.new_price_cny_fen) / 100 * FX_CNY_BDT).toLocaleString("en-IN");
  const productHref = `${SITE_URL}/products/${alert.source_id}`;

  const subject = `Price ${dir} ${pct}% on ${productTitle}`;
  const results: EmailResult[] = [];
  for (const p of profiles) {
    if (!p.email) continue;
    const greet = p.full_name ? `Hi ${p.full_name},` : "Hi,";
    const html = `
      <div style="font-family: -apple-system, system-ui, sans-serif; max-width: 560px; margin: 0 auto; color: #0f172a;">
        <h1 style="font-size: 22px; margin-bottom: 4px;">${greet}</h1>
        <p>The price of <strong>${productTitle}</strong> just ${dir} <strong>${pct}%</strong> on the supplier.</p>
        <table style="width: 100%; border-collapse: collapse; margin: 16px 0; font-size: 14px;">
          <tr style="border-bottom: 1px solid #e2e8f0;">
            <td style="padding: 8px 0; color: #64748b;">Old (FOB ¥)</td>
            <td style="padding: 8px 0; text-align: right; font-family: ui-monospace, monospace;">¥${oldCny}</td>
          </tr>
          <tr style="border-bottom: 1px solid #e2e8f0;">
            <td style="padding: 8px 0; color: #64748b;">New (FOB ¥)</td>
            <td style="padding: 8px 0; text-align: right; font-family: ui-monospace, monospace; font-weight: 600;">¥${newCny}</td>
          </tr>
          <tr>
            <td style="padding: 8px 0; color: #64748b;">After FX (BDT)</td>
            <td style="padding: 8px 0; text-align: right; font-family: ui-monospace, monospace;">৳${oldBdt} → ৳${newBdt}</td>
          </tr>
        </table>
        <p>View: <a href="${productHref}" style="color: #0891b2;">${productHref}</a></p>
        <p style="color: #94a3b8; font-size: 12px; margin-top: 32px;">You're watching this product. BanglaSource</p>
      </div>`;
    const r = await sendEmail({
      to: p.email,
      subject,
      html,
      tags: [
        { name: "type", value: "price_alert" },
        { name: "source_id", value: alert.source_id },
      ],
    });
    results.push(r);
  }
  return results;
}

/**
 * Phase 22: RFQ — buyer-submitted. Email sent to the
 * buyer confirming we got the request, and a separate
 * alert-style email to ops so an admin can pick it up
 * fast.
 */
export async function notifyRFQReceived(rfqId: number): Promise<EmailResult[]> {
  const sb = getServiceRoleClient();
  const { data: rfq } = await sb
    .from("rfqs")
    .select("id, user_id, title, target_qty, target_price_cny_fen, destination_country, created_at")
    .eq("id", rfqId)
    .maybeSingle();
  if (!rfq) return [{ ok: false, error: "rfq_not_found", to: [], provider: "resend" }];
  const { data: profile } = await sb
    .from("profiles")
    .select("email, full_name")
    .eq("id", rfq.user_id)
    .maybeSingle();
  if (!profile?.email) {
    return [{ ok: false, error: "buyer_no_email", to: [], provider: "resend" }];
  }
  const num = `RFQ-${String(rfqId).padStart(6, "0")}`;
  const greet = profile.full_name ? `Hi ${profile.full_name},` : "Hi,";
  const targetCny = rfq.target_price_cny_fen
    ? `¥${(Number(rfq.target_price_cny_fen) / 100).toFixed(2)} / unit`
    : "no target price";

  const results: EmailResult[] = [];

  // 1. To the buyer — receipt confirmation
  const buyerSubject = `RFQ ${num} received — we'll get back to you in 48h`;
  const buyerHtml = `
    <div style="font-family: -apple-system, system-ui, sans-serif; max-width: 560px; margin: 0 auto; color: #0f172a;">
      <h1 style="font-size: 22px; margin-bottom: 4px;">${greet}</h1>
      <p>We got your custom Request-for-Quote <strong>${num}</strong>. We're forwarding the spec to 3-5 verified factories and will send you sealed bids within 48 hours.</p>

      <div style="background: #f1f5f9; border: 1px solid #e2e8f0; border-radius: 8px; padding: 16px; margin: 20px 0;">
        <p style="margin: 0 0 4px; color: #64748b; font-size: 12px; text-transform: uppercase; letter-spacing: 0.05em;">Your spec</p>
        <p style="margin: 0 0 8px; font-size: 16px; font-weight: 600;">${rfq.title}</p>
        <p style="margin: 0; color: #475569; font-size: 13px;">Target: ${rfq.target_qty.toLocaleString()} units @ ${targetCny}</p>
        <p style="margin: 0; color: #475569; font-size: 13px;">Ships to: ${rfq.destination_country}</p>
      </div>

      <p>Track anytime:<br>
        <a href="${SITE_URL}/buyer/rfqs/${rfqId}" style="color: #0891b2;">${SITE_URL}/buyer/rfqs/${rfqId}</a>
      </p>

      <p style="color: #64748b; font-size: 13px;">While you wait, you can browse the catalog for in-stock alternatives. If a factory has something close, we'll include it in the bid round.</p>

      <p style="color: #94a3b8; font-size: 12px; margin-top: 32px;">BanglaSource · Custom sourcing</p>
    </div>`;
  results.push(
    await sendEmail({
      to: profile.email,
      subject: buyerSubject,
      html: buyerHtml,
      tags: [
        { name: "type", value: "rfq_received" },
        { name: "rfq", value: num },
      ],
    }),
  );

  // 2. To ops — alert that a new RFQ needs pickup. We don't
  // have a separate "ops email" yet; send to a designated
  // OPS_EMAIL env var, defaulting to support@banglasource.com.
  const opsTo = process.env.OPS_EMAIL ?? "support@banglasource.com";
  const opsSubject = `New RFQ ${num} — ${rfq.target_qty.toLocaleString()} units — needs pickup`;
  const opsHtml = `
    <div style="font-family: -apple-system, system-ui, sans-serif; max-width: 560px; margin: 0 auto; color: #0f172a;">
      <h1 style="font-size: 18px; margin-bottom: 4px;">New RFQ pickup</h1>
      <p><strong>${rfq.title}</strong> from ${profile.full_name ?? profile.email}</p>
      <p>Target: ${rfq.target_qty.toLocaleString()} units @ ${targetCny} → ${rfq.destination_country}</p>
      <p>Buyer email: <a href="mailto:${profile.email}" style="color: #0891b2;">${profile.email}</a></p>
      <p>View + reply: <a href="${SITE_URL}/admin/rfqs/${rfqId}" style="color: #0891b2;">${SITE_URL}/admin/rfqs/${rfqId}</a></p>
    </div>`;
  results.push(
    await sendEmail({
      to: opsTo,
      subject: opsSubject,
      html: opsHtml,
      replyTo: profile.email,
      tags: [
        { name: "type", value: "rfq_ops_alert" },
        { name: "rfq", value: num },
      ],
    }),
  );

  return results;
}

/**
 * Phase 22: RFQ — admin sent a quote. Email the buyer with
 * the price + MOQ + lead time. Includes a clear "accept"
 * CTA pointing at /buyer/rfqs/[id] where they can flip the
 * RFQ to accepted and start the order.
 */
export async function notifyRFQQuoted(rfqId: number): Promise<EmailResult> {
  const sb = getServiceRoleClient();
  const { data: rfq } = await sb
    .from("rfqs")
    .select("id, user_id, title, quoted_price_cny_fen, quoted_min_qty, quoted_lead_days, quoted_notes")
    .eq("id", rfqId)
    .maybeSingle();
  if (!rfq) {
    return { ok: false, error: "rfq_not_found", to: [], provider: "resend" };
  }
  const { data: profile } = await sb
    .from("profiles")
    .select("email, full_name")
    .eq("id", rfq.user_id)
    .maybeSingle();
  if (!profile?.email) {
    return { ok: false, error: "buyer_no_email", to: [], provider: "resend" };
  }
  const num = `RFQ-${String(rfqId).padStart(6, "0")}`;
  const greet = profile.full_name ? `Hi ${profile.full_name},` : "Hi,";

  const priceCny = rfq.quoted_price_cny_fen
    ? (Number(rfq.quoted_price_cny_fen) / 100).toFixed(2)
    : "—";
  const minQty = rfq.quoted_min_qty?.toLocaleString() ?? "—";
  const lead = rfq.quoted_lead_days ?? "—";

  const subject = `RFQ ${num} — your factory quote is in`;
  const html = `
    <div style="font-family: -apple-system, system-ui, sans-serif; max-width: 560px; margin: 0 auto; color: #0f172a;">
      <h1 style="font-size: 22px; margin-bottom: 4px;">${greet}</h1>
      <p>We've got a quote back from the factory for your <strong>${rfq.title}</strong> request. Here are the numbers:</p>

      <div style="background: #f1f5f9; border: 1px solid #e2e8f0; border-radius: 8px; padding: 16px; margin: 20px 0;">
        <table style="width: 100%; border-collapse: collapse; font-size: 14px;">
          <tr style="border-bottom: 1px solid #e2e8f0;">
            <td style="padding: 8px 0; color: #64748b;">FOB per unit (CNY)</td>
            <td style="padding: 8px 0; text-align: right; font-family: ui-monospace, monospace; font-weight: 600;">¥${priceCny}</td>
          </tr>
          <tr style="border-bottom: 1px solid #e2e8f0;">
            <td style="padding: 8px 0; color: #64748b;">Minimum order qty</td>
            <td style="padding: 8px 0; text-align: right; font-family: ui-monospace, monospace; font-weight: 600;">${minQty}</td>
          </tr>
          <tr>
            <td style="padding: 8px 0; color: #64748b;">Lead time (days)</td>
            <td style="padding: 8px 0; text-align: right; font-family: ui-monospace, monospace; font-weight: 600;">${lead}</td>
          </tr>
        </table>
      </div>

      ${rfq.quoted_notes
        ? `<p><strong>Notes from our side:</strong><br>${rfq.quoted_notes}</p>`
        : ""}

      <p style="margin: 24px 0;">
        <a href="${SITE_URL}/buyer/rfqs/${rfqId}" style="display: inline-block; background: #0891b2; color: white; padding: 12px 24px; border-radius: 6px; text-decoration: none; font-weight: 600;">
          View and accept
        </a>
      </p>

      <p style="color: #64748b; font-size: 13px;">Quote is valid for 7 days. After that, factory prices may shift — let us know if you need an extension.</p>

      <p style="color: #94a3b8; font-size: 12px; margin-top: 32px;">BanglaSource · Custom sourcing</p>
    </div>`;
  return sendEmail({
    to: profile.email,
    subject,
    html,
    tags: [
      { name: "type", value: "rfq_quoted" },
      { name: "rfq", value: num },
    ],
  });
}
/* ============================================================================
   Phase 38 — Group buy fan-outs

   Two helpers used by /api/group-buys/[id]/join (notifyGroupBuyJoined)
   and /api/group-buys/[id]/cancel-membership (notifyGroupBuyMembershipCancelled).

   These are the buyer-side notifications for the group-buy flow. The
   formation / expiry / cancellation fan-outs (Phase 40) will add 3 more
   helpers at that time. Bodies are deliberately minimal for now; the
   richer content (target progress bar, "you saved ৳X" copy, etc.) lands
   in Phase 42 polish once we have real production data on what works.

   The call sites use `void import("@/lib/email").then(...)` so a slow or
   failed email never blocks the API response.
   =========================================================================== */

/**
 * notifyGroupBuyJoined — fires after a buyer commits a qty to an
 * open group_buy. Tells them:
 *   - what they committed (qty)
 *   - the price they SAW (unit_bdt_at_commit)
 *   - the deadline
 *   - where the group currently stands (current_qty / target_qty)
 *
 * Future enhancement (Phase 42): include a progress bar image +
 * share button ("tell a friend to join and unlock a lower price").
 */
export async function notifyGroupBuyJoined(
  memberId: string,
): Promise<EmailResult> {
  const sb = getServiceRoleClient();
  const { data: member } = await sb
    .from("group_buy_members")
    .select(
      "id, group_buy_id, user_id, qty, unit_bdt_at_commit, created_at, group_buys(target_qty, deadline_at, status, products(title_en))",
    )
    .eq("id", memberId)
    .maybeSingle();
  if (!member) {
    return { ok: false, error: "member_not_found", to: [], provider: "resend" };
  }
  const gb = (member as unknown as {
    group_buys: {
      target_qty: number;
      deadline_at: string;
      status: string;
      products: { title_en: string | null } | null;
    } | null;
  }).group_buys;
  if (!gb) {
    return { ok: false, error: "group_buy_not_found", to: [], provider: "resend" };
  }

  const { data: profile } = await sb
    .from("profiles")
    .select("email, full_name")
    .eq("id", member.user_id)
    .maybeSingle();
  if (!profile?.email) {
    return { ok: false, error: "buyer_no_email", to: [], provider: "resend" };
  }

  // Compute current SUM so the buyer sees their contribution in context.
  const { data: sumRows } = await sb
    .from("group_buy_members")
    .select("qty")
    .eq("group_buy_id", member.group_buy_id);
  const currentQty = (sumRows ?? []).reduce((s, m) => s + (m.qty ?? 0), 0);
  const remaining = Math.max(0, gb.target_qty - currentQty);

  const greet = profile.full_name ? `Hi ${profile.full_name},` : "Hi,";
  const productTitle = gb.products?.title_en ?? "your selected product";
  const deadlineStr = new Date(gb.deadline_at).toLocaleString("en-GB", {
    dateStyle: "medium",
    timeStyle: "short",
  });

  const subject = `You're in: ${member.qty} pcs committed at ৳${member.unit_bdt_at_commit}/pc`;
  const html = `
    <div style="font-family: -apple-system, system-ui, sans-serif; max-width: 560px; margin: 0 auto; color: #0f172a;">
      <h1 style="font-size: 22px; margin-bottom: 4px;">${greet}</h1>
      <p>You've committed <strong>${member.qty} pcs</strong> of <strong>${productTitle}</strong> to the group buy.</p>

      <div style="background: #f1f5f9; border: 1px solid #e2e8f0; border-radius: 8px; padding: 16px; margin: 20px 0;">
        <table style="width: 100%; border-collapse: collapse; font-size: 14px;">
          <tr style="border-bottom: 1px solid #e2e8f0;">
            <td style="padding: 8px 0; color: #64748b;">Your committed qty</td>
            <td style="padding: 8px 0; text-align: right; font-family: ui-monospace, monospace; font-weight: 600;">${member.qty} pcs</td>
          </tr>
          <tr style="border-bottom: 1px solid #e2e8f0;">
            <td style="padding: 8px 0; color: #64748b;">Price you're committed at</td>
            <td style="padding: 8px 0; text-align: right; font-family: ui-monospace, monospace; font-weight: 600;">৳${member.unit_bdt_at_commit}/pc</td>
          </tr>
          <tr style="border-bottom: 1px solid #e2e8f0;">
            <td style="padding: 8px 0; color: #64748b;">Group progress</td>
            <td style="padding: 8px 0; text-align: right; font-family: ui-monospace, monospace; font-weight: 600;">${currentQty.toLocaleString()} / ${gb.target_qty.toLocaleString()} pcs</td>
          </tr>
          <tr>
            <td style="padding: 8px 0; color: #64748b;">Deadline</td>
            <td style="padding: 8px 0; text-align: right; font-family: ui-monospace, monospace; font-weight: 600;">${deadlineStr}</td>
          </tr>
        </table>
      </div>

      <p>${
        remaining > 0
          ? `The group needs <strong>${remaining.toLocaleString()} more pcs</strong> by the deadline to form. If more buyers join, your per-piece price may drop further (you'll be charged the final tiered price when the group forms — not the price shown above).`
          : `The group has hit its target. We're charging members now — you'll get a separate email when your order is ready to pay.`
      }</p>

      <p style="margin: 24px 0;">
        <a href="${SITE_URL}/group-buys/${member.group_buy_id}" style="display: inline-block; background: #0891b2; color: white; padding: 12px 24px; border-radius: 6px; text-decoration: none; font-weight: 600;">
          View group progress
        </a>
      </p>

      <p style="color: #94a3b8; font-size: 12px; margin-top: 32px;">BanglaSource · Group buys</p>
    </div>`;
  return sendEmail({
    to: profile.email,
    subject,
    html,
    tags: [
      { name: "type", value: "group_buy_joined" },
      { name: "group_buy", value: String(member.group_buy_id).slice(0, 8) },
    ],
  });
}

/**
 * notifyGroupBuyMembershipCancelled — fires after a buyer cancels
 * their own commitment to a group_buy. Confirms the cancellation
 * and reminds them of the group's deadline (in case they want to
 * re-join).
 */
export async function notifyGroupBuyMembershipCancelled(
  groupBuyId: string,
  userId: string,
): Promise<EmailResult> {
  const sb = getServiceRoleClient();
  const [{ data: profile }, { data: gb }] = await Promise.all([
    sb
      .from("profiles")
      .select("email, full_name")
      .eq("id", userId)
      .maybeSingle(),
    sb
      .from("group_buys")
      .select("id, deadline_at, status, products(title_en)")
      .eq("id", groupBuyId)
      .maybeSingle(),
  ]);
  if (!profile?.email) {
    return { ok: false, error: "buyer_no_email", to: [], provider: "resend" };
  }
  if (!gb) {
    return { ok: false, error: "group_buy_not_found", to: [], provider: "resend" };
  }

  const greet = profile.full_name ? `Hi ${profile.full_name},` : "Hi,";
  const productTitle =
    (gb as unknown as { products: { title_en: string | null } | null })
      .products?.title_en ?? "your selected product";
  const deadlineStr = new Date(gb.deadline_at).toLocaleString("en-GB", {
    dateStyle: "medium",
    timeStyle: "short",
  });

  const subject = `Group buy cancellation confirmed`;
  const html = `
    <div style="font-family: -apple-system, system-ui, sans-serif; max-width: 560px; margin: 0 auto; color: #0f172a;">
      <h1 style="font-size: 22px; margin-bottom: 4px;">${greet}</h1>
      <p>Your commitment to the <strong>${productTitle}</strong> group buy has been cancelled. No charge has been made.</p>

      ${
        gb.status === "open"
          ? `<p>The group is still open until <strong>${deadlineStr}</strong>. You can re-join any time before then — just head back to the group page.</p>
             <p style="margin: 24px 0;">
               <a href="${SITE_URL}/group-buys/${groupBuyId}" style="display: inline-block; background: #0891b2; color: white; padding: 12px 24px; border-radius: 6px; text-decoration: none; font-weight: 600;">
                 View group
               </a>
             </p>`
          : `<p>The group is no longer accepting new members (status: ${gb.status}).</p>`
      }

      <p style="color: #94a3b8; font-size: 12px; margin-top: 32px;">BanglaSource · Group buys</p>
    </div>`;
  return sendEmail({
    to: profile.email,
    subject,
    html,
    tags: [
      { name: "type", value: "group_buy_membership_cancelled" },
      { name: "group_buy", value: String(groupBuyId).slice(0, 8) },
    ],
  });
}
