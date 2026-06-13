import { requireUser } from "@/lib/portal-auth";
import { buyerNav } from "@/lib/buyer-nav";
import { getServiceRoleClient } from "@/lib/supabase/server";
import { PortalShell } from "@/components/portal-shell";
import Link from "next/link";
import { IconBell, IconSearch } from "@/components/portal-icons";

export const dynamic = "force-dynamic";
export const revalidate = 0;

async function loadCounts(userId: string) {
  try {
    const supabase = getServiceRoleClient();
    const [openQuotes, watchlist, addresses] = await Promise.all([
      supabase
        .from("quotes")
        .select("id", { count: "exact", head: true })
        .eq("user_id", userId)
        .in("status", ["pending", "sourced", "quoted", "confirmed"]),
      supabase
        .from("watchlist")
        .select("id", { count: "exact", head: true })
        .eq("user_id", userId),
      // The "addresses" table doesn't exist yet; we read from profiles
      // for the count placeholder. Once the addresses table is added,
      // swap this.
      Promise.resolve({ count: 0 }),
    ]);
    return {
      openQuotes: openQuotes.count ?? 0,
      rfqs: 0,
      addresses: (addresses as { count: number }).count ?? 0,
      watchlist: watchlist.count ?? 0,
    };
  } catch {
    return { openQuotes: 0, rfqs: 0, addresses: 0, watchlist: 0 };
  }
}

export default async function BuyerLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await requireUser("/buyer");
  const counts = await loadCounts(user.id);
  return (
    <PortalShell
      brand="BanglaSource"
      groups={buyerNav(counts)}
      user={{
        email: user.email,
        fullName: user.fullName,
        isAdmin: user.isAdmin,
      }}
      switchToHref={user.isAdmin ? "/admin" : undefined}
      switchToLabel={user.isAdmin ? "Switch to admin" : undefined}
      topbar={
        <>
          <div className="flex-1 max-w-md">
            <div className="flex items-center gap-2 h-9 px-3 rounded-md bg-bg-soft border border-border focus-within:border-border-strong transition-colors">
              <span className="text-fg-subtle">
                <IconSearch size={14} />
              </span>
              <input
                type="text"
                placeholder="Search products…"
                className="flex-1 bg-transparent text-[13px] outline-none placeholder:text-fg-subtle"
              />
              <span className="text-[10px] text-fg-subtle font-mono px-1.5 py-0.5 rounded border border-border">
                ⌘K
              </span>
            </div>
          </div>
          <div className="flex-1" />
          <Link
            href="/cart"
            className="h-9 w-9 rounded-md hover:bg-bg-soft flex items-center justify-center text-fg-muted hover:text-fg"
            title="Cart"
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
              <path d="M2 2h2l1.6 8.4a1 1 0 001 .8h5.5a1 1 0 001-.78L14 5H4.2" />
              <circle cx="6" cy="13.5" r="0.7" />
              <circle cx="11.5" cy="13.5" r="0.7" />
            </svg>
          </Link>
          <Link
            href="/buyer/quotes"
            className="h-9 w-9 rounded-md hover:bg-bg-soft flex items-center justify-center text-fg-muted hover:text-fg relative"
            title="Notifications"
          >
            <IconBell size={16} />
            {counts.openQuotes > 0 && (
              <span className="absolute top-1 right-1 w-2 h-2 rounded-full bg-emerald-500" />
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
