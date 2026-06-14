"use client";

// /admin/orders/[id]/_client.tsx
//
// Client-side status / tracking / internal-note form. Submits to
// PATCH /api/admin/orders/[id] and refreshes the page on success.
//
// Why client: status transitions need optimistic UI (the table
// page is server-rendered, so we trigger a router refresh() after
// the PATCH returns). The form is small enough that we don't
// bother with a separate server action.

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

type OrderStatus =
  | "pending_payment"
  | "paid"
  | "in_transit"
  | "delivered"
  | "cancelled";

const STATUS_LABEL: Record<OrderStatus, string> = {
  pending_payment: "Pending payment",
  paid: "Paid",
  in_transit: "In transit",
  delivered: "Delivered",
  cancelled: "Cancelled",
};

export function OrderStatusForm({
  orderId,
  currentStatus,
  currentTracking,
  currentInternalNote,
  buyerEmail,
}: {
  orderId: number;
  currentStatus: OrderStatus;
  currentTracking: string | null;
  currentInternalNote: string | null;
  buyerEmail: string | null;
}) {
  const router = useRouter();
  const [status, setStatus] = useState<OrderStatus>(currentStatus);
  const [tracking, setTracking] = useState(currentTracking ?? "");
  const [internalNote, setInternalNote] = useState(
    currentInternalNote ?? "",
  );
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [isPending, startTransition] = useTransition();

  const dirty =
    status !== currentStatus ||
    (tracking || "") !== (currentTracking ?? "") ||
    (internalNote || "") !== (currentInternalNote ?? "");

  async function save() {
    setError(null);
    setSaved(false);
    const res = await fetch(`/api/admin/orders/${orderId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        status,
        tracking_number: tracking.trim() || null,
        internal_note: internalNote.trim() || null,
      }),
    });
    if (!res.ok) {
      const j = await res.json().catch(() => ({}));
      setError(j.error ?? j.message ?? `HTTP ${res.status}`);
      return;
    }
    setSaved(true);
    startTransition(() => {
      router.refresh();
    });
  }

  function reset() {
    setStatus(currentStatus);
    setTracking(currentTracking ?? "");
    setInternalNote(currentInternalNote ?? "");
    setError(null);
    setSaved(false);
  }

  // Disallow transitioning backwards from terminal states (delivered,
  // cancelled). Re-opening a cancelled order isn't supported.
  const terminal: OrderStatus[] = ["delivered", "cancelled"];
  const lockedFromTerminal = terminal.includes(currentStatus);

  return (
    <div className="card p-5 space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-[15px] font-semibold">Order actions</h2>
        {lockedFromTerminal ? (
          <span className="text-[10.5px] uppercase tracking-wider text-fg-subtle font-mono px-1.5 py-0.5 border border-border rounded">
            Terminal state — read only
          </span>
        ) : (
          <span className="text-[10.5px] uppercase tracking-wider text-fg-subtle font-mono">
            current: {STATUS_LABEL[currentStatus]}
          </span>
        )}
      </div>

      {/* Status select */}
      <div>
        <label className="block text-[11px] uppercase tracking-wider text-fg-subtle font-medium mb-1.5">
          Status
        </label>
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
          {(Object.keys(STATUS_LABEL) as OrderStatus[]).map((s) => {
            const active = status === s;
            const disabled = lockedFromTerminal && s !== currentStatus;
            return (
              <button
                key={s}
                type="button"
                onClick={() => setStatus(s)}
                disabled={disabled}
                className={`h-9 px-3 text-[12.5px] rounded-md border transition-colors ${
                  active
                    ? "border-cyan-600 bg-cyan-50 text-cyan-800"
                    : "border-border text-fg-muted hover:text-fg hover:bg-bg-soft"
                } ${disabled ? "opacity-40 cursor-not-allowed" : ""}`}
              >
                {STATUS_LABEL[s]}
              </button>
            );
          })}
        </div>
        {lockedFromTerminal && (
          <p className="mt-1.5 text-[11px] text-fg-subtle">
            Delivered and cancelled orders are terminal. To re-process
            this order, create a new one from the buyer's cart.
          </p>
        )}
      </div>

      {/* Tracking number */}
      <div>
        <label className="block text-[11px] uppercase tracking-wider text-fg-subtle font-medium mb-1.5">
          Tracking number
        </label>
        <input
          type="text"
          value={tracking}
          onChange={(e) => setTracking(e.target.value)}
          placeholder="e.g. DHL 1234567890, or leave blank"
          className="h-9 px-3 w-full rounded-md border border-border bg-bg text-[12.5px] font-mono outline-none focus:border-cyan-500"
        />
        <p className="mt-1.5 text-[11px] text-fg-subtle">
          Courier tracking. Shown to the buyer in the order detail page
          once the order is <em>In transit</em> or later.
        </p>
      </div>

      {/* Internal note */}
      <div>
        <label className="block text-[11px] uppercase tracking-wider text-fg-subtle font-medium mb-1.5">
          Internal note
        </label>
        <textarea
          value={internalNote}
          onChange={(e) => setInternalNote(e.target.value)}
          rows={3}
          placeholder="Admin-only. Not visible to the buyer. e.g. 'buyer requested DHL express' or 'CNY rate locked at 16.85'"
          className="px-3 py-2 w-full rounded-md border border-border bg-bg text-[12.5px] outline-none focus:border-cyan-500 resize-none"
        />
      </div>

      {error && (
        <div className="text-[12px] text-rose-700 bg-rose-50 border border-rose-200 rounded-md p-2.5">
          Could not save: {error}
        </div>
      )}
      {saved && !error && (
        <div className="text-[12px] text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-md p-2.5">
          Saved. Refreshing…
        </div>
      )}

      <div className="flex items-center gap-2 pt-1">
        <button
          type="button"
          onClick={save}
          disabled={!dirty || isPending}
          className="h-9 px-4 rounded-md bg-cyan-600 text-white text-[12.5px] font-medium hover:bg-cyan-700 disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {isPending ? "Saving…" : "Save changes"}
        </button>
        <button
          type="button"
          onClick={reset}
          disabled={!dirty || isPending}
          className="h-9 px-3 text-[12.5px] text-fg-muted hover:text-fg disabled:opacity-40"
        >
          Reset
        </button>
        {buyerEmail && (
          <a
            href={`mailto:${buyerEmail}`}
            className="ml-auto h-9 px-3 text-[12.5px] text-fg-muted hover:text-fg inline-flex items-center"
          >
            ✉ Email buyer
          </a>
        )}
      </div>
    </div>
  );
}
