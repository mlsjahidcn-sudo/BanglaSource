"use client";
// /admin/settings/_client.tsx
//
// Phase 48 (2026-06-18): admin-editable runtime settings.
//
// Currently exposes just the FX rate. The form reads the current
// value from a server prop, displays it with last-updated metadata,
// and POSTs the new value to /api/admin/settings/fx_cny_bdt.
//
// UX:
//   - Inline error on validation failure (e.g. "out of range 1-50")
//   - Success state shows the new value + resets the form
//   - Last-updated timestamp + admin id displayed below input
//   - Disabled while submitting
//   - Keyboard: Enter submits, Esc resets
//
// Audit: every successful write stores updated_by = current admin id.
// The UI shows the first 8 chars of the UUID (auth.users.id). Adding
// a /api/admin/users/[id] route would let us render the email
// instead — out of scope for Phase 48.

import { useState, useTransition } from "react";
import { useLang } from "@/lib/i18n";

type SettingRow = {
  key: string;
  value: unknown;
  updatedAt: string;
  updatedBy: string | null;
};

function fmtRelative(iso: string): string {
  const t = new Date(iso).getTime();
  const now = Date.now();
  const sec = Math.round((now - t) / 1000);
  if (sec < 60) return `${sec}s ago`;
  if (sec < 3600) return `${Math.round(sec / 60)}m ago`;
  if (sec < 86400) return `${Math.round(sec / 3600)}h ago`;
  return `${Math.round(sec / 86400)}d ago`;
}

export function SettingsClient({
  initialSettings,
}: {
  initialSettings: Record<string, SettingRow>;
}) {
  const { t } = useLang();
  const [fxValue, setFxValue] = useState<string>(
    String(initialSettings.fx_cny_bdt?.value ?? ""),
  );
  const [fxUpdatedAt, setFxUpdatedAt] = useState<string | null>(
    initialSettings.fx_cny_bdt?.updatedAt ?? null,
  );
  const [fxUpdatedBy, setFxUpdatedBy] = useState<string | null>(
    initialSettings.fx_cny_bdt?.updatedBy ?? null,
  );
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  async function saveFx(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    startTransition(async () => {
      const res = await fetch("/api/admin/settings/fx_cny_bdt", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ value: fxValue }),
      });
      const json = (await res.json().catch(() => null)) as
        | { ok: true; row: SettingRow }
        | { ok: false; error: string }
        | null;
      if (!res.ok || !json || !("ok" in json) || !json.ok) {
        const msg =
          json && "error" in json
            ? json.error
            : `HTTP ${res.status}`;
        setError(msg.replace(/^validation:\s*/i, ""));
        return;
      }
      setFxUpdatedAt(json.row.updatedAt);
      setFxUpdatedBy(json.row.updatedBy);
      setFxValue(String(json.row.value));
      setSuccess(
        `Saved. New rate: 1 CNY = ${json.row.value} BDT. Takes effect on the next page load.`,
      );
    });
  }

  const parsedFx = parseFloat(fxValue);
  const fxValid = Number.isFinite(parsedFx) && parsedFx >= 1 && parsedFx <= 50;
  const fxDirty = fxValue !== String(initialSettings.fx_cny_bdt?.value ?? "");

  return (
    <div className="space-y-8 max-w-2xl">
      {/* FX rate card */}
      <form
        onSubmit={saveFx}
        className="bg-bg border border-border rounded-lg p-6"
      >
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <h2 className="text-[15px] font-semibold tracking-tight text-fg">
              CNY → BDT exchange rate
            </h2>
            <p className="mt-1 text-[13px] text-fg-muted">
              Used to convert factory FOB prices (quoted in CNY) into BDT for
              display and the all-in landed cost.
            </p>
          </div>
          <span className="text-[11px] uppercase tracking-wider font-medium text-fg-subtle bg-bg-muted border border-border rounded px-2 py-1 shrink-0">
            runtime
          </span>
        </div>

        <div className="mt-5 grid gap-2">
          <label
            htmlFor="fx-cny-bdt"
            className="text-[12px] text-fg-subtle uppercase tracking-wider font-medium"
          >
            Rate (BDT per 1 CNY)
          </label>
          <div className="flex items-center gap-3">
            <input
              id="fx-cny-bdt"
              type="number"
              inputMode="decimal"
              step="0.01"
              min={1}
              max={50}
              value={fxValue}
              onChange={(e) => {
                setFxValue(e.target.value);
                setError(null);
                setSuccess(null);
              }}
              onKeyDown={(e) => {
                if (e.key === "Escape") {
                  setFxValue(String(initialSettings.fx_cny_bdt?.value ?? ""));
                  setError(null);
                }
              }}
              aria-invalid={!fxValid && fxValue.length > 0}
              aria-describedby={!fxValid && fxValue.length > 0 ? "fx-err" : undefined}
              required
              className="w-40 h-10 px-3 border border-border rounded-md text-[14px] tabular-nums font-medium focus:border-cyan-600 focus:ring-2 focus:ring-cyan-100 focus:outline-none"
            />
            <span className="text-[13px] text-fg-muted">BDT per 1 CNY</span>
          </div>
          {!fxValid && fxValue.length > 0 && (
            <p
              id="fx-err"
              className="text-[12px] text-red-600"
            >
              Must be between 1 and 50
            </p>
          )}
        </div>

        {/* Audit row */}
        {fxUpdatedAt && (
          <div className="mt-4 flex items-center gap-3 text-[11.5px] text-fg-subtle">
            <span>
              Updated {fmtRelative(fxUpdatedAt)}
            </span>
            {fxUpdatedBy && (
              <>
                <span aria-hidden>·</span>
                <span className="font-mono">
                  by admin {fxUpdatedBy.slice(0, 8)}
                </span>
              </>
            )}
          </div>
        )}

        {/* Error / success */}
        {error && (
          <div
            role="alert"
            className="mt-4 text-[12.5px] text-red-700 bg-red-50 border border-red-200 rounded-md px-3 py-2 flex items-start gap-2"
          >
            <span aria-hidden>⚠</span>
            <span>{error}</span>
          </div>
        )}
        {success && (
          <div
            role="status"
            className="mt-4 text-[12.5px] text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-md px-3 py-2 flex items-start gap-2"
          >
            <span aria-hidden>✓</span>
            <span>{success}</span>
          </div>
        )}

        {/* Buttons */}
        <div className="mt-5 flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={() => {
              setFxValue(String(initialSettings.fx_cny_bdt?.value ?? ""));
              setError(null);
              setSuccess(null);
            }}
            disabled={pending || !fxDirty}
            className="h-9 px-3 text-[12.5px] font-medium rounded-md border border-border hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Reset
          </button>
          <button
            type="submit"
            disabled={pending || !fxDirty || !fxValid}
            className="h-9 px-4 text-[12.5px] font-medium rounded-md bg-cyan-600 text-white hover:bg-cyan-700 active:bg-cyan-800 disabled:opacity-50 disabled:cursor-not-allowed shadow-[inset_0_-1px_0_rgba(0,0,0,0.08)] flex items-center gap-2"
          >
            {pending && (
              <svg
                aria-hidden
                className="animate-spin w-3.5 h-3.5"
                viewBox="0 0 24 24"
                fill="none"
              >
                <circle
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeOpacity="0.25"
                  strokeWidth="4"
                />
                <path
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.4 0 0 5.4 0 12h4z"
                />
              </svg>
            )}
            Save FX rate
          </button>
        </div>
      </form>

      {/* Hint card for adding new settings */}
      <div className="bg-bg-soft border border-border rounded-lg p-5 text-[12.5px] text-fg-muted leading-relaxed">
        <p className="font-medium text-fg mb-1.5">
          Adding a new setting
        </p>
        <ol className="list-decimal list-inside space-y-1">
          <li>INSERT a new row in <code className="text-fg">public.settings</code> (or update the seed migration)</li>
          <li>Add validation in <code className="text-fg">src/lib/settings.ts → setSetting()</code></li>
          <li>Add a form field above in this component</li>
        </ol>
      </div>
    </div>
  );
}