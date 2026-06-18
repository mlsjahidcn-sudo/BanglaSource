// /app/for-you/page.tsx
//
// Personal "For You" page. Shows the buyer's personalized feed
// in 4 sections:
//   1. Price drops on watchlist  (notifications from Phase 8)
//   2. Watchlist-deal: same category as saved items
//   3. Recently viewed           (re-display for re-engagement)
//   4. Personalized For-You      (the AI for-you feed)
//
// Auth-gated: anon users get redirected to /login with a
// /for-you return URL. The page is server-rendered where
// possible (the personalized grid is client-rendered since
// /api/ai/for-you is the source of truth).

import { requireUser } from "@/lib/portal-auth";
import { getServiceRoleClient } from "@/lib/supabase/server";
import { Container } from "@/components/ui/container";
import { ForYou } from "@/components/for-you";
import { RecentlyViewed } from "@/components/recently-viewed";
import Link from "next/link";
import { fmtBdt, FX_CNY_BDT } from "@/lib/pricing";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type Notif = {
  id: number;
  title: string;
  body: string;
  href: string;
  read_at: string | null;
  created_at: string;
};

async function loadUnreadDrops(userId: string): Promise<Notif[]> {
  try {
    const supabase = getServiceRoleClient();
    const { data, error } = await supabase
      .from("notifications")
      .select("id, title, body, href, read_at, created_at")
      .eq("user_id", userId)
      .is("read_at", null)
      .order("created_at", { ascending: false })
      .limit(8);
    if (error) return [];
    return (data ?? []) as Notif[];
  } catch {
    return [];
  }
}

export default async function ForYouPage() {
  const user = await requireUser("/for-you");
  const drops = await loadUnreadDrops(user.id);

  return (
    <Container className="py-8 max-w-6xl">
      {/* Header */}
      <div className="mb-8">
        <p className="text-[11px] text-fg-subtle uppercase tracking-wider font-medium flex items-center gap-1.5">
          Personalized
          <span className="px-1.5 py-0.5 rounded bg-cyan-50 text-cyan-800 text-[9.5px] font-mono tnum">
            AI
          </span>
        </p>
        <h1 className="mt-1">
          For you, {user.email?.split("@")[0] ?? "buyer"}
        </h1>
        <p className="mt-1.5 text-[13.5px] text-fg-muted max-w-xl">
          A live feed of price drops on your watchlist, fresh picks
          matched to your taste, and what you've been browsing. The
          more you explore, the smarter this gets.
        </p>
      </div>

      {/* Section 1: Price drops on watchlist */}
      <section className="mb-12">
        <div className="mb-4 flex items-end justify-between">
          <div>
            <h2>Active price drops</h2>
            <p className="mt-1 text-[12.5px] text-fg-muted">
              Real-time alerts from your saved products.
            </p>
          </div>
          <Link
            href="/buyer/notifications"
            className="text-[12.5px] text-cyan-600 hover:underline"
          >
            See all →
          </Link>
        </div>
        {drops.length === 0 ? (
          <div className="card p-8 text-center">
            <p className="text-[14px] font-medium">No active drops right now.</p>
            <p className="mt-1 text-[12.5px] text-fg-muted">
              Save a product and enable price-drop alerts. When the
              factory price moves ±15%, you'll see it here.
            </p>
            <Link
              href="/categories"
              className="mt-4 inline-flex h-9 items-center px-3 text-[12px] font-medium rounded-md bg-cyan-600 text-white hover:bg-cyan-700"
            >
              Browse catalog →
            </Link>
          </div>
        ) : (
          <div className="space-y-2">
            {drops.map((d) => (
              <Link
                key={d.id}
                href={d.href ?? "/buyer/saved"}
                className="card p-4 flex items-center gap-4 hover:border-cyan-300 transition-colors"
              >
                <div className="w-1 self-stretch rounded bg-rose-500" />
                <div className="flex-1 min-w-0">
                  <p className="text-[13.5px] font-medium leading-snug">
                    {d.title}
                  </p>
                  <p className="mt-0.5 text-[12px] text-fg-muted line-clamp-1">
                    {d.body}
                  </p>
                </div>
                <span className="text-[11px] text-fg-subtle font-mono tnum shrink-0">
                  {timeAgo(d.created_at)}
                </span>
                <span className="text-cyan-600 text-[12px] font-medium shrink-0">
                  View →
                </span>
              </Link>
            ))}
          </div>
        )}
      </section>

      {/* Section 2: AI For You (12 items) */}
      <section className="mb-12">
        <ForYou limit={12} />
      </section>

      {/* Section 3: Recently viewed (8 items) */}
      <section>
        <RecentlyViewed limit={8} />
      </section>
    </Container>
  );
}

function timeAgo(iso: string): string {
  const d = new Date(iso);
  const diff = Math.floor((Date.now() - d.getTime()) / 1000);
  if (diff < 60) return "now";
  if (diff < 3600) return `${Math.floor(diff / 60)}m`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h`;
  if (diff < 604800) return `${Math.floor(diff / 86400)}d`;
  return d.toLocaleDateString();
}
