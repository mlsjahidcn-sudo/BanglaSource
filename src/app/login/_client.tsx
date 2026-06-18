"use client";
// /app/login/_client.tsx
//
// Phase 46 (2026-06-18): split-pane login + signup UX.
//
// Layout (md+):
//   ┌────────────────────────────────┬──────────────────────┐
//   │ _marketing.tsx                 │  Form card           │
//   │  - Logo                        │   - Tabs (in|up)     │
//   │  - Headline                    │   - Lede             │
//   │  - 3 bullets                   │   - Email            │
//   │  - Trust footer                │   - Password (eye)   │
//   └────────────────────────────────┴──────────────────────┘
//
// Layout (mobile):
//   - Marketing pane hidden
//   - Compact brand header above form
//
// State machine:
//   ┌─ unknown (loading session) → signed-out → submit → success
//   │                                ↓                    ↓
//   │                              forgot            check-email
//   │                                ↓
//   │                              submit → sent
//   └─ signed-in (already authed) → signed-in card
//
// URL params honored:
//   ?redirect=<path>  — where to send user after signin (Phase 41)
//   ?mode=signup      — pre-select the signup tab (deep links)
//   ?type=recovery    — Supabase password reset landing (shows
//                       recovery banner; we don't auto-update UI yet
//                       because the user usually has to enter a
//                       new password on the same page after click)

import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { useLang } from "@/lib/i18n";
import { getBrowserClient } from "@/lib/supabase/browser";
import { Container } from "@/components/ui/container";
import { AuthMarketingPane, AuthMobileHeader } from "./_marketing";
import { ForgotPasswordForm } from "./_forgot";
import { SignedInCard } from "./_signed-in";

type Mode = "signin" | "signup";
type View = "form" | "forgot" | "check-email";

/**
 * Decide where to send a freshly-authenticated user. Rules:
 *   1. If a `?redirect=` param was passed AND it points to a
 *      non-portal route, respect it.
 *   2. If the param points at /admin/* and the user isn't an
 *      admin, fall through to the role-based default.
 *   3. Otherwise: admins → /admin, buyers → /buyer.
 */
async function resolvePostLoginRedirect(fallback: string): Promise<string> {
  const isAdminPath = fallback.startsWith("/admin");
  if (fallback && fallback !== "/account" && !isAdminPath) {
    return fallback;
  }
  try {
    const supabase = getBrowserClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return "/buyer";
    const { data: profile } = await supabase
      .from("profiles")
      .select("is_admin")
      .eq("id", user.id)
      .maybeSingle();
    return profile?.is_admin ? "/admin" : "/buyer";
  } catch {
    return "/buyer";
  }
}

/**
 * Password strength score (0-4). Higher = better.
 *   - length ≥ 8            +1
 *   - has lower + upper      +1
 *   - has digit              +1
 *   - has symbol (!@#$%^&*) +1
 *
 * Score labels:
 *   0-1 = weak
 *   2-3 = ok
 *   4   = strong
 */
function scorePassword(pw: string): {
  score: number;
  label: "weak" | "ok" | "strong";
  checks: { length: boolean; mix: boolean; symbol: boolean };
} {
  const length = pw.length >= 8;
  const mix = /[a-z]/.test(pw) && /[A-Z]/.test(pw);
  const digit = /\d/.test(pw);
  const symbol = /[!@#$%^&*(),.?":{}|<>_\-+=[\]\\/'`~]/.test(pw);
  // We accept length OR digit alone as "mix" for the visual hint — many
  // users don't add mixed case to their passwords.
  const checks = {
    length,
    mix: (mix && digit) || (mix && symbol) || (digit && symbol),
    symbol: symbol || mix,
  };
  const score = [length, digit || mix, mix, symbol].filter(Boolean).length;
  // Re-score using checks (length + checks.mix + checks.symbol = 0..3)
  const finalScore =
    [checks.length, checks.mix, checks.symbol].filter(Boolean).length;
  const label: "weak" | "ok" | "strong" =
    finalScore <= 1 ? "weak" : finalScore === 2 ? "ok" : "strong";
  return { score: finalScore, label, checks };
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

function EnvelopeIcon({ className = "w-6 h-6" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden
    >
      <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
      <polyline points="22,6 12,13 2,6" />
    </svg>
  );
}

export function LoginClient() {
  const { t, lang } = useLang();
  const router = useRouter();
  const search = useSearchParams();
  const redirectTo = search.get("redirect") ?? "/account";
  const initialMode: Mode = search.get("mode") === "signup" ? "signup" : "signin";

  // ── State ──────────────────────────────────────────────────────
  const [mode, setMode] = useState<Mode>(initialMode);
  const [view, setView] = useState<View>("form");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [signedIn, setSignedIn] = useState<boolean | null>(null);
  const [signedInEmail, setSignedInEmail] = useState<string | null>(null);
  const [signupEmail, setSignupEmail] = useState<string>(""); // captured for check-email view

  // ── Derived ────────────────────────────────────────────────────
  const emailValid = useMemo(
    () => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email),
    [email],
  );
  const passwordScore = useMemo(() => scorePassword(password), [password]);
  const passwordValid = password.length >= 6;
  const canSubmit = emailValid && passwordValid && !loading;

  // ── Effects ────────────────────────────────────────────────────
  // Check existing session on mount
  useEffect(() => {
    const supabase = getBrowserClient();
    supabase.auth.getSession().then(({ data }) => {
      if (data.session?.user) {
        setSignedIn(true);
        setSignedInEmail(data.session.user.email ?? null);
      } else {
        setSignedIn(false);
      }
    });
  }, []);

  // ── Handlers ───────────────────────────────────────────────────
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit) return;
    setError(null);
    setLoading(true);
    const supabase = getBrowserClient();
    try {
      if (mode === "signup") {
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: `${window.location.origin}/login`,
          },
        });
        if (error) throw error;
        if (data.session) {
          router.push(await resolvePostLoginRedirect(redirectTo));
          return;
        }
        // Email confirmation required — show the "check email" view
        setSignupEmail(email);
        setView("check-email");
      } else {
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        if (error) throw error;
        router.push(await resolvePostLoginRedirect(redirectTo));
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  function switchMode(next: Mode) {
    if (next === mode) return;
    setMode(next);
    setError(null);
    // Update URL so deep-link shares work, but don't push to history
    const url = new URL(window.location.href);
    if (next === "signup") url.searchParams.set("mode", "signup");
    else url.searchParams.delete("mode");
    window.history.replaceState({}, "", url.toString());
  }

  // ── Render: signed-in screen ───────────────────────────────────
  if (signedIn) {
    return (
      <Container className="py-10 md:py-16 max-w-md">
        <div className="bg-white rounded-lg border border-slate-200 shadow-sm p-8">
          <SignedInCard email={signedInEmail} />
        </div>
      </Container>
    );
  }

  // ── Render: forgot-password screen ─────────────────────────────
  if (view === "forgot") {
    return (
      <div className="min-h-screen flex">
        <AuthMarketingPane />
        <div className="flex-1 flex items-center justify-center bg-white p-6 md:p-10">
          <div className="w-full max-w-sm">
            <AuthMobileHeader />
            <div className="bg-white rounded-lg border border-slate-200 shadow-sm p-8">
              <ForgotPasswordForm onBack={() => setView("form")} />
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ── Render: check-email screen ─────────────────────────────────
  if (view === "check-email") {
    return (
      <div className="min-h-screen flex">
        <AuthMarketingPane />
        <div className="flex-1 flex items-center justify-center bg-white p-6 md:p-10">
          <div className="w-full max-w-sm">
            <AuthMobileHeader />
            <div className="bg-white rounded-lg border border-slate-200 shadow-sm p-8 text-center">
              <div
                aria-hidden
                className="grid place-items-center w-12 h-12 rounded-full bg-cyan-50 mx-auto"
              >
                <EnvelopeIcon className="w-6 h-6 text-cyan-700" />
              </div>
              <h2 className="mt-5 text-[20px] font-semibold tracking-tight text-slate-900">
                {t("login.check_email_heading")}
              </h2>
              <p className="mt-2 text-[13.5px] text-slate-600 leading-relaxed">
                {t("login.check_email_body", { email: signupEmail })}
              </p>
              <p className="mt-3 text-[12px] text-slate-500 leading-relaxed">
                {t("login.check_email_help")}
              </p>
              <button
                type="button"
                onClick={() => {
                  setView("form");
                  setMode("signin");
                  setPassword("");
                  setError(null);
                }}
                className="mt-6 w-full h-11 text-[13px] font-medium text-cyan-700 hover:text-cyan-800 hover:underline underline-offset-2"
              >
                {t("login.forgot_back")}
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ── Render: main form (signin / signup tabs) ───────────────────
  return (
    <div className="min-h-screen flex">
      <AuthMarketingPane />
      <div className="flex-1 flex items-center justify-center bg-white p-6 md:p-10">
        <div className="w-full max-w-sm">
          <AuthMobileHeader />

          <div className="bg-white rounded-lg border border-slate-200 shadow-sm p-8">
            {/* Tabs */}
            <div
              role="tablist"
              aria-label={t("login.title")}
              className="grid grid-cols-2 gap-1 p-1 bg-slate-100 rounded-md"
            >
              <button
                type="button"
                role="tab"
                aria-selected={mode === "signin"}
                onClick={() => switchMode("signin")}
                className={
                  "h-9 text-[13px] font-medium rounded transition-all duration-150 " +
                  (mode === "signin"
                    ? "bg-white text-slate-900 shadow-sm"
                    : "text-slate-600 hover:text-slate-900")
                }
              >
                {t("login.signin_tab")}
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={mode === "signup"}
                onClick={() => switchMode("signup")}
                className={
                  "h-9 text-[13px] font-medium rounded transition-all duration-150 " +
                  (mode === "signup"
                    ? "bg-white text-slate-900 shadow-sm"
                    : "text-slate-600 hover:text-slate-900")
                }
              >
                {t("login.signup_tab")}
              </button>
            </div>

            {/* Heading */}
            <div className="mt-6">
              <h1 className="text-[22px] font-semibold tracking-tight text-slate-900">
                {mode === "signin" ? t("login.signin_tab") : t("login.signup_tab")}
              </h1>
              <p className="mt-1.5 text-[13.5px] text-slate-600">
                {mode === "signin" ? t("login.signin_lede") : t("login.signup_lede")}
              </p>
            </div>

            {/* Form */}
            <form onSubmit={submit} className="mt-6 space-y-4" noValidate>
              {/* Email */}
              <div>
                <label
                  htmlFor="email"
                  className="block text-[12px] text-slate-500 uppercase tracking-wider font-medium"
                >
                  {t("login.email")}
                </label>
                <div className="mt-2 relative">
                  <input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(e) => {
                      setEmail(e.target.value);
                      if (error) setError(null);
                    }}
                    placeholder={t("login.email_ph")}
                    autoComplete="email"
                    required
                    aria-invalid={
                      email.length > 0 && !emailValid ? "true" : undefined
                    }
                    aria-describedby={email.length > 0 && !emailValid ? "email-err" : undefined}
                    className={
                      "w-full h-11 px-3 border rounded-md text-[14px] focus:ring-2 focus:ring-cyan-100 focus:outline-none transition-colors " +
                      (email.length > 0 && !emailValid
                        ? "border-red-300 focus:border-red-500 pr-10"
                        : emailValid
                          ? "border-emerald-500 focus:border-cyan-600 pr-10"
                          : "border-slate-200 focus:border-cyan-600")
                    }
                  />
                  {emailValid && (
                    <span
                      aria-hidden
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-emerald-600"
                    >
                      <svg
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2.5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        className="w-4 heading-4"
                      >
                        <polyline points="20 6 9 17 4 12" />
                      </svg>
                    </span>
                  )}
                </div>
                {email.length > 0 && !emailValid && (
                  <p
                    id="email-err"
                    className="mt-1.5 text-[11.5px] text-red-600"
                  >
                    {lang === "bn"
                      ? "একটি বৈধ ইমেইল ঠিকানা লিখুন"
                      : "Enter a valid email address"}
                  </p>
                )}
              </div>

              {/* Password */}
              <div>
                <div className="flex items-baseline justify-between">
                  <label
                    htmlFor="password"
                    className="block text-[12px] text-slate-500 uppercase tracking-wider font-medium"
                  >
                    {t("login.password_label")}
                  </label>
                  {mode === "signin" && (
                    <button
                      type="button"
                      onClick={() => setView("forgot")}
                      className="text-[11.5px] text-cyan-700 hover:text-cyan-800 hover:underline underline-offset-2"
                    >
                      {t("login.forgot_link")}
                    </button>
                  )}
                </div>
                <div className="mt-2 relative">
                  <input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(e) => {
                      setPassword(e.target.value);
                      if (error) setError(null);
                    }}
                    placeholder={t("login.password_ph")}
                    autoComplete={
                      mode === "signin" ? "current-password" : "new-password"
                    }
                    required
                    minLength={6}
                    aria-invalid={
                      password.length > 0 && !passwordValid
                        ? "true"
                        : undefined
                    }
                    className={
                      "w-full h-11 px-3 pr-12 border rounded-md text-[14px] focus:ring-2 focus:ring-cyan-100 focus:outline-none transition-colors " +
                      (password.length > 0 && !passwordValid
                        ? "border-red-300 focus:border-red-500"
                        : "border-slate-200 focus:border-cyan-600")
                    }
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    aria-label={showPassword ? t("login.hide_password") : t("login.show_password")}
                    aria-pressed={showPassword}
                    className="absolute right-2 top-1/2 -translate-y-1/2 px-2 h-7 text-[11px] font-medium text-slate-500 hover:text-slate-700 rounded transition-colors"
                  >
                    {showPassword ? t("login.hide_password") : t("login.show_password")}
                  </button>
                </div>

                {/* Password strength meter — signup only */}
                {mode === "signup" && password.length > 0 && (
                  <div className="mt-2.5">
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="text-slate-500">
                        {t("login.password_strength_label")}
                      </span>
                      <span
                        className={
                          "font-medium " +
                          (passwordScore.label === "weak"
                            ? "text-red-600"
                            : passwordScore.label === "ok"
                              ? "text-amber-600"
                              : "text-emerald-600")
                        }
                      >
                        {passwordScore.label === "weak"
                          ? t("login.password_strength_weak")
                          : passwordScore.label === "ok"
                            ? t("login.password_strength_ok")
                            : t("login.password_strength_strong")}
                      </span>
                    </div>
                    <div
                      className="mt-1.5 heading-1 bg-slate-100 rounded-full overflow-hidden"
                      role="progressbar"
                      aria-valuenow={passwordScore.score}
                      aria-valuemin={0}
                      aria-valuemax={3}
                    >
                      <div
                        className={
                          "h-full transition-all duration-300 " +
                          (passwordScore.label === "weak"
                            ? "w-1/3 bg-red-500"
                            : passwordScore.label === "ok"
                              ? "w-2/3 bg-amber-500"
                              : "w-full bg-emerald-500")
                        }
                      />
                    </div>
                    <ul className="mt-2 grid grid-cols-1 gap-0.5 text-[11px]">
                      <li
                        className={
                          passwordScore.checks.length
                            ? "text-emerald-700"
                            : "text-slate-500"
                        }
                      >
                        <span aria-hidden className="mr-1">
                          {passwordScore.checks.length ? "✓" : "·"}
                        </span>
                        {t("login.password_tip_length")}
                      </li>
                      <li
                        className={
                          passwordScore.checks.mix
                            ? "text-emerald-700"
                            : "text-slate-500"
                        }
                      >
                        <span aria-hidden className="mr-1">
                          {passwordScore.checks.mix ? "✓" : "·"}
                        </span>
                        {t("login.password_tip_mix")}
                      </li>
                      <li
                        className={
                          passwordScore.checks.symbol
                            ? "text-emerald-700"
                            : "text-slate-500"
                        }
                      >
                        <span aria-hidden className="mr-1">
                          {passwordScore.checks.symbol ? "✓" : "·"}
                        </span>
                        {t("login.password_tip_symbol")}
                      </li>
                    </ul>
                  </div>
                )}
              </div>

              {/* Error */}
              {error && (
                <div
                  role="alert"
                  className="text-[12.5px] text-red-700 bg-red-50 border border-red-200 rounded-md px-3 py-2 flex items-start gap-2"
                >
                  <span aria-hidden>⚠</span>
                  <span>{error}</span>
                </div>
              )}

              {/* Submit */}
              <button
                type="submit"
                disabled={!canSubmit}
                className="w-full h-11 bg-cyan-600 text-white text-[14px] font-medium rounded-md hover:bg-cyan-700 active:bg-cyan-800 disabled:opacity-50 disabled:cursor-not-allowed shadow-[inset_0_-1px_0_rgba(0,0,0,0.08)] transition-colors flex items-center justify-center gap-2"
              >
                {loading && <Spinner />}
                {loading
                  ? mode === "signin"
                    ? t("login.signing_in")
                    : t("login.creating_account")
                  : mode === "signin"
                    ? t("login.signin_cta")
                    : t("login.signup_cta")}
              </button>
            </form>

            {/* Footer */}
            <div className="mt-5 pt-5 border-t border-slate-200 flex items-center justify-between text-[12.5px]">
              <button
                type="button"
                onClick={() => switchMode(mode === "signin" ? "signup" : "signin")}
                className="text-slate-600 hover:text-slate-900 transition-colors"
              >
                {mode === "signin" ? t("login.need_account") : t("login.have_account")}
              </button>
              <Link
                href="/"
                className="text-slate-500 hover:text-slate-700 transition-colors"
              >
                {t("login.skip")}
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}