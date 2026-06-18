"use client";
import { Container } from "@/components/ui/container";
import { useLang } from "@/lib/i18n";
import { FX_CNY_BDT } from "@/lib/pricing";
import { IconChevron, IconPlane, IconShip, IconBolt, IconWallet, IconCheck, IconX } from "@/components/portal-icons";
import { BRAND, whatsappLink } from "@/lib/contact";

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

// Phase 53: 3 shipping modes. Icon + name + days + best-for
// are the 4 columns of the comparison table.
const SHIP_MODES = [
  {
    id: "express",
    icon: "IconBolt",
    nameKey: "how.ship_compare.express.name",
    daysKey: "how.ship_compare.express.days",
    bestKey: "how.ship_compare.express.best",
  },
  {
    id: "air",
    icon: "IconPlane",
    nameKey: "how.ship_compare.air.name",
    daysKey: "how.ship_compare.air.days",
    bestKey: "how.ship_compare.air.best",
  },
  {
    id: "sea",
    icon: "IconShip",
    nameKey: "how.ship_compare.sea.name",
    daysKey: "how.ship_compare.sea.days",
    bestKey: "how.ship_compare.sea.best",
  },
] as const;

// Phase 53: with-us vs going-direct comparison rows.
// Each row is 3 cells: thing / us / them.
const COMPARE_ROWS = [
  {
    thingKey: "how.compare.row1.thing",
    usKey: "how.compare.row1.us",
    themKey: "how.compare.row1.them",
  },
  {
    thingKey: "how.compare.row2.thing",
    usKey: "how.compare.row2.us",
    themKey: "how.compare.row2.them",
  },
  {
    thingKey: "how.compare.row3.thing",
    usKey: "how.compare.row3.us",
    themKey: "how.compare.row3.them",
  },
  {
    thingKey: "how.compare.row4.thing",
    usKey: "how.compare.row4.us",
    themKey: "how.compare.row4.them",
  },
] as const;

// Phase 53: 3 payment methods. Each shows an icon +
// name + description. bKash + Nagad are MFS, bank
// is BEFTN/RTGS/SWIFT. We don't show fees because
// the price is the same on the user's side.
const PAY_METHODS = [
  { id: "bkash", nameKey: "how.pay.bkash.name", descKey: "how.pay.bkash.desc" },
  { id: "nagad", nameKey: "how.pay.nagad.name", descKey: "how.pay.nagad.desc" },
  { id: "bank", nameKey: "how.pay.bank.name", descKey: "how.pay.bank.desc" },
] as const;

// Phase 53: FAQ. Native <details> accordion, no JS.
const FAQ = [
  { qKey: "how.faq.q1", aKey: "how.faq.a1" },
  { qKey: "how.faq.q2", aKey: "how.faq.a2" },
  { qKey: "how.faq.q3", aKey: "how.faq.a3" },
  { qKey: "how.faq.q4", aKey: "how.faq.a4" },
  { qKey: "how.faq.q5", aKey: "how.faq.a5" },
  { qKey: "how.faq.q6", aKey: "how.faq.a6" },
] as const;

export function HowClient() {
  const { t } = useLang();
  return (
    <>
      <Container className="pt-16 md:pt-20 pb-12">
        <p className="text-[12px] font-medium tracking-wider uppercase text-cyan-700">
          Process
        </p>
        <h1 className="mt-3 text-[36px] md:text-[48px] lg:text-[56px] leading-[1.05] font-semibold tracking-[-0.02em] max-w-3xl">
          {t("how.title")}
        </h1>
        <p className="mt-5 text-[17px] text-fg-muted max-w-2xl leading-relaxed">
          {t("how.subtitle")}
        </p>
      </Container>

      {/* ── 7 steps ─────────────────────────────────────────── */}
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

      {/* ── Phase 53 · Shipping mode comparison ──────────────── */}
      <Container className="pb-16">
        <p className="text-[12px] font-medium tracking-wider uppercase text-cyan-700">
          {t("how.ship_compare.eyebrow")}
        </p>
        <h2 className="mt-3 text-[24px] md:text-[28px] font-semibold tracking-[-0.01em] max-w-2xl">
          {t("how.ship_compare.title")}
        </h2>
        <p className="mt-2 text-[13.5px] text-fg-muted max-w-2xl">
          {t("how.ship_compare.subtitle")}
        </p>
        <div className="mt-6 max-w-4xl card overflow-hidden">
          <table className="w-full text-[13.5px]">
            <thead>
              <tr className="text-left text-[10.5px] uppercase tracking-wider text-fg-subtle font-medium border-b border-border">
                <th className="py-3 pl-5 pr-3">{t("how.ship_compare.mode")}</th>
                <th className="py-3 pr-3">{t("how.ship_compare.days")}</th>
                <th className="py-3 pr-5">{t("how.ship_compare.best")}</th>
              </tr>
            </thead>
            <tbody>
              {SHIP_MODES.map((m, i) => {
                const Icon =
                  m.icon === "IconBolt"
                    ? IconBolt
                    : m.icon === "IconPlane"
                      ? IconPlane
                      : IconShip;
                return (
                  <tr
                    key={m.id}
                    className={
                      i < SHIP_MODES.length - 1 ? "border-b border-border" : ""
                    }
                  >
                    <td className="py-4 pl-5 pr-3 font-medium align-top">
                      <div className="flex items-center gap-2.5">
                        <span
                          className="inline-flex items-center justify-center w-8 h-8 rounded-md bg-cyan-50 border border-cyan-200 text-cyan-700"
                          aria-hidden
                        >
                          <Icon size={16} />
                        </span>
                        {t(m.nameKey)}
                      </div>
                    </td>
                    <td className="py-4 pr-3 text-fg-muted font-mono tnum align-top">
                      {t(m.daysKey)}
                    </td>
                    <td className="py-4 pr-5 text-fg-muted align-top">
                      {t(m.bestKey)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Container>

      {/* ── Phase 24 · Worked example ───────────────────────── */}
      <Container className="pb-16">
        <div className="max-w-4xl">
          <p className="text-[12px] font-medium tracking-wider uppercase text-cyan-700">
            Worked example
          </p>
          <h2 className="mt-3 text-[24px] md:text-[28px] font-semibold tracking-[-0.01em] max-w-2xl">
            What the landed cost looks like for a 100-unit TWS earbuds order
          </h2>
          <p className="mt-2 text-[13.5px] text-fg-muted max-w-2xl">
            Real example using current rates (¥1 = ৳{FX_CNY_BDT} interbank,
            air ৳1,348/kg, ৳240/kg duty for phone accessories). All numbers
            are pre-order estimates — the actual invoice is computed
            server-side at order time using the day&apos;s FX rate.
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

      {/* ── Phase 53 · With us / going direct comparison ───── */}
      <Container className="pb-16">
        <p className="text-[12px] font-medium tracking-wider uppercase text-cyan-700">
          {t("how.compare.eyebrow")}
        </p>
        <h2 className="mt-3 text-[24px] md:text-[28px] font-semibold tracking-[-0.01em] max-w-2xl">
          {t("how.compare.title")}
        </h2>
        <div className="mt-6 max-w-4xl card overflow-hidden">
          <table className="w-full text-[13.5px]">
            <thead>
              <tr className="text-left text-[10.5px] uppercase tracking-wider text-fg-subtle font-medium border-b border-border">
                <th className="py-3 pl-5 pr-3 w-[28%]">
                  {t("how.compare.col.thing")}
                </th>
                <th className="py-3 pr-3 w-[36%] bg-cyan-50 text-cyan-900">
                  {t("how.compare.col.us")}
                </th>
                <th className="py-3 pr-5 w-[36%]">
                  {t("how.compare.col.them")}
                </th>
              </tr>
            </thead>
            <tbody>
              {COMPARE_ROWS.map((r, i) => (
                <tr
                  key={r.thingKey}
                  className={i < COMPARE_ROWS.length - 1 ? "border-b border-border" : ""}
                >
                  <td className="py-4 pl-5 pr-3 font-medium align-top">
                    {t(r.thingKey)}
                  </td>
                  <td className="py-4 pr-3 align-top bg-cyan-50/50">
                    <div className="flex items-start gap-2">
                      <IconCheck
                        size={16}
                        className="shrink-0 mt-0.5 text-cyan-700"
                      />
                      <span className="text-fg">{t(r.usKey)}</span>
                    </div>
                  </td>
                  <td className="py-4 pr-5 align-top">
                    <div className="flex items-start gap-2">
                      <IconX
                        size={16}
                        className="shrink-0 mt-0.5 text-fg-faint"
                      />
                      <span className="text-fg-muted">{t(r.themKey)}</span>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Container>

      {/* ── Phase 53 · Payment methods ──────────────────────── */}
      <Container className="pb-16">
        <p className="text-[12px] font-medium tracking-wider uppercase text-cyan-700">
          {t("how.pay.eyebrow")}
        </p>
        <h2 className="mt-3 text-[24px] md:text-[28px] font-semibold tracking-[-0.01em] max-w-2xl">
          {t("how.pay.title")}
        </h2>
        <p className="mt-2 text-[13.5px] text-fg-muted max-w-2xl">
          {t("how.pay.subtitle")}
        </p>
        <div className="mt-6 max-w-4xl grid grid-cols-1 md:grid-cols-3 gap-4">
          {PAY_METHODS.map((m) => (
            <div key={m.id} className="card p-5">
              <div className="flex items-center gap-2.5">
                <span
                  className="inline-flex items-center justify-center w-9 h-9 rounded-md bg-cyan-50 border border-cyan-200 text-cyan-700"
                  aria-hidden
                >
                  <IconWallet size={18} />
                </span>
                <p className="text-[15px] font-semibold">{t(m.nameKey)}</p>
              </div>
              <p className="mt-3 text-[13px] text-fg-muted leading-relaxed">
                {t(m.descKey)}
              </p>
            </div>
          ))}
        </div>
      </Container>

      {/* ── Phase 24 · Quality control band ─────────────────── */}
      <Container className="pb-16">
        <div className="bg-slate-900 text-white rounded-2xl px-8 md:px-14 py-14 md:py-16">
          <div className="max-w-2xl">
            <p className="text-[12px] font-medium tracking-wider uppercase text-emerald-400">
              Quality control
            </p>
            <h2 className="mt-3 text-[28px] md:text-[36px] leading-tight font-semibold tracking-[-0.02em] text-white">
              {t("how.band.title")}
            </h2>
            <p className="mt-4 text-[16px] text-slate-300 leading-relaxed">
              {t("how.band.body")}
            </p>
          </div>
        </div>
      </Container>

      {/* ── Phase 53 · FAQ (native <details>) ────────────────── */}
      <Container className="pb-16">
        <p className="text-[12px] font-medium tracking-wider uppercase text-cyan-700">
          {t("how.faq.eyebrow")}
        </p>
        <h2 className="mt-3 text-[24px] md:text-[28px] font-semibold tracking-[-0.01em] max-w-2xl">
          {t("how.faq.title")}
        </h2>
        <div className="mt-6 max-w-4xl card overflow-hidden">
          <ul className="divide-y divide-border">
            {FAQ.map((f) => (
              <li key={f.qKey}>
                <details className="group">
                  <summary className="list-none cursor-pointer p-4 md:p-5 flex items-center justify-between gap-4 hover:bg-bg-soft">
                    <span className="text-[14.5px] md:text-[15px] font-medium">
                      {t(f.qKey)}
                    </span>
                    <IconChevron
                      size={18}
                      className="shrink-0 text-fg-muted transition-transform duration-200 group-open:rotate-180"
                    />
                  </summary>
                  <div className="px-4 md:px-5 pb-4 md:pb-5 -mt-1 text-[13.5px] text-fg-muted leading-relaxed">
                    {t(f.aKey)}
                  </div>
                </details>
              </li>
            ))}
          </ul>
        </div>
      </Container>

      {/* ── Phase 53 · Bottom CTA ──────────────────────────── */}
      <Container className="pb-24">
        <div className="bg-slate-900 text-white rounded-2xl px-8 md:px-14 py-12 md:py-14">
          <p className="text-[12px] font-medium tracking-wider uppercase text-emerald-400">
            {t("how.cta.eyebrow")}
          </p>
          <h2 className="mt-3 text-[26px] md:text-[32px] leading-tight font-semibold tracking-[-0.02em] max-w-2xl text-white">
            {t("how.cta.title")}
          </h2>
          <p className="mt-3 text-[15px] text-slate-300 leading-relaxed max-w-xl">
            {t("how.cta.subtitle")}
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <a
              href="/search"
              className="inline-flex items-center justify-center gap-2 h-12 px-6 rounded-md bg-cyan-500 text-white text-[14.5px] font-semibold hover:bg-cyan-400"
            >
              {t("how.cta.browse")}
              <span aria-hidden>→</span>
            </a>
            <a
              href="/rfq"
              className="inline-flex items-center justify-center gap-2 h-12 px-6 rounded-md border border-slate-700 text-slate-100 text-[14.5px] font-semibold hover:bg-slate-800"
            >
              {t("how.cta.rfq")}
            </a>
            <a
              href={whatsappLink()}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center justify-center gap-2 h-12 px-6 rounded-md border border-slate-700 text-slate-100 text-[14.5px] font-semibold hover:bg-slate-800"
            >
              {t("how.cta.whatsapp")}
            </a>
          </div>
        </div>
      </Container>
    </>
  );
}
