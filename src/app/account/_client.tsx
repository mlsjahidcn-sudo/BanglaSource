"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { Container } from "@/components/ui/container";
import { useCart } from "@/lib/cart";
import { getBrowserClient } from "@/lib/supabase/browser";
import { fmtCny } from "@/lib/pricing";
import { useLang } from "@/lib/i18n";

type QuoteRow = {
  id: string;
  quote_id: string;
  product_ids: string[];
  shipping_mode: "air" | "sea" | "express";
  total_qty: number;
  total_bdt: number;
  unit_bdt: number;
  transit_days: string;
  status: string;
  created_at: string;
  expires_at: string;
};

type Profile = {
  id: string;
  email: string;
  full_name: string | null;
  company: string | null;
  phone: string | null;
};

export function AccountClient() {
  const { t } = useLang();
  const { count, items, hydrated: cartHydrated } = useCart();
  const [hydrated, setHydrated] = useState(false);
  const [user, setUser] = useState<{ id: string; email: string } | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [quotes, setQuotes] = useState<QuoteRow[]>([]);
  const [loadingQuotes, setLoadingQuotes] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const supabase = getBrowserClient();
    let alive = true;
    (async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!alive) return;
      setHydrated(true);
      if (!user) {
        setUser(null);
        return;
      }
      setUser({ id: user.id, email: user.email ?? "" });

      // Profile
      const { data: p } = await supabase
        .from("profiles")
        .select("id,email,full_name,company,phone")
        .eq("id", user.id)
        .maybeSingle();
      if (alive) setProfile(p as Profile | null);

      // Quotes
      setLoadingQuotes(true);
      const { data: q, error: qErr } = await supabase
        .from("quotes")
        .select(
          "id,quote_id,product_ids,shipping_mode,total_qty,total_bdt,unit_bdt,transit_days,status,created_at,expires_at",
        )
        .order("created_at", { ascending: false })
        .limit(50);
      if (alive) {
        setQuotes((q ?? []) as QuoteRow[]);
        setError(qErr?.message ?? null);
        setLoadingQuotes(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  if (!hydrated) {
    return (
      <Container className="py-16">
        <p className="text-[13px] text-fg-muted">Loading…</p>
      </Container>
    );
  }

  if (!user) {
    return (
      <Container className="py-16 max-w-md">
        <div className="card p-8 text-center">
          <h1 className="text-[22px] font-semibold tracking-tight">
            Not signed in
          </h1>
          <p className="mt-2 text-[13.5px] text-fg-muted">{t("login.lede")}</p>
          <Link
            href="/login?redirect=/account"
            className="mt-6 inline-flex h-10 items-center px-4 text-[13px] font-medium rounded-md bg-cyan-600 text-white hover:bg-cyan-700"
          >
            {t("login.title")} →
          </Link>
        </div>
      </Container>
    );
  }

  return (
    <Container className="py-10 max-w-3xl">
      <div className="card p-8">
        <p className="text-[11px] text-fg-subtle uppercase tracking-wider font-medium">
          Signed in
        </p>
        <h1 className="mt-1 text-[26px] font-semibold tracking-[-0.01em]">
          {user.email}
        </h1>
        {profile && (profile.full_name || profile.company) && (
          <p className="mt-1 text-[12.5px] text-fg-muted">
            {[profile.full_name, profile.company].filter(Boolean).join(" · ")}
          </p>
        )}
      </div>

      <div className="mt-6 grid sm:grid-cols-2 gap-3">
        <div className="card p-5">
          <p className="text-[11px] text-fg-subtle uppercase tracking-wider font-medium">
            {t("cart.title")}
          </p>
          <p className="mt-1 text-[24px] font-semibold price-tag">
            {cartHydrated ? count : "—"}
          </p>
          <p className="text-[12px] text-fg-muted mt-0.5">
            {cartHydrated ? items.length : 0} {t("cart.skus")}
          </p>
          <Link
            href="/cart"
            className="mt-3 inline-flex h-9 items-center px-3 text-[12.5px] font-medium rounded-md border border-border hover:bg-slate-50"
          >
            {t("cart.view_all")} →
          </Link>
        </div>

        <div className="card p-5">
          <p className="text-[11px] text-fg-subtle uppercase tracking-wider font-medium">
            Quotes saved
          </p>
          <p className="mt-1 text-[24px] font-semibold price-tag">
            {quotes.length}
          </p>
          <p className="text-[12px] text-fg-muted mt-0.5">
            Last 50 shown below
          </p>
        </div>
      </div>

      <div className="mt-8">
        <h2 className="text-[18px] font-semibold tracking-tight">
          Your quotes
        </h2>
        <p className="mt-1 text-[12.5px] text-fg-muted">
          Each row is a quote you've generated from your order list.
        </p>
        {loadingQuotes && (
          <p className="mt-4 text-[13px] text-fg-muted">Loading…</p>
        )}
        {error && (
          <p className="mt-4 text-[12.5px] text-red-600">{error}</p>
        )}
        {!loadingQuotes && quotes.length === 0 && (
          <div className="mt-4 card p-8 text-center">
            <p className="text-[14px] font-medium">No quotes yet</p>
            <p className="mt-1 text-[12.5px] text-fg-muted">
              Add products to your order list and request a quote.
            </p>
            <Link
              href="/categories"
              className="mt-4 inline-flex h-10 items-center px-4 text-[13px] font-medium rounded-md bg-cyan-600 text-white hover:bg-cyan-700"
            >
              Browse the catalog →
            </Link>
          </div>
        )}

        {quotes.length > 0 && (
          <ul className="mt-4 card divide-y divide-border">
            {quotes.map((q) => (
              <li key={q.id} className="p-5 flex items-start gap-4">
                <div className="flex-1 min-w-0">
                  <p className="text-[12.5px] font-mono tnum text-fg-muted">
                    {q.quote_id}
                  </p>
                  <p className="mt-0.5 text-[14px] font-medium">
                    {q.product_ids.length} {t("cart.skus")} ·{" "}
                    {q.total_qty} pcs · {q.shipping_mode.toUpperCase()} ·{" "}
                    {q.transit_days}
                  </p>
                  <p className="mt-0.5 text-[12px] text-fg-muted">
                    Saved {new Date(q.created_at).toLocaleDateString()} ·
                    status:{" "}
                    <span className="font-mono">{q.status}</span>
                  </p>
                </div>
                <div className="text-right shrink-0">
                  <p className="price-tag text-[16px] font-semibold">
                    ৳{q.total_bdt.toLocaleString("en-IN")}
                  </p>
                  <p className="text-[11px] text-fg-subtle mt-0.5 font-mono tnum">
                    ৳{q.unit_bdt.toLocaleString("en-IN")} / pc
                  </p>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      <SignOutButton />
    </Container>
  );
}

function SignOutButton() {
  const [loading, setLoading] = useState(false);
  return (
    <button
      onClick={async () => {
        setLoading(true);
        const supabase = getBrowserClient();
        await supabase.auth.signOut();
        window.location.href = "/";
      }}
      disabled={loading}
      className="mt-10 text-[12.5px] text-fg-muted hover:text-fg"
    >
      {loading ? "..." : t_local("login.out")}
    </button>
  );
}

// Tiny inline t() shim — the page is a client component using useLang, but
// this sub-component is a server-friendly one. Avoid re-importing context.
function t_local(key: string) {
  const map: Record<string, string> = {
    "login.out": "Sign out →",
    "cart.skus": "SKUs",
    "cart.title": "Order list",
    "cart.view_all": "View full list",
  };
  return map[key] ?? key;
}
