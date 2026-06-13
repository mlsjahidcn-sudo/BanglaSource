// /app/buyer/notifications/page.tsx
//
// In-app notifications feed. Server-rendered for first paint (so
// the buyer sees something without waiting on JS), then the
// client component takes over for marking read and live updates.

import { requireUser } from "@/lib/portal-auth";
import { getServiceRoleClient } from "@/lib/supabase/server";
import { Container } from "@/components/ui/container";
import { NotificationsList } from "./_client";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type Notification = {
  id: number;
  kind: string;
  title: string;
  body: string | null;
  href: string | null;
  read_at: string | null;
  created_at: string;
};

async function loadNotifications(userId: string) {
  try {
    const supabase = getServiceRoleClient();
    const [{ data: items, count: unread }] = await Promise.all([
      supabase
        .from("notifications")
        .select("id, kind, title, body, href, read_at, created_at")
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(100),
      Promise.resolve({ count: 0 }),
    ]);
    // Count unread (separate head query for cheapness)
    const { count: unreadCount } = await supabase
      .from("notifications")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId)
      .is("read_at", null);
    return {
      items: (items ?? []) as Notification[],
      unread: unreadCount ?? unread ?? 0,
    };
  } catch {
    return { items: [], unread: 0 };
  }
}

export default async function BuyerNotificationsPage() {
  const user = await requireUser("/buyer/notifications");
  const { items, unread } = await loadNotifications(user.id);
  return (
    <Container className="py-8 max-w-3xl">
      <div className="mb-6 flex items-end justify-between gap-4 flex-wrap">
        <div>
          <p className="text-[11px] text-fg-subtle uppercase tracking-wider font-medium">
            Account
          </p>
          <h1 className="mt-1 text-[26px] font-semibold tracking-[-0.01em]">
            Notifications
          </h1>
          <p className="mt-1.5 text-[13px] text-fg-muted max-w-md">
            Price-drop alerts from your watchlist, plus quote updates.
          </p>
        </div>
        {unread > 0 && (
          <span className="px-2.5 py-1 rounded-full bg-rose-100 text-rose-700 text-[11.5px] font-medium">
            {unread} unread
          </span>
        )}
      </div>

      <NotificationsList initial={items} initialUnread={unread} />
    </Container>
  );
}
