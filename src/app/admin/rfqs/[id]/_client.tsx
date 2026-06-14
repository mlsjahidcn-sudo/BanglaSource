"use client";

// /admin/rfqs/[id] — quote form client component.
//
// Posts to PATCH /api/admin/rfqs/[id]. The form is disabled
// when the RFQ is not in 'open' status (we get this from the
// `disabled` prop computed server-side). On success we
// router.refresh() so the parent page re-renders the new
// status + quote payload.

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

export function RFQQuoteForm({
  rfqId,
  disabled,
  initialPriceCny,
  initialMinQty,
  initialLeadDays,
  initialNotes,
}: {
  rfqId: number;
  disabled: boolean;
  initialPriceCny: number | null;
  initialMinQty: number | null;
  initialLeadDays: number | null;
  initialNotes: string | null;
}) {
  const router = useRouter();
  const initialPriceYuan =
    initialPriceCny != null ? (initialPriceCny / 100).toFixed(2) : "";
  const [price, setPrice] = useState(initialPriceYuan);
  const [minQty, setMinQty] = useState(
    initialMinQty != null ? String(initialMinQty) : "",
  );
  const [leadDays, setLeadDays] = useState(
    initialLeadDays != null ? String(initialLeadDays) : "",
  );
  const [notes, setNotes] = useState(initialNotes ?? "");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  async function submit() {
    setError(null);
    const priceNum = Number(price);
    const minQtyNum = Number(minQty);
    const leadNum = Number(leadDays);
    if (!Number.isFinite(priceNum) || priceNum <= 0) {
      setError("Quoted FOB must be a positive number (CNY per unit).");
      return;
    }
    if (!Number.isInteger(minQtyNum) || minQtyNum < 1) {
      setError("MOQ must be a positive integer.");
      return;
    }
    if (!Number.isInteger(leadNum) || leadNum < 1 || leadNum > 365) {
      setError("Lead days must be a positive integer (1-365).");
      return;
    }
    const res = await fetch(`/api/admin/rfqs/${rfqId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        status: "quoted",
        quoted_price_cny_fen: Math.round(priceNum * 100),
        quoted_min_qty: minQtyNum,
        quoted_lead_days: leadNum,
        quoted_notes: notes.trim() || undefined,
      }),
    });
    if (!res.ok) {
      const j = await res.json().catch(() => ({}));
      setError(j.message ?? j.error ?? `HTTP ${res.status}`);
      return;
    }
    startTransition(() => router.refresh());
  }

  if (disabled) {
    return (
      <p className="text-[12px] text-fg-muted">
        This RFQ is already {disabled ? "past the open stage" : "not in an open state"} — the buyer has been emailed with the quote.
      </p>
    );
  }

  return (
    <div className="grid grid-cols-2 gap-3">
      <Field label="Quoted FOB / unit (CNY)">
        <input
          type="number"
          value={price}
          onChange={(e) => setPrice(e.target.value)}
          placeholder="12.50"
          min={0}
          step={0.01}
          className="h-9 px-3 w-full rounded-md border border-border bg-bg text-[13px] font-mono outline-none focus:border-cyan-500"
        />
      </Field>
      <Field label="Min order qty">
        <input
          type="number"
          value={minQty}
          onChange={(e) => setMinQty(e.target.value)}
          placeholder="1000"
          min={1}
          className="h-9 px-3 w-full rounded-md border border-border bg-bg text-[13px] font-mono outline-none focus:border-cyan-500"
        />
      </Field>
      <Field label="Lead time (days)">
        <input
          type="number"
          value={leadDays}
          onChange={(e) => setLeadDays(e.target.value)}
          placeholder="30"
          min={1}
          max={365}
          className="h-9 px-3 w-full rounded-md border border-border bg-bg text-[13px] font-mono outline-none focus:border-cyan-500"
        />
      </Field>
      <div />
      <Field label="Notes to buyer" full>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="e.g. 30% deposit, balance on B/L copy; sample fee $50 refundable on bulk order; CIF available on request."
          rows={3}
          className="px-3 py-2 w-full rounded-md border border-border bg-bg text-[13px] outline-none focus:border-cyan-500 resize-y"
        />
      </Field>
      {error && (
        <div className="col-span-2 text-[12.5px] text-rose-700 bg-rose-50 border border-rose-200 rounded-md p-2.5">
          {error}
        </div>
      )}
      <div className="col-span-2 flex items-center gap-2">
        <button
          type="button"
          onClick={submit}
          disabled={isPending}
          className="h-9 px-4 rounded-md bg-cyan-600 text-white text-[12.5px] font-medium hover:bg-cyan-700 disabled:opacity-50"
        >
          {isPending ? "Sending quote…" : "Send quote to buyer"}
        </button>
        <span className="text-[11px] text-fg-muted">
          Emailed to buyer + status flips to "Quoted"
        </span>
      </div>
    </div>
  );
}

function Field({
  label,
  full,
  children,
}: {
  label: string;
  full?: boolean;
  children: React.ReactNode;
}) {
  return (
    <label className={`block ${full ? "col-span-2" : ""}`}>
      <span className="block text-[10.5px] uppercase tracking-wider text-fg-subtle font-medium mb-1">
        {label}
      </span>
      {children}
    </label>
  );
}
