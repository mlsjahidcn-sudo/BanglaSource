// /lib/admin-nav.ts
// Admin portal sidebar config.

import {
  IconHome,
  IconSync,
  IconSearch,
  IconChart,
  IconAlert,
  IconQuote,
  IconUsers,
  IconTraffic,
  IconPackage,
  IconAI,
  IconImport,
} from "@/components/portal-icons";
import type { NavGroup } from "@/components/portal-shell";

export const adminNav = (counts: {
  products: number;
  openAlerts: number;
  discoveries: number;
  quotes: number;
  trafficLast7d: number;
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
        label: "Import",
        href: "/admin/import",
        icon: <IconImport />,
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
        label: "Quote requests",
        href: "/admin/quotes",
        icon: <IconQuote />,
        badge: counts.quotes,
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
