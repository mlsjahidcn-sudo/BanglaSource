"use client";

// /admin/group-buys/[id]/_member-actions.tsx
//
// Phase 41 — admin per-member actions: "Retry" for failed members
// + "Remove" for any member. Wired into the members table on the
// admin group detail page.

import { useState } from "react";
import { useRouter } from "next/navigation";

export function RetryMemberButton({
  groupBuyId,
  memberId,
}: {
  groupBuyId: string;
  memberId: string;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleClick() {
    if (
      !confirm(
        "Retry order creation for this member? They should have a default address set first.",
      )
    ) {
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/admin/group-buys/${groupBuyId}/members/${memberId}/retry`,
        { method: "POST" },
      );
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(json.message ?? json.error ?? `HTTP ${res.status}`);
        return;
      }
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Network error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={handleClick}
        disabled={busy}
        className="text-[11px] text-cyan-700 hover:text-cyan-800 font-medium disabled:text-fg-subtle"
      >
        {busy ? "Retrying…" : "Retry"}
      </button>
      {error && <span className="text-[10.5px] text-red-700 ml-1.5">{error}</span>}
    </>
  );
}

export function RemoveMemberButton({
  groupBuyId,
  memberId,
}: {
  groupBuyId: string;
  memberId: string;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleClick() {
    if (
      !confirm(
        "Remove this member from the group buy? Their commitment is deleted; their order (if any) is NOT touched.",
      )
    ) {
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/admin/group-buys/${groupBuyId}/members/${memberId}`,
        { method: "DELETE" },
      );
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        setError(j.message ?? j.error ?? `HTTP ${res.status}`);
        return;
      }
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Network error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={handleClick}
        disabled={busy}
        className="text-[11px] text-red-700 hover:text-red-800 font-medium disabled:text-fg-subtle"
      >
        {busy ? "Removing…" : "Remove"}
      </button>
      {error && <span className="text-[10.5px] text-red-700 ml-1.5">{error}</span>}
    </>
  );
}