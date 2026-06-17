// /lib/buyer-nav.ts
// Buyer portal sidebar config.

import {
  IconHome,
  IconQuote,
  IconPackage,
  IconAddress,
  IconUser,
  IconSettings,
  IconRFQ,
  IconCart,
  IconAI,
  IconGroupBuy,
} from "@/components/portal-icons";
import type { NavGroup } from "@/components/portal-shell";

export const buyerNav = (counts: {
  openQuotes: number;
  rfqs: number;
  addresses: number;
  watchlist: number;
  activeGroupBuys: number;
}): NavGroup[] => [
  {
    label: "Overview",
    items: [
      { label: "Dashboard", href: "/buyer", icon: <IconHome />, exact: true },
      { label: "For you", href: "/for-you", icon: <IconAI /> },
    ],
  },
  {
    label: "Buying",
    items: [
      {
        label: "My orders",
        href: "/buyer/orders",
        icon: <IconPackage />,
      },
      {
        label: "My quotes",
        href: "/buyer/quotes",
        icon: <IconQuote />,
        badge: counts.openQuotes,
      },
      {
        label: "My RFQs",
        href: "/buyer/rfqs",
        icon: <IconRFQ />,
        badge: counts.rfqs,
      },
      {
        label: "Group buys",
        href: "/buyer/group-buys",
        icon: <IconGroupBuy />,
        badge: counts.activeGroupBuys,
      },
      {
        label: "Saved items",
        href: "/buyer/saved",
        icon: <IconPackage />,
        badge: counts.watchlist,
      },
      {
        label: "Order list",
        href: "/cart",
        icon: <IconCart />,
      },
    ],
  },
  {
    label: "Account",
    items: [
      {
        label: "Addresses",
        href: "/buyer/addresses",
        icon: <IconAddress />,
        badge: counts.addresses,
      },
      { label: "Profile", href: "/buyer/profile", icon: <IconUser /> },
      { label: "Settings", href: "/buyer/settings", icon: <IconSettings /> },
    ],
  },
];
