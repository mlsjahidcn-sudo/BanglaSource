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
  type Product,
  type ShippingMode,
  type LandedBreakdown,
} from "@/lib/pricing";
import { useCart } from "@/lib/cart";

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

        {/* Bulk tier table */}
        <div className="mt-10">
          <div className="flex items-baseline justify-between">
            <h2 className="text-[18px] font-semibold tracking-tight">
              Bulk pricing
            </h2>
            <p className="text-[11px] text-fg-subtle uppercase tracking-wider">
              Factory price · ৳ BDT / pc
            </p>
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
                    (1 + (product.markup_pct || 10) / 100) *
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
            ৳ prices are landed-in-Dhaka estimates (incl. shipping, duty, VAT, our fee).
            Exact total with 70/30 split shown in the quote panel →
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

            {/* Landed cost */}
            <div>
              <div className="flex items-baseline justify-between">
                <p className="text-[11px] text-emerald-700 uppercase tracking-wider font-semibold">
                  Landed cost in Dhaka
                </p>
                {quoteLoading && (
                  <span className="text-[10.5px] text-fg-subtle">
                    recalculating…
                  </span>
                )}
              </div>
              <p className="mt-1 text-[12px] text-fg-subtle">
                Includes shipping, duty, VAT. Locks at checkout.
              </p>

              {quote && quote.warnings.length > 0 && (
                <p className="mt-3 text-[11.5px] text-amber-700 bg-amber-50 border border-amber-200 rounded-md p-2.5">
                  {quote.warnings[0]}
                </p>
              )}

              {lc ? (
                <dl className="mt-4 space-y-2 text-[13px]">
                  <BreakdownRow
                    label="FOB China"
                    value={fmtBdt(lc.cnSubtotalBdt)}
                  />
                  <BreakdownRow
                    label={`Int'l shipping (${mode})`}
                    value={fmtBdt(lc.intlBdt)}
                  />
                  <BreakdownRow
                    label="Sourcing & consolidation"
                    value={fmtBdt(lc.agentBdt + lc.consolBdt)}
                  />
                  <BreakdownRow
                    label={`Duty ${Math.round(lc.dutyPct * 100)}% + VAT + AIT`}
                    value={fmtBdt(lc.dutyBdt + lc.vatBdt + lc.aitBdt)}
                  />
                  <BreakdownRow
                    label={`Our fee (${lc.markupPct}%)`}
                    value={fmtBdt(lc.markupBdt)}
                  />
                </dl>
              ) : (
                <div className="mt-4 space-y-2 animate-pulse">
                  <div className="h-3 bg-slate-100 rounded w-full" />
                  <div className="h-3 bg-slate-100 rounded w-4/5" />
                  <div className="h-3 bg-slate-100 rounded w-3/5" />
                </div>
              )}

              {lc && (
                <div className="mt-5 pt-5 border-t border-border">
                  <div className="flex items-end justify-between">
                    <div>
                      <p className="text-[11px] text-fg-subtle uppercase tracking-wider">
                        Total
                      </p>
                      <p className="price-tag text-[28px] font-semibold mt-0.5">
                        {fmtBdt(lc.totalBdt)}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-[11px] text-fg-subtle uppercase tracking-wider">
                        Per piece
                      </p>
                      <p className="price-tag text-[18px] font-medium mt-0.5 text-fg-muted">
                        {fmtBdt(lc.unitBdt)}
                      </p>
                    </div>
                  </div>

                  {/* Payment split: 70% deposit, 30% on delivery */}
                  <div className="mt-4 p-3 bg-slate-50 border border-border rounded-md">
                    <p className="text-[10.5px] uppercase tracking-wider font-semibold text-fg-muted">
                      Payment plan
                    </p>
                    <div className="mt-2 grid grid-cols-2 gap-3 text-[12.5px]">
                      <div>
                        <p className="text-fg-muted text-[11px]">
                          70% deposit
                        </p>
                        <p className="price-tag font-semibold text-fg text-[15px] mt-0.5">
                          {fmtBdt(lc.depositBdt)}
                        </p>
                        <p className="text-[10.5px] text-fg-subtle mt-0.5">
                          on order confirm
                        </p>
                      </div>
                      <div className="border-l border-border pl-3">
                        <p className="text-fg-muted text-[11px]">
                          30% balance
                        </p>
                        <p className="price-tag font-semibold text-fg text-[15px] mt-0.5">
                          {fmtBdt(lc.balanceBdt)}
                        </p>
                        <p className="text-[10.5px] text-fg-subtle mt-0.5">
                          on delivery · Dhaka
                        </p>
                      </div>
                    </div>
                    <div className="mt-2.5 h-1.5 bg-slate-200 rounded-full overflow-hidden flex">
                      <div
                        className="h-full bg-emerald-500"
                        style={{ width: `${(lc.depositPct ?? 0.7) * 100}%` }}
                      />
                      <div
                        className="h-full bg-amber-500"
                        style={{ width: `${(lc.balancePct ?? 0.3) * 100}%` }}
                      />
                    </div>
                  </div>

                  <p className="mt-2 text-[10.5px] text-fg-subtle font-mono tnum">
                    Quote {lc.quoteId} · transit {lc.transitDays} · valid until{" "}
                    {new Date(lc.expiresAt).toLocaleDateString()}
                  </p>
                </div>
              )}
            </div>

            <div className="mt-5 space-y-2">
              <Button size="lg" className="w-full" onClick={handleAdd}>
                Add to order list
              </Button>
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
              No payment until you confirm order with our team.
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

function BreakdownRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-fg-muted">{label}</span>
      <span className="price-tag font-medium">{value}</span>
    </div>
  );
}
