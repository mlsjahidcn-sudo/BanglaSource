"use client";
import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { Container } from "@/components/ui/container";
import { Button } from "@/components/ui/button";
import { useLang } from "@/lib/i18n";
import { getBrowserClient } from "@/lib/supabase/browser";

/**
 * Decide where to send a freshly-authenticated user. Rules:
 *   1. If a `?redirect=` param was passed AND it points to a
 *      non-portal route, respect it (preserves the existing
 *      "you tried to view /buyer/orders → sent back to login
 *      → after login, return to /buyer/orders" flow).
 *   2. If the param points at /admin/* and the user isn't an
 *      admin, fall through to the role-based default.
 *   3. Otherwise: admins → /admin, buyers → /buyer.
 *
 * Reads `is_admin` from the profiles table via the anon client
 * (RLS allows users to read their own profile row).
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
 * The "Go to account →" button on the already-signed-in screen.
 * Looks up `is_admin` and routes the user to the right portal.
 * Same logic as `resolvePostLoginRedirect` but rendered as JSX
 * after the session is established.
 */
function SignedInRedirectButton({ email }: { email: string | null }) {
  const router = useRouter();
  const [label, setLabel] = useState("Go to account →");
  const [href, setHref] = useState("/account");
  useEffect(() => {
    let cancelled = false;
    (async () => {
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
        setLabel("Open admin →");
        setHref("/admin");
      } else {
        setLabel("Open buyer dashboard →");
        setHref("/buyer");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);
  return (
    <Link
      href={href}
      onClick={(e) => {
        e.preventDefault();
        router.push(href);
      }}
      className="h-10 inline-flex items-center justify-center text-[13px] font-medium rounded-md bg-cyan-600 text-white hover:bg-cyan-700"
    >
      {label}
    </Link>
  );
}

export function LoginClient() {
  const { t } = useLang();
  const router = useRouter();
  const search = useSearchParams();
  const redirectTo = search.get("redirect") ?? "/account";
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [signedIn, setSignedIn] = useState(false);
  const [signedInEmail, setSignedInEmail] = useState<string | null>(null);

  useEffect(() => {
    const supabase = getBrowserClient();
    supabase.auth.getSession().then(({ data }) => {
      if (data.session?.user) {
        setSignedIn(true);
        setSignedInEmail(data.session.user.email ?? null);
      }
    });
  }, []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setInfo(null);
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
        // If email confirmation is required, the session will be null.
        if (data.session) {
          router.push(await resolvePostLoginRedirect(redirectTo));
        } else {
          setInfo(
            "Check your email to confirm. We've sent a link to " +
              email +
              ".",
          );
        }
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

  async function signOut() {
    const supabase = getBrowserClient();
    await supabase.auth.signOut();
    setSignedIn(false);
    setSignedInEmail(null);
    router.refresh();
  }

  if (signedIn) {
    return (
      <Container className="py-16 max-w-md">
        <div className="card p-8 text-center">
          <p className="text-[12px] text-fg-subtle uppercase tracking-wider font-medium">
            {t("login.guest_title")}
          </p>
          <h1 className="mt-2 text-[22px] font-semibold tracking-tight">
            {signedInEmail}
          </h1>
          <p className="mt-2 text-[13px] text-fg-muted">
            {t("login.guest_body")}
          </p>
          <div className="mt-6 grid grid-cols-1 gap-2">
            <SignedInRedirectButton email={signedInEmail} />
            <button
              onClick={signOut}
              className="h-10 inline-flex items-center justify-center text-[13px] font-medium rounded-md border border-border hover:bg-slate-50"
            >
              {t("login.out")}
            </button>
          </div>
        </div>
      </Container>
    );
  }

  return (
    <Container className="py-16 max-w-md">
      <div className="card p-8">
        <p className="text-[11px] text-fg-subtle uppercase tracking-wider font-medium">
          {t("login.title")}
        </p>
        <h1 className="mt-2 text-[26px] font-semibold tracking-[-0.01em]">
          {mode === "signin" ? t("login.title") : "Create account"}
        </h1>
        <p className="mt-2 text-[13.5px] text-fg-muted">{t("login.lede")}</p>

        <form onSubmit={submit} className="mt-7 space-y-4">
          <div>
            <label
              htmlFor="email"
              className="text-[12px] text-fg-subtle uppercase tracking-wider font-medium"
            >
              {t("login.email")}
            </label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder={t("login.email_ph")}
              autoComplete="email"
              required
              className="mt-2 w-full h-11 px-3 border border-border rounded-md text-[14px] focus:border-cyan-600 focus:outline-none"
            />
          </div>
          <div>
            <label
              htmlFor="password"
              className="text-[12px] text-fg-subtle uppercase tracking-wider font-medium"
            >
              Password
            </label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              autoComplete={
                mode === "signin" ? "current-password" : "new-password"
              }
              required
              minLength={6}
              className="mt-2 w-full h-11 px-3 border border-border rounded-md text-[14px] focus:border-cyan-600 focus:outline-none"
            />
          </div>
          {error && (
            <p className="text-[12px] text-red-600 bg-red-50 border border-red-200 rounded-md p-2.5">
              {error}
            </p>
          )}
          {info && (
            <p className="text-[12px] text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-md p-2.5">
              {info}
            </p>
          )}
          <Button size="lg" className="w-full" disabled={loading}>
            {loading
              ? "..."
              : mode === "signin"
                ? t("login.title")
                : "Create account"}
          </Button>
        </form>

        <div className="mt-5 pt-5 border-t border-border flex items-center justify-between text-[12.5px]">
          <button
            type="button"
            onClick={() => {
              setMode(mode === "signin" ? "signup" : "signin");
              setError(null);
              setInfo(null);
            }}
            className="text-fg-muted hover:text-fg"
          >
            {mode === "signin"
              ? "Need an account? Create one"
              : "Already have one? Sign in"}
          </button>
          <Link href="/" className="text-fg-subtle hover:text-fg">
            {t("login.skip")}
          </Link>
        </div>
      </div>
    </Container>
  );
}
