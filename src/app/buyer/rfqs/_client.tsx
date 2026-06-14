"use client";
// /buyer/rfqs — client component for the list + new-RFQ form.
//
// The page itself is a server component that loads the buyer's
// own RFQs + their profile (for prefilling the form's name +
// email). All mutations round-trip to /api/buyer/rfqs.
//
// The form is intentionally permissive on the spec field — we
// want the buyer to write naturally, not fill out a 30-field
// questionnaire. The schema validators (server-side) catch
// the obvious bad cases (empty title, too-short spec,
// out-of-range qty).

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

export type RFQ = {
  id: number;
  title: string;
  spec_text: string;
  target_qty: number;
  target_price_cny_fen: number | null;
  image_urls: string[];
  destination_country: string;
  notes: string | null;
  status: "open" | "quoted" | "accepted" | "rejected" | "cancelled";
  quoted_price_cny_fen: number | null;
  quoted_min_qty: number | null;
  quoted_lead_days: number | null;
  quoted_notes: string | null;
  quoted_at: string | null;
  closed_at: string | null;
  created_at: string;
  updated_at: string;
};

const STATUS_COPY: Record<
  RFQ["status"],
  { label: string; tone: "neutral" | "info" | "ok" | "warn" | "muted" }
> = {
  open: { label: "Open", tone: "info" },
  quoted: { label: "Quoted", tone: "neutral" },
  accepted: { label: "Accepted", tone: "ok" },
  rejected: { label: "Rejected", tone: "warn" },
  cancelled: { label: "Cancelled", tone: "muted" },
};

const STATUS_TONE_CLASS: Record<string, string> = {
  info: "border-cyan-200 bg-cyan-50 text-cyan-800",
  neutral: "border-violet-200 bg-violet-50 text-violet-800",
  ok: "border-emerald-200 bg-emerald-50 text-emerald-800",
  warn: "border-amber-200 bg-amber-50 text-amber-800",
  muted: "border-border bg-bg-soft text-fg-muted",
};

export function RFQsClient({
  rfqs,
  mode,
  defaultName,
  defaultEmail,
}: {
  rfqs: RFQ[];
  mode: "new" | null;
  defaultName: string;
  defaultEmail: string;
}) {
  const router = useRouter();

  const showEmpty = rfqs.length === 0 && mode !== "new";

  return (
    <>
      {showEmpty ? (
        <div className="card p-8 text-center">
          <div className="max-w-md mx-auto">
            <h3 className="text-[16px] font-semibold">No RFQs yet</h3>
            <p className="mt-1.5 text-[13px] text-fg-muted">
              Submit a spec, quantity, and any photos. We forward to
              3-5 verified factories and return sealed bids in 48 hours.
            </p>
            <Link
              href="/buyer/rfqs?action=new"
              className="mt-6 inline-block px-4 py-2 text-[13px] rounded-md bg-cyan-600 text-white hover:bg-cyan-700 font-medium"
            >
              New RFQ
            </Link>
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          {rfqs.map((r) => (
            <div key={r.id} className="card p-5">
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span
                      className={`text-[10px] font-medium tracking-wider uppercase px-1.5 py-0.5 border rounded ${
                        STATUS_TONE_CLASS[STATUS_COPY[r.status].tone]
                      }`}
                    >
                      {STATUS_COPY[r.status].label}
                    </span>
                    <span className="text-[11.5px] text-fg-subtle font-mono">
                      RFQ-{String(r.id).padStart(6, "0")}
                    </span>
                    <span className="text-[14px] font-semibold">{r.title}</span>
                  </div>
                  <p className="mt-1.5 text-[13px] text-fg line-clamp-2">
                    {r.spec_text}
                  </p>
                  <p className="mt-1.5 text-[12px] text-fg-muted">
                    Target: {r.target_qty.toLocaleString()} units
                    {r.target_price_cny_fen
                      ? ` @ ¥${(r.target_price_cny_fen / 100).toFixed(2)}`
                      : ""}{" "}
                    · Ships to {r.destination_country} ·{" "}
                    {new Date(r.created_at).toLocaleDateString("en-GB", {
                      day: "numeric",
                      month: "short",
                      year: "numeric",
                    })}
                  </p>
                  {r.status === "quoted" && r.quoted_price_cny_fen && (
                    <div className="mt-3 bg-cyan-50 border border-cyan-200 rounded-md p-3">
                      <p className="text-[10.5px] uppercase tracking-wider text-cyan-800 font-medium">
                        Factory quote
                      </p>
                      <p className="mt-1 text-[14px] font-semibold text-cyan-900">
                        ¥{(r.quoted_price_cny_fen / 100).toFixed(2)} / unit
                      </p>
                      <p className="text-[12px] text-cyan-800 mt-0.5">
                        Min qty {r.quoted_min_qty?.toLocaleString() ?? "—"}{" "}
                        · Lead {r.quoted_lead_days ?? "—"} days
                      </p>
                      {r.quoted_notes && (
                        <p className="mt-2 text-[12.5px] text-cyan-900 leading-relaxed">
                          {r.quoted_notes}
                        </p>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {mode === "new" && (
        <div className="mt-6">
          <NewRFQForm
            defaultName={defaultName}
            defaultEmail={defaultEmail}
            onDone={() => {
              router.push("/buyer/rfqs");
              router.refresh();
            }}
            onCancel={() => router.push("/buyer/rfqs")}
          />
        </div>
      )}

      {mode === null && !showEmpty && (
        <div className="mt-6 flex items-center gap-3">
          <Link
            href="/buyer/rfqs?action=new"
            className="px-4 py-2 text-[13px] rounded-md bg-cyan-600 text-white hover:bg-cyan-700 font-medium"
          >
            + New RFQ
          </Link>
          <Link
            href="/categories"
            className="text-[12.5px] text-fg-muted hover:text-fg"
          >
            or browse the catalog →
          </Link>
        </div>
      )}
    </>
  );
}

function NewRFQForm({
  defaultName,
  defaultEmail,
  onDone,
  onCancel,
}: {
  defaultName: string;
  defaultEmail: string;
  onDone: () => void;
  onCancel: () => void;
}) {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [spec, setSpec] = useState("");
  const [qty, setQty] = useState("");
  const [targetPrice, setTargetPrice] = useState("");
  const [imageUrls, setImageUrls] = useState("");
  const [notes, setNotes] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  async function submit() {
    setError(null);
    const imageList = imageUrls
      .split(/[\n,]/)
      .map((s) => s.trim())
      .filter(Boolean);
    let targetPriceFen: number | null = null;
    if (targetPrice.trim()) {
      const n = Number(targetPrice);
      if (!Number.isFinite(n) || n <= 0) {
        setError("Target price must be a positive number (CNY per unit).");
        return;
      }
      targetPriceFen = Math.round(n * 100);
    }
    const qtyNum = Number(qty);
    if (!Number.isInteger(qtyNum) || qtyNum < 1) {
      setError("Target quantity must be a positive integer.");
      return;
    }
    const res = await fetch("/api/buyer/rfqs", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: title.trim(),
        spec_text: spec.trim(),
        target_qty: qtyNum,
        target_price_cny_fen: targetPriceFen,
        image_urls: imageList,
        destination_country: "BD",
        notes: notes.trim() || undefined,
      }),
    });
    if (!res.ok) {
      const j = await res.json().catch(() => ({}));
      setError(j.message ?? j.error ?? `HTTP ${res.status}`);
      return;
    }
    startTransition(() => {
      onDone();
      router.refresh();
    });
  }

  return (
    <div className="card p-5 border-cyan-200">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-[14px] font-semibold">New RFQ</h2>
        <button
          type="button"
          onClick={onCancel}
          className="text-[12px] text-fg-muted hover:text-fg"
        >
          Cancel
        </button>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <Field label="Title (short summary)">
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Private-label cotton t-shirts, Gildan 5000 blank"
            className="h-9 px-3 w-full rounded-md border border-border bg-bg text-[13px] outline-none focus:border-cyan-500"
          />
        </Field>
        <Field label="Target quantity (units)">
          <input
            type="number"
            value={qty}
            onChange={(e) => setQty(e.target.value)}
            placeholder="1000"
            min={1}
            className="h-9 px-3 w-full rounded-md border border-border bg-bg text-[13px] font-mono outline-none focus:border-cyan-500"
          />
        </Field>
        <Field label="Target FOB / unit (CNY, optional)">
          <input
            type="number"
            value={targetPrice}
            onChange={(e) => setTargetPrice(e.target.value)}
            placeholder="12.50"
            min={0}
            step={0.01}
            className="h-9 px-3 w-full rounded-md border border-border bg-bg text-[13px] font-mono outline-none focus:border-cyan-500"
          />
        </Field>
        <Field label="Submitted by" full>
          <p className="h-9 px-3 w-full rounded-md border border-border bg-bg-soft text-[13px] flex items-center text-fg-muted">
            {defaultName || "—"}{" "}
            {defaultEmail && (
              <span className="ml-2 text-fg-subtle font-mono">· {defaultEmail}</span>
            )}
          </p>
        </Field>
        <Field label="Spec (materials / sizes / colors / branding / packaging)" full>
          <textarea
            value={spec}
            onChange={(e) => setSpec(e.target.value)}
            placeholder="100% cotton, 180 GSM, sizes S-XXL, 4 colors (black, white, navy, heather grey), private-label woven neck label, individually poly-bagged, 50pcs per master carton. Need 1 round of samples before bulk."
            rows={6}
            className="px-3 py-2 w-full rounded-md border border-border bg-bg text-[13px] outline-none focus:border-cyan-500 resize-y"
          />
        </Field>
        <Field
          label="Reference image URLs (one per line — Alibaba, WeChat screenshot, Google Drive link, etc.)"
          full
        >
          <textarea
            value={imageUrls}
            onChange={(e) => setImageUrls(e.target.value)}
            placeholder="https://…/ref1.jpg&#10;https://…/ref2.jpg"
            rows={2}
            className="px-3 py-2 w-full rounded-md border border-border bg-bg text-[12.5px] font-mono outline-none focus:border-cyan-500 resize-none"
          />
        </Field>
        <Field label="Anything else? (optional)" full>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="e.g. Need delivery to Chittagong, prefer factories that already work with Bangladesh buyers, sample budget $50."
            rows={2}
            className="px-3 py-2 w-full rounded-md border border-border bg-bg text-[13px] outline-none focus:border-cyan-500 resize-none"
          />
        </Field>
      </div>

      {error && (
        <div className="mt-3 text-[12.5px] text-rose-700 bg-rose-50 border border-rose-200 rounded-md p-2.5">
          {error}
        </div>
      )}

      <div className="mt-4 flex items-center gap-2">
        <button
          type="button"
          onClick={submit}
          disabled={isPending}
          className="h-9 px-4 rounded-md bg-cyan-600 text-white text-[12.5px] font-medium hover:bg-cyan-700 disabled:opacity-50"
        >
          {isPending ? "Submitting…" : "Submit RFQ"}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="h-9 px-3 text-[12.5px] text-fg-muted hover:text-fg"
        >
          Cancel
        </button>
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
    <label className={`block ${full ? "sm:col-span-2" : ""}`}>
      <span className="block text-[10.5px] uppercase tracking-wider text-fg-subtle font-medium mb-1">
        {label}
      </span>
      {children}
    </label>
  );
}
