"use client";
// /components/save-button.tsx
//
// Heart/save button for the watchlist. Drop into PDP or any product
// card. Renders two states:
//   - "outline" heart when not saved
//   - "filled" red heart when saved
//   - a "Sign in to save" prompt when not authenticated
//
// State management: optimistic local state + a single fetch call
// to /api/watchlist. The /api/watchlist endpoint handles auth, RLS,
// and source_id → product_id resolution. The component doesn't need
// to know which product_id corresponds to which source_id.
//
// Variants:
//   - "lg" — full row button with label, used on the PDP under "Add to order list"
//   - "icon" — small round button, used on product cards in the catalog grid
//
// Optimistic updates: on click we flip local state immediately, fire
// the request, and revert on failure. This keeps the UI snappy.

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getBrowserClient } from "@/lib/supabase/browser";

type Variant = "lg" | "icon";

type Props = {
  sourceId: string;
  variant?: Variant;
  className?: string;
};

export function SaveButton({ sourceId, variant = "lg", className = "" }: Props) {
  const router = useRouter();
  const [saved, setSaved] = useState(false);
  const [loading, setLoading] = useState(false);
  const [signedIn, setSignedIn] = useState<boolean | null>(null);

  // Initial state: am I signed in, and is this product already saved?
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const supabase = getBrowserClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (cancelled) return;
      if (!user) {
        setSignedIn(false);
        return;
      }
      setSignedIn(true);
      // Fetch the user's full watchlist and check if this source_id
      // is in it. Cheap because the watchlist is per-user and small
      // (we cap at 200 items server-side).
      try {
        const r = await fetch("/api/watchlist", { cache: "no-store" });
        if (!r.ok) return;
        const j = (await r.json()) as {
          ok: boolean;
          items?: Array<{ products: { source_id: string } | null }>;
        };
        const isSaved = (j.items ?? []).some(
          (i) => i.products?.source_id === sourceId,
        );
        if (!cancelled) setSaved(isSaved);
      } catch {
        /* ignore */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [sourceId]);

  async function toggle() {
    if (loading) return;
    if (signedIn === false) {
      // Bounce to login with a redirect back here
      router.push(`/login?redirect=${encodeURIComponent(window.location.pathname)}`);
      return;
    }
    const next = !saved;
    setSaved(next);
    setLoading(true);
    try {
      const r = await fetch("/api/watchlist", {
        method: next ? "POST" : "DELETE",
        headers: { "Content-Type": "application/json" },
        body: next
          ? JSON.stringify({ source_id: sourceId })
          : undefined,
      });
      if (!r.ok) {
        // Revert on failure
        setSaved(!next);
        const j = await r.json().catch(() => ({}));
        // eslint-disable-next-line no-console
        console.warn("watchlist toggle failed", j);
      }
    } catch {
      setSaved(!next);
    } finally {
      setLoading(false);
    }
  }

  if (variant === "icon") {
    return (
      <button
        type="button"
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          toggle();
        }}
        aria-label={saved ? "Remove from watchlist" : "Save to watchlist"}
        aria-pressed={saved}
        className={`h-11 w-11 rounded-full bg-bg/90 backdrop-blur-sm border border-border shadow-sm flex items-center justify-center transition-all hover:scale-105 ${
          saved ? "text-rose-600" : "text-fg-muted hover:text-rose-600"
        } ${className}`}
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill={saved ? "currentColor" : "none"} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
        </svg>
      </button>
    );
  }

  // variant === "lg"
  return (
    <button
      type="button"
      onClick={toggle}
      aria-pressed={saved}
      disabled={loading && signedIn === null}
      className={`h-11 w-full inline-flex items-center justify-center gap-2 px-4 rounded-md text-[13.5px] font-medium border transition-colors ${
        saved
          ? "bg-rose-50 border-rose-200 text-rose-700 hover:bg-rose-100"
          : "bg-bg border-border text-fg hover:bg-slate-50"
      } disabled:opacity-60 ${className}`}
    >
      <svg width="18" height="18" viewBox="0 0 24 24" fill={saved ? "currentColor" : "none"} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
      </svg>
      {saved ? "Saved to watchlist" : signedIn ? "Save to watchlist" : "Sign in to save"}
    </button>
  );
}
