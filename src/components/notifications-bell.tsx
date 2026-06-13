"use client";
// /components/notifications-bell.tsx
//
// Topbar bell with unread badge + popover list. Replaces the
// static dot in the buyer layout. Auto-refreshes every 60s and
// also re-pulls on `focus` (cheap, only one /api/notifications
// GET per call). Marks all as read on open, individual rows on
// click.

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { IconBell } from "@/components/portal-icons";

type Notification = {
  id: number;
  kind: string;
  title: string;
  body: string | null;
  href: string | null;
  read_at: string | null;
  created_at: string;
};

export function NotificationsBell() {
  const router = useRouter();
  const wrapRef = useRef<HTMLDivElement>(null);
  const [items, setItems] = useState<Notification[]>([]);
  const [unread, setUnread] = useState(0);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  async function load() {
    try {
      const r = await fetch("/api/notifications", { cache: "no-store" });
      if (!r.ok) return;
      const j = (await r.json()) as { ok: boolean; items?: Notification[]; unread?: number };
      setItems(j.items ?? []);
      setUnread(j.unread ?? 0);
    } catch {
      /* ignore */
    }
  }

  useEffect(() => {
    load();
    const onFocus = () => load();
    window.addEventListener("focus", onFocus);
    const interval = setInterval(load, 60_000);
    return () => {
      window.removeEventListener("focus", onFocus);
      clearInterval(interval);
    };
  }, []);

  // Click-outside close
  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  async function markAll() {
    if (unread === 0) return;
    setBusy(true);
    try {
      await fetch("/api/notifications", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ all: true }),
      });
      setItems((cur) =>
        cur.map((n) => (n.read_at ? n : { ...n, read_at: new Date().toISOString() })),
      );
      setUnread(0);
    } catch {
      /* ignore */
    } finally {
      setBusy(false);
    }
  }

  async function markOne(id: number) {
    setItems((cur) =>
      cur.map((n) => (n.id === id && !n.read_at ? { ...n, read_at: new Date().toISOString() } : n)),
    );
    setUnread((u) => Math.max(0, u - 1));
    try {
      await fetch("/api/notifications", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });
    } catch {
      /* ignore */
    }
  }

  function handleToggle() {
    const next = !open;
    setOpen(next);
    if (next) markAll();
  }

  function handleItemClick(n: Notification) {
    setOpen(false);
    if (n.href) {
      router.push(n.href);
    }
  }

  return (
    <div ref={wrapRef} className="relative">
      <button
        type="button"
        onClick={handleToggle}
        aria-label={`Notifications, ${unread} unread`}
        className="h-9 w-9 rounded-md hover:bg-bg-soft flex items-center justify-center text-fg-muted hover:text-fg relative"
      >
        <IconBell size={16} />
        {unread > 0 && (
          <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] rounded-full bg-rose-500 text-white text-[10px] font-semibold flex items-center justify-center px-1 font-mono tnum">
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute top-full right-0 mt-2 w-[360px] bg-bg border border-border rounded-lg shadow-xl z-50 overflow-hidden">
          <div className="px-3 py-2.5 border-b border-border flex items-center justify-between">
            <p className="text-[12.5px] font-semibold">Notifications</p>
            <Link
              href="/buyer/notifications"
              onClick={() => setOpen(false)}
              className="text-[11.5px] text-cyan-600 hover:underline"
            >
              View all →
            </Link>
          </div>
          {items.length === 0 ? (
            <div className="p-6 text-center text-[12.5px] text-fg-muted">
              No notifications yet. Save a product to your watchlist
              and we'll let you know when its price drops.
            </div>
          ) : (
            <ul className="max-h-[420px] overflow-y-auto">
              {items.slice(0, 8).map((n) => (
                <li key={n.id}>
                  <button
                    type="button"
                    onClick={() => {
                      markOne(n.id);
                      handleItemClick(n);
                    }}
                    className={`w-full text-left px-3 py-2.5 hover:bg-slate-50 border-b border-border last:border-0 transition-colors ${
                      !n.read_at ? "bg-cyan-50/30" : ""
                    }`}
                  >
                    <div className="flex items-start gap-2">
                      {!n.read_at && (
                        <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-rose-500 shrink-0" />
                      )}
                      <div className="min-w-0 flex-1">
                        <p className="text-[12.5px] font-medium line-clamp-1">
                          {n.title}
                        </p>
                        {n.body && (
                          <p className="text-[11.5px] text-fg-muted line-clamp-2 mt-0.5">
                            {n.body}
                          </p>
                        )}
                        <p className="text-[10.5px] text-fg-subtle mt-0.5 font-mono tnum">
                          {formatAgo(n.created_at)}
                        </p>
                      </div>
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}

function formatAgo(iso: string): string {
  const d = new Date(iso);
  const now = Date.now();
  const diff = Math.floor((now - d.getTime()) / 1000);
  if (diff < 60) return "just now";
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  if (diff < 604800) return `${Math.floor(diff / 86400)}d ago`;
  return d.toLocaleDateString();
}
