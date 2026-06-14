import { AdminPage, AdminPageHeader } from "@/components/admin-page";
import { getServiceRoleClient } from "@/lib/supabase/server";
import Link from "next/link";

export const dynamic = "force-dynamic";
export const revalidate = 0;

async function loadSummary() {
  try {
    const supabase = getServiceRoleClient();
    const since24h = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const [products, active, quotesPending, quotes, discoveries, openAlerts, views24h, recentSyncs] =
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
          .from("discovered_products")
          .select("id", { count: "exact", head: true })
          .eq("status", "new"),
        supabase
          .from("price_alert_log")
          .select("id", { count: "exact", head: true })
          .is("acknowledged_at", null),
        supabase
          .from("page_views")
          .select("id", { count: "exact", head: true })
          .gte("recorded_at", since24h),
        supabase
          .from("sync_runs")
          .select("id,trigger,started_at,finished_at,products_seen,products_changed,api_cost_usd,error")
          .order("started_at", { ascending: false })
          .limit(5),
      ]);
    return {
      products: products.count ?? 0,
      active: active.count ?? 0,
      quotesPending: quotesPending.count ?? 0,
      quotes: quotes.count ?? 0,
      discoveries: discoveries.count ?? 0,
      openAlerts: openAlerts.count ?? 0,
      views24h: views24h.count ?? 0,
      recentSyncs: recentSyncs.data ?? [],
    };
  } catch {
    return {
      products: 0,
      active: 0,
      quotesPending: 0,
      quotes: 0,
      discoveries: 0,
      openAlerts: 0,
      views24h: 0,
      recentSyncs: [],
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

function fmtDuration(start: string, end: string | null) {
  if (!end) return "—";
  const ms = new Date(end).getTime() - new Date(start).getTime();
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

export default async function AdminDashboard() {
  const s = await loadSummary();
  const cards = [
    {
      label: "Catalog",
      value: s.products,
      sub: `${s.active} active`,
      href: "/admin/sync",
    },
    {
      label: "Quote requests",
      value: s.quotes,
      sub: `${s.quotesPending} pending`,
      href: "/admin/quotes",
    },
    {
      label: "Discoveries",
      value: s.discoveries,
      sub: "new from 1688",
      href: "/admin/discovery",
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
              href="/admin/sync"
              className="px-3 py-1.5 text-[12px] border border-border rounded-md hover:bg-bg-soft"
            >
              Open sync
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

      {/* Recent sync runs */}
      <div className="mt-10">
        <h2 className="text-[18px] font-semibold tracking-tight mb-4">
          Recent sync runs
        </h2>
        <div className="card overflow-hidden">
          <table className="w-full text-[13px]">
            <thead className="text-[11px] uppercase tracking-wider text-fg-subtle border-b border-border">
              <tr>
                <th className="text-left font-medium px-4 py-3">Started</th>
                <th className="text-left font-medium px-4 py-3">Trigger</th>
                <th className="text-right font-medium px-4 py-3">Seen</th>
                <th className="text-right font-medium px-4 py-3">Changed</th>
                <th className="text-right font-medium px-4 py-3">Cost</th>
                <th className="text-right font-medium px-4 py-3">Duration</th>
              </tr>
            </thead>
            <tbody>
              {s.recentSyncs.length === 0 ? (
                <tr>
                  <td colSpan={6} className="text-center text-fg-muted py-8">
                    No sync runs yet.
                  </td>
                </tr>
              ) : (
                s.recentSyncs.map((r) => (
                  <tr
                    key={r.id}
                    className="border-b border-border last:border-b-0 hover:bg-bg-soft"
                  >
                    <td className="px-4 py-2.5 font-mono tnum text-[12px]">
                      {fmtDate(r.started_at)}
                    </td>
                    <td className="px-4 py-2.5 text-[12px] text-fg-muted">
                      {r.trigger}
                    </td>
                    <td className="px-4 py-2.5 text-right font-mono tnum">
                      {r.products_seen}
                    </td>
                    <td className="px-4 py-2.5 text-right font-mono tnum">
                      {r.products_changed}
                    </td>
                    <td className="px-4 py-2.5 text-right font-mono tnum text-[12px]">
                      {r.api_cost_usd ? `$${r.api_cost_usd.toFixed(4)}` : "—"}
                    </td>
                    <td className="px-4 py-2.5 text-right font-mono tnum text-[12px]">
                      {fmtDuration(r.started_at, r.finished_at)}
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
          href="/admin/sync"
          label="Sync catalog"
          desc="Nightly 1688 price refresh + manual trigger."
        />
        <QuickLink
          href="/admin/discovery"
          label="Review discoveries"
          desc={`${s.discoveries} new SKUs found by 1688 keyword search.`}
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
