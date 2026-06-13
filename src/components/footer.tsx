"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useLang } from "@/lib/i18n";
import { categories } from "@/lib/categories";

// Inline SVG icon set (no external icon lib).
function Icon({
  name,
  className,
}: {
  name: string;
  className?: string;
}) {
  const common = "w-3.5 h-3.5";
  const c = className ?? common;
  switch (name) {
    case "bangladeshi-flag":
      return (
        // stylised BD flag — green disc on red field
        <svg viewBox="0 0 24 16" className={c} aria-hidden="true">
          <rect width="24" height="16" rx="2" fill="#006a4e" />
          <circle cx="10" cy="8" r="5" fill="#f42a41" />
        </svg>
      );
    case "china-flag":
      return (
        <svg viewBox="0 0 24 16" className={c} aria-hidden="true">
          <rect width="24" height="16" rx="2" fill="#de2910" />
          <text
            x="12"
            y="11"
            textAnchor="middle"
            fontSize="8"
            fill="#ffde00"
            fontWeight="700"
          >
            ★
          </text>
        </svg>
      );
    case "shield-check":
      return (
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className={c}
        >
          <path d="M12 2 4 5v7c0 5 3.5 8.5 8 10 4.5-1.5 8-5 8-10V5l-8-3Z" />
          <path d="m9 12 2 2 4-4" />
        </svg>
      );
    case "package":
      return (
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className={c}
        >
          <path d="M16.5 9.4 7.55 4.24" />
          <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z" />
          <path d="M3.27 6.96 12 12.01l8.73-5.05" />
          <path d="M12 22.08V12" />
        </svg>
      );
    case "users":
      return (
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className={c}
        >
          <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
          <circle cx="9" cy="7" r="4" />
          <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
          <path d="M16 3.13a4 4 0 0 1 0 7.75" />
        </svg>
      );
    case "piggy":
      return (
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className={c}
        >
          <path d="M19 5c-1.5 0-2.8 1.4-3 2-3.5-1.5-11-.3-11 5 0 1.8 0 3 2 4.5V20h4v-2h3v2h4v-4c1-.5 1.7-1 2-2h2v-3c0-3-2-4-3-4Z" />
          <path d="M2 9v1c0 1.1.9 2 2 2h1" />
          <path d="M16 11h0" />
        </svg>
      );
    case "mail":
      return (
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className={c}
        >
          <rect width="20" height="16" x="2" y="4" rx="2" />
          <path d="m22 7-10 5L2 7" />
        </svg>
      );
    case "send":
      return (
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className={c}
        >
          <path d="M14.536 21.686a.5.5 0 0 0 .937-.024l6.5-19a.496.496 0 0 0-.635-.635l-19 6.5a.5.5 0 0 0-.024.937l7.93 3.18a2 2 0 0 1 1.112 1.11Z" />
          <path d="m21.854 2.147-10.94 10.939" />
        </svg>
      );
    case "facebook":
      return (
        <svg
          viewBox="0 0 24 24"
          fill="currentColor"
          className={c}
        >
          <path d="M22 12a10 10 0 1 0-11.56 9.88V14.9H7.9V12h2.54V9.8c0-2.5 1.49-3.89 3.77-3.89 1.1 0 2.24.2 2.24.2v2.46h-1.26c-1.24 0-1.63.77-1.63 1.56V12h2.77l-.44 2.9h-2.33v6.98A10 10 0 0 0 22 12Z" />
        </svg>
      );
    case "instagram":
      return (
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className={c}
        >
          <rect width="20" height="20" x="2" y="2" rx="5" />
          <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37Z" />
          <line x1="17.5" x2="17.51" y1="6.5" y2="6.5" />
        </svg>
      );
    case "youtube":
      return (
        <svg
          viewBox="0 0 24 24"
          fill="currentColor"
          className={c}
        >
          <path d="M23.5 6.2a3 3 0 0 0-2.1-2.1C19.5 3.6 12 3.6 12 3.6s-7.5 0-9.4.5A3 3 0 0 0 .5 6.2C0 8.1 0 12 0 12s0 3.9.5 5.8a3 3 0 0 0 2.1 2.1c1.9.5 9.4.5 9.4.5s7.5 0 9.4-.5a3 3 0 0 0 2.1-2.1c.5-1.9.5-5.8.5-5.8s0-3.9-.5-5.8ZM9.6 15.6V8.4l6.3 3.6-6.3 3.6Z" />
        </svg>
      );
    case "linkedin":
      return (
        <svg
          viewBox="0 0 24 24"
          fill="currentColor"
          className={c}
        >
          <path d="M20.5 2h-17A1.5 1.5 0 0 0 2 3.5v17A1.5 1.5 0 0 0 3.5 22h17a1.5 1.5 0 0 0 1.5-1.5v-17A1.5 1.5 0 0 0 20.5 2ZM8 19H5V9h3v10Zm-1.5-11.5A1.5 1.5 0 1 1 8 6a1.5 1.5 0 0 1-1.5 1.5ZM19 19h-3v-5.5c0-1.5-.5-2-1.5-2S13 12.5 13 14V19h-3V9h3v1.5c.5-1 1.5-1.5 3-1.5 2.5 0 3 1.5 3 4Z" />
        </svg>
      );
    case "whatsapp":
      return (
        <svg
          viewBox="0 0 24 24"
          fill="currentColor"
          className={c}
        >
          <path d="M.057 24l1.687-6.163a11.867 11.867 0 0 1-1.587-5.946C.16 5.335 5.495 0 12.05 0a11.82 11.82 0 0 1 8.413 3.488 11.82 11.82 0 0 1 3.48 8.414c-.003 6.557-5.338 11.892-11.893 11.892a11.9 11.9 0 0 1-5.688-1.448L.057 24Zm6.597-3.807c1.676.995 3.276 1.591 5.392 1.592 5.448 0 9.886-4.434 9.889-9.885.002-5.462-4.415-9.89-9.881-9.892-5.452 0-9.887 4.434-9.889 9.884a9.86 9.86 0 0 0 1.523 5.273l-.999 3.648 3.965-1.04Zm11.387-5.464c-.074-.124-.272-.198-.57-.347-.297-.149-1.758-.868-2.031-.967-.272-.099-.47-.149-.669.149-.198.297-.768.967-.941 1.165-.173.198-.347.223-.644.074-.297-.149-1.255-.462-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.297-.347.446-.521.151-.172.2-.296.3-.495.099-.198.05-.372-.025-.521-.075-.148-.669-1.611-.916-2.206-.242-.579-.487-.501-.669-.51l-.57-.01a1.094 1.094 0 0 0-.792.372c-.272.297-1.04 1.016-1.04 2.479s1.065 2.876 1.213 3.074c.149.198 2.095 3.2 5.076 4.487.709.306 1.263.489 1.694.626.712.226 1.36.194 1.872.118.571-.085 1.758-.719 2.006-1.413.248-.695.248-1.29.173-1.414Z" />
        </svg>
      );
    case "logo":
      return (
        <svg
          viewBox="0 0 22 22"
          fill="none"
          className={c}
          aria-hidden="true"
        >
          <path
            d="M11 1.5L20.5 6.5V15.5L11 20.5L1.5 15.5V6.5L11 1.5Z"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinejoin="round"
          />
          <path
            d="M11 6.5L15.5 9V13L11 15.5L6.5 13V9L11 6.5Z"
            fill="currentColor"
          />
        </svg>
      );
    default:
      return null;
  }
}

const PAYMENTS: Array<{ name: string; tag: string; tone: string }> = [
  { name: "Bank transfer", tag: "City Bank · DBBL · EBL", tone: "bg-slate-100 text-slate-700" },
  { name: "bKash", tag: "personal + merchant", tone: "bg-pink-50 text-pink-700" },
  { name: "Nagad", tag: "BD mobile wallet", tone: "bg-orange-50 text-orange-700" },
  { name: "Rocket", tag: "DBBL mobile", tone: "bg-violet-50 text-violet-700" },
  { name: "USDT (TRC20)", tag: "crypto, 0% spread", tone: "bg-emerald-50 text-emerald-700" },
  { name: "Cash on delivery", tag: "Dhaka warehouse", tone: "bg-amber-50 text-amber-700" },
];

function formatBdt(n: number): string {
  return "৳" + Math.round(n).toLocaleString("en-IN");
}

export function Footer() {
  const { t } = useLang();
  const [email, setEmail] = useState("");
  const [subState, setSubState] = useState<"idle" | "loading" | "ok" | "err">(
    "idle",
  );
  const [stats, setStats] = useState<{
    active_products: number;
    verified_factories: number;
    total_buyers: number;
    total_saved_bdt: number;
  } | null>(null);

  // Trust strip data — pulled live from /api/stats/trust on mount.
  // Same endpoint the homepage hero uses, so the numbers stay
  // consistent across the site. Cached for an hour on the server.
  useEffect(() => {
    const ac = new AbortController();
    fetch("/api/stats/trust", { signal: ac.signal })
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => {
        if (j?.ok) {
          setStats({
            active_products: j.active_products,
            verified_factories: j.verified_factories,
            total_buyers: j.total_buyers,
            total_saved_bdt: j.total_saved_bdt,
          });
        }
      })
      .catch(() => {
        /* ignore — trust strip is best-effort */
      });
    return () => ac.abort();
  }, []);

  async function handleSubscribe(e: React.FormEvent) {
    e.preventDefault();
    if (!email.includes("@")) {
      setSubState("err");
      return;
    }
    setSubState("loading");
    try {
      const r = await fetch("/api/newsletter/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const j = await r.json();
      if (j?.ok) setSubState("ok");
      else setSubState("err");
    } catch {
      setSubState("err");
    }
  }

  const cats = Object.values(categories);

  return (
    <footer className="border-t border-border bg-bg-soft mt-24">
      {/* ── Trust strip (live, from /api/stats/trust) ──────────────── */}
      <div className="border-b border-border bg-bg">
        <div className="mx-auto max-w-7xl px-6 md:px-10 py-6">
          <p className="text-[11px] uppercase tracking-wider text-fg-subtle font-medium mb-3">
            {t("footer.trust_strip")}
          </p>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <TrustStat
              icon="package"
              label="active products"
              value={stats ? stats.active_products.toLocaleString() : "—"}
            />
            <TrustStat
              icon="shield-check"
              label="verified factories"
              value={stats ? stats.verified_factories.toLocaleString() : "—"}
            />
            <TrustStat
              icon="users"
              label="buyers"
              value={stats ? stats.total_buyers.toLocaleString() : "—"}
            />
            <TrustStat
              icon="piggy"
              label="saved for buyers"
              value={stats ? formatBdt(stats.total_saved_bdt) + "+" : "—"}
            />
          </div>
        </div>
      </div>

      {/* ── Main grid ───────────────────────────────────────────────── */}
      <div className="mx-auto max-w-7xl px-6 md:px-10 py-16">
        <div className="grid grid-cols-2 md:grid-cols-12 gap-10">
          {/* Brand column — col-span-4 */}
          <div className="col-span-2 md:col-span-4">
            <div className="flex items-center gap-2">
              <span className="text-emerald-600">
                <Icon name="logo" className="w-5 h-5" />
              </span>
              <span className="font-semibold tracking-tight text-[15px]">
                BanglaSource
              </span>
            </div>
            <p className="mt-3 text-sm text-fg-muted max-w-xs leading-relaxed">
              {t("footer.tagline")}
            </p>

            <div className="mt-5 flex items-center gap-3 text-[12px] text-fg-subtle">
              <span className="inline-flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                Dhaka
              </span>
              <span className="text-slate-300">·</span>
              <span className="inline-flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                Chittagong
              </span>
              <span className="text-slate-300">·</span>
              <span className="inline-flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                Guangzhou
              </span>
            </div>

            <div className="mt-5 flex items-center gap-2">
              <Icon name="bangladeshi-flag" className="w-5 h-3.5 rounded-sm" />
              <Icon name="china-flag" className="w-5 h-3.5 rounded-sm" />
              <span className="text-[11px] text-fg-subtle ml-1">
                Bangladesh · China
              </span>
            </div>

            <div className="mt-4 inline-flex items-center gap-1.5 px-2.5 py-1 rounded border border-border bg-bg text-[11px] text-fg-muted font-mono tnum">
              <Icon name="shield-check" className="w-3 h-3 text-emerald-600" />
              {t("footer.trade_license")}
            </div>

            {/* Social row */}
            <div className="mt-6 flex items-center gap-3 text-fg-muted">
              <SocialLink href="https://www.facebook.com/skybuybd" label="Facebook">
                <Icon name="facebook" className="w-4 h-4" />
              </SocialLink>
              <SocialLink href="https://www.instagram.com/skybuybd/" label="Instagram">
                <Icon name="instagram" className="w-4 h-4" />
              </SocialLink>
              <SocialLink href="https://www.youtube.com/@skybuybd" label="YouTube">
                <Icon name="youtube" className="w-4 h-4" />
              </SocialLink>
              <SocialLink href="https://www.linkedin.com/company/skybuybd" label="LinkedIn">
                <Icon name="linkedin" className="w-4 h-4" />
              </SocialLink>
              <SocialLink href="https://wa.me/8617325764171" label="WhatsApp">
                <Icon name="whatsapp" className="w-4 h-4" />
              </SocialLink>
            </div>
          </div>

          {/* Categories column */}
          <div className="md:col-span-3">
            <h4 className="text-[11px] font-medium tracking-wider uppercase text-fg-subtle mb-4">
              {t("footer.categories")}
            </h4>
            <ul className="space-y-2.5 text-sm">
              {cats.map((c) => (
                <li key={c.key}>
                  <Link
                    href={`/categories/${c.slug}`}
                    className="text-fg-muted hover:text-fg inline-flex items-baseline gap-1.5"
                  >
                    {c.name_en}
                    <span className="text-[10.5px] text-fg-subtle">
                      {c.subs.length} subs
                    </span>
                  </Link>
                </li>
              ))}
              <li className="pt-1">
                <Link
                  href="/categories"
                  className="text-emerald-700 hover:text-emerald-800 font-medium text-[12.5px]"
                >
                  Browse all →
                </Link>
              </li>
            </ul>
          </div>

          {/* Sourcing column */}
          <div className="md:col-span-2">
            <h4 className="text-[11px] font-medium tracking-wider uppercase text-fg-subtle mb-4">
              {t("footer.sourcing")}
            </h4>
            <ul className="space-y-2.5 text-sm">
              <li>
                <Link href="/categories" className="text-fg-muted hover:text-fg">
                  Catalog
                </Link>
              </li>
              <li>
                <Link href="/how-it-works" className="text-fg-muted hover:text-fg">
                  How it works
                </Link>
              </li>
              <li>
                <Link href="/shipping-rates" className="text-fg-muted hover:text-fg">
                  Shipping rates
                </Link>
              </li>
              <li>
                <Link href="/for-you" className="text-fg-muted hover:text-fg">
                  For you
                </Link>
              </li>
              <li>
                <Link href="/buyer/saved" className="text-fg-muted hover:text-fg">
                  Saved
                </Link>
              </li>
              <li>
                <Link href="/search" className="text-fg-muted hover:text-fg">
                  Search
                </Link>
              </li>
            </ul>
          </div>

          {/* Company column */}
          <div className="md:col-span-3">
            <h4 className="text-[11px] font-medium tracking-wider uppercase text-fg-subtle mb-4">
              {t("footer.company")}
            </h4>
            <ul className="space-y-2.5 text-sm">
              <li>
                <Link href="/about" className="text-fg-muted hover:text-fg">
                  About
                </Link>
              </li>
              <li>
                <Link href="/contact" className="text-fg-muted hover:text-fg">
                  Contact
                </Link>
              </li>
              <li>
                <Link href="#" className="text-fg-muted hover:text-fg">
                  {t("footer.privacy")}
                </Link>
              </li>
              <li>
                <Link href="#" className="text-fg-muted hover:text-fg">
                  {t("footer.terms")}
                </Link>
              </li>
              <li>
                <Link href="#" className="text-fg-muted hover:text-fg">
                  {t("footer.refund")}
                </Link>
              </li>
              <li>
                <Link href="/how-it-works" className="text-fg-muted hover:text-fg">
                  FAQ
                </Link>
              </li>
            </ul>
          </div>
        </div>

        {/* ── Payments band ─────────────────────────────────────────── */}
        <div className="mt-12 pt-8 border-t border-border">
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 mb-4">
            <div>
              <h4 className="text-[11px] font-medium tracking-wider uppercase text-fg-subtle">
                {t("footer.payments")}
              </h4>
              <p className="mt-1 text-[12px] text-fg-muted max-w-xl">
                {t("footer.payments_blurb")}
              </p>
            </div>
            <div className="flex items-center gap-1.5 text-[11px] text-fg-subtle whitespace-nowrap">
              <Icon name="shield-check" className="w-3.5 h-3.5 text-emerald-600" />
              70/30 split · balance settled in Dhaka
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            {PAYMENTS.map((p) => (
              <div
                key={p.name}
                className={`px-3 py-1.5 rounded-md border border-border text-[12px] font-medium ${p.tone}`}
                title={p.tag}
              >
                {p.name}
                <span className="text-fg-subtle font-normal ml-1.5 text-[10.5px]">
                  {p.tag}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* ── Newsletter band ───────────────────────────────────────── */}
        <div className="mt-10 pt-8 border-t border-border">
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
            <div className="flex-1 max-w-md">
              <h4 className="text-[14px] font-semibold text-fg flex items-center gap-1.5">
                <Icon name="mail" className="w-4 h-4 text-emerald-600" />
                {t("footer.stay_updated")}
              </h4>
              <p className="mt-1 text-[12.5px] text-fg-muted">
                {t("footer.newsletter_blurb")}
              </p>
            </div>
            <form
              onSubmit={handleSubscribe}
              className="flex w-full md:w-auto items-center gap-2"
            >
              <input
                type="email"
                required
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value);
                  if (subState === "err") setSubState("idle");
                }}
                placeholder={t("footer.email_placeholder")}
                className="flex-1 md:w-64 h-10 px-3 rounded-md border border-border bg-bg text-[13px] placeholder:text-fg-subtle focus:outline-none focus:border-emerald-500"
                disabled={subState === "loading" || subState === "ok"}
              />
              <button
                type="submit"
                disabled={subState === "loading" || subState === "ok"}
                className="h-10 px-4 rounded-md bg-emerald-600 text-white text-[13px] font-medium hover:bg-emerald-700 disabled:opacity-60 inline-flex items-center gap-1.5"
              >
                <Icon name="send" className="w-3.5 h-3.5" />
                {subState === "ok"
                  ? t("footer.subscribed")
                  : subState === "loading"
                    ? "…"
                    : t("footer.subscribe")}
              </button>
            </form>
          </div>
        </div>

        {/* ── Bottom bar ────────────────────────────────────────────── */}
        <div className="mt-12 pt-6 border-t border-border flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-[12px] text-fg-subtle">
          <p>{t("footer.copyright")}</p>
          <div className="flex items-center gap-3 text-fg-subtle">
            <span className="font-mono tnum">v1.0 · {t("footer.built_in")}</span>
            <span className="text-slate-300">·</span>
            <a
              href="mailto:hello@banglasource.bd"
              className="hover:text-fg inline-flex items-center gap-1"
            >
              <Icon name="mail" className="w-3 h-3" />
              hello@banglasource.bd
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
}

function TrustStat({
  icon,
  label,
  value,
}: {
  icon: string;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-center gap-2.5">
      <span className="w-8 h-8 rounded-md bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
        <Icon name={icon} className="w-4 h-4" />
      </span>
      <div className="min-w-0">
        <p className="text-[16px] font-semibold price-tag leading-none">{value}</p>
        <p className="text-[11px] text-fg-subtle mt-0.5 leading-none">{label}</p>
      </div>
    </div>
  );
}

function SocialLink({
  href,
  label,
  children,
}: {
  href: string;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={label}
      className="w-8 h-8 rounded-md border border-border flex items-center justify-center hover:bg-bg hover:text-emerald-600 transition-colors"
    >
      {children}
    </a>
  );
}
