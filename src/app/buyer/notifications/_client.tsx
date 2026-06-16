"use client";
// /app/buyer/notifications/_client.tsx
//
// List of the user's notifications. Server-renders the first 100,
// the client maintains the read state and exposes a "Mark all
// read" button. Empty state explains how to start getting alerts.

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

type Notification = {
  id: number;
  kind: string;
  title: string;
  body: string | null;
  href: string | null;
  read_at: string | null;
  created_at: string;
};

export function NotificationsList({
  initial,
  initialUnread,
}: {
  initial: Notification[];
  initialUnread: number;
}) {
  const router = useRouter();
  const [items, setItems] = useState<Notification[]>(initial);
  const [unread, setUnread] = useState(initialUnread);
  const [busy, setBusy] = useState(false);

  async function markAll() {
    if (unread === 0) return;
    setBusy(true);
    try {
      const r = await fetch("/api/notifications", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ all: true }),
      });
      if (r.ok) {
        const now = new Date().toISOString();
        setItems((cur) =>
          cur.map((n) => (n.read_at ? n : { ...n, read_at: now })),
        );
        setUnread(0);
      }
    } finally {
      setBusy(false);
    }
  }

  async function markOne(id: number) {
    setItems((cur) =>
      cur.map((n) =>
        n.id === id && !n.read_at
          ? { ...n, read_at: new Date().toISOString() }
          : n,
      ),
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

  if (items.length === 0) {
    return (
      <div className="card p-12 text-center">
        <div className="w-12 h-12 rounded-full bg-bg-soft border border-border flex items-center justify-center mx-auto">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
            <path d="M13.73 21a2 2 0 0 1-3.46 0" />
          </svg>
        </div>
        <h3 className="mt-4 text-[16px] font-semibold">No notifications yet</h3>
        <p className="mt-1.5 text-[13px] text-fg-muted max-w-sm mx-auto">
          Save a product to your watchlist. When its factory price
          drops by 15% or more, we'll surface it here.
        </p>
        <Link
          href="/categories"
          className="mt-5 inline-flex h-10 items-center px-4 text-[13px] font-medium rounded-md bg-cyan-600 text-white hover:bg-cyan-700"
        >
          Browse catalog →
        </Link>
      </div>
    );
  }

  return (
    <div>
      {unread > 0 && (
        <div className="mb-3 flex items-center justify-end">
          <button
            type="button"
            onClick={markAll}
            disabled={busy}
            className="text-[12px] text-cyan-600 hover:underline disabled:opacity-50"
          >
            {busy ? "Marking…" : "Mark all read"}
          </button>
        </div>
      )}

      <div className="rounded-lg border border-border overflow-hidden bg-bg">
        <ul>
          {items.map((n, i) => {
            const inner = (
              <div className="flex items-start gap-3">
                {!n.read_at && (
                  <span className="mt-1.5 w-2 h-2 rounded-full bg-rose-500 shrink-0" />
                )}
                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline gap-2">
                    <p className="text-[13px] font-medium line-clamp-1">
                      {n.title}
                    </p>
                    <span className="text-[10px] font-mono tnum text-fg-subtle uppercase tracking-wider">
                      {n.kind}
                    </span>
                  </div>
                  {n.body && (
                    <p className="text-[12.5px] text-fg-muted mt-0.5">
                      {n.body}
                    </p>
                  )}
                  <p className="text-[10.5px] text-fg-subtle mt-1 font-mono tnum">
                    {formatAgo(n.created_at)}
                  </p>
                </div>
              </div>
            );
            return (
              <li
                key={n.id}
                className={`border-b border-border last:border-0 ${
                  !n.read_at ? "bg-cyan-50/30" : ""
                }`}
              >
                {n.href ? (
                  <Link
                    href={n.href}
                    onClick={() => {
                      if (!n.read_at) markOne(n.id);
                    }}
                    className="block px-4 py-3 hover:bg-slate-50 transition-colors"
                  >
                    {inner}
                  </Link>
                ) : (
                  <div className="px-4 py-3">{inner}</div>
                )}
              </li>
            );
          })}
        </ul>
      </div>
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
