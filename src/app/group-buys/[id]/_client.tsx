"use client";

// /group-buys/[id]/_client.tsx
//
// Phase 39. The interactive part of the group-buy detail page.
// Server-rendered props come in (groupBuyId, currentQty, tiers,
// etc.). The component owns:
//   - The qty picker (integer input + stepper)
//   - The live "you'll pay" preview using groupBuyPriceAtQty
//   - The Join / Cancel CTA — the rendering depends on three
//     signals: (a) is the user signed in, (b) do they already
//     have a membership, (c) what is the group's status

import { useState, useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { fmtBdt, groupBuyPriceAtQty, type GroupBuyPriceTier } from "@/lib/pricing";
import { dict } from "@/lib/i18n-dict";

type Membership = {
  id: string;
  qty: number;
  unit_bdt_at_commit: number;
  payment_state: string;
  order_id: number | null;
  created_at: string;
};

type Props = {
  groupBuyId: string;
  groupStatus: "open" | "forming" | "formed" | "expired" | "cancelled";
  minQty: number;
  targetQty: number;
  priceTiers: GroupBuyPriceTier[];
  currentQty: number;
  currentUserId: string | null;
  currentUserEmail: string | null;
  initialMembership: Membership | null;
  finalUnitBdt: number | null;
};

export function GroupBuyDetailClient({
  groupBuyId,
  groupStatus,
  minQty,
  targetQty,
  priceTiers,
  currentQty,
  currentUserId,
  currentUserEmail,
  initialMembership,
  finalUnitBdt,
}: Props) {
  const router = useRouter();
  const [membership, setMembership] = useState<Membership | null>(initialMembership);
  const [qty, setQty] = useState<number>(minQty);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // The price the buyer is committing at — based on the LIVE
  // current_qty (not current_qty + qty). After a successful join,
  // the buyer's `unit_bdt_at_commit` snapshot is whatever this
  // function returns NOW. Phase 40 will charge them at the lower
  // of (unit_bdt_at_commit, final_unit_bdt) when the group forms.
  const unitBdtAtCommit = useMemo(
    () => groupBuyPriceAtQty(priceTiers, currentQty),
    [priceTiers, currentQty],
  );
  const totalBdt = qty * unitBdtAtCommit;

  const isOpen = groupStatus === "open";
  const isFormed = groupStatus === "formed";

  async function handleJoin() {
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch(`/api/group-buys/${groupBuyId}/join`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ qty }),
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json.message || json.error || "Could not join");
        return;
      }
      setMembership({
        id: json.member.id,
        qty: json.member.qty,
        unit_bdt_at_commit: json.member.unit_bdt_at_commit,
        payment_state: json.member.payment_state,
        order_id: json.member.order_id ?? null,
        created_at: json.member.created_at,
      });
      // Refresh the page so the server re-fetches the new
      // currentQty (and the tier ladder updates).
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Network error");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleCancel() {
    if (!confirm("Cancel your commitment? You can re-join later if the group is still open.")) {
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch(`/api/group-buys/${groupBuyId}/cancel-membership`, {
        method: "POST",
      });
      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        setError(json.message || json.error || "Could not cancel");
        return;
      }
      setMembership(null);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Network error");
    } finally {
      setSubmitting(false);
    }
  }

  // ────────────────────────────────────────────────────────────
  // RENDER: pick the right CTA based on (user, membership, status)
  // ────────────────────────────────────────────────────────────

  // Anon → sign in CTA
  if (!currentUserId) {
    return (
      <div className="rounded-lg border border-border bg-bg-soft p-5">
        <p className="text-[13px] text-fg-muted">
          {dict["group_buy.public.detail.min_per_buyer"].en.replace(
            "{qty}",
            String(minQty),
          )}
        </p>
        <Link
          href={`/login?redirect=${encodeURIComponent(`/group-buys/${groupBuyId}`)}`}
          className="btn btn-primary btn-md w-full mt-4 justify-center"
        >
          {dict["group_buy.public.detail.signin_cta"].en}
        </Link>
        {currentUserEmail && (
          <p className="text-[11px] text-fg-subtle mt-2">
            (as {currentUserEmail})
          </p>
        )}
      </div>
    );
  }

  // Already a member
  if (membership) {
    return (
      <div className="rounded-lg border border-cyan-200 bg-cyan-50/50 p-5 space-y-3">
        <div className="flex items-center gap-2">
          <span className="w-2 heading-2 rounded-full bg-cyan-500" />
          <p className="text-[13px] font-semibold text-cyan-900">
            {dict["group_buy.public.detail.already_in"].en
              .replace("{qty}", String(membership.qty))
              .replace("{price}", fmtBdt(membership.unit_bdt_at_commit))}
          </p>
        </div>
        <p className="text-[12px] text-fg-muted">
          {dict["group_buy.public.detail.already_in_explainer"].en}
        </p>
        {/* "Price dropped since you joined" hint */}
        {isOpen && unitBdtAtCommit < membership.unit_bdt_at_commit && (
          <p className="text-[11.5px] text-emerald-700 bg-emerald-50 border border-emerald-200 rounded px-3 py-2">
            Current price is now{" "}
            <span className="font-mono tnum font-semibold">{fmtBdt(unitBdtAtCommit)}/pc</span>{" "}
            — you're locked at{" "}
            <span className="font-mono tnum">{fmtBdt(membership.unit_bdt_at_commit)}/pc</span>.
          </p>
        )}
        {/* Group-formed → link to pay */}
        {isFormed && membership.order_id && (
          <Link
            href={`/orders/${membership.order_id}`}
            className="btn btn-primary btn-md w-full justify-center"
          >
            Pay order #{membership.order_id} →
          </Link>
        )}
        {/* Open → cancel */}
        {isOpen && (
          <button
            type="button"
            onClick={handleCancel}
            disabled={submitting}
            className="btn btn-outline btn-md w-full"
          >
            {submitting ? "Cancelling…" : dict["group_buy.public.detail.cancel_cta"].en}
          </button>
        )}
        {error && <p className="text-[12px] text-red-700">{error}</p>}
      </div>
    );
  }

  // Group is not open + no membership
  if (!isOpen) {
    return (
      <div className="rounded-lg border border-border bg-bg-soft p-5">
        <p className="text-[13px] text-fg-muted">
          {groupStatus === "forming" && dict["group_buy.public.detail.forming"].en}
          {groupStatus === "formed" &&
            dict["group_buy.public.detail.formed"].en.replace(
              "{price}",
              fmtBdt(finalUnitBdt ?? 0),
            )}
          {groupStatus === "expired" && dict["group_buy.public.detail.expired"].en}
          {groupStatus === "cancelled" && dict["group_buy.public.detail.cancelled"].en}
        </p>
      </div>
    );
  }

  // Open + signed in + no membership → join CTA with qty picker
  return (
    <div className="rounded-lg border border-border bg-bg p-5 space-y-4">
      <div>
        <label className="block">
          <span className="text-[12px] font-medium text-fg">
            {dict["group_buy.public.detail.qty_label"].en}
          </span>
          <div className="mt-1.5 flex items-stretch gap-2">
            <button
              type="button"
              onClick={() => setQty((q) => Math.max(minQty, q - minQty))}
              className="w-10 rounded border border-border bg-bg-soft hover:bg-slate-100 text-[18px] font-medium"
              aria-label="Decrease"
            >
              −
            </button>
            <input
              type="number"
              value={qty}
              min={minQty}
              step={minQty}
              max={targetQty}
              onChange={(e) => {
                const v = Number(e.target.value);
                if (Number.isFinite(v) && v >= minQty) {
                  setQty(Math.floor(v));
                }
              }}
              className="flex-1 px-3 py-2 rounded border border-border bg-bg text-center font-mono tnum text-[16px] focus:outline-none focus:border-cyan-500"
            />
            <button
              type="button"
              onClick={() => setQty((q) => Math.min(targetQty, q + minQty))}
              className="w-10 rounded border border-border bg-bg-soft hover:bg-slate-100 text-[18px] font-medium"
              aria-label="Increase"
            >
              +
            </button>
          </div>
          <span className="text-[11px] text-fg-subtle mt-1.5 block">
            {dict["group_buy.public.detail.qty_step_hint"].en
              .replace("{step}", String(minQty))}{" "}
            ·{" "}
            {dict["group_buy.public.detail.min_not_met"].en.replace(
              "{qty}",
              String(minQty),
            )}
          </span>
        </label>
      </div>

      {/* Live preview */}
      <div className="rounded border border-border bg-bg-soft p-3 space-y-1">
        <div className="flex items-baseline justify-between text-[12.5px]">
          <span className="text-fg-muted">Price per pc</span>
          <span className="font-mono tnum font-medium">{fmtBdt(unitBdtAtCommit)}</span>
        </div>
        <div className="flex items-baseline justify-between text-[14px] pt-1.5 border-t border-border">
          <span className="font-medium">
            {dict["group_buy.public.detail.you_pay"].en.split("=")[0].trim()}
          </span>
          <span className="font-mono tnum font-bold text-cyan-700">
            {fmtBdt(totalBdt)}
          </span>
        </div>
      </div>

      <button
        type="button"
        onClick={handleJoin}
        disabled={submitting || qty < minQty || qty > targetQty}
        className="btn btn-primary btn-md w-full justify-center"
      >
        {submitting
          ? "Joining…"
          : dict["group_buy.public.detail.join_cta"].en}
      </button>

      {error && <p className="text-[12px] text-red-700">{error}</p>}
    </div>
  );
}