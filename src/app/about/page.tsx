// /about — Phase 24: fleshed out 6-section "why
// BanglaSource" with real numbers from the DB and
// a clearer team / operations / compliance story.
//
// The 6 sections in order:
//   1. Hero (mission + thesis)
//   2. By the numbers (live stats from the DB)
//   3. The 6 reasons buyers choose us (differentiators)
//   4. The team (where we sit, what each desk does)
//   5. Compliance (licenses — same as before)
//   6. Address card (with corrected .com email)

import { Container } from "@/components/ui/container";
import { getServiceRoleClient } from "@/lib/supabase/server";
import { BRAND } from "@/lib/contact";
import { jsonLdScript } from "@/lib/seo";

export const metadata = {
  title: "About",
  description: `BanglaSource is a Dhaka-headquartered B2B sourcing desk connecting verified Chinese factories to Bangladeshi resellers. Landed cost all the way to your door, bKash & bank payment, end-to-end shipping.`,
};

const REASONS = [
  {
    title: "One all-in BDT price",
    body: "Every catalog product shows a single BDT figure that includes factory FOB, FX, air or sea freight, BD customs duty, VAT, and AIT. No surprises at the customs broker.",
    tone: "cyan",
  },
  {
    title: "Pre-pay 100%, no balance on delivery",
    body: "We confirm the full landed cost within an hour of your order. You wire the total once and we move. No '30% balance to the courier' pattern that other desks use.",
    tone: "emerald",
  },
  {
    title: "Verified-desk model, not an open marketplace",
    body: "Every product is hand-vetted, every supplier is verified, every order passes through our consolidation warehouse in Guangzhou before shipping. We are the desk, not a list.",
    tone: "violet",
  },
  {
    title: "Bangladesh-specific tax math",
    body: "Customs duty is per-kg specific (not ad-valorem %), VAT is 15% of (CIF + duty), AIT is 5% of CIF. The math is non-trivial; we encode it so the price you see is the price you pay.",
    tone: "amber",
  },
  {
    title: "Bangla + English support, real humans",
    body: "Sat-Thu 9-18 BST Dhaka office, plus a China desk staffed 24/7 for factory emergencies. WhatsApp first, email if you prefer paper. No ticket system, no bots.",
    tone: "rose",
  },
  {
    title: "Open to RFQs, not just catalog",
    body: "If the catalog doesn't have it, post a Request-for-Quote with spec + qty + photos. We forward to 3-5 verified factories and return sealed bids in 48 hours.",
    tone: "cyan",
  },
] as const;

const TONE_BG: Record<string, string> = {
  cyan: "bg-cyan-50 border-cyan-200",
  emerald: "bg-emerald-50 border-emerald-200",
  violet: "bg-violet-50 border-violet-200",
  amber: "bg-amber-50 border-amber-200",
  rose: "bg-rose-50 border-rose-200",
};

const TONE_DOT: Record<string, string> = {
  cyan: "bg-cyan-500",
  emerald: "bg-emerald-500",
  violet: "bg-violet-500",
  amber: "bg-amber-500",
  rose: "bg-rose-500",
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

async function loadStats() {
  try {
    const sb = getServiceRoleClient();
    const [active, suppliers, viewStats] = await Promise.all([
      sb.from("products").select("id", { count: "exact", head: true }).eq("active", true),
      sb.from("products").select("supplier_name").eq("active", true).limit(500),
      sb
        .from("page_views")
        .select("id", { count: "exact", head: true })
        .gte(
          "recorded_at",
          new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
        ),
    ]);
    const uniqSuppliers = new Set(
      (suppliers.data ?? []).map((r: any) => r.supplier_name).filter(Boolean),
    ).size;
    return {
      activeCount: active.count ?? 0,
      supplierCount: uniqSuppliers,
      viewsLast30d: viewStats.count ?? 0,
    };
  } catch {
    return { activeCount: 0, supplierCount: 0, viewsLast30d: 0 };
  }
}

export default async function AboutPage() {
  const stats = await loadStats();
  return (
    <>
      {/* AboutPage JSON-LD: a simple Organization variant
          keyed to the company. The home page already
          carries the canonical Organization entity; this
          is a redundant signal pointing at the about page
          so Google can render a richer knowledge panel. */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: jsonLdScript({
            "@context": "https://schema.org",
            "@type": "AboutPage",
            name: `About ${BRAND.name}`,
            url: `https://${BRAND.domain}/about`,
            mainEntity: {
              "@type": "Organization",
              name: BRAND.name,
              email: BRAND.email,
              address: {
                "@type": "PostalAddress",
                streetAddress: BRAND.address[0],
                addressLocality: "Dhaka",
                postalCode: "1205",
                addressCountry: "BD",
              },
            },
          }),
        }}
      />

      <Container className="pt-16 md:pt-20 pb-12">
        <p className="text-[12px] font-medium tracking-wider uppercase text-cyan-700">
          About
        </p>
        <h1 className="mt-3 text-[40px] md:text-[56px] leading-[1.05] font-semibold tracking-[-0.02em] max-w-3xl">
          Built for Bangladeshi resellers, run from Dhaka + Guangzhou.
        </h1>
        <p className="mt-5 text-[17px] text-fg-muted max-w-2xl leading-relaxed">
          We started in 2024 after watching too many
          Bangladeshi shop owners get burned buying from
          wholesale platforms directly — wrong shipments,
          ghost factories, customs holds. We built the
          desk we wished existed.
        </p>
      </Container>

      {/* 2. By the numbers */}
      <Container className="pb-12">
        <h2 className="text-[20px] font-semibold tracking-tight">By the numbers</h2>
        <p className="mt-2 text-[13.5px] text-fg-muted max-w-2xl">
          Live figures from the catalog and traffic. The
          catalog syncs weekly; the 30-day traffic is
          real page-view data.
        </p>
        <div className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-4">
          <Stat label="Active products" value={stats.activeCount.toLocaleString()} tone="cyan" />
          <Stat label="Verified suppliers" value={stats.supplierCount.toLocaleString()} tone="emerald" />
          <Stat label="Page views · 30 days" value={stats.viewsLast30d.toLocaleString()} tone="violet" />
        </div>
      </Container>

      {/* 3. The 6 reasons */}
      <Container className="pb-12">
        <h2 className="text-[20px] font-semibold tracking-tight">6 reasons buyers choose us</h2>
        <p className="mt-2 text-[13.5px] text-fg-muted max-w-2xl">
          The full version. The short version: we
          remove every part of the cross-border import
          process that&apos;s a surprise.
        </p>
        <div className="mt-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {REASONS.map((r) => (
            <div key={r.title} className={`card p-5 border-l-4 ${TONE_BG[r.tone]}`}>
              <div className="flex items-center gap-2">
                <span className={`w-1.5 h-1.5 rounded-full ${TONE_DOT[r.tone]}`} />
                <p className="text-[10.5px] uppercase tracking-wider font-medium text-fg-subtle">
                  Why us
                </p>
              </div>
              <h3 className="mt-3 text-[16px] font-semibold tracking-[-0.005em]">
                {r.title}
              </h3>
              <p className="mt-2 text-[13px] text-fg-muted leading-relaxed">
                {r.body}
              </p>
            </div>
          ))}
        </div>
      </Container>

      {/* 4. The team */}
      <Container className="pb-12">
        <h2 className="text-[20px] font-semibold tracking-tight">The team</h2>
        <p className="mt-2 text-[13.5px] text-fg-muted max-w-2xl">
          Three desks, three timezones. Whoever you talk
          to, they own the outcome.
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

      {/* 5. Compliance */}
      <Container className="pb-12">
        <h2 className="text-[20px] font-semibold tracking-tight">Licenses & compliance</h2>
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

      {/* 6. Address card */}
      <Container className="pb-24">
        <div className="max-w-3xl card p-6 md:p-8">
          <p className="text-[11px] text-fg-subtle uppercase tracking-wider font-medium">
            Dhaka office
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
