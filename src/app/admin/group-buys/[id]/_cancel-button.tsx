// /admin/group-buys/[id]/_cancel-button
//
// Phase 37: the only client island on the detail page. The
// page is server-rendered; this button is the one piece that
// needs interactivity (a confirm modal + a fetch).
//
// Cancel flow:
//   1. Admin clicks "Cancel group buy"
//   2. Browser confirm() — last-chance before the action
//   3. PATCH /api/admin/group-buys/[id] with { action: "cancel" }
//   4. Server uses the service-role client to update status
//      to 'cancelled' (only from 'open' or 'forming'). The
//      trigger group_buys_guard_transition stamps cancelled_at.
//   5. On success: hard reload to refresh server-rendered state.
//   6. On error: alert() with the message.

"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function CancelGroupBuyButton({ id }: { id: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function handleCancel() {
    if (
      !window.confirm(
        "Cancel this group buy? This is final — buyers will be notified and no charge will happen.",
      )
    ) {
      return;
    }
    setBusy(true);
    try {
      const r = await fetch(`/api/admin/group-buys/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "cancel" }),
      });
      if (!r.ok) {
        const body = await r.json().catch(() => ({}));
        alert(`Cancel failed: ${body.error ?? r.status}`);
        setBusy(false);
        return;
      }
      // Hard reload to re-render the server-rendered detail
      // with the new cancelled state.
      router.refresh();
    } catch (e) {
      alert(e instanceof Error ? e.message : "Cancel failed");
      setBusy(false);
    }
  }

  return (
    <button
      type="button"
      onClick={handleCancel}
      disabled={busy}
      className="h-9 px-3.5 text-[12.5px] font-medium rounded-md border border-red-200 bg-bg text-red-700 hover:bg-red-50 hover:border-red-300 disabled:opacity-50 disabled:cursor-not-allowed"
    >
      {busy ? "Cancelling…" : "Cancel group buy"}
    </button>
  );
}
