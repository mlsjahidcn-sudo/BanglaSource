"use client";
// /app/login/_forgot.tsx
//
// Phase 46 (2026-06-18): Inline forgot-password flow. When the user
// clicks "Forgot password?" on the sign-in tab, this replaces the
// main form with a single-email "send reset link" view.
//
// Why inline (not a modal / separate route):
//   - One fewer route to maintain. The Supabase recovery flow lands
//     users at /login?type=recovery, which the main client already
//     handles.
//   - No JS-modal layering / focus trap complexity.
//   - The form is intentionally simple — email-only — so a modal-
//     style overlay would be overkill.

import { useState } from "react";
import { useLang } from "@/lib/i18n";
import { getBrowserClient } from "@/lib/supabase/browser";

export function ForgotPasswordForm({ onBack }: { onBack: () => void }) {
  const { t } = useLang();
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  const emailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!emailValid) return;
    setError(null);
    setLoading(true);
    try {
      const supabase = getBrowserClient();
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/login?type=recovery`,
      });
      if (error) throw error;
      // Always show the "sent" state even if the account doesn't exist,
      // to avoid leaking which emails are registered. The user sees
      // the same message regardless.
      setSent(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  if (sent) {
    return (
      <div>
        <div
          aria-hidden
          className="grid place-items-center w-12 h-12 rounded-full bg-cyan-50 mx-auto"
        >
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="w-6 h-6 text-cyan-700"
          >
            <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
            <polyline points="22,6 12,13 2,6" />
          </svg>
        </div>
        <h2 className="mt-4 text-[18px] font-semibold tracking-tight text-center text-slate-900">
          {t("login.check_email_heading")}
        </h2>
        <p className="mt-2 text-[13.5px] text-slate-600 text-center leading-relaxed">
          {t("login.forgot_sent", { email })}
        </p>
        <p className="mt-3 text-[12px] text-slate-500 text-center">
          {t("login.check_email_help")}
        </p>
        <button
          type="button"
          onClick={onBack}
          className="mt-6 w-full h-11 text-[13px] font-medium text-cyan-700 hover:text-cyan-800 hover:underline underline-offset-2"
        >
          {t("login.forgot_back")}
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="space-y-5">
      <div>
        <button
          type="button"
          onClick={onBack}
          className="text-[12px] text-cyan-700 hover:text-cyan-800 hover:underline underline-offset-2"
        >
          {t("login.forgot_back")}
        </button>
      </div>
      <div>
        <h2 className="text-[22px] font-semibold tracking-tight text-slate-900">
          {t("login.forgot_heading")}
        </h2>
        <p className="mt-1.5 text-[13.5px] text-slate-600">
          {t("login.forgot_body")}
        </p>
      </div>
      <div>
        <label
          htmlFor="forgot-email"
          className="block text-[12px] text-slate-500 uppercase tracking-wider font-medium"
        >
          {t("login.email")}
        </label>
        <input
          id="forgot-email"
          type="email"
          value={email}
          onChange={(e) => {
            setEmail(e.target.value);
            setError(null);
          }}
          placeholder={t("login.email_ph")}
          autoComplete="email"
          required
          className="mt-2 w-full h-11 px-3 border border-slate-200 rounded-md text-[14px] focus:border-cyan-600 focus:ring-2 focus:ring-cyan-100 focus:outline-none transition-colors"
        />
      </div>
      {error && (
        <p
          role="alert"
          className="text-[12.5px] text-red-700 bg-red-50 border border-red-200 rounded-md px-3 py-2 flex items-start gap-2"
        >
          <span aria-hidden>⚠</span>
          <span>{error}</span>
        </p>
      )}
      <button
        type="submit"
        disabled={loading || !emailValid}
        className="w-full h-11 bg-cyan-600 text-white text-[14px] font-medium rounded-md hover:bg-cyan-700 active:bg-cyan-800 disabled:opacity-50 disabled:cursor-not-allowed shadow-[inset_0_-1px_0_rgba(0,0,0,0.08)] transition-colors flex items-center justify-center gap-2"
      >
        {loading && <Spinner />}
        {loading ? t("login.sending") : t("login.forgot_cta")}
      </button>
    </form>
  );
}

function Spinner() {
  return (
    <svg
      aria-hidden
      className="animate-spin w-4 heading-4"
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
  );
}