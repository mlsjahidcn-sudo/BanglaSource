import { AdminPage, AdminPageHeader } from "@/components/admin-page";
import { getServiceRoleClient } from "@/lib/supabase/server";
import Link from "next/link";

export const dynamic = "force-dynamic";
export const revalidate = 0;

async function loadSummary() {
  // Phase 27 (hand-picked pivot, 2026-06-15): the catalog is no
  // longer auto-synced. Removed the sync_runs / discovered_products
  // reads from this dashboard. Recent-activity list now shows the
  // most recent product edits instead.
  try {
    const supabase = getServiceRoleClient();
    const since24h = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const [products, active, quotesPending, quotes, openAlerts, views24h, recentEdits] =
      await Promise.all([
        supabase.from("products").select("id", { count: "exact", head: true }),
        supabase
          .from("products")
          .select("id", { count: "exact", head: true })
          .eq("active", true),
        supabase
          .from("quotes")
          .select("id", { count: "exact", head: true })
          .eq("status", "pending"),
        supabase.from("quotes").select("id", { count: "exact", head: true }),
        supabase
          .from("price_alert_log")
          .select("id", { count: "exact", head: true })
          .is("acknowledged_at", null),
        supabase
          .from("page_views")
          .select("id", { count: "exact", head: true })
          .gte("recorded_at", since24h),
        supabase
          .from("products")
          .select("source_id, title_en, updated_at")
          .order("updated_at", { ascending: false })
          .limit(8),
      ]);
    return {
      products: products.count ?? 0,
      active: active.count ?? 0,
      quotesPending: quotesPending.count ?? 0,
      quotes: quotes.count ?? 0,
      openAlerts: openAlerts.count ?? 0,
      views24h: views24h.count ?? 0,
      recentEdits: recentEdits.data ?? [],
    };
  } catch {
    return {
      products: 0,
      active: 0,
      quotesPending: 0,
      quotes: 0,
      openAlerts: 0,
      views24h: 0,
      recentEdits: [],
    };
  }
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleString("en-BD", {
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default async function AdminDashboard() {
  const s = await loadSummary();
  const cards = [
    {
      label: "Catalog",
      value: s.products,
      sub: `${s.active} active`,
      href: "/admin/products",
    },
    {
      label: "Add product",
      value: "+",
      sub: "Hand-pick from Pinduoduo / Taobao / other",
      href: "/admin/products/new",
    },
    {
      label: "Quote requests",
      value: s.quotes,
      sub: `${s.quotesPending} pending`,
      href: "/admin/quotes",
    },
    {
      label: "Open alerts",
      value: s.openAlerts,
      sub: ">15% moves",
      href: "/admin/alerts",
    },
    {
      label: "Views (24h)",
      value: s.views24h,
      sub: "page_views",
      href: "/admin/traffic",
    },
  ];
  return (
    <AdminPage>
      {/* Header */}
      <AdminPageHeader
        eyebrow="Admin · overview"
        title="Dashboard"
        dotColor="emerald"
        actions={
          <>
            <Link
              href="/admin/products/new"
              className="px-3 py-1.5 text-[12px] border border-emerald-300 text-emerald-700 bg-emerald-50 rounded-md hover:bg-emerald-100"
            >
              + Add product
            </Link>
            <Link
              href="/"
              target="_blank"
              className="px-3 py-1.5 text-[12px] text-fg-muted hover:text-fg"
            >
              ↗ Public site
            </Link>
          </>
        }
      />

      {/* Summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-px bg-border border border-border rounded-lg overflow-hidden">
        {cards.map((c) => (
          <Link
            key={c.label}
            href={c.href}
            className="bg-bg p-4 md:p-5 hover:bg-bg-soft transition-colors group"
          >
            <p className="text-[10px] font-medium tracking-wider uppercase text-fg-subtle">
              {c.label}
            </p>
            <p className="price-tag mt-1.5 text-[28px] md:text-[32px] font-semibold leading-none">
              {c.value}
            </p>
            <p className="mt-2 text-[11px] text-fg-muted">{c.sub}</p>
          </Link>
        ))}
      </div>

      {/* Recent catalog edits */}
      <div className="mt-10">
        <h2 className="text-[18px] font-semibold tracking-tight mb-4">
          Recent catalog edits
        </h2>
        <div className="card overflow-hidden">
          <table className="w-full text-[13px]">
            <thead className="text-[11px] uppercase tracking-wider text-fg-subtle border-b border-border">
              <tr>
                <th className="text-left font-medium px-4 py-3">Updated</th>
                <th className="text-left font-medium px-4 py-3">Product</th>
                <th className="text-left font-medium px-4 py-3">Source ID</th>
                <th className="text-right font-medium px-4 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {s.recentEdits.length === 0 ? (
                <tr>
                  <td colSpan={4} className="text-center text-fg-muted py-8">
                    No catalog edits yet — add a product to get started.
                  </td>
                </tr>
              ) : (
                s.recentEdits.map((r) => (
                  <tr
                    key={r.source_id}
                    className="border-b border-border last:border-b-0 hover:bg-bg-soft"
                  >
                    <td className="px-4 py-2.5 font-mono tnum text-[12px]">
                      {fmtDate(r.updated_at)}
                    </td>
                    <td className="px-4 py-2.5 text-[13px] line-clamp-1">
                      {r.title_en}
                    </td>
                    <td className="px-4 py-2.5 font-mono tnum text-[12px] text-fg-muted">
                      {r.source_id}
                    </td>
                    <td className="px-4 py-2.5 text-right">
                      <Link
                        href={`/admin/products/${r.source_id}`}
                        className="text-cyan-700 hover:underline text-[12px]"
                      >
                        Edit →
                      </Link>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Quick links */}
      <div className="mt-10 grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
        <QuickLink
          href="/admin/products/new"
          label="Add a product"
          desc="Hand-pick a trending item from Pinduoduo, Taobao, or any China source."
        />
        <QuickLink
          href="/admin/products"
          label="Catalog"
          desc="All products, including legacy stock you can hide or delete."
        />
        <QuickLink
          href="/admin/quotes"
          label="Triage quotes"
          desc={`${s.quotesPending} pending quote requests from buyers.`}
        />
        <QuickLink
          href="/admin/alerts"
          label="Check alerts"
          desc={`${s.openAlerts} open price alerts to review.`}
        />
        <QuickLink
          href="/admin/traffic"
          label="View traffic"
          desc="Self-hosted pageview analytics, last 7 days."
        />
        <QuickLink
          href="/admin/users"
          label="Manage users"
          desc="All registered buyers, by signup date."
        />
      </div>
    </AdminPage>
  );
}

function QuickLink({
  href,
  label,
  desc,
}: {
  href: string;
  label: string;
  desc: string;
}) {
  return (
    <Link
      href={href}
      className="card p-5 hover:border-border-strong transition-colors group"
    >
      <h3 className="text-[14px] font-semibold tracking-tight group-hover:underline">
        {label}
      </h3>
      <p className="mt-1 text-[12px] text-fg-muted leading-relaxed">{desc}</p>
    </Link>
  );
}
