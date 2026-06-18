"use client";

// /buyer/addresses — client component for the list + form +
// editing state. The page itself is a server component that
// loads the initial list and passes it down. All mutations
// (add / edit / set-default / delete) round-trip to
// /api/buyer/addresses[/id] and re-fetch via router.refresh().
//
// The mode is driven by URL search params:
//   /buyer/addresses          → list (or empty state)
//   /buyer/addresses?action=new   → list + new-form visible
//   /buyer/addresses?action=edit&id=N  → list + edit-form for N

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

const LABELS = ["Home", "Office", "3PL", "Factory", "Other"] as const;
type Label = (typeof LABELS)[number];

export type Address = {
  id: number;
  label: Label;
  full_name: string;
  phone: string;
  country: string;
  district: string;
  address_line: string;
  is_default: boolean;
  created_at: string;
  updated_at: string;
};

export function AddressesClient({
  addresses,
  mode,
  editing,
}: {
  addresses: Address[];
  mode: "new" | "edit" | null;
  editing: Address | undefined;
}) {
  const router = useRouter();
  const [confirmDelete, setConfirmDelete] = useState<number | null>(null);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  async function setDefault(id: number) {
    setError(null);
    const res = await fetch(`/api/buyer/addresses/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ is_default: true }),
    });
    if (!res.ok) {
      const j = await res.json().catch(() => ({}));
      setError(j.message ?? j.error ?? `HTTP ${res.status}`);
      return;
    }
    startTransition(() => router.refresh());
  }

  async function del(id: number) {
    setError(null);
    const res = await fetch(`/api/buyer/addresses/${id}`, {
      method: "DELETE",
    });
    if (!res.ok) {
      const j = await res.json().catch(() => ({}));
      setError(j.message ?? j.error ?? `HTTP ${res.status}`);
      return;
    }
    setConfirmDelete(null);
    startTransition(() => router.refresh());
  }

  const showEmpty = addresses.length === 0 && mode !== "new";

  return (
    <>
      {error && (
        <div className="mb-4 text-[12.5px] text-rose-700 bg-rose-50 border border-rose-200 rounded-md p-2.5">
          {error}
        </div>
      )}

      {showEmpty ? (
        <div className="card p-8 text-center">
          <div className="max-w-md mx-auto">
            <h3 className="text-[16px] font-semibold">
              No saved addresses yet
            </h3>
            <p className="mt-1.5 text-[13px] text-fg-muted">
              Add one to skip the re-typing on your next order.
              You can still type a one-off address at /checkout.
            </p>
            <Link
              href="/buyer/addresses?action=new"
              className="mt-6 inline-block px-4 py-2 text-[13px] rounded-md bg-cyan-600 text-white hover:bg-cyan-700 font-medium"
            >
              Add your first address
            </Link>
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          {addresses.map((a) => (
            <div key={a.id} className="card p-5">
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span
                      className={`text-[10px] font-medium tracking-wider uppercase px-1.5 py-0.5 border rounded ${
                        a.label === "Home"
                          ? "border-emerald-200 bg-emerald-50 text-emerald-800"
                          : a.label === "Office"
                            ? "border-cyan-200 bg-cyan-50 text-cyan-800"
                            : "border-border bg-bg-soft text-fg-muted"
                      }`}
                    >
                      {a.label}
                    </span>
                    {a.is_default && (
                      <span className="text-[10px] font-medium tracking-wider uppercase px-1.5 py-0.5 border border-amber-200 bg-amber-50 text-amber-800 rounded">
                        Default
                      </span>
                    )}
                    <span className="text-[14px] font-semibold">
                      {a.full_name}
                    </span>
                    <span className="text-[12px] text-fg-muted font-mono">
                      {a.phone}
                    </span>
                  </div>
                  <p className="mt-1.5 text-[13px] text-fg leading-relaxed">
                    {a.address_line}
                  </p>
                  <p className="text-[12px] text-fg-muted">
                    {a.district}, {a.country}
                  </p>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  {!a.is_default && (
                    <button
                      type="button"
                      onClick={() => setDefault(a.id)}
                      disabled={isPending}
                      className="h-8 px-3 text-[12px] border border-border rounded-md text-fg-muted hover:text-fg hover:bg-bg-soft disabled:opacity-50"
                    >
                      Set default
                    </button>
                  )}
                  <Link
                    href={`/buyer/addresses?action=edit&id=${a.id}`}
                    className="h-8 px-3 inline-flex items-center text-[12px] border border-border rounded-md text-fg-muted hover:text-fg hover:bg-bg-soft"
                  >
                    Edit
                  </Link>
                  {confirmDelete === a.id ? (
                    <span className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => del(a.id)}
                        disabled={isPending}
                        className="h-8 px-3 text-[12px] bg-rose-600 text-white rounded-md hover:bg-rose-700 disabled:opacity-50"
                      >
                        Confirm
                      </button>
                      <button
                        type="button"
                        onClick={() => setConfirmDelete(null)}
                        className="h-8 px-2 text-[12px] text-fg-muted hover:text-fg"
                      >
                        Cancel
                      </button>
                    </span>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setConfirmDelete(a.id)}
                      disabled={isPending}
                      className="h-8 px-3 text-[12px] border border-border rounded-md text-fg-muted hover:text-rose-600 hover:border-rose-200 disabled:opacity-50"
                    >
                      Delete
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {mode === "new" && (
        <div className="mt-6">
          <AddressForm
            onDone={() => router.push("/buyer/addresses")}
            onCancel={() => router.push("/buyer/addresses")}
          />
        </div>
      )}

      {mode === "edit" && editing && (
        <div className="mt-6">
          <AddressForm
            initial={editing}
            onDone={() => router.push("/buyer/addresses")}
            onCancel={() => router.push("/buyer/addresses")}
          />
        </div>
      )}

      {mode === null && !showEmpty && (
        <div className="mt-6 flex items-center gap-3">
          <Link
            href="/buyer/addresses?action=new"
            className="px-4 py-2 text-[13px] rounded-md bg-cyan-600 text-white hover:bg-cyan-700 font-medium"
          >
            + Add address
          </Link>
          <Link
            href="/checkout"
            className="text-[12.5px] text-fg-muted hover:text-fg"
          >
            or skip and type at checkout →
          </Link>
        </div>
      )}
    </>
  );
}

function AddressForm({
  initial,
  onDone,
  onCancel,
}: {
  initial?: Address;
  onDone: () => void;
  onCancel: () => void;
}) {
  const router = useRouter();
  const isEdit = Boolean(initial);
  const [form, setForm] = useState(
    initial
      ? {
          label: initial.label,
          full_name: initial.full_name,
          phone: initial.phone,
          country: initial.country,
          district: initial.district,
          address_line: initial.address_line,
        }
      : {
          label: "Home" as Label,
          full_name: "",
          phone: "",
          country: "BD",
          district: "",
          address_line: "",
        },
  );
  const [isDefault, setIsDefault] = useState(initial?.is_default ?? false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  async function save() {
    setError(null);
    const url = isEdit
      ? `/api/buyer/addresses/${initial!.id}`
      : "/api/buyer/addresses";
    const method = isEdit ? "PATCH" : "POST";
    const res = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...form, is_default: isDefault }),
    });
    if (!res.ok) {
      const j = await res.json().catch(() => ({}));
      setError(j.message ?? j.error ?? `HTTP ${res.status}`);
      return;
    }
    startTransition(() => {
      router.push("/buyer/addresses");
      router.refresh();
    });
  }

  return (
    <div className="card p-5 border-cyan-200">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-[14px] font-semibold">
          {isEdit ? "Edit address" : "New address"}
        </h2>
        <button
          type="button"
          onClick={onCancel}
          className="text-[12px] text-fg-muted hover:text-fg"
        >
          Cancel
        </button>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <Field label="Label">
          <select
            value={form.label}
            onChange={(e) =>
              setForm({ ...form, label: e.target.value as Label })
            }
            className="h-9 px-3 w-full rounded-md border border-border bg-bg text-[13px] outline-none focus:border-cyan-500"
          >
            {LABELS.map((l) => (
              <option key={l} value={l}>
                {l}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Country (2-letter)">
          <input
            type="text"
            value={form.country}
            onChange={(e) =>
              setForm({ ...form, country: e.target.value.toUpperCase() })
            }
            maxLength={2}
            className="h-9 px-3 w-full rounded-md border border-border bg-bg text-[13px] font-mono uppercase outline-none focus:border-cyan-500"
          />
        </Field>
        <Field label="Full name">
          <input
            type="text"
            value={form.full_name}
            onChange={(e) =>
              setForm({ ...form, full_name: e.target.value })
            }
            placeholder="Mr. Buyer"
            className="h-9 px-3 w-full rounded-md border border-border bg-bg text-[13px] outline-none focus:border-cyan-500"
          />
        </Field>
        <Field label="Phone">
          <input
            type="text"
            value={form.phone}
            onChange={(e) => setForm({ ...form, phone: e.target.value })}
            placeholder="01XXX-XXXXXX"
            className="h-9 px-3 w-full rounded-md border border-border bg-bg text-[13px] font-mono outline-none focus:border-cyan-500"
          />
        </Field>
        <Field label="District / city">
          <input
            type="text"
            value={form.district}
            onChange={(e) => setForm({ ...form, district: e.target.value })}
            placeholder="Gulshan, Dhaka"
            className="h-9 px-3 w-full rounded-md border border-border bg-bg text-[13px] outline-none focus:border-cyan-500"
          />
        </Field>
        <Field label="Address line" full>
          <textarea
            value={form.address_line}
            onChange={(e) =>
              setForm({ ...form, address_line: e.target.value })
            }
            placeholder="House 1, Road 1, Test Lane"
            rows={2}
            className="px-3 py-2 w-full rounded-md border border-border bg-bg text-[13px] outline-none focus:border-cyan-500 resize-none"
          />
        </Field>
      </div>
      <label className="mt-4 flex items-center gap-2 text-[13px] text-fg-muted cursor-pointer">
        <input
          type="checkbox"
          checked={isDefault}
          onChange={(e) => setIsDefault(e.target.checked)}
          className="w-4 heading-4 rounded border-border text-cyan-600 focus:ring-cyan-500"
        />
        Set as default (used to pre-fill /checkout)
      </label>

      {error && (
        <div className="mt-3 text-[12.5px] text-rose-700 bg-rose-50 border border-rose-200 rounded-md p-2.5">
          {error}
        </div>
      )}

      <div className="mt-4 flex items-center gap-2">
        <button
          type="button"
          onClick={save}
          disabled={isPending}
          className="h-9 px-4 rounded-md bg-cyan-600 text-white text-[12.5px] font-medium hover:bg-cyan-700 disabled:opacity-50"
        >
          {isPending ? "Saving…" : isEdit ? "Save changes" : "Add address"}
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
