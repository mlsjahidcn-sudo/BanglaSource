"use client";
// /app/login/_signed-in.tsx
//
// Phase 46 (2026-06-18): Already-signed-in screen, extracted from
// _client.tsx for clarity. Renders when the user lands on /login
// while already authenticated.
//
// Three actions:
//   - Primary: send them to their portal (/admin or /buyer based on
//     is_admin). Same logic as `resolvePostLoginRedirect` in _client.tsx.
//   - Secondary: sign out (in case they're on someone else's device).
//
// Why we don't just auto-redirect:
//   - Multi-account scenario (family member / shared office device).
//   - User wants to confirm which account they're signed in as before
//     continuing (privacy).

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useLang } from "@/lib/i18n";
import { getBrowserClient } from "@/lib/supabase/browser";

export function SignedInCard({ email }: { email: string | null }) {
  const { t } = useLang();
  const router = useRouter();
  const [label, setLabel] = useState<string>("→");
  const [href, setHref] = useState<string>("/buyer");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const supabase = getBrowserClient();
        const {
          data: { user },
        } = await supabase.auth.getUser();
        if (!user || cancelled) return;
        const { data: profile } = await supabase
          .from("profiles")
          .select("is_admin")
          .eq("id", user.id)
          .maybeSingle();
        if (cancelled) return;
        if (profile?.is_admin) {
          setLabel(t("login.signin_cta_admin"));
          setHref("/admin");
        } else {
          setLabel(t("login.signin_cta_buyer"));
          setHref("/buyer");
        }
      } catch {
        /* swallow — keep default */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [t]);

  async function signOut() {
    const supabase = getBrowserClient();
    await supabase.auth.signOut();
    router.refresh();
  }

  return (
    <div className="text-center">
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
          <path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2" />
          <circle cx="12" cy="7" r="4" />
        </svg>
      </div>
      <p className="mt-5 text-[12px] text-slate-500 uppercase tracking-wider font-medium">
        {t("login.guest_title")}
      </p>
      <h1 className="mt-2 text-[20px] font-semibold tracking-tight text-slate-900 break-all">
        {email}
      </h1>
      <p className="mt-2 text-[13px] text-slate-600 max-w-xs mx-auto leading-relaxed">
        {t("login.guest_body")}
      </p>
      <div className="mt-7 grid grid-cols-1 gap-2.5">
        <Link
          href={href}
          onClick={(e) => {
            e.preventDefault();
            router.push(href);
          }}
          className="h-11 inline-flex items-center justify-center text-[13.5px] font-medium rounded-md bg-cyan-600 text-white hover:bg-cyan-700 active:bg-cyan-800 shadow-[inset_0_-1px_0_rgba(0,0,0,0.08)] transition-colors"
        >
          {label}
        </Link>
        <button
          type="button"
          onClick={signOut}
          className="h-11 inline-flex items-center justify-center text-[13px] font-medium rounded-md border border-slate-200 text-slate-700 hover:bg-slate-50 transition-colors"
        >
          {t("login.out")}
        </button>
      </div>
    </div>
  );
}