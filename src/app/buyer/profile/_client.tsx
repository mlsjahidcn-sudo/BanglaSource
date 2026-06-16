"use client";
//
// /buyer/profile/_client.tsx
//
// Phase 21 close-out (Phase 33, 2026-06-15). Converts the
// read-only profile page into an inline editor:
//   - Edit / Save / Cancel buttons
//   - 4 inputs (full_name, company, phone, country)
//   - "Change password" → modal with current + new + confirm fields
//   - Success toast + revert to view mode
//
// All calls go through the two new PATCH / POST routes.
// State machine: view → editProfile / editPassword → saving → view.

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

type ProfileShape = {
  email: string;
  full_name: string | null;
  company: string | null;
  phone: string | null;
  country: string | null;
  is_admin: boolean;
  created_at: string | null;
};

const COUNTRY_OPTIONS = [
  ["BD", "Bangladesh"],
  ["IN", "India"],
  ["PK", "Pakistan"],
  ["NP", "Nepal"],
  ["LK", "Sri Lanka"],
  ["MM", "Myanmar"],
  ["AE", "UAE"],
  ["SA", "Saudi Arabia"],
  ["GB", "United Kingdom"],
  ["US", "United States"],
] as const;

type ToastKind = "ok" | "err";
type Toast = { kind: ToastKind; msg: string } | null;

export function ProfileEditor({ initial }: { initial: ProfileShape }) {
  const router = useRouter();
  const [view, setView] = useState<"view" | "edit" | "password">("view");
  const [pending, startTransition] = useTransition();
  const [toast, setToast] = useState<Toast>(null);

  // Edit form state
  const [fullName, setFullName] = useState(initial.full_name ?? "");
  const [company, setCompany] = useState(initial.company ?? "");
  const [phone, setPhone] = useState(initial.phone ?? "");
  const [country, setCountry] = useState(initial.country ?? "BD");

  // Password form state
  const [currentPw, setCurrentPw] = useState("");
  const [newPw, setNewPw] = useState("");
  const [confirmPw, setConfirmPw] = useState("");

  function flash(kind: ToastKind, msg: string) {
    setToast({ kind, msg });
    setTimeout(() => setToast(null), 4000);
  }

  function startEdit() {
    setFullName(initial.full_name ?? "");
    setCompany(initial.company ?? "");
    setPhone(initial.phone ?? "");
    setCountry(initial.country ?? "BD");
    setView("edit");
  }

  function cancelEdit() {
    setView("view");
  }

  async function saveProfile() {
    const body = {
      full_name: fullName || null,
      company: company || null,
      phone: phone || null,
      country: country || null,
    };
    const res = await fetch("/api/buyer/profile", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const j = await res.json().catch(() => ({}));
      flash("err", `Save failed: ${j.error ?? res.statusText}`);
      return;
    }
    flash("ok", "Profile saved.");
    setView("view");
    startTransition(() => router.refresh());
  }

  async function changePassword() {
    if (newPw !== confirmPw) {
      flash("err", "New password and confirmation don't match.");
      return;
    }
    if (newPw.length < 8) {
      flash("err", "New password must be at least 8 characters.");
      return;
    }
    const res = await fetch("/api/buyer/profile/password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        current_password: currentPw,
        new_password: newPw,
      }),
    });
    if (!res.ok) {
      const j = await res.json().catch(() => ({}));
      flash(
        "err",
        j.error === "current_password_wrong"
          ? "Current password is wrong."
          : `Change failed: ${j.error ?? res.statusText}`,
      );
      return;
    }
    flash("ok", "Password changed. Sign in with the new one next time.");
    setView("view");
    setCurrentPw("");
    setNewPw("");
    setConfirmPw("");
  }

  const joinDate = initial.created_at
    ? new Date(initial.created_at).toLocaleDateString("en-GB", {
        month: "long",
        year: "numeric",
      })
    : "—";

  return (
    <div className="p-6 md:p-8 max-w-3xl">
      <div className="mb-8">
        <p className="text-[12px] font-medium tracking-wider uppercase text-fg-subtle">
          Account
        </p>
        <h1 className="mt-2 text-[32px] md:text-[40px] leading-[1.05] font-semibold tracking-[-0.02em]">
          Profile
        </h1>
        <p className="mt-3 text-[14px] text-fg-muted">
          {initial.is_admin ? "You have admin privileges." : "Buyer account"}{" "}
          · joined {joinDate}.
        </p>
      </div>

      {toast && (
        <div
          role="alert"
          className={`mb-4 rounded-md px-3 py-2 text-[13px] border ${
            toast.kind === "ok"
              ? "bg-cyan-50 border-cyan-200 text-cyan-800"
              : "bg-rose-50 border-rose-200 text-rose-800"
          }`}
        >
          {toast.msg}
        </div>
      )}

      {view === "view" && (
        <>
          <div className="card divide-y divide-border">
            <Row label="Email" value={initial.email} />
            <Row label="Full name" value={initial.full_name ?? "Not set"} />
            <Row label="Company" value={initial.company ?? "Not set"} />
            <Row label="Phone" value={initial.phone ?? "Not set"} />
            <Row label="Country" value={initial.country ?? "Not set"} />
            <Row
              label="Role"
              value={initial.is_admin ? "Admin" : "Buyer"}
              badge={initial.is_admin ? "emerald" : "slate"}
            />
          </div>
          <div className="mt-6 flex items-center gap-2">
            <button
              type="button"
              onClick={startEdit}
              className="px-4 py-2 text-[13px] rounded-md bg-cyan-600 text-white hover:bg-cyan-700 font-medium"
            >
              Edit profile
            </button>
            <button
              type="button"
              onClick={() => setView("password")}
              className="px-4 py-2 text-[13px] border border-border rounded-md text-fg-muted hover:text-fg"
            >
              Change password
            </button>
          </div>
        </>
      )}

      {view === "edit" && (
        <>
          <div className="card divide-y divide-border">
            <div className="p-4 flex items-center justify-between">
              <span className="text-[12px] text-fg-muted">Email</span>
              <span className="text-[13px] font-medium text-fg-muted">
                {initial.email}
                <span className="ml-2 text-[10px] uppercase tracking-wider text-fg-subtle">
                  managed by auth
                </span>
              </span>
            </div>
            <Field
              label="Full name"
              value={fullName}
              onChange={setFullName}
              max={80}
              placeholder="Your name as it appears on orders"
            />
            <Field
              label="Company"
              value={company}
              onChange={setCompany}
              max={120}
              placeholder="Optional — your business name"
            />
            <Field
              label="Phone"
              value={phone}
              onChange={setPhone}
              max={30}
              placeholder="+880 1XXX-XXXXXX"
            />
            <div className="p-4 flex items-center justify-between gap-3">
              <span className="text-[12px] text-fg-muted">Country</span>
              <select
                value={country}
                onChange={(e) => setCountry(e.target.value)}
                className="h-9 px-2 text-[13px] rounded-md border border-border bg-bg max-w-[200px]"
              >
                {COUNTRY_OPTIONS.map(([code, name]) => (
                  <option key={code} value={code}>
                    {name}
                  </option>
                ))}
              </select>
            </div>
            <Row
              label="Role"
              value={initial.is_admin ? "Admin" : "Buyer"}
              badge={initial.is_admin ? "emerald" : "slate"}
            />
          </div>
          <div className="mt-6 flex items-center gap-2">
            <button
              type="button"
              onClick={saveProfile}
              disabled={pending}
              className="px-4 py-2 text-[13px] rounded-md bg-cyan-600 text-white hover:bg-cyan-700 font-medium disabled:opacity-50"
            >
              {pending ? "Saving…" : "Save changes"}
            </button>
            <button
              type="button"
              onClick={cancelEdit}
              disabled={pending}
              className="px-4 py-2 text-[13px] border border-border rounded-md text-fg-muted hover:text-fg"
            >
              Cancel
            </button>
          </div>
        </>
      )}

      {view === "password" && (
        <>
          <div className="card p-5 space-y-4">
            <h2 className="text-[14px] font-semibold">Change password</h2>
            <div>
              <label className="block text-[12px] text-fg-muted mb-1">
                Current password
              </label>
              <input
                type="password"
                value={currentPw}
                onChange={(e) => setCurrentPw(e.target.value)}
                autoComplete="current-password"
                className="w-full h-9 px-3 text-[13px] rounded-md border border-border bg-bg focus:border-border-strong outline-none"
              />
            </div>
            <div>
              <label className="block text-[12px] text-fg-muted mb-1">
                New password (min 8 chars)
              </label>
              <input
                type="password"
                value={newPw}
                onChange={(e) => setNewPw(e.target.value)}
                autoComplete="new-password"
                className="w-full h-9 px-3 text-[13px] rounded-md border border-border bg-bg focus:border-border-strong outline-none"
              />
            </div>
            <div>
              <label className="block text-[12px] text-fg-muted mb-1">
                Confirm new password
              </label>
              <input
                type="password"
                value={confirmPw}
                onChange={(e) => setConfirmPw(e.target.value)}
                autoComplete="new-password"
                className="w-full h-9 px-3 text-[13px] rounded-md border border-border bg-bg focus:border-border-strong outline-none"
              />
            </div>
          </div>
          <div className="mt-6 flex items-center gap-2">
            <button
              type="button"
              onClick={changePassword}
              disabled={pending}
              className="px-4 py-2 text-[13px] rounded-md bg-cyan-600 text-white hover:bg-cyan-700 font-medium disabled:opacity-50"
            >
              {pending ? "Saving…" : "Change password"}
            </button>
            <button
              type="button"
              onClick={() => {
                setView("view");
                setCurrentPw("");
                setNewPw("");
                setConfirmPw("");
              }}
              disabled={pending}
              className="px-4 py-2 text-[13px] border border-border rounded-md text-fg-muted hover:text-fg"
            >
              Cancel
            </button>
          </div>
        </>
      )}
    </div>
  );
}

function Row({
  label,
  value,
  badge,
}: {
  label: string;
  value: string;
  badge?: "emerald" | "slate";
}) {
  return (
    <div className="flex items-center justify-between p-4">
      <span className="text-[12px] text-fg-muted">{label}</span>
      <span className="text-[13px] font-medium text-fg flex items-center gap-2">
        {value}
        {badge && (
          <span
            className={`text-[10px] font-medium tracking-wider uppercase px-1.5 py-0.5 border rounded ${
              badge === "emerald"
                ? "border-cyan-200 bg-cyan-50 text-cyan-800"
                : "border-border bg-bg-soft text-fg-muted"
            }`}
          >
            {value.toLowerCase()}
          </span>
        )}
      </span>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  max,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  max: number;
  placeholder?: string;
}) {
  return (
    <div className="p-4 flex items-center justify-between gap-3">
      <span className="text-[12px] text-fg-muted shrink-0">{label}</span>
      <div className="flex-1 max-w-[320px]">
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          maxLength={max}
          placeholder={placeholder}
          className="w-full h-9 px-3 text-[13px] rounded-md border border-border bg-bg focus:border-border-strong outline-none"
        />
        <p className="mt-1 text-[10.5px] text-fg-subtle font-mono tnum text-right">
          {value.length}/{max}
        </p>
      </div>
    </div>
  );
}
