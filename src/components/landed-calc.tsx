"use client";
import { useState, useMemo } from "react";
import {
  fmtBdt,
  FX_CNY_BDT,
  BUYER_MARKUP_PCT,
  type ShippingMode,
  AIR_TIERS_PUBLIC,
  AIR_MIN_LADDER_PUBLIC,
  EXPRESS_TIERS_PUBLIC,
  EXPRESS_MIN_LADDER_PUBLIC,
  SIDE_SERVICE_RATES_PUBLIC,
} from "@/lib/pricing";

/**
 * Public landed-cost calculator for /shipping-rates.
 *
 * Uses the same pricing math the server uses at order time, so
 * the buyer's estimate is accurate to within ±৳0–50 (the
 * server's per-kg tier lookup and the customer's tier will
 * match exactly when they use the same inputs).
 *
 * Inputs:
 *   - Total weight (kg) — drives per-kg tier + service floor
 *   - Quantity (pcs) — pieces in the order
 *   - CNY / pc — factory FOB, gets FX'd at 16.85
 *   - Mode (air / express / sea) — picks the int'l rate table
 *   - Customs rate (৳/kg) — per-kg specific, default 750 (Cat A).
 *     User can override for high-specific items (sunglasses 3,500)
 *     or restricted (battery 1,200).
 *
 * Outputs:
 *   - Per-kg tier active for the chosen weight
 *   - Service minimum (small-parcel floor) that applies
 *   - Line-by-line breakdown matching the order detail page
 *   - 70% deposit (on product price only) and the on-delivery rest
 */
export function LandedCalc() {
  const [weight, setWeight] = useState(8);
  const [qty, setQty] = useState(50);
  const [cnyPerPc, setCnyPerPc] = useState(25);
  const [mode, setMode] = useState<ShippingMode>("air");
  const [dutyPerKg, setDutyPerKg] = useState(750); // default: Cat A
  // Phase 11: markup is company-fixed at BUYER_MARKUP_PCT (10%).
  // We no longer expose a slider — buyers shouldn't be doing
  // our margin math. The "Product price" in the output already
  // includes the markup.

  const fx = FX_CNY_BDT;

  // Resolve the active per-kg tier and the service floor.
  const tierInfo = useMemo(() => {
    if (mode === "air") {
      const tier = AIR_TIERS_PUBLIC.find((t) => weight <= t.maxKg) ??
        AIR_TIERS_PUBLIC[AIR_TIERS_PUBLIC.length - 1];
      const floor = AIR_MIN_LADDER_PUBLIC.find((t) => weight <= t.maxKg);
      return {
        label: `Air · up to ${tier.maxKg === Infinity ? "50+ kg" : `${tier.maxKg} kg`}`,
        perKg: tier.rateBdtPerKg,
        floor: floor?.minBdt ?? 0,
        formula: floor
          ? `৳${tier.rateBdtPerKg.toLocaleString()}/kg (below service floor ৳${floor.minBdt.toLocaleString()})`
          : `৳${tier.rateBdtPerKg.toLocaleString()}/kg`,
      };
    }
    if (mode === "express") {
      const tier = EXPRESS_TIERS_PUBLIC.find((t) => weight <= t.maxKg) ??
        EXPRESS_TIERS_PUBLIC[EXPRESS_TIERS_PUBLIC.length - 1];
      const floor = EXPRESS_MIN_LADDER_PUBLIC.find((t) => weight <= t.maxKg);
      return {
        label: `Express · up to ${tier.maxKg === Infinity ? "20+ kg" : `${tier.maxKg} kg`}`,
        perKg: tier.rateBdtPerKg,
        floor: floor?.minBdt ?? 0,
        formula: floor
          ? `৳${tier.rateBdtPerKg.toLocaleString()}/kg (below service floor ৳${floor.minBdt.toLocaleString()})`
          : `৳${tier.rateBdtPerKg.toLocaleString()}/kg`,
      };
    }
    // Sea
    return {
      label: `Sea LCL · ৳${SIDE_SERVICE_RATES_PUBLIC.consol.bdtPerOrder.toLocaleString()}/CBM (floor ৳5,055)`,
      perKg: 0,
      floor: 0,
      formula: "৳33,700/CBM (min ৳5,055 = 0.15 CBM)",
    };
  }, [mode, weight]);

  // Compute the full breakdown in BDT, matching the server's
  // pricing math.
  const result = useMemo(() => {
    const cnSubtotalCny = cnyPerPc * qty;
    const cnSubtotalBdt = Math.round(cnSubtotalCny * fx);

    // Int'l shipping — max(per-kg, floor) for air/express,
    // CBM-based for sea.
    let intlBdt = 0;
    if (mode === "air") {
      const perKg = weight * tierInfo.perKg;
      intlBdt = Math.max(perKg, tierInfo.floor);
    } else if (mode === "express") {
      const perKg = weight * tierInfo.perKg;
      intlBdt = Math.max(perKg, tierInfo.floor);
    } else {
      // Sea — assume the user's "weight" kg is a CBM proxy for the
      // calculator (in real life the catalog has volume_cbm). For
      // a flat kg input we apply the sea rate as if each kg = 0.004
      // CBM (250kg/CBM), so 50kg = 0.2 CBM.
      const cbm = Math.max(weight * 0.004, 0.15);
      intlBdt = Math.max(cbm * 33700, 5055);
    }

    // CN first-mile
    const cnDomesticBdt = Math.max(
      SIDE_SERVICE_RATES_PUBLIC.cnDomestic.minBdt,
      Math.round(weight * SIDE_SERVICE_RATES_PUBLIC.cnDomestic.bdtPerKg),
    );
    // Sourcing agent
    const agentBdt = Math.max(
      SIDE_SERVICE_RATES_PUBLIC.agent.minBdt,
      Math.round(cnSubtotalBdt * SIDE_SERVICE_RATES_PUBLIC.agent.pct),
    );
    // Single-product calculator → no consolidation
    const consolBdt = 0;

    const cifBdt = cnSubtotalBdt + intlBdt + cnDomesticBdt + agentBdt + consolBdt;

    // Per-kg specific customs
    const dutyBdt = Math.round(weight * dutyPerKg);
    // VAT 15% on (CIF + duty)
    const vatBdt = Math.round((cifBdt + dutyBdt) * 0.15);
    // AIT 5% on CIF
    const aitBdt = Math.round(cifBdt * 0.05);
    // Markup on the CN subtotal (company-fixed; never shown as
    // a separate line — the "Product price" absorbs it).
    const markupBdt = Math.round(cnSubtotalBdt * (BUYER_MARKUP_PCT / 100));
    // Product price (factory + markup) — what the 70/30 split is on
    const productBdt = cnSubtotalBdt + markupBdt;
    // Total landed
    const totalBdt = cifBdt + dutyBdt + vatBdt + aitBdt;
    // 70% deposit (product only — shipping + duty settle on delivery)
    const depositBdt = Math.round(productBdt * 0.7);
    const balanceBdt = productBdt - depositBdt;

    return {
      cnSubtotalBdt,
      intlBdt,
      cnDomesticBdt,
      agentBdt,
      consolBdt,
      cifBdt,
      dutyBdt,
      vatBdt,
      aitBdt,
      markupBdt,
      productBdt,
      totalBdt,
      depositBdt,
      balanceBdt,
    };
  }, [cnyPerPc, qty, weight, fx, mode, tierInfo, dutyPerKg]);

  return (
    <div className="card overflow-hidden">
      <div className="p-6 md:p-8 grid sm:grid-cols-2 gap-5">
        <Field label="Total weight (kg)">
          <input
            type="number"
            min={0.1}
            step={0.1}
            value={weight}
            onChange={(e) => setWeight(parseFloat(e.target.value) || 0)}
            className="input"
          />
        </Field>
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
        <Field label="Customs ৳/kg">
          <select
            value={dutyPerKg}
            onChange={(e) => setDutyPerKg(parseInt(e.target.value) || 0)}
            className="input"
          >
            <option value="750">750 — Category A (general)</option>
            <option value="1150">1,150 — Category B (battery / restricted)</option>
            <option value="1200">1,200 — Smart watch / BT / food / knife / powder</option>
            <option value="1350">1,350 — Power bank / battery</option>
            <option value="3500">3,500 — Sunglasses (high specific)</option>
          </select>
        </Field>
        <Field label="Mode" full>
          <div className="grid grid-cols-3 gap-2">
            {(["air", "express", "sea"] as const).map((m) => (
              <button
                key={m}
                onClick={() => setMode(m)}
                className={`h-10 px-3 text-[13px] font-medium rounded-md border transition-colors ${
                  mode === m
                    ? "bg-slate-900 text-white border-slate-900"
                    : "bg-bg text-fg border-border hover:border-border-strong"
                }`}
              >
                {m === "air"
                  ? "Air"
                  : m === "express"
                    ? "Express"
                    : "Sea LCL"}
              </button>
            ))}
          </div>
        </Field>
      </div>

      <div className="border-t border-border" />

      <div className="p-6 md:p-8 bg-bg-soft">
        <div className="grid md:grid-cols-2 gap-8">
          <div>
            <p className="text-[11px] text-fg-subtle uppercase tracking-wider font-medium">
              Rate applied
            </p>
            <p className="mt-2 text-[14px] font-semibold text-cyan-700">
              {tierInfo.label}
            </p>
            <p className="mt-1 text-[12px] text-fg-muted font-mono">
              {tierInfo.formula}
            </p>

            <p className="mt-6 text-[11px] text-fg-subtle uppercase tracking-wider font-medium">
              Breakdown (BDT)
            </p>
            <dl className="mt-3 space-y-1.5 text-[13px]">
              {/* Phase 11: "Product price" already includes the
                  company markup. We don't surface it as a
                  separate line — the buyer sees one number. */}
              <Row label="Product price" value={fmtBdt(result.cnSubtotalBdt + result.markupBdt)} />
              <Row label="Int'l shipping" value={fmtBdt(result.intlBdt)} />
              <Row label="CN first-mile" value={fmtBdt(result.cnDomesticBdt)} />
              <Row label="Sourcing agent (3%)" value={fmtBdt(result.agentBdt)} />
              <Row label={`Customs (৳${dutyPerKg.toLocaleString()}/kg)`} value={fmtBdt(result.dutyBdt)} />
              <Row label="VAT 15% (CIF + duty)" value={fmtBdt(result.vatBdt)} />
              <Row label="AIT 5% (CIF)" value={fmtBdt(result.aitBdt)} />
            </dl>
          </div>

          <div className="space-y-4">
            <div className="bg-bg border border-border rounded-lg p-5">
              <p className="text-[11px] text-fg-subtle uppercase tracking-wider font-medium">
                Total landed in Dhaka
              </p>
              <p className="mt-2 price-tag text-[36px] md:text-[44px] font-semibold tracking-tight">
                {fmtBdt(result.totalBdt + result.markupBdt)}
              </p>
              <p className="mt-1 text-[12px] text-fg-muted">
                = {fmtBdt(result.cnSubtotalBdt + result.markupBdt)} product +{" "}
                {fmtBdt(result.totalBdt - result.cnSubtotalBdt)} shipping, duty, tax
              </p>
            </div>

            <div className="bg-emerald-50 border border-emerald-200/60 rounded-lg p-4 text-[12.5px]">
              <p className="text-[11px] uppercase tracking-wider font-semibold text-emerald-700">
                Pay-now 70% (product only)
              </p>
              <p className="mt-1 text-[20px] font-semibold price-tag text-emerald-900">
                {fmtBdt(result.depositBdt)}
              </p>
              <p className="mt-1 text-emerald-800/80 text-[11.5px]">
                + on delivery: {fmtBdt(result.balanceBdt)} product balance +{" "}
                {fmtBdt(result.totalBdt - result.cnSubtotalBdt)} shipping + duty + tax
              </p>
            </div>

            <p className="text-[11px] text-fg-subtle leading-relaxed">
              Estimate only. Final cost locks at order time; the order
              detail page shows the locked amount, and we honour the
              70/30 split on the product price.
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
  full,
}: {
  label: string;
  children: React.ReactNode;
  full?: boolean;
}) {
  return (
    <label className={full ? "sm:col-span-2" : ""}>
      <span className="text-[11px] text-fg-subtle uppercase tracking-wider font-medium">
        {label}
      </span>
      <div className="mt-2">{children}</div>
    </label>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between border-b border-border pb-1.5 last:border-0 last:pb-0">
      <dt className="text-fg-muted">{label}</dt>
      <dd className="price-tag font-medium">{value}</dd>
    </div>
  );
}
