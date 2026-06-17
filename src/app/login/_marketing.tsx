"use client";
// /app/login/_marketing.tsx
//
// Phase 46 (2026-06-18): Left-side brand panel of the split-pane login
// layout. Hidden on mobile (`hidden md:flex`); the form is the only
// thing a mobile user sees plus a compact brand header.
//
// Shows:
//   - Wordmark (logo + BanglaSource)
//   - Headline
//   - 3 value bullets (factory pricing, all-in BDT, photo QC)
//   - Trust badge footer (Supabase auth)
//
// Why this matters:
//   - Reduces perceived risk of handing over an email/password
//     (matches Stripe / Linear / Notion pattern).
//   - Reuses the existing home.value1-4 copy from i18n-dict where
//     possible; only the headline + bullets are auth-specific.
//   - Cyan-50 background reinforces the cyan-600 brand color without
//     competing with the white form card on the right.

import { useLang } from "@/lib/i18n";

function Logo() {
  return (
    <div className="flex items-center gap-2.5">
      <span
        aria-hidden
        className="grid place-items-center w-9 h-9 rounded-md bg-cyan-600 text-white shadow-[inset_0_-1px_0_rgba(0,0,0,0.08)]"
      >
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="w-4.5 h-4.5"
          aria-hidden
        >
          <path d="M3 9l9-6 9 6v11a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
          <path d="M9 22V12h6v10" />
        </svg>
      </span>
      <span className="text-[17px] font-semibold tracking-tight text-cyan-800">
        BanglaSource
      </span>
    </div>
  );
}

function CheckIcon() {
  return (
    <span
      aria-hidden
      className="grid place-items-center w-5 h-5 rounded-full bg-cyan-600 text-white shrink-0 mt-0.5"
    >
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="3"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="w-3 h-3"
      >
        <polyline points="20 6 9 17 4 12" />
      </svg>
    </span>
  );
}

export function AuthMarketingPane() {
  const { t } = useLang();
  const bullets = [t("login.bullet1"), t("login.bullet2"), t("login.bullet3")];

  return (
    <div className="hidden md:flex md:w-1/2 lg:w-[55%] xl:w-[60%] bg-cyan-50 relative overflow-hidden">
      {/* Subtle decorative gradient overlay — a wide cyan stripe on
          the bottom-right that fades into the bg. Adds depth without
          competing with the headline copy. */}
      <div
        aria-hidden
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            "radial-gradient(circle at 90% 100%, rgba(8, 145, 178, 0.08) 0%, rgba(8, 145, 178, 0) 50%)",
        }}
      />
      <div
        aria-hidden
        className="absolute -bottom-24 -right-24 w-96 h-96 rounded-full opacity-30"
        style={{
          background:
            "radial-gradient(circle, var(--cyan-200) 0%, var(--cyan-100) 60%, transparent 100%)",
        }}
      />

      <div className="relative z-10 flex flex-col justify-center w-full p-10 lg:p-14">
        <Logo />

        <div className="mt-12 max-w-md">
          <h1 className="text-[32px] lg:text-[40px] font-semibold tracking-tight text-slate-900 leading-[1.1]">
            {t("login.headline")}
          </h1>
          <p className="mt-4 text-[15px] text-slate-600 leading-relaxed">
            {t("login.subhead")}
          </p>

          <ul className="mt-8 space-y-3.5">
            {bullets.map((b, i) => (
              <li
                key={i}
                className="flex items-start gap-3 text-[14px] text-slate-700 leading-snug"
              >
                <CheckIcon />
                <span>{b}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}

/**
 * Compact brand header shown ABOVE the form on mobile (where the
 * full marketing pane is hidden). Keeps the brand present on
 * small screens without consuming valuable form-space.
 */
export function AuthMobileHeader() {
  return (
    <div className="md:hidden flex items-center justify-center pb-2">
      <Logo />
    </div>
  );
}