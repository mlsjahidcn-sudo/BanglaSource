// /lib/admin-nav.ts
// Admin portal sidebar config.
//
// Phase 27 (hand-picked pivot, 2026-06-15): removed Sync and
// Discoveries nav items — the catalog is now hand-curated via
// /admin/products/new, so there's nothing to auto-sync or to
// review from 1688 keyword search. The `discoveries` count
// in the counts object is also no longer used.
//
// Phase 37 (group buy admin, 2026-06-17): added the
// "Group buys" sidebar item + `groupBuyNavCounts` helper for
// the per-status counts the list-page filter chips use.

import {
  IconHome,
  IconChart,
  IconAlert,
  IconQuote,
  IconRFQ,
  IconUsers,
  IconTraffic,
  IconPackage,
  IconAI,
  IconImage,
  IconPlus,
  IconOrders,
  IconGroupBuy,
} from "@/components/portal-icons";
import type { NavGroup } from "@/components/portal-shell";
import type { ServiceClient } from "@/lib/supabase/server";

export const adminNav = (counts: {
  products: number;
  openAlerts: number;
  quotes: number;
  trafficLast7d: number;
  openOrders: number;
  openRFQs: number;
  openGroupBuys: number;
}): NavGroup[] => [
  {
    label: "Overview",
    items: [
      { label: "Dashboard", href: "/admin", icon: <IconHome />, exact: true },
      {
        label: "Traffic",
        href: "/admin/traffic",
        icon: <IconTraffic />,
        badge: counts.trafficLast7d,
      },
    ],
  },
  {
    label: "Catalog",
    items: [
      {
        label: "Products",
        href: "/admin/products",
        icon: <IconPackage />,
        badge: counts.products,
      },
      {
        label: "Group buys",
        href: "/admin/group-buys",
        icon: <IconGroupBuy />,
        badge: counts.openGroupBuys,
      },
      {
        label: "Add product",
        href: "/admin/products/new",
        icon: <IconPlus />,
      },
      {
        label: "Image agent",
        href: "/admin/images",
        icon: <IconImage />,
      },
    ],
  },
  {
    label: "Inbound",
    items: [
      {
        label: "Orders",
        href: "/admin/orders",
        icon: <IconOrders />,
        badge: counts.openOrders,
      },
      {
        label: "Quote requests",
        href: "/admin/quotes",
        icon: <IconQuote />,
        badge: counts.quotes,
      },
      {
        label: "RFQs",
        href: "/admin/rfqs",
        icon: <IconRFQ />,
        badge: counts.openRFQs,
      },
      {
        label: "Price alerts",
        href: "/admin/alerts",
        icon: <IconAlert />,
        badge: counts.openAlerts,
      },
    ],
  },
  {
    label: "Audience",
    items: [
      { label: "Users", href: "/admin/users", icon: <IconUsers /> },
    ],
  },
  {
    label: "Intelligence",
    items: [
      { label: "AI Ops Chat", href: "/admin/ai", icon: <IconAI /> },
    ],
  },
];

/**
 * Per-status counts for the /admin/group-buys list-page filter
 * chips. Cheap (one COUNT per status) and used as a sidebar badge
 * in the nav item above.
 *
 * "open" drives the sidebar badge (the count of groups still
 * taking buyer commits — the count a human actually needs).
 */
export async function groupBuyNavCounts(sb: ServiceClient): Promise<{
  open: number;
  forming: number;
  formed: number;
  expired: number;
  cancelled: number;
}> {
  const statuses = ["open", "forming", "formed", "expired", "cancelled"] as const;
  const results = await Promise.all(
    statuses.map((s) =>
      sb
        .from("group_buys")
        .select("id", { count: "exact", head: true })
        .eq("status", s),
    ),
  );
  return {
    open: results[0].count ?? 0,
    forming: results[1].count ?? 0,
    formed: results[2].count ?? 0,
    expired: results[3].count ?? 0,
    cancelled: results[4].count ?? 0,
  };
}
