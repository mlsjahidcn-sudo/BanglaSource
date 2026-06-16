"use client";
import { Container } from "@/components/ui/container";
import { useLang } from "@/lib/i18n";
import { FX_CNY_BDT } from "@/lib/pricing";

const STEPS: Array<{ n: string; titleKey: string; bodyKey: string }> = [
  { n: "01", titleKey: "how.s1.title", bodyKey: "how.s1.body" },
  { n: "02", titleKey: "how.s2.title", bodyKey: "how.s2.body" },
  { n: "03", titleKey: "how.s3.title", bodyKey: "how.s3.body" },
  { n: "04", titleKey: "how.s4.title", bodyKey: "how.s4.body" },
  { n: "05", titleKey: "how.s5.title", bodyKey: "how.s5.body" },
  { n: "06", titleKey: "how.s6.title", bodyKey: "how.s6.body" },
  { n: "07", titleKey: "how.s7.title", bodyKey: "how.s7.body" },
];

// Worked example: 100 TWS earbuds at ¥18.50 FOB,
// air freight, 1.2kg total, "phone accessories"
// HS code (৳240/kg specific duty). Used as the
// per-step cost breakdown in the "Land cost"
// section below the steps. Numbers chosen to be
// representative, not from a real order.
const EXAMPLE = (() => {
  const unitCny = 18.5;
  const qty = 100;
  const totalCny = unitCny * qty;
  const totalBdt = Math.round(totalCny * FX_CNY_BDT);
  // Air: 0–2kg ৳1,348/kg → 1.2kg × 1348 = 1618
  const airKg = 1.2;
  const airFreightBdt = Math.round(airKg * 1348);
  // CN domestic + agent: ৳135/kg + 3% of FOB
  const cnDomesticBdt = Math.round(airKg * 135);
  const agentBdt = Math.round(totalBdt * 0.03);
  // Consol ৳400
  const consolBdt = 400;
  // Duty: ৳240/kg × 1.2kg = 288
  const dutyBdt = Math.round(240 * airKg);
  const cifBdt = totalBdt + airFreightBdt + cnDomesticBdt + agentBdt + consolBdt;
  const vatBdt = Math.round(cifBdt * 0.15);
  const aitBdt = Math.round(cifBdt * 0.05);
  const totalBdtLanded = cifBdt + dutyBdt + vatBdt + aitBdt;
  const markupPct = 10;
  const markupBdt = Math.round(totalBdtLanded * (markupPct / 100));
  const sellBdt = totalBdtLanded + markupBdt;
  return [
    { label: "Factory FOB (¥18.50 × 100)", bdt: totalBdt, note: "100 TWS earbuds" },
    { label: "Air freight (1.2 kg × ৳1,348)", bdt: airFreightBdt, note: "Dhakha door-to-door" },
    { label: "CN domestic + agent", bdt: cnDomesticBdt + agentBdt, note: "৳135/kg + 3% sourcing fee" },
    { label: "Consolidation", bdt: consolBdt, note: "Per-shipment floor" },
    { label: "Customs duty (৳240/kg × 1.2)", bdt: dutyBdt, note: "Phone accessories HS code" },
    { label: "VAT (15% × CIF+duty)", bdt: vatBdt, note: "" },
    { label: "AIT (5% × CIF)", bdt: aitBdt, note: "Imposed, not creditable" },
    { label: "Our markup (10%)", bdt: markupBdt, note: "Standard buyer tier" },
  ];
})();
const EXAMPLE_TOTAL = EXAMPLE.reduce((s, e) => s + e.bdt, 0);

export function HowClient() {
  const { t } = useLang();
  return (
    <>
      <Container className="pt-16 md:pt-20 pb-12">
        <p className="text-[12px] font-medium tracking-wider uppercase text-cyan-700">
          Process
        </p>
        <h1 className="mt-3 text-[40px] md:text-[56px] leading-[1.05] font-semibold tracking-[-0.02em] max-w-3xl">
          {t("how.title")}
        </h1>
        <p className="mt-5 text-[17px] text-fg-muted max-w-2xl leading-relaxed">
          {t("how.subtitle")}
        </p>
      </Container>
      <Container className="pb-16">
        <ol className="space-y-px bg-border border border-border rounded-lg overflow-hidden max-w-4xl">
          {STEPS.map((s) => (
            <li
              key={s.n}
              className="bg-bg p-7 md:p-9 grid md:grid-cols-12 gap-6"
            >
              <div className="md:col-span-2">
                <p className="step-num">— {s.n}</p>
              </div>
              <div className="md:col-span-10">
                <h2 className="text-[20px] font-semibold tracking-tight">
                  {t(s.titleKey)}
                </h2>
                <p className="mt-2.5 text-[15px] text-fg-muted leading-relaxed max-w-2xl">
                  {t(s.bodyKey)}
                </p>
              </div>
            </li>
          ))}
        </ol>
      </Container>

      {/* Phase 24: worked example of a 100-unit TWS
          earbuds order. Shows the per-step landed-cost
          breakdown so the buyer sees the math before
          they commit. Currency = BDT throughout. */}
      <Container className="pb-16">
        <div className="max-w-4xl">
          <p className="text-[12px] font-medium tracking-wider uppercase text-cyan-700">
            Worked example
          </p>
          <h2 className="mt-3 text-[24px] md:text-[28px] font-semibold tracking-[-0.01em] max-w-2xl">
            What the landed cost looks like for a 100-unit TWS earbuds order
          </h2>
          <p className="mt-2 text-[13.5px] text-fg-muted max-w-2xl">
            Real example using current rates (¥1 = ৳1.65
            interbank, air ৳1,348/kg, ৳240/kg duty for
            phone accessories). All numbers are
            pre-order estimates — the actual invoice is
            computed server-side at order time using the
            day&apos;s FX rate.
          </p>

          <div className="mt-6 card overflow-hidden">
            <table className="w-full text-[13.5px]">
              <thead>
                <tr className="text-left text-[10.5px] uppercase tracking-wider text-fg-subtle font-medium border-b border-border">
                  <th className="py-3 pl-5 pr-3">Line</th>
                  <th className="py-3 pr-3">Note</th>
                  <th className="py-3 pr-5 text-right">BDT</th>
                </tr>
              </thead>
              <tbody>
                {EXAMPLE.map((row, i) => (
                  <tr key={i} className="border-b border-border last:border-b-0">
                    <td className="py-3 pl-5 pr-3 font-medium">{row.label}</td>
                    <td className="py-3 pr-3 text-fg-muted text-[12.5px]">
                      {row.note}
                    </td>
                    <td className="py-3 pr-5 text-right font-mono tnum">
                      ৳{row.bdt.toLocaleString("en-IN")}
                    </td>
                  </tr>
                ))}
                <tr className="bg-bg-soft">
                  <td className="py-3.5 pl-5 pr-3 font-semibold text-[14px]">
                    Total per-unit (÷ 100)
                  </td>
                  <td className="py-3.5 pr-3 text-fg-muted text-[12.5px]">
                    What you actually sell against
                  </td>
                  <td className="py-3.5 pr-5 text-right font-mono tnum font-semibold">
                    ৳{Math.round(EXAMPLE_TOTAL / 100).toLocaleString("en-IN")} / unit
                  </td>
                </tr>
                <tr>
                  <td className="py-3.5 pl-5 pr-3 font-semibold text-[14px]">
                    Order total
                  </td>
                  <td className="py-3.5 pr-3 text-fg-muted text-[12.5px]">
                    Pre-pay 100% at order confirm
                  </td>
                  <td className="py-3.5 pr-5 text-right font-mono tnum font-semibold text-[15px]">
                    ৳{EXAMPLE_TOTAL.toLocaleString("en-IN")}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
          <p className="mt-3 text-[12px] text-fg-subtle">
            Worked example only. Use the{" "}
            <a href="/shipping-rates" className="text-cyan-700 hover:underline">
              shipping rates calculator
            </a>{" "}
            for a live quote on your actual product mix.
          </p>
        </div>
      </Container>

      <Container className="pb-24">
        <div className="bg-slate-900 text-white rounded-2xl px-8 md:px-14 py-14 md:py-16">
          <div className="max-w-2xl">
            <p className="text-[12px] font-medium tracking-wider uppercase text-emerald-400">
              Quality control
            </p>
            <h2 className="mt-3 text-[28px] md:text-[36px] leading-tight font-semibold tracking-[-0.02em]">
              {t("how.band.title")}
            </h2>
            <p className="mt-4 text-[16px] text-slate-300 leading-relaxed">
              {t("how.band.body")}
            </p>
          </div>
        </div>
      </Container>
    </>
  );
}
