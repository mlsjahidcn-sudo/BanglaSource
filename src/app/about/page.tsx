// /about — server component.
//
// Phase 24 (the original 6 sections) + Phase 53 enhancements:
//   - Story timeline (4 milestones 2022-2026)
//   - "What we don't do" (transparency section)
//   - FAQ (native <details>, no JS, accessible by default)
//   - Bottom CTA with hours
//   - Brand color fix: replaced `rose` tone with `cyan` to honor
//     the no-rose rule (the 5th reason was violating it)
//
// Server side: loads DB stats + emits AboutPage JSON-LD.
// Renders: <AboutClient stats={stats} /> — that component uses
// `useLang` for bilingual content.

import { Container } from "@/components/ui/container";
import { getServiceRoleClient } from "@/lib/supabase/server";
import { BRAND } from "@/lib/contact";
import { jsonLdScript } from "@/lib/seo";
import { AboutClient } from "./_about-client";

export const metadata = {
  title: "About",
  description: `BanglaSource is a Dhaka-headquartered B2B sourcing desk connecting verified Chinese factories to Bangladeshi resellers. Landed cost all the way to your door, bKash & bank payment, end-to-end shipping.`,
};

async function loadStats() {
  try {
    const sb = getServiceRoleClient();
    const [active, suppliers, viewStats] = await Promise.all([
      sb.from("products").select("id", { count: "exact", head: true }).eq("active", true),
      // Phase 56: query the RAW supplier_name field directly, NOT
      // through getCatalog() — the public catalog strips supplier
      // identity. We need a count here (not the names), and the
      // count never leaves the server. Filtering out the empty
      // bucket ensures we only count real factories.
      sb
        .from("products")
        .select("supplier_name")
        .eq("active", true)
        .not("supplier_name", "is", null)
        .neq("supplier_name", "")
        .limit(2000),
      sb
        .from("page_views")
        .select("id", { count: "exact", head: true })
        .gte(
          "recorded_at",
          new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
        ),
    ]);
    const uniqSuppliers = new Set(
      (suppliers.data ?? []).map((r: any) => r.supplier_name),
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

      <AboutClient stats={stats} />
    </>
  );
}
