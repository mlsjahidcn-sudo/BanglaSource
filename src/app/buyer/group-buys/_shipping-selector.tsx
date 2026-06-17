"use client";

// /buyer/group-buys/_shipping-selector.tsx
//
// Phase 41 — buyer switches their shipping mode (air/sea/express)
// on a group buy commitment. Only editable while the group is
// still 'open' or 'forming'. Once 'formed', the mode is frozen
// because the cron has already created the order with the chosen
// mode.

import { useState } from "react";
import { useRouter } from "next/navigation";

const MODES = [
  { value: "air", label: "Air", hint: "Fastest (3-5 days). Most common." },
  { value: "sea", label: "Sea", hint: "Cheapest for big orders (3-6 weeks)." },
  { value: "express", label: "Express", hint: "DHL/FedEx (1-3 days). Premium." },
] as const;

export function ShippingSelector({
  groupBuyId,
  initialMode,
  locked,
}: {
  groupBuyId: string;
  initialMode: "air" | "sea" | "express";
  locked: boolean;
}) {
  const router = useRouter();
  const [mode, setMode] = useState<"air" | "sea" | "express">(initialMode);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleChange(next: "air" | "sea" | "express") {
    if (next === mode || locked) return;
    setMode(next);
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/buyer/group-buys/${groupBuyId}/shipping-mode`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ shipping_mode: next }),
        },
      );
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        setError(j.message ?? j.error ?? "Could not update");
        setMode(initialMode); // revert
        return;
      }
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Network error");
      setMode(initialMode);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div>
      <div className="flex items-center gap-1.5">
        <span className="text-[10.5px] uppercase tracking-wider text-fg-subtle font-medium mr-1">
          Ship
        </span>
        {MODES.map((m) => {
          const active = m.value === mode;
          return (
            <button
              key={m.value}
              type="button"
              disabled={locked || saving}
              onClick={() => handleChange(m.value)}
              title={m.hint}
              className={`text-[10.5px] px-2 py-1 rounded border transition-colors ${
                active
                  ? "bg-cyan-600 text-white border-cyan-600"
                  : locked
                    ? "bg-bg-soft text-fg-subtle border-border cursor-not-allowed"
                    : "bg-bg text-fg-muted border-border hover:border-cyan-300 hover:text-cyan-700"
              }`}
            >
              {m.label}
            </button>
          );
        })}
        {saving && <span className="text-[10px] text-fg-subtle">saving…</span>}
      </div>
      {error && <p className="text-[10.5px] text-red-700 mt-1">{error}</p>}
      {locked && (
        <p className="text-[10px] text-fg-subtle mt-0.5">
          Locked after formation
        </p>
      )}
    </div>
  );
}