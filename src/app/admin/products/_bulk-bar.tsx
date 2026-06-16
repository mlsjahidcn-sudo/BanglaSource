"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

type Props = {
  sourceIds: string[];
  inactiveSourceIds: string[];
  activeSourceIds: string[];
  totalActive: number;
  totalAll: number;
};

type Toast = { kind: "ok" | "err"; msg: string } | null;

export function BulkActionsBar(props: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [toast, setToast] = useState<Toast>(null);

  const flash = (kind: "ok" | "err", msg: string) => {
    setToast({ kind, msg });
    setTimeout(() => setToast(null), 4000);
  };

  async function bulkSet(active: boolean, ids: string[], scope: string) {
    if (ids.length === 0) {
      flash(
        "err",
        "No products to " +
          (active ? "activate" : "deactivate") +
          " in scope \"" +
          scope +
          "\".",
      );
      return;
    }
    if (ids.length > 500) {
      flash(
        "err",
        "Refusing to update " +
          ids.length +
          " products in one go (max 500). Narrow filters first.",
      );
      return;
    }
    const verb = active ? "activate" : "deactivate";
    const ok = window.confirm(
      "Set " +
        ids.length +
        " product(s) to " +
        verb.toUpperCase() +
        "?\n\nThis is reversible. Buyers won't see inactive products in search or category pages.",
    );
    if (!ok) return;
    const res = await fetch("/api/admin/products/bulk", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ active, source_ids: ids }),
    });
    if (!res.ok) {
      const j = (await res.json().catch(() => ({}))) as { error?: string };
      flash("err", "Bulk update failed: " + (j.error ?? res.statusText));
      return;
    }
    const j = (await res.json()) as { updated: number; requested: number };
    flash(
      "ok",
      "Updated " + j.updated + " of " + j.requested + " product(s) to " + verb + ".",
    );
    startTransition(() => router.refresh());
  }

  return (
    <div className="mt-4 card p-3 flex flex-wrap items-center gap-2">
      <span className="text-[10.5px] uppercase tracking-wider font-medium text-fg-subtle mr-1">
        Bulk
      </span>
      <button
        type="button"
        disabled={pending || props.sourceIds.length === 0}
        onClick={() => bulkSet(false, props.sourceIds, "current filter")}
        className="h-8 px-3 text-[12.5px] rounded-md border border-rose-200 text-rose-700 bg-rose-50 hover:bg-rose-100 disabled:opacity-40 disabled:cursor-not-allowed"
      >
        Deactivate {props.sourceIds.length} in filter
      </button>
      <button
        type="button"
        disabled={pending || props.inactiveSourceIds.length === 0}
        onClick={() => bulkSet(true, props.inactiveSourceIds, "all inactive")}
        className="h-8 px-3 text-[12.5px] rounded-md border border-emerald-200 text-emerald-700 bg-emerald-50 hover:bg-emerald-100 disabled:opacity-40 disabled:cursor-not-allowed"
      >
        Activate {props.inactiveSourceIds.length} inactive
      </button>
      <button
        type="button"
        disabled={pending || props.activeSourceIds.length === 0}
        onClick={() => bulkSet(false, props.activeSourceIds, "all active")}
        className="h-8 px-3 text-[12.5px] rounded-md border border-border text-fg-muted hover:text-fg hover:bg-bg-soft disabled:opacity-40 disabled:cursor-not-allowed"
      >
        Deactivate {props.activeSourceIds.length} active
      </button>
      <span className="text-[11px] text-fg-subtle ml-auto font-mono tnum">
        {props.totalActive} active / {props.totalAll} total
      </span>
      {toast && (
        <span
          role="alert"
          className={
            "basis-full mt-1 text-[12px] px-2 py-1 rounded border " +
            (toast.kind === "ok"
              ? "bg-cyan-50 border-cyan-200 text-cyan-800"
              : "bg-rose-50 border-rose-200 text-rose-800")
          }
        >
          {toast.msg}
        </span>
      )}
    </div>
  );
}
