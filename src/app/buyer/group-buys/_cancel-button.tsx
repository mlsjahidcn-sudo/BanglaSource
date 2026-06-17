"use client";

// /buyer/group-buys/_cancel-button.tsx
//
// Phase 39. Tiny client island for the "Cancel my commitment"
// action on the my-groups page. After cancel, refresh the page
// so the server re-renders with the now-empty membership.

import { useState } from "react";
import { useRouter } from "next/navigation";

export function CancelMembershipButton({
  groupBuyId,
  label,
}: {
  groupBuyId: string;
  label: string;
}) {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleClick() {
    if (
      !confirm(
        "Cancel your commitment to this group? You can re-join later if it's still open.",
      )
    ) {
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/group-buys/${groupBuyId}/cancel-membership`,
        { method: "POST" },
      );
      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        setError(json.message || json.error || "Could not cancel");
        return;
      }
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Network error");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={handleClick}
        disabled={submitting}
        className="btn btn-outline btn-sm md:w-32 justify-center"
      >
        {submitting ? "Cancelling…" : label}
      </button>
      {error && (
        <p className="text-[11px] text-red-700 md:w-32 text-right">{error}</p>
      )}
    </>
  );
}