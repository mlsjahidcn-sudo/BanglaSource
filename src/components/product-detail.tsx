"use client";
import { useEffect, useState, useMemo } from "react";
import Image from "next/image";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  fmtBdt,
  fmtCny,
  fmtKg,
  fmtCbm,
  ORDER_MIN_WEIGHT_KG,
  effectiveMarkupPct,
  type Product,
  type ShippingMode,
  type LandedBreakdown,
} from "@/lib/pricing";
import { useCart } from "@/lib/cart";
import { SaveButton } from "@/components/save-button";
import { useLang } from "@/lib/i18n";
import {
  whatsappLink,
  whatsappProductMessage,
} from "@/lib/contact";

const BADGE_LABEL: Record<string, { en: string; bn: string }> = {
  verified_factory: { en: "Verified factory", bn: "যাচাইকৃত কারখানা" },
  "24h_response": { en: "24h response", bn: "২৪ ঘণ্টা উত্তর" },
  top_supplier: { en: "Top supplier", bn: "শীর্ষ সরবরাহকারী" },
  trade_assurance: { en: "Trade assurance", bn: "ট্রেড অ্যাসুরেন্স" },
};

type QuoteResponse = {
  ok: boolean;
  warnings: string[];
  quote: LandedBreakdown;
};

export function ProductDetail({ product }: { product: Product }) {
  const [qty, setQty] = useState(() => product.factory_moq);
  const [mode, setMode] = useState<ShippingMode>("air");
  const [activeImage, setActiveImage] = useState(0);
  const [quote, setQuote] = useState<QuoteResponse | null>(null);
  const [quoteLoading, setQuoteLoading] = useState(false);
  const { add } = useCart();
  const { t } = useLang();

  // Fetch real quote from API whenever qty/mode change (debounced)
  useEffect(() => {
    const ctrl = new AbortController();
    setQuoteLoading(true);
    const t = setTimeout(async () => {
      try {
        const r = await fetch(
          `/api/quote/landed?productId=${product.source_id}&qty=${qty}&mode=${mode}`,
          { signal: ctrl.signal },
        );
        const j = await r.json();
        if (j.ok) setQuote(j);
      } catch {
        // aborted
      } finally {
        setQuoteLoading(false);
      }
    }, 220);
    return () => {
      clearTimeout(t);
      ctrl.abort();
    };
  }, [product.source_id, qty, mode]);

  const unitCny = useMemo(() => {
    const t = product.price_tiers.find(
      (tier) => qty >= tier.qty_min && qty <= tier.qty_max,
    );
    return t?.price_cny_fen ?? product.price_tiers.at(-1)!.price_cny_fen;
  }, [product.price_tiers, qty]);

  const lc = quote?.quote;

  function handleAdd() {
    add({
      productId: product.source_id,
      title_en: product.title_en,
      title_bn: product.title_bn,
      image: product.images[0],
      unitPriceCny: unitCny,
      factory_moq: product.factory_moq,
      qty,
      // Lock the markup + logistics params at add time so the cart
      // subtotal matches what the buyer just saw on the PDP, even
      // if the admin later changes the per-product value. Phase 11:
      // admins can override the markup per-product from
      // /admin/products/[id]; effectiveMarkupPct falls back to
      // the company default (10%) when the product's
      // markup_pct is missing/0.
      markup_pct: effectiveMarkupPct(product),
      weight_kg: product.weight_kg,
      volume_cbm: product.volume_cbm,
      category: product.category,
      customs_duty_per_kg: product.customs_duty_per_kg ?? 0,
    });
  }

  return (
    <div className="grid lg:grid-cols-12 gap-10 lg:gap-14">
      {/* ───── Gallery ───── */}
      <div className="lg:col-span-7">
        <div className="relative aspect-square bg-slate-50 rounded-lg overflow-hidden border border-border">
          <Image
            src={product.images[activeImage]}
            alt={product.title_en}
            fill
            priority
            sizes="(max-width: 1024px) 100vw, 60vw"
            className="object-cover"
          />
        </div>
        <div className="mt-3 grid grid-cols-3 gap-3">
          {product.images.map((src, i) => (
            <button
              key={i}
              onClick={() => setActiveImage(i)}
              className={`relative aspect-square bg-slate-50 rounded-md overflow-hidden border transition-colors ${
                activeImage === i
                  ? "border-emerald-600"
                  : "border-border hover:border-border-strong"
              }`}
              aria-label={`View image ${i + 1}`}
            >
              <Image
                src={src}
                alt=""
                fill
                sizes="120px"
                className="object-cover"
              />
            </button>
          ))}
        </div>

        {/* Description */}
        <div className="mt-10">
          <h2 className="text-[18px] font-semibold tracking-tight">
            Description
          </h2>
          <p className="mt-3 text-[15px] text-fg-muted leading-relaxed">
            {product.description_en}
          </p>
        </div>

        {/* Why buy from us — trust strip */}
        <div className="mt-6 grid grid-cols-1 sm:grid-cols-3 gap-2">
          {[
            {
              icon: "🛡️",
              title: "Trade-assured",
              body: "Refund if the product doesn't match the listing.",
            },
            {
              icon: "🚚",
              title: "Door-to-door Dhaka",
              body: "Air or sea, customs handled. You pay in BDT.",
            },
            {
              icon: "💳",
              title: "Full prepayment",
              body: "Pay 100% of the landed cost at order confirm. No balance on delivery.",
            },
          ].map((b) => (
            <div
              key={b.title}
              className="rounded-lg border border-border bg-slate-50/50 p-3"
            >
              <p className="text-[18px] leading-none">{b.icon}</p>
              <p className="mt-2 text-[12.5px] font-semibold">{b.title}</p>
              <p className="mt-0.5 text-[11.5px] text-fg-muted leading-snug">
                {b.body}
              </p>
            </div>
          ))}
        </div>

        {/* Bulk tier table */}
        <div className="mt-10">
          <div className="flex items-baseline justify-between flex-wrap gap-2">
            <h2 className="text-[18px] font-semibold tracking-tight">
              Bulk pricing
            </h2>
            <div className="flex items-center gap-3 text-[11.5px] text-fg-muted">
              {product.order_count_30d > 0 && (
                <span className="inline-flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                  {product.order_count_30d} ordered in last 30d
                </span>
              )}
              {product.rating_overall > 0 && (
                <span className="inline-flex items-center gap-1">
                  <span className="text-amber-500">★</span>
                  {product.rating_overall.toFixed(1)} rating
                </span>
              )}
              <span className="uppercase tracking-wider text-fg-subtle">
                Factory price · ৳ BDT / pc
              </span>
            </div>
          </div>
          <table className="table-clean mt-4">
            <thead>
              <tr>
                <th>Quantity</th>
                <th className="text-right">Factory (CNY)</th>
                <th className="text-right">Per piece (৳)</th>
                <th className="text-right">Saving</th>
              </tr>
            </thead>
            <tbody>
              {product.price_tiers.map((tier, i) => {
                const base = product.price_tiers[0].price_cny_fen;
                const saving = i === 0 ? 0 : Math.round((1 - tier.price_cny_fen / base) * 100);
                const isCurrent =
                  qty >= tier.qty_min && qty <= tier.qty_max;
                // Show landed BDT/pc as a ballpark: CNY × FX × (1 + duty% + 15%VAT + 5%AIT + markup%)
                // This is an "all-in landed" preview. Exact per-tot is in the right panel.
                const fen = tier.price_cny_fen;
                const cny = fen / 100;
                const landedBdtPerPc = Math.ceil(
                  cny *
                    16.85 *
                    (1 + effectiveMarkupPct(product) / 100) *
                    1.30, // rough: 10% duty + 15% VAT + 5% AIT average for 7 categories
                );
                return (
                  <tr
                    key={i}
                    className={isCurrent ? "bg-emerald-50/50" : ""}
                  >
                    <td>
                      <span className="font-mono tnum">
                        {tier.qty_min}
                        {tier.qty_max === 9999 ? "+" : `–${tier.qty_max}`}
                      </span>
                      {isCurrent && (
                        <span className="ml-2 text-[10px] uppercase tracking-wider text-emerald-700 font-medium">
                          current
                        </span>
                      )}
                    </td>
                    <td className="text-right price-tag font-medium text-fg-muted">
                      {fmtCny(fen)}
                    </td>
                    <td className="text-right price-tag font-semibold text-fg">
                      {fmtBdt(landedBdtPerPc)}
                    </td>
                    <td className="text-right text-fg-muted">
                      {saving > 0 ? `−${saving}%` : "—"}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          <p className="mt-2 text-[11px] text-fg-subtle">
            ৳ prices are landed-in-Dhaka estimates (incl. shipping, duty, VAT, AIT).
            Exact total shown in the quote panel — pay 100% at order confirm →
          </p>
        </div>

        {/* Supplier card */}
        <div className="mt-10 card p-6">
          <p className="text-[11px] text-fg-subtle uppercase tracking-wider font-medium">
            Factory
          </p>
          <p className="mt-1.5 text-[16px] font-semibold tracking-tight">
            {product.supplier_name}
          </p>
          <p className="mt-1 text-[13px] text-fg-muted">
            {product.supplier_city}, {product.supplier_province}, China
          </p>
          <div className="mt-5 grid grid-cols-3 gap-4 text-[12px]">
            <Stat label="30-day orders" value={product.order_count_30d.toLocaleString()} />
            <Stat label="In stock" value={product.stock_total.toLocaleString()} />
            <Stat
              label="Rating"
              value={`${product.rating_overall.toFixed(1)} / 5.0`}
            />
          </div>
          {product.badges.length > 0 && (
            <div className="mt-5 flex flex-wrap gap-1.5">
              {product.badges.map((b) => (
                <Badge key={b} tone="accent">
                  {BADGE_LABEL[b]?.en ?? b}
                </Badge>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ───── Buy panel (sticky) ───── */}
      <div className="lg:col-span-5">
        <div className="lg:sticky lg:top-24 space-y-6">
          <div>
            <div className="text-[12px] text-fg-subtle font-mono tnum uppercase tracking-wider">
              ID · {product.source_id}
            </div>
            <h1 className="mt-2 text-[24px] md:text-[28px] leading-[1.2] font-semibold tracking-[-0.015em]">
              {product.title_en}
            </h1>
            <p className="mt-2 text-[14px] text-fg-muted">
              {product.title_bn}
            </p>
          </div>

          {/* Qty + mode */}
          <div className="card p-5">
            <div className="flex items-end justify-between">
              <div>
                <p className="text-[11px] text-fg-subtle uppercase tracking-wider">
                  Factory price
                </p>
                <p className="price-tag text-[24px] font-semibold mt-0.5">
                  {fmtBdt(Math.ceil((unitCny / 100) * 16.85))}
                </p>
                <p className="text-[12px] text-fg-subtle mt-0.5">
                  per piece · ≈ {fmtCny(unitCny)} · MOQ {product.factory_moq}
                </p>
              </div>
            </div>

            <div className="mt-5 hr" />

            <div className="mt-5">
              <label className="text-[12px] text-fg-subtle uppercase tracking-wider font-medium">
                Quantity
              </label>
              <div className="mt-2 flex items-center gap-2">
                <button
                  onClick={() => setQty(Math.max(product.factory_moq, qty - 1))}
                  className="w-10 h-10 border border-border rounded-md hover:bg-slate-50 transition-colors text-fg-muted"
                  aria-label="Decrease"
                >
                  −
                </button>
                <input
                  type="number"
                  min={product.factory_moq}
                  value={qty}
                  onChange={(e) =>
                    setQty(
                      Math.max(
                        product.factory_moq,
                        parseInt(e.target.value) || product.factory_moq,
                      ),
                    )
                  }
                  className="flex-1 h-10 border border-border rounded-md text-center price-tag font-medium focus:border-emerald-600 focus:outline-none"
                />
                <button
                  onClick={() => setQty(qty + 1)}
                  className="w-10 h-10 border border-border rounded-md hover:bg-slate-50 transition-colors text-fg-muted"
                  aria-label="Increase"
                >
                  +
                </button>
              </div>
              {/* Phase 11: order-level min-weight hint. The number
                  is sourced from the same constant the cart
                  progress bar uses, so the UI never disagrees
                  with the server. */}
              <p className="mt-2 text-[11.5px] text-fg-subtle">
                {t("pdp.min_order_weight", {
                  kg: String(ORDER_MIN_WEIGHT_KG),
                })}
              </p>
            </div>

            <div className="mt-4">
              <label className="text-[12px] text-fg-subtle uppercase tracking-wider font-medium">
                Shipping mode
              </label>
              <div className="mt-2 grid grid-cols-2 gap-2">
                {(["air", "sea"] as const).map((m) => (
                  <button
                    key={m}
                    onClick={() => setMode(m)}
                    className={`h-10 px-3 text-[13px] font-medium rounded-md border transition-colors ${
                      mode === m
                        ? "bg-slate-900 text-white border-slate-900"
                        : "bg-bg text-fg border-border hover:border-border-strong"
                    }`}
                  >
                    {m === "air" ? "Air freight" : "Sea freight (LCL)"}
                  </button>
                ))}
              </div>
            </div>

            <div className="mt-5 hr" />

            {/* ── PDP price card ──────────────────────────────────────
                Phase 14: the buyer only sees the product price on the
                PDP. The landed cost (shipping + customs + VAT + AIT)
                is NOT itemised in the buyer UI — per user instruction
                (June 2026), our team confirms the amount by email or
                WhatsApp after the buyer places the order. The card
                now shows just two things:
                  1. Product price (= supplier FOB × (1 + markup%))
                  2. "Landed cost shared after order" hint with a
                     one-line explanation.
                The full landed math is still computed server-side
                (and stored on the order row) — it's just hidden
                from the buyer's primary flow. The weight + per-kg
                hint card stays as a transparent reference.
            ─────────────────────────────────────────────────────────── */}
            <div>
              {quoteLoading && !lc && (
                <div className="space-y-2 animate-pulse">
                  <div className="h-5 bg-slate-100 rounded w-full" />
                  <div className="h-4 bg-slate-100 rounded w-4/5" />
                  <div className="h-4 bg-slate-100 rounded w-4/5" />
                </div>
              )}

              {lc && (
                <div className="space-y-3">
                  {/* ── Line 1: Product price (qty × per-piece product price) ── */}
                  <div className="flex items-baseline justify-between border-b border-border pb-3">
                    <p className="text-[13px] font-semibold text-fg-muted uppercase tracking-wider">
                      {t("pdp.product_price")}
                    </p>
                    <p className="price-tag text-[20px] font-semibold text-fg">
                      {fmtBdt(lc.productBdt)}
                    </p>
                  </div>

                  {/* ── Landed cost (Phase 14: not shown to the buyer) ──
                       Per user instruction, the landed cost (shipping +
                       customs + VAT + AIT) is NOT surfaced in the
                       buyer UI. Our team confirms the amount by email
                       or WhatsApp after the buyer places the order.
                       The product price above is what the buyer sees
                       on the PDP; the rest of the math is server-side
                       and shown only on the order detail page (for
                       admin / audit) — not in the buyer's primary
                       flow. */}
                  <div className="flex items-start justify-between gap-3 p-3 rounded-md bg-cyan-50/40 border border-cyan-200/60 text-[12.5px]">
                    <p className="text-cyan-900 leading-relaxed">
                      <span className="font-semibold">
                        {t("pdp.landed_short")}.
                      </span>{" "}
                      {t("pdp.landed.body")}
                    </p>
                  </div>

                  {/* ── Weight + per-kg hint card (skyblue dashed, like skybuybd) ── */}
                  {lc.rateTier && (
                    <div className="mt-2 p-3 rounded-md border-2 border-dashed border-cyan-300 bg-cyan-50/40">
                      <div className="flex items-center gap-2">
                        <span aria-hidden="true" className="text-amber-600">
                          🔒
                        </span>
                        <p className="text-[12.5px] font-semibold text-amber-700">
                          {t("pdp.weight_card_title")}: {fmtKg(lc.chargeableKg)}
                        </p>
                      </div>
                      <p className="mt-2 text-[14px] font-semibold text-fg">
                        {t("pdp.shipping_label_bn")}
                      </p>
                      <p className="mt-1 text-[13px] font-semibold text-cyan-700">
                        {t("pdp.shipping_rate", {
                          // Show the range from the worst-case tier (currently
                          // active, e.g. small-parcel ৳1,348/kg) down to the
                          // best-case tier (50kg+ at ৳421/kg). This mirrors
                          // skybuybd's "৳750 / ৳1,150 Per Kg" hint and gives
                          // the buyer a concrete incentive to order more.
                          min: `৳${lc.rateTier.rateBdtPerKg.toLocaleString()}`,
                          max: "৳421",
                        })}
                      </p>
                    </div>
                  )}

                  {/* ── Bengali disclaimer: customs is a national duty ── */}
                  <p className="mt-3 text-[11.5px] leading-relaxed text-rose-600 font-medium">
                    {t("pdp.customs_disclaimer")}
                  </p>

                  {/* Quote ID footer (audit trail) */}
                  <p className="mt-1 text-[10.5px] text-fg-subtle font-mono tnum">
                    Quote {lc.quoteId} · {qty} {qty > 1 ? "pcs" : "pc"} ·{" "}
                    pay 100% at order confirm · valid until{" "}
                    {new Date(lc.expiresAt).toLocaleDateString()}
                  </p>
                </div>
              )}

              {/* Warnings (small-parcel premium, shipping-dominant, etc.) */}
              {quote && quote.warnings.length > 0 && (
                <div className="mt-3 space-y-1.5">
                  {quote.warnings.map((w, i) => (
                    <p
                      key={i}
                      className="text-[11.5px] text-amber-700 bg-amber-50 border border-amber-200 rounded-md p-2.5"
                    >
                      {w}
                    </p>
                  ))}
                </div>
              )}
            </div>

            <div className="mt-5 space-y-2">
              <Button size="lg" className="w-full" onClick={handleAdd}>
                Add to order list
              </Button>
              <SaveButton
                sourceId={product.source_id}
                variant="lg"
              />
              {/* Phase 24: per-product WhatsApp deep link.
                  Pre-fills a product-context message so
                  the China desk can pull it up the moment
                  it lands. Most popular for "I need this
                  fast" or "can you check stock?". */}
              <a
                href={whatsappLink(
                  whatsappProductMessage(
                    product.title_en,
                    product.source_id,
                    "https://banglasource.com",
                  ),
                )}
                target="_blank"
                rel="noreferrer"
                className="h-11 w-full inline-flex items-center justify-center gap-2 rounded-md border border-emerald-300 text-[13.5px] font-medium text-emerald-700 bg-emerald-50 hover:bg-emerald-100 transition-colors"
              >
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 16 16"
                  fill="currentColor"
                  aria-hidden="true"
                >
                  <path d="M13.6 2.3A7.5 7.5 0 0 0 8 .4 7.5 7.5 0 0 0 1.7 11c.2 1 .5 1.8 1 2.6L1.4 14.6l1.1-.3 2.6-1A7.5 7.5 0 0 0 15.6 8a7.5 7.5 0 0 0-2-5.7zM8 13.5a5.4 5.4 0 0 1-2.7-.7l-.2-.1-1.5.4.4-1.5-.1-.2A5.5 5.5 0 1 1 13.5 8 5.4 5.4 0 0 1 8 13.5zm3-4.1c-.2-.1-1.1-.5-1.3-.6-.2-.1-.3-.1-.5.1l-.6.7c-.1.1-.2.2-.4.1-.2-.1-.8-.3-1.5-1a5.5 5.5 0 0 1-1-1.3c-.1-.2 0-.3.1-.4l.3-.4.2-.3v-.4c0-.1-.5-1.2-.7-1.6-.2-.4-.4-.4-.5-.4h-.4c-.2 0-.4 0-.6.2-.2.2-.8.8-.8 2s.9 2.4 1 2.5c.1.2 1.7 2.6 4.2 3.6.6.2 1 .4 1.4.5.6.2 1.1.1 1.5.1.5-.1 1.5-.6 1.7-1.2.2-.6.2-1.1.2-1.2-.1-.1-.3-.2-.5-.3z" />
                </svg>
                Talk to us on WhatsApp
              </a>
              <Button
                size="md"
                variant="outline"
                className="w-full"
                onClick={handleAdd}
              >
                Request formal quote (PDF)
              </Button>
            </div>

            <p className="mt-3 text-[11px] text-fg-subtle text-center">
              You pay the landed cost (shipping + customs + tax) we confirm by email or WhatsApp after you place the order.
            </p>
          </div>

          {/* Specs */}
          <div className="card p-5">
            <p className="text-[11px] text-fg-subtle uppercase tracking-wider font-medium">
              Specs
            </p>
            <dl className="mt-3 space-y-2.5 text-[13px]">
              <Spec label="Weight / pc" value={fmtKg(product.weight_kg)} />
              <Spec label="Volume / pc" value={fmtCbm(product.volume_cbm)} />
              <Spec
                label="Shipment est."
                value={mode === "air" ? "5–9 days" : "30–45 days"}
              />
              <Spec
                label="Ships from"
                value={`${product.supplier_city}`}
              />
            </dl>
          </div>
        </div>
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-fg-subtle">{label}</p>
      <p className="mt-0.5 price-tag font-medium text-fg">{value}</p>
    </div>
  );
}

function Spec({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between border-b border-border pb-2 last:border-0 last:pb-0">
      <dt className="text-fg-muted">{label}</dt>
      <dd className="font-mono tnum text-fg text-[12.5px]">{value}</dd>
    </div>
  );
}


