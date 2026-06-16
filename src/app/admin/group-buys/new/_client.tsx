// /admin/group-buys/new — manual group-buy-create form.
//
// Phase 37. Admin fills:
//   - product_id (picker — searches active products by title/source_id)
//   - target_qty (total SUM of member.qty to form the group)
//   - min_qty_per_buyer (1-100000; default 50)
//   - 1-5 price tiers (dynamic rows; qty_threshold + unit_bdt)
//   - deadline (datetime-local; must be > 1h from now)
//
// On Save -> POST /api/admin/group-buys -> creates the group_buy
// row with status='open' and bounces the admin to the detail page.
//
// The tier inputs are validated client-side via
// `validateGroupBuyTiers` so the admin sees the error BEFORE
// hitting the API. The API re-validates server-side — don't skip
// the server check, the client check is purely UX.
//
// Live "preview": as the admin fills tiers, the panel on the
// right shows the buyer-visible pricing ladder (so they can
// see the same thing the buyer will).

"use client";

import { useState, useMemo, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { AdminPage } from "@/components/admin-page";
import {
  validateGroupBuyTiers,
  groupBuyPriceAtQty,
  type GroupBuyPriceTier,
} from "@/lib/pricing";
import { CATEGORIES } from "@/lib/catalog-categories";

type ProductRow = {
  id: number;
  source_id: string;
  title_en: string | null;
  title_bn: string | null;
  category: string;
  images: string[] | null;
  factory_moq: number | null;
};

type Tier = { qty_threshold: string; unit_bdt: string };

const DEFAULT_TIERS: Tier[] = [
  { qty_threshold: "500", unit_bdt: "480" },
  { qty_threshold: "1000", unit_bdt: "450" },
  { qty_threshold: "2000", unit_bdt: "420" },
];

function isoToLocalInput(iso: string): string {
  // datetime-local wants "YYYY-MM-DDTHH:MM" in LOCAL time, NOT UTC.
  // toISOString() gives UTC. We construct local time manually.
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function defaultDeadlineLocal(): string {
  // 7 days from now, in local time
  const d = new Date(Date.now() + 7 * 86400_000);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function NewGroupBuyClient({ products }: { products: ProductRow[] }) {
  const router = useRouter();

  // Product search
  const [search, setSearch] = useState("");
  const [productId, setProductId] = useState<number | null>(null);
  const filteredProducts = useMemo(() => {
    if (!search.trim()) return products.slice(0, 50);
    const q = search.toLowerCase();
    return products
      .filter(
        (p) =>
          (p.title_en ?? "").toLowerCase().includes(q) ||
          (p.title_bn ?? "").toLowerCase().includes(q) ||
          p.source_id.toLowerCase().includes(q),
      )
      .slice(0, 50);
  }, [products, search]);

  // Form fields
  const [targetQty, setTargetQty] = useState("1000");
  const [minQty, setMinQty] = useState("50");
  const [deadlineLocal, setDeadlineLocal] = useState(defaultDeadlineLocal());
  const [tiers, setTiers] = useState<Tier[]>(DEFAULT_TIERS);

  // Submit state
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const selectedProduct =
    productId != null ? products.find((p) => p.id === productId) ?? null : null;

  // Build typed tiers for validation + preview
  const parsedTiers: GroupBuyPriceTier[] = useMemo(
    () =>
      tiers
        .map((t) => ({
          qty_threshold: parseInt(t.qty_threshold, 10) || 0,
          unit_bdt: parseInt(t.unit_bdt, 10) || 0,
        }))
        .filter((t) => t.qty_threshold > 0 && t.unit_bdt > 0),
    [tiers],
  );
  const tiersValidation = useMemo(
    () => validateGroupBuyTiers(parsedTiers),
    [parsedTiers],
  );

  // Validation
  const productOk = productId != null;
  const targetOk = parseInt(targetQty, 10) >= 1;
  const minOk = parseInt(minQty, 10) >= 1;
  const tiersOk = tiersValidation.ok;
  const minUnderTarget =
    minOk && targetOk && parseInt(minQty, 10) < parseInt(targetQty, 10);

  // Deadline must be > 1h from now
  const deadlineMs = useMemo(() => {
    if (!deadlineLocal) return 0;
    return new Date(deadlineLocal).getTime();
  }, [deadlineLocal]);
  const oneHourFromNow = Date.now() + 3600_000;
  const deadlineOk = deadlineMs > oneHourFromNow;

  const canSave =
    !saving && productOk && targetOk && minOk && minUnderTarget && tiersOk && deadlineOk;

  function updateTier(idx: number, field: "qty_threshold" | "unit_bdt", value: string) {
    setTiers((prev) =>
      prev.map((t, i) => (i === idx ? { ...t, [field]: value } : t)),
    );
  }
  function addTier() {
    if (tiers.length >= 5) return;
    // Suggest the next sensible threshold: 2x the last one
    const last = tiers[tiers.length - 1];
    const lastQty = parseInt(last?.qty_threshold ?? "0", 10) || 100;
    const lastBdt = parseInt(last?.unit_bdt ?? "0", 10) || 500;
    setTiers((prev) => [
      ...prev,
      {
        qty_threshold: String(lastQty * 2),
        unit_bdt: String(Math.max(1, lastBdt - 30)),
      },
    ]);
  }
  function removeTier(idx: number) {
    if (tiers.length <= 1) return;
    setTiers((prev) => prev.filter((_, i) => i !== idx));
  }

  async function handleSave() {
    setError(null);
    if (!canSave) return;
    setSaving(true);
    try {
      // Local datetime -> UTC ISO
      const deadlineIso = new Date(deadlineLocal).toISOString();
      const r = await fetch("/api/admin/group-buys", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          productId: productId,
          targetQty: parseInt(targetQty, 10),
          minQtyPerBuyer: parseInt(minQty, 10),
          priceTiers: parsedTiers,
          deadlineAt: deadlineIso,
        }),
      });
      if (!r.ok) {
        const body = await r.json().catch(() => ({}));
        setError(body.error ?? `Save failed: ${r.status}`);
        setSaving(false);
        return;
      }
      const created = (await r.json()) as { id: string };
      router.push(`/admin/group-buys/${created.id}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Save failed");
      setSaving(false);
    }
  }

  // Preview ladder
  const previewSteps = useMemo(() => {
    if (!tiersOk || !targetOk) return [];
    const target = parseInt(targetQty, 10);
    const steps: { qty: number; price: number; label: string }[] = [];
    for (const tier of parsedTiers) {
      steps.push({
        qty: tier.qty_threshold,
        price: tier.unit_bdt,
        label: `At ${tier.qty_threshold.toLocaleString()} pcs → ৳${tier.unit_bdt}/pc`,
      });
    }
    // Add the "below lowest tier" row
    if (parsedTiers.length > 0) {
      const first = parsedTiers[0];
      steps.unshift({
        qty: 0,
        price: first.unit_bdt,
        label: `Below ${first.qty_threshold.toLocaleString()} → ৳${first.unit_bdt}/pc (worst case)`,
      });
    }
    steps.push({
      qty: target,
      price: groupBuyPriceAtQty(parsedTiers, target),
      label: `At target ${target.toLocaleString()} → ৳${groupBuyPriceAtQty(parsedTiers, target)}/pc`,
    });
    return steps;
  }, [parsedTiers, tiersOk, targetQty, targetOk]);

  return (
    <AdminPage size="wide">
      <div className="mb-6">
        <Link
          href="/admin/group-buys"
          className="text-[12px] text-fg-muted hover:text-fg"
        >
          ← Group buys
        </Link>
        <h1 className="text-[24px] font-semibold tracking-tight mt-2">
          Create group buy
        </h1>
        <p className="text-[13px] text-fg-muted mt-1">
          Set a target quantity, a deadline, and a tiered step-down price
          ladder. Buyers commit a qty; when SUM of all members hits target,
          every member is charged at the final tiered price.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* LEFT: form */}
        <div className="space-y-5">
          {/* Product picker */}
          <Field label="Product" required>
            {selectedProduct ? (
              <div className="rounded-md border border-cyan-300 bg-cyan-50/50 p-3 flex items-center gap-3">
                {selectedProduct.images?.[0] ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={selectedProduct.images[0]}
                    alt=""
                    className="w-12 h-12 rounded border border-border object-cover shrink-0"
                  />
                ) : (
                  <div className="w-12 h-12 rounded border border-border bg-slate-50 shrink-0" />
                )}
                <div className="min-w-0 flex-1">
                  <p className="text-[13px] font-medium truncate">
                    {selectedProduct.title_en ?? `Product #${selectedProduct.id}`}
                  </p>
                  <p className="text-[11px] text-fg-subtle font-mono tnum">
                    {selectedProduct.source_id} ·{" "}
                    {CATEGORIES.find((c) => c.value === selectedProduct.category)
                      ?.label ?? selectedProduct.category}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setProductId(null)}
                  className="text-[12px] text-cyan-700 hover:text-cyan-800 shrink-0"
                >
                  Change
                </button>
              </div>
            ) : (
              <div className="space-y-2">
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search products by title, source_id..."
                  className="h-10 w-full rounded-md border border-border bg-bg px-3 text-[13px] focus:border-cyan-600 focus:outline-none focus:ring-2 focus:ring-cyan-500/20"
                />
                <div className="rounded-md border border-border max-h-72 overflow-y-auto">
                  {filteredProducts.length === 0 ? (
                    <p className="px-3 py-6 text-center text-[12.5px] text-fg-muted">
                      No matches
                    </p>
                  ) : (
                    filteredProducts.map((p) => (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => {
                          setProductId(p.id);
                          setSearch("");
                        }}
                        className="w-full text-left px-3 py-2 hover:bg-cyan-50/40 border-b border-border last:border-0 flex items-center gap-2"
                      >
                        {p.images?.[0] ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={p.images[0]}
                            alt=""
                            className="w-7 h-7 rounded border border-border object-cover shrink-0"
                          />
                        ) : (
                          <div className="w-7 h-7 rounded border border-border bg-slate-50 shrink-0" />
                        )}
                        <div className="min-w-0 flex-1">
                          <p className="text-[12.5px] font-medium truncate">
                            {p.title_en ?? `Product #${p.id}`}
                          </p>
                          <p className="text-[10.5px] text-fg-subtle font-mono tnum">
                            {p.source_id}
                          </p>
                        </div>
                      </button>
                    ))
                  )}
                </div>
              </div>
            )}
          </Field>

          {/* Qty fields */}
          <div className="grid grid-cols-2 gap-3">
            <Field
              label="Target quantity (pcs)"
              required
              hint="Sum of all members' qty to form the group"
            >
              <input
                type="number"
                min="1"
                max="1000000"
                value={targetQty}
                onChange={(e) => setTargetQty(e.target.value)}
                className="h-10 w-full rounded-md border border-border bg-bg px-3 text-[13px] font-mono tnum focus:border-cyan-600 focus:outline-none focus:ring-2 focus:ring-cyan-500/20"
              />
            </Field>
            <Field
              label="Min per buyer (pcs)"
              required
              hint="1 - target_qty"
              error={
                minOk && targetOk && !minUnderTarget
                  ? "Must be < target"
                  : undefined
              }
            >
              <input
                type="number"
                min="1"
                max="1000000"
                value={minQty}
                onChange={(e) => setMinQty(e.target.value)}
                className="h-10 w-full rounded-md border border-border bg-bg px-3 text-[13px] font-mono tnum focus:border-cyan-600 focus:outline-none focus:ring-2 focus:ring-cyan-500/20"
              />
            </Field>
          </div>

          {/* Deadline */}
          <Field
            label="Deadline"
            required
            hint={`Must be > 1 hour from now (your local: ${new Date().toLocaleString("en-GB", { dateStyle: "short", timeStyle: "short" })})`}
            error={!deadlineOk ? "Deadline must be > 1h from now" : undefined}
          >
            <input
              type="datetime-local"
              value={deadlineLocal}
              onChange={(e) => setDeadlineLocal(e.target.value)}
              className="h-10 w-full rounded-md border border-border bg-bg px-3 text-[13px] font-mono tnum focus:border-cyan-600 focus:outline-none focus:ring-2 focus:ring-cyan-500/20"
            />
          </Field>

          {/* Tiers */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-[12.5px] font-medium">
                Price tiers <span className="text-red-600">*</span>
                <span className="text-fg-muted font-normal ml-1">
                  ({tiers.length}/5)
                </span>
              </label>
              <button
                type="button"
                onClick={addTier}
                disabled={tiers.length >= 5}
                className="text-[12px] text-cyan-700 hover:text-cyan-800 disabled:text-fg-subtle disabled:cursor-not-allowed"
              >
                + Add tier
              </button>
            </div>
            <div className="space-y-1.5">
              {tiers.map((tier, idx) => (
                <div
                  key={idx}
                  className="flex items-center gap-2 rounded-md border border-border bg-bg p-2"
                >
                  <span className="text-[10.5px] uppercase tracking-wider text-fg-subtle w-12">
                    Tier {idx + 1}
                  </span>
                  <div className="flex-1">
                    <input
                      type="number"
                      min="1"
                      value={tier.qty_threshold}
                      onChange={(e) =>
                        updateTier(idx, "qty_threshold", e.target.value)
                      }
                      placeholder="Qty threshold"
                      className="h-9 w-full rounded border border-border bg-bg px-2.5 text-[12.5px] font-mono tnum focus:border-cyan-600 focus:outline-none"
                    />
                  </div>
                  <span className="text-[11px] text-fg-subtle">@</span>
                  <div className="flex-1">
                    <input
                      type="number"
                      min="1"
                      value={tier.unit_bdt}
                      onChange={(e) =>
                        updateTier(idx, "unit_bdt", e.target.value)
                      }
                      placeholder="Unit BDT"
                      className="h-9 w-full rounded border border-border bg-bg px-2.5 text-[12.5px] font-mono tnum focus:border-cyan-600 focus:outline-none"
                    />
                  </div>
                  <span className="text-[11px] text-fg-subtle">৳/pc</span>
                  {tiers.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removeTier(idx)}
                      className="text-fg-subtle hover:text-red-600 w-7 h-7 rounded flex items-center justify-center"
                      title="Remove tier"
                    >
                      ×
                    </button>
                  )}
                </div>
              ))}
            </div>
            {!tiersValidation.ok && (
              <p className="mt-1.5 text-[12px] text-red-600">
                {tiersValidation.error}
              </p>
            )}
            {tiersValidation.ok && (
              <p className="mt-1.5 text-[11.5px] text-emerald-700">
                ✓ {parsedTiers.length} tier{parsedTiers.length === 1 ? "" : "s"}{" "}
                valid
              </p>
            )}
          </div>

          {error && (
            <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-[12.5px] text-red-700">
              {error}
            </div>
          )}

          <div className="flex items-center gap-3 pt-2">
            <button
              type="button"
              onClick={handleSave}
              disabled={!canSave}
              className="h-10 px-5 text-[13px] font-medium rounded-md bg-cyan-600 text-white hover:bg-cyan-700 disabled:bg-bg-soft disabled:text-fg-subtle disabled:cursor-not-allowed shadow-[inset_0_-1px_0_rgba(0,0,0,0.08)]"
            >
              {saving ? "Creating…" : "Create group buy"}
            </button>
            <Link
              href="/admin/group-buys"
              className="h-10 px-4 text-[13px] font-medium rounded-md border border-border bg-bg text-fg hover:border-border-strong inline-flex items-center"
            >
              Cancel
            </Link>
          </div>
        </div>

        {/* RIGHT: live preview */}
        <div className="rounded-lg border border-border bg-bg-soft/30 p-4 h-fit lg:sticky lg:top-4">
          <p className="section-eyebrow mb-3">Buyer view preview</p>
          <h3 className="text-[15px] font-semibold mb-3">
            {selectedProduct?.title_en ?? "Pick a product to preview"}
          </h3>
          {selectedProduct ? (
            <>
              <div className="space-y-1.5 mb-4">
                <Row k="Source ID" v={selectedProduct.source_id} mono />
                <Row
                  k="Category"
                  v={
                    CATEGORIES.find((c) => c.value === selectedProduct.category)
                      ?.label ?? selectedProduct.category
                  }
                />
                <Row k="Target qty" v={`${parseInt(targetQty, 10).toLocaleString()} pcs`} mono />
                <Row
                  k="Min per buyer"
                  v={`${parseInt(minQty, 10).toLocaleString()} pcs`}
                  mono
                />
                <Row
                  k="Deadline"
                  v={new Date(deadlineLocal).toLocaleString("en-GB", {
                    dateStyle: "medium",
                    timeStyle: "short",
                  })}
                />
              </div>

              {tiersOk && previewSteps.length > 0 ? (
                <div>
                  <p className="text-[11.5px] uppercase tracking-wider text-fg-subtle font-medium mb-2">
                    Pricing ladder
                  </p>
                  <div className="space-y-1">
                    {previewSteps.map((s, i) => (
                      <div
                        key={i}
                        className={`flex items-center justify-between px-2.5 py-1.5 rounded text-[12.5px] ${
                          i === 0
                            ? "bg-amber-50/50 text-amber-900"
                            : i === previewSteps.length - 1
                              ? "bg-emerald-50/50 text-emerald-900"
                              : "text-fg"
                        }`}
                      >
                        <span className="font-mono tnum text-[11.5px]">
                          {s.qty.toLocaleString()} pcs
                        </span>
                        <span className="font-mono tnum font-medium">
                          ৳{s.price}/pc
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <p className="text-[12.5px] text-fg-muted">
                  Fix the price tiers to see the preview.
                </p>
              )}
            </>
          ) : (
            <p className="text-[12.5px] text-fg-muted">
              Select a product to see the buyer-facing preview here.
            </p>
          )}
        </div>
      </div>
    </AdminPage>
  );
}

function Field({
  label,
  required,
  hint,
  error,
  children,
}: {
  label: string;
  required?: boolean;
  hint?: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="block text-[12.5px] font-medium mb-1.5">
        {label} {required && <span className="text-red-600">*</span>}
      </label>
      {children}
      {hint && !error && (
        <p className="mt-1 text-[11px] text-fg-subtle">{hint}</p>
      )}
      {error && <p className="mt-1 text-[11px] text-red-600">{error}</p>}
    </div>
  );
}

function Row({ k, v, mono }: { k: string; v: string; mono?: boolean }) {
  return (
    <div className="data-row">
      <span>{k}</span>
      <span className={mono ? "font-mono tnum" : ""}>{v}</span>
    </div>
  );
}
