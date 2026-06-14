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
        <p>The price of <strong>${productTitle}</strong> just ${dir} <strong>${pct}%</strong> on 1688.</p>
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
