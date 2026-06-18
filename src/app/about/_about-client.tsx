"use client";
// /about — client renderer.
//
// Phase 53 enhancement: this file replaces the inline JSX that
// used to live in page.tsx so we can use the bilingual useLang()
// hook for the new sections (timeline, dontdo, FAQ, CTA) and
// keep them in sync with EN/BN.
//
// Sections in order:
//   1. Hero (mission + thesis)             — bilingual
//   2. By the numbers (live DB stats)      — server-passed
//   3. 6 reasons (fixed rose → cyan)       — bilingual
//   4. Story timeline (2022-2026)          — bilingual (NEW)
//   5. The team (3 desks)                  — static
//   6. What we don't do (transparency)     — bilingual (NEW)
//   7. Licenses & compliance               — static
//   8. FAQ (native <details>)              — bilingual (NEW)
//   9. Address card                        — static
//  10. Bottom CTA (WhatsApp + Email)       — bilingual (NEW)

import { Container } from "@/components/ui/container";
import { useLang } from "@/lib/i18n";
import { BRAND, whatsappLink } from "@/lib/contact";
import { IconChevron } from "@/components/portal-icons";

// 6 reasons (Phase 24) — brand color fix in Phase 53:
// the 5th reason was using `rose-50` / `rose-200` which
// violates the no-rose brand rule. Replaced with `cyan`.
// Visual variety now: cyan, emerald, violet, amber, cyan, cyan.
const REASONS = [
  {
    key: "r1",
    titleKey: "about.reasons.r1.title",
    bodyKey: "about.reasons.r1.body",
    tone: "cyan",
  },
  {
    key: "r2",
    titleKey: "about.reasons.r2.title",
    bodyKey: "about.reasons.r2.body",
    tone: "emerald",
  },
  {
    key: "r3",
    titleKey: "about.reasons.r3.title",
    bodyKey: "about.reasons.r3.body",
    tone: "violet",
  },
  {
    key: "r4",
    titleKey: "about.reasons.r4.title",
    bodyKey: "about.reasons.r4.body",
    tone: "amber",
  },
  {
    key: "r5",
    titleKey: "about.reasons.r5.title",
    bodyKey: "about.reasons.r5.body",
    tone: "cyan",
  },
  {
    key: "r6",
    titleKey: "about.reasons.r6.title",
    bodyKey: "about.reasons.r6.body",
    tone: "cyan",
  },
] as const;

const TONE_BG: Record<string, string> = {
  cyan: "bg-cyan-50 border-cyan-200",
  emerald: "bg-emerald-50 border-emerald-200",
  violet: "bg-violet-50 border-violet-200",
  amber: "bg-amber-50 border-amber-200",
};

const TONE_DOT: Record<string, string> = {
  cyan: "bg-cyan-500",
  emerald: "bg-emerald-500",
  violet: "bg-violet-500",
  amber: "bg-amber-500",
};

const LICENSES = [
  ["Trade License", "City Corporation, Dhaka"],
  ["RJSC Registration", "Private Limited Company"],
  ["TIN Certificate", "National Board of Revenue"],
  ["BIN", "Business Identification Number, NBR"],
  ["IRC", "Import Registration Certificate, CCI&E"],
  ["DBID", "Digital Business Identification"],
];

const TEAM_DESKS = [
  {
    city: "Dhaka",
    role: "Buyer support · Finance · Customs",
    detail: "Sat–Thu 9-18 BST. First point of contact for any post-order issue.",
  },
  {
    city: "Chittagong",
    role: "Customs · Freight · Last-mile",
    detail: "Coordinates with the C&F agent for clearance + delivery to your warehouse.",
  },
  {
    city: "Guangzhou / Yiwu",
    role: "Sourcing · QC · Consolidation",
    detail: "Photos each order, consolidates from 3-5 factories into one shipment.",
  },
] as const;

const TIMELINE = [
  { year: "2022", titleKey: "about.timeline.2022.title", bodyKey: "about.timeline.2022.body" },
  { year: "2024", titleKey: "about.timeline.2024.title", bodyKey: "about.timeline.2024.body" },
  { year: "2025", titleKey: "about.timeline.2025.title", bodyKey: "about.timeline.2025.body" },
  { year: "2026", titleKey: "about.timeline.2026.title", bodyKey: "about.timeline.2026.body" },
] as const;

const DONTDO = [
  { titleKey: "about.dontdo.1.title", bodyKey: "about.dontdo.1.body" },
  { titleKey: "about.dontdo.2.title", bodyKey: "about.dontdo.2.body" },
  { titleKey: "about.dontdo.3.title", bodyKey: "about.dontdo.3.body" },
  { titleKey: "about.dontdo.4.title", bodyKey: "about.dontdo.4.body" },
] as const;

const FAQ = [
  { qKey: "about.faq.q1", aKey: "about.faq.a1" },
  { qKey: "about.faq.q2", aKey: "about.faq.a2" },
  { qKey: "about.faq.q3", aKey: "about.faq.a3" },
  { qKey: "about.faq.q4", aKey: "about.faq.a4" },
  { qKey: "about.faq.q5", aKey: "about.faq.a5" },
  { qKey: "about.faq.q6", aKey: "about.faq.a6" },
] as const;

type Stats = { activeCount: number; supplierCount: number; viewsLast30d: number };

export function AboutClient({ stats }: { stats: Stats }) {
  const { t } = useLang();
  return (
    <>
      {/* 1. Hero */}
      <Container className="pt-16 md:pt-20 pb-12">
        <p className="text-[12px] font-medium tracking-wider uppercase text-cyan-700">
          {t("about.hero.eyebrow")}
        </p>
        <h1 className="mt-3 text-[36px] md:text-[48px] lg:text-[56px] leading-[1.05] font-semibold tracking-[-0.02em] max-w-3xl">
          {t("about.hero.title")}
        </h1>
        <p className="mt-5 text-[17px] text-fg-muted max-w-2xl leading-relaxed">
          {t("about.hero.subtitle")}
        </p>
        {/* Mini-CTA strip under the hero — quick action
            paths to the most common follow-ups. Avoids
            the user scrolling all the way down to find
            the contact link. */}
        <div className="mt-7 flex flex-wrap gap-3">
          <a
            href={whatsappLink(t("about.cta.whatsapp_prefill"))}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-2 h-11 px-5 rounded-md bg-cyan-600 text-white text-[14px] font-semibold hover:bg-cyan-700"
          >
            {t("about.cta.whatsapp")}
            <span aria-hidden>→</span>
          </a>
          <a
            href="/how-it-works"
            className="inline-flex items-center gap-2 h-11 px-5 rounded-md border border-border bg-bg text-[14px] font-semibold hover:bg-bg-soft"
          >
            {t("about.cta.see_process")}
          </a>
        </div>
      </Container>

      {/* 2. By the numbers */}
      <Container className="pb-14">
        <h2 className="text-[20px] font-semibold tracking-tight">
          {t("about.numbers.title")}
        </h2>
        <p className="mt-2 text-[13.5px] text-fg-muted max-w-2xl">
          {t("about.numbers.subtitle")}
        </p>
        <div className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-4">
          <Stat
            label={t("about.numbers.active")}
            value={stats.activeCount.toLocaleString()}
            tone="cyan"
          />
          <Stat
            label={t("about.numbers.suppliers")}
            value={stats.supplierCount.toLocaleString()}
            tone="emerald"
          />
          <Stat
            label={t("about.numbers.views")}
            value={stats.viewsLast30d.toLocaleString()}
            tone="violet"
          />
        </div>
      </Container>

      {/* 3. 6 reasons */}
      <Container className="pb-14">
        <h2 className="text-[20px] font-semibold tracking-tight">
          {t("about.reasons.title")}
        </h2>
        <p className="mt-2 text-[13.5px] text-fg-muted max-w-2xl">
          {t("about.reasons.subtitle")}
        </p>
        <div className="mt-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {REASONS.map((r) => (
            <div key={r.key} className={`card p-5 border-l-4 ${TONE_BG[r.tone]}`}>
              <div className="flex items-center gap-2">
                <span className={`w-1.5 h-1.5 rounded-full ${TONE_DOT[r.tone]}`} />
                <p className="text-[10.5px] uppercase tracking-wider font-medium text-fg-subtle">
                  {t("about.reasons.eyebrow")}
                </p>
              </div>
              <h3 className="mt-3 text-[16px] font-semibold tracking-[-0.005em]">
                {t(r.titleKey)}
              </h3>
              <p className="mt-2 text-[13px] text-fg-muted leading-relaxed">
                {t(r.bodyKey)}
              </p>
            </div>
          ))}
        </div>
      </Container>

      {/* 4. Story timeline (Phase 53) */}
      <Container className="pb-14">
        <h2 className="text-[20px] font-semibold tracking-tight">
          {t("about.timeline.eyebrow")}
        </h2>
        <p className="mt-2 text-[13.5px] text-fg-muted max-w-2xl">
          {t("about.timeline.subtitle")}
        </p>
        <div className="mt-6 max-w-3xl relative">
          {/* Vertical line behind the dots — desktop only.
              On mobile, the line collapses to the left of
              the column. We use `before:` pseudo via a
              wrapper div for the line. */}
          <ol className="relative space-y-6">
            {TIMELINE.map((tl, i) => (
              <li key={tl.year} className="relative pl-12 md:pl-16">
                {/* The year-dot. absolute-positioned in the
                    left gutter. Cyan = brand. Larger on
                    mobile for legibility. */}
                <span
                  className="absolute left-0 top-0 inline-flex items-center justify-center w-10 h-10 md:w-12 md:h-12 rounded-full bg-cyan-600 text-white text-[12px] md:text-[13px] font-semibold font-mono"
                  aria-hidden
                >
                  {tl.year.slice(2)}
                </span>
                <h3 className="text-[16px] font-semibold tracking-[-0.005em]">
                  {t(tl.titleKey)}
                </h3>
                <p className="mt-1.5 text-[13.5px] text-fg-muted leading-relaxed max-w-2xl">
                  {t(tl.bodyKey)}
                </p>
              </li>
            ))}
          </ol>
        </div>
      </Container>

      {/* 5. The team */}
      <Container className="pb-14">
        <h2 className="text-[20px] font-semibold tracking-tight">
          {t("about.team.title")}
        </h2>
        <p className="mt-2 text-[13.5px] text-fg-muted max-w-2xl">
          {t("about.team.subtitle")}
        </p>
        <div className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-4">
          {TEAM_DESKS.map((d) => (
            <div key={d.city} className="card p-5">
              <p className="text-[10.5px] uppercase tracking-wider font-medium text-fg-subtle">
                {d.city}
              </p>
              <p className="mt-1 text-[15px] font-semibold">{d.role}</p>
              <p className="mt-2 text-[12.5px] text-fg-muted leading-relaxed">
                {d.detail}
              </p>
            </div>
          ))}
        </div>
      </Container>

      {/* 6. What we don't do (Phase 53) */}
      <Container className="pb-14">
        <h2 className="text-[20px] font-semibold tracking-tight">
          {t("about.dontdo.eyebrow")}
        </h2>
        <p className="mt-2 text-[13.5px] text-fg-muted max-w-2xl">
          {t("about.dontdo.subtitle")}
        </p>
        <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-4 max-w-4xl">
          {DONTDO.map((d) => (
            <div
              key={d.titleKey}
              className="card p-5 flex gap-4"
            >
              {/* Amber dot = "we deliberately don't do this".
                  Distinct from the brand cyan, signals an
                  intentional choice without scolding. */}
              <span
                className="shrink-0 mt-1 inline-flex items-center justify-center w-8 h-8 rounded-full bg-amber-50 border border-amber-200"
                aria-hidden
              >
                <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
              </span>
              <div className="min-w-0">
                <h3 className="text-[15px] font-semibold tracking-[-0.005em]">
                  {t(d.titleKey)}
                </h3>
                <p className="mt-1.5 text-[13px] text-fg-muted leading-relaxed">
                  {t(d.bodyKey)}
                </p>
              </div>
            </div>
          ))}
        </div>
      </Container>

      {/* 7. Licenses & compliance */}
      <Container className="pb-14">
        <h2 className="text-[20px] font-semibold tracking-tight">
          {t("about.licenses.title")}
        </h2>
        <div className="mt-5 max-w-3xl card overflow-hidden">
          <table className="table-clean">
            <tbody>
              {LICENSES.map(([k, v]) => (
                <tr key={k}>
                  <td className="font-medium w-1/2">{k}</td>
                  <td className="text-fg-muted">{v}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Container>

      {/* 8. FAQ — native <details>/<summary> for accordion
           behavior. No JS required, accessible by default
           (keyboard, screen reader, focus). Chevron rotates
           180° via CSS when the row is open. */}
      <Container className="pb-14">
        <h2 className="text-[20px] font-semibold tracking-tight">
          {t("about.faq.eyebrow")}
        </h2>
        <p className="mt-2 text-[13.5px] text-fg-muted max-w-2xl">
          {t("about.faq.title")}
        </p>
        <div className="mt-6 max-w-3xl card overflow-hidden">
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

      {/* 9. Address card */}
      <Container className="pb-14">
        <div className="max-w-3xl card p-6 md:p-8">
          <p className="text-[11px] text-fg-subtle uppercase tracking-wider font-medium">
            {t("about.address.eyebrow")}
          </p>
          <p className="mt-2 text-[15px] font-medium">
            {BRAND.address.map((line, i) => (
              <span key={i}>
                {line}
                {i < BRAND.address.length - 1 && <br />}
              </span>
            ))}
          </p>
          <div className="mt-5 pt-5 border-t border-border flex flex-wrap gap-x-8 gap-y-2 text-[13px]">
            <a
              href={`mailto:${BRAND.email}`}
              className="text-fg-muted hover:text-fg"
            >
              {BRAND.email}
            </a>
            <a
              href={`tel:${BRAND.phoneBdE164}`}
              className="text-fg-muted hover:text-fg font-mono tnum"
            >
              {BRAND.phoneBdDisplay}
            </a>
            <a
              href="https://wa.me/8617325764171"
              target="_blank"
              rel="noreferrer"
              className="text-fg-muted hover:text-fg font-mono tnum"
            >
              WhatsApp
            </a>
          </div>
        </div>
      </Container>

      {/* 10. Bottom CTA (Phase 53) — gives the user one
            clear "next step" after reading the page. */}
      <Container className="pb-24">
        <div className="bg-slate-900 text-white rounded-2xl px-8 md:px-14 py-12 md:py-14">
          <div className="grid md:grid-cols-2 gap-8 items-center">
            <div>
              <p className="text-[12px] font-medium tracking-wider uppercase text-emerald-400">
                {t("about.cta.eyebrow")}
              </p>
              <h2 className="mt-3 text-[26px] md:text-[32px] leading-tight font-semibold tracking-[-0.02em] text-white">
                {t("about.cta.title")}
              </h2>
              <p className="mt-3 text-[15px] text-slate-300 leading-relaxed max-w-xl">
                {t("about.cta.subtitle")}
              </p>
            </div>
            <div className="flex flex-col gap-3">
              <a
                href={whatsappLink(t("about.cta.whatsapp_prefill"))}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center justify-center gap-2 h-12 px-6 rounded-md bg-cyan-500 text-white text-[14.5px] font-semibold hover:bg-cyan-400"
              >
                {t("about.cta.whatsapp")}
                <span aria-hidden>→</span>
              </a>
              <a
                href={`mailto:${BRAND.email}`}
                className="inline-flex items-center justify-center gap-2 h-12 px-6 rounded-md border border-slate-700 text-slate-100 text-[14.5px] font-semibold hover:bg-slate-800"
              >
                {t("about.cta.email")}
              </a>
              <div className="mt-2 pt-3 border-t border-slate-800 text-[12.5px] text-slate-400 leading-relaxed">
                <p className="font-semibold uppercase tracking-wider text-[10.5px] text-slate-500">
                  {t("about.cta.hours_label")}
                </p>
                <p className="mt-1">{t("about.cta.hours_dhaka")}</p>
                <p className="mt-1">{t("about.cta.hours_china")}</p>
              </div>
            </div>
          </div>
        </div>
      </Container>
    </>
  );
}

function Stat({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone: "cyan" | "emerald" | "violet";
}) {
  return (
    <div className="card p-5">
      <div className="flex items-center gap-2">
        <span
          className={`w-1.5 h-1.5 rounded-full ${
            tone === "cyan"
              ? "bg-cyan-500"
              : tone === "emerald"
                ? "bg-emerald-500"
                : "bg-violet-500"
          }`}
        />
        <p className="text-[10.5px] uppercase tracking-wider text-fg-subtle font-medium">
          {label}
        </p>
      </div>
      <p className="mt-3 text-[36px] font-semibold tracking-tight font-mono tnum">
        {value}
      </p>
    </div>
  );
}
