// /lib/admin-nav.ts
// Admin portal sidebar config.

import {
  IconHome,
  IconSync,
  IconSearch,
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
} from "@/components/portal-icons";
import type { NavGroup } from "@/components/portal-shell";

export const adminNav = (counts: {
  products: number;
  openAlerts: number;
  discoveries: number;
  quotes: number;
  trafficLast7d: number;
  openOrders: number;
  openRFQs: number;
}): NavGroup[] => [
  {
    label: "Overview",
    items: [
      { label: "Dashboard", href: "/admin", icon: <IconHome />, exact: true },
      {
        label: "Sync",
        href: "/admin/sync",
        icon: <IconSync />,
        badge: counts.products,
      },
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
        label: "Add product",
        href: "/admin/products/new",
        icon: <IconPlus />,
      },
      {
        label: "Image agent",
        href: "/admin/images",
        icon: <IconImage />,
      },
      {
        label: "Discoveries",
        href: "/admin/discovery",
        icon: <IconSearch />,
        badge: counts.discoveries,
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
