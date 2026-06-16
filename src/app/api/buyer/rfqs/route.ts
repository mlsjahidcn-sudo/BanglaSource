// POST /api/buyer/rfqs
//
// Phase 22: a signed-in buyer submits a Request-for-Quote
// (custom spec, private-label run, quantity the catalog
// doesn't cover). The form lives at /buyer/rfqs and is a
// thin wrapper over this endpoint.
//
// Auth: cookie-bound server client. RLS enforces user
// ownership. After insert, we fire-and-forget
// `notifyRFQReceived` to send the buyer a receipt email
// and ops an alert email. The buyer email is the more
// important one; ops can be disabled later if it gets noisy.

import { NextRequest, NextResponse } from "next/server";
import { getServerClient } from "@/lib/supabase/server";
import { rateLimit, clientKey } from "@/lib/rate-limit";

const RATE_LIMIT = 10;
const RATE_WINDOW_MS = 60_000;

type PostBody = {
  title?: string;
  spec_text?: string;
  target_qty?: number;
  target_price_cny_fen?: number | null;
  image_urls?: string[];
  destination_country?: string;
  notes?: string;
};

const IMAGE_URL_RE = /^https?:\/\/.{1,2000}$/i;

export async function POST(req: NextRequest) {
  const rl = rateLimit({
    key: `rfqs.create:${clientKey(req)}`,
    capacity: RATE_LIMIT,
    windowMs: RATE_WINDOW_MS,
  });
  if (!rl.allowed) {
    return NextResponse.json(
      { error: "rate_limited" },
      { status: 429, headers: { "Retry-After": String(Math.ceil(rl.resetIn / 1000)) } },
    );
  }

  const sb = await getServerClient();
  const {
    data: { user },
  } = await sb.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  let body: PostBody;
  try {
    body = (await req.json()) as PostBody;
  } catch {
    return NextResponse.json({ error: "bad_json" }, { status: 400 });
  }

  // Validate
  const title = (body.title ?? "").trim();
  if (title.length < 4 || title.length > 200) {
    return NextResponse.json(
      { error: "bad_title", message: "Title must be 4-200 characters." },
      { status: 400 },
    );
  }
  const specText = (body.spec_text ?? "").trim();
  if (specText.length < 10 || specText.length > 4000) {
    return NextResponse.json(
      { error: "bad_spec", message: "Spec must be 10-4000 characters." },
      { status: 400 },
    );
  }
  const targetQty = Number(body.target_qty);
  if (!Number.isInteger(targetQty) || targetQty < 1 || targetQty > 1_000_000) {
    return NextResponse.json(
      { error: "bad_qty", message: "Target quantity must be a positive integer (1-1,000,000)." },
      { status: 400 },
    );
  }
  // target_price_cny_fen is optional
  let targetPriceCnyFen: number | null = null;
  if (body.target_price_cny_fen != null) {
    const n = Number(body.target_price_cny_fen);
    if (!Number.isInteger(n) || n < 1 || n > 100_000_000) {
      return NextResponse.json(
        { error: "bad_target_price", message: "Target price must be a positive integer in CNY fen (1-100,000,000)." },
        { status: 400 },
      );
    }
    targetPriceCnyFen = n;
  }
  // image_urls optional, max 8, each must be a URL
  const imageUrls = Array.isArray(body.image_urls) ? body.image_urls : [];
  if (imageUrls.length > 8) {
    return NextResponse.json(
      { error: "bad_images", message: "Max 8 image URLs." },
      { status: 400 },
    );
  }
  for (const u of imageUrls) {
    if (typeof u !== "string" || !IMAGE_URL_RE.test(u)) {
      return NextResponse.json(
        { error: "bad_image_url", message: "Image URLs must be valid http(s) URLs." },
        { status: 400 },
      );
    }
  }
  const destinationCountry = (body.destination_country ?? "BD").trim().toUpperCase();
  if (destinationCountry.length !== 2) {
    return NextResponse.json(
      { error: "bad_country", message: "Country must be a 2-letter code." },
      { status: 400 },
    );
  }
  const notes = body.notes?.trim() || null;
  if (notes && notes.length > 4000) {
    return NextResponse.json(
      { error: "bad_notes", message: "Notes must be ≤ 4000 characters." },
      { status: 400 },
    );
  }

  const { data, error } = await sb
    .from("rfqs")
    .insert({
      user_id: user.id,
      title,
      spec_text: specText,
      target_qty: targetQty,
      target_price_cny_fen: targetPriceCnyFen,
      image_urls: imageUrls,
      destination_country: destinationCountry,
      notes,
      status: "open",
      admin_owner_id: null,
      quoted_price_cny_fen: null,
      quoted_min_qty: null,
      quoted_lead_days: null,
      quoted_notes: null,
      quoted_at: null,
      closed_at: null,
    })
    .select("id")
    .single();
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Phase 22 fan-out: send the buyer a receipt + ops an alert.
  // Fire-and-forget — the RFQ is already created and the buyer's
  // next click should be the redirect, not a Resend ack.
  void import("@/lib/email").then(({ notifyRFQReceived }) =>
    notifyRFQReceived(data.id as number).catch((e) => {
      // eslint-disable-next-line no-console
      console.error("[rfqs] notifyRFQReceived failed:", e);
    }),
  );

  return NextResponse.json({
    ok: true,
    rfq: {
      id: data.id,
      number: `RFQ-${String(data.id).padStart(6, "0")}`,
    },
  });
}
