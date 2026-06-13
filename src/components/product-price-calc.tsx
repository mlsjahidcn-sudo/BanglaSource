"use client";
import { useState, useMemo } from "react";
import { fmtBdt, FX_CNY_BDT } from "@/lib/pricing";

/**
 * Public product-price calculator for /shipping-rates.
 *
 * User said: "markup price no need to add in calculator, as user
 * is putting the product price". The input IS the per-piece price
 * the buyer will see — the calculator is just a CNY → BDT
 * converter. Whatever the user types in (the factory FOB) is the
 * product price; the markup is internal-only and never shown
 * here.
 *
 * Math: Product price ৳ = qty × cnyPerPc × FX
 * Per-piece ৳ = cnyPerPc × FX
 *
 * No markup line, no "FOB + markup" split, no percentage. The
 * buyer just sees the unit price in ৳. Phase 13 dropped the
 * 70/30 split — the buyer now pays 100% of the landed cost
 * upfront, but the calculator on this page is a simple
 * per-piece CNY→BDT converter, not a 70/30 calculator.
 */
export function ProductPriceCalc() {
  const [qty, setQty] = useState(50);
  const [cnyPerPc, setCnyPerPc] = useState(25);

  const result = useMemo(() => {
    const unitBdt = cnyPerPc * FX_CNY_BDT;
    const productBdt = unitBdt * qty;
    return { unitBdt, productBdt };
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
        <Field label="CNY / pc (product price)">
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
            <p className="mt-1 text-[12px] text-fg-subtle font-mono">
              ৳{result.unitBdt.toLocaleString(undefined, {
                maximumFractionDigits: 2,
              })}{" "}
              / pc
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
