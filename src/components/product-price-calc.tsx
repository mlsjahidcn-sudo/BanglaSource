"use client";
import { useState, useMemo } from "react";
import {
  fmtBdt,
  FX_CNY_BDT,
  DEFAULT_BUYER_MARKUP_PCT,
} from "@/lib/pricing";

/**
 * Public product-price calculator for /shipping-rates.
 *
 * Phase 12 follow-up: the page is "Shipping & landed cost" but
 * the user wants the calculator to focus on the product price
 * only — not the full landed cost breakdown. Shipping / duty /
 * VAT math is already shown on the page above (mode cards, side
 * services, and the PDP itself when a buyer lands on a product).
 *
 * This widget now just answers: "If I buy N pieces of something
 * that costs ¥X/pc factory FOB, what's the buyer's product
 * price in ৳?" That's the only number the buyer sees on the
 * PDP and in the cart.
 *
 * Math: Product price = qty × cnyPerPc × FX × (1 + markup)
 * The markup used here is the company default (10%) because the
 * calculator has no product context; admin-set per-product
 * markup is reflected on the actual PDP/cart/orders.
 */
export function ProductPriceCalc() {
  const [qty, setQty] = useState(50);
  const [cnyPerPc, setCnyPerPc] = useState(25);

  const result = useMemo(() => {
    const cnSubtotalCny = cnyPerPc * qty;
    const cnSubtotalBdt = cnSubtotalCny * FX_CNY_BDT;
    const markupBdt = Math.round(
      cnSubtotalBdt * (DEFAULT_BUYER_MARKUP_PCT / 100),
    );
    const productBdt = Math.round(cnSubtotalBdt + markupBdt);
    return { cnSubtotalBdt, markupBdt, productBdt };
  }, [cnyPerPc, qty]);

  return (
    <div className="card overflow-hidden">
      <div className="p-6 md:p-8 grid sm:grid-cols-2 gap-5">
        <Field label="Quantity (pcs)">
          <input
            type="number"
            min={1}
            value={qty}
            onChange={(e) => setQty(parseInt(e.target.value) || 1)}
            className="input"
          />
        </Field>
        <Field label="CNY / pc (factory FOB)">
          <input
            type="number"
            min={0.01}
            step={0.5}
            value={cnyPerPc}
            onChange={(e) => setCnyPerPc(parseFloat(e.target.value) || 0)}
            className="input"
          />
        </Field>
      </div>

      <div className="border-t border-border" />

      <div className="p-6 md:p-8 bg-bg-soft">
        <div className="grid md:grid-cols-2 gap-8 items-start">
          <div>
            <p className="text-[11px] text-fg-subtle uppercase tracking-wider font-medium">
              Product price
            </p>
            <p className="mt-2 text-[44px] md:text-[56px] font-semibold tracking-tight price-tag leading-none">
              {fmtBdt(result.productBdt)}
            </p>
            <p className="mt-3 text-[13px] text-fg-muted">
              For {qty} pieces at ¥{cnyPerPc.toFixed(2)}/pc
            </p>
          </div>

          <div className="space-y-3">
            <div className="bg-bg border border-border rounded-lg p-4">
              <p className="text-[11px] text-fg-subtle uppercase tracking-wider font-medium">
                Pay now 70% (product only)
              </p>
              <p className="mt-1.5 text-[20px] font-semibold price-tag text-emerald-700">
                {fmtBdt(Math.round(result.productBdt * 0.7))}
              </p>
              <p className="mt-1 text-[11.5px] text-fg-muted">
                = {fmtBdt(Math.round(result.productBdt * 0.3))} on delivery
              </p>
            </div>
            <p className="text-[11px] text-fg-subtle leading-relaxed">
              Shipping from Guangzhou to Dhaka, Bangladesh customs duty,
              VAT 15%, and AIT 5% settle to the courier on delivery in
              Dhaka — see the 3 mode cards above for per-kg rates and
              the side-services cards for sourcing / consolidation fees.
            </p>
          </div>
        </div>
      </div>

      <style>{`
        .input {
          width: 100%;
          height: 40px;
          padding: 0 12px;
          border: 1px solid var(--border);
          border-radius: 6px;
          font-family: var(--font-mono);
          font-variant-numeric: tabular-nums;
          background: var(--bg);
          color: var(--fg);
        }
        .input:focus {
          outline: none;
          border-color: var(--emerald-600);
        }
      `}</style>
    </div>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label>
      <span className="text-[11px] text-fg-subtle uppercase tracking-wider font-medium">
        {label}
      </span>
      <div className="mt-2">{children}</div>
    </label>
  );
}
