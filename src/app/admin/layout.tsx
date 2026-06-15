import { requireAdmin } from "@/lib/portal-auth";
import { adminNav } from "@/lib/admin-nav";
import { getServiceRoleClient } from "@/lib/supabase/server";
import { PortalShell } from "@/components/portal-shell";
import { TopbarSearch } from "@/components/topbar-search";
import Link from "next/link";
import { IconBell } from "@/components/portal-icons";

export const dynamic = "force-dynamic";
export const revalidate = 0;

async function loadCounts() {
  try {
    const supabase = getServiceRoleClient();
    const [
      products,
      quotes,
      alerts,
      since7dViews,
      openOrders,
      openRFQs,
    ] = await Promise.all([
      supabase.from("products").select("id", { count: "exact", head: true }),
      supabase.from("quotes").select("id", { count: "exact", head: true }),
      supabase
        .from("price_alert_log")
        .select("id", { count: "exact", head: true })
        .is("acknowledged_at", null),
      supabase
        .from("page_views")
        .select("id", { count: "exact", head: true })
        .gte(
          "recorded_at",
          new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
        ),
      // Open orders = pending_payment + paid (the two states a
      // human needs to act on). Terminal states (delivered,
      // cancelled) are excluded.
      supabase
        .from("orders")
        .select("id", { count: "exact", head: true })
        .in("status", ["pending_payment", "paid"]),
      // Open RFQs = status='open' (the only state a human needs
      // to act on — once quoted, the ball's in the buyer's court).
      supabase
        .from("rfqs")
        .select("id", { count: "exact", head: true })
        .eq("status", "open"),
    ]);
    return {
      products: products.count ?? 0,
      quotes: quotes.count ?? 0,
      openAlerts: alerts.count ?? 0,
      openQuotes: 0,
      trafficLast7d: since7dViews.count ?? 0,
      openOrders: openOrders.count ?? 0,
      openRFQs: openRFQs.count ?? 0,
    };
  } catch {
    return {
      products: 0,
      quotes: 0,
      openAlerts: 0,
      openQuotes: 0,
      trafficLast7d: 0,
      openOrders: 0,
      openRFQs: 0,
    };
  }
}

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await requireAdmin("/admin");
  const counts = await loadCounts();
  return (
    <PortalShell
      brand="BanglaSource Admin"
      groups={adminNav(counts)}
      user={{
        email: user.email,
        fullName: user.fullName,
        isAdmin: user.isAdmin,
      }}
      switchToHref="/buyer"
      switchToLabel="Switch to buyer view"
      topbar={
        <>
          <TopbarSearch />
          <div className="flex-1" />
          <Link
            href="/admin/alerts"
            className="h-9 w-9 rounded-md hover:bg-bg-soft flex items-center justify-center text-fg-muted hover:text-fg relative"
            title="Alerts"
          >
            <IconBell size={16} />
            {counts.openAlerts > 0 && (
              <span className="absolute top-1 right-1 w-2 h-2 rounded-full bg-rose-500" />
            )}
          </Link>
          <Link
            href="/"
            className="text-[12px] text-fg-muted hover:text-fg h-9 px-3 rounded-md hover:bg-bg-soft flex items-center"
            target="_blank"
          >
            ↗ Public site
          </Link>
        </>
      }
    >
      {children}
    </PortalShell>
  );
}
