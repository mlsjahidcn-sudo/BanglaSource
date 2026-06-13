"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useLang } from "@/lib/i18n";
import { LangToggle } from "@/components/ui/lang-toggle";
import { SearchBar } from "@/components/search-bar";
import { CartDrawer } from "@/components/cart-drawer";
import { useCart } from "@/lib/cart";
import { getBrowserClient } from "@/lib/supabase/browser";

export function Nav() {
  const { t } = useLang();
  const { count } = useCart();
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [cartOpen, setCartOpen] = useState(false);

  useEffect(() => {
    const supabase = getBrowserClient();
    supabase.auth.getSession().then(({ data }) => {
      setUserEmail(data.session?.user?.email ?? null);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_evt, session) => {
      setUserEmail(session?.user?.email ?? null);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  return (
    <>
      <header className="sticky top-0 z-40 border-b border-border bg-bg/90 backdrop-blur supports-[backdrop-filter]:bg-bg/70">
        <div className="mx-auto max-w-7xl px-6 md:px-10 h-16 flex items-center gap-6">
          {/* Logo */}
          <Link
            href="/"
            className="flex items-center gap-2 shrink-0"
            aria-label="BanglaSource home"
          >
            <svg
              width="22"
              height="22"
              viewBox="0 0 22 22"
              fill="none"
              className="text-emerald-600"
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
            <span className="font-semibold tracking-tight text-[15px]">
              BanglaSource
            </span>
          </Link>

          {/* Primary nav */}
          <nav className="hidden md:flex items-center gap-6 text-[14px] text-fg-muted">
            <Link href="/categories" className="nav-link hover:text-fg">
              {t("nav.catalog")}
            </Link>
            {userEmail && (
              <Link
                href="/buyer/saved"
                className="nav-link hover:text-fg flex items-center gap-1"
              >
                <svg
                  width="13"
                  height="13"
                  viewBox="0 0 24 24"
                  fill="currentColor"
                  className="text-rose-500"
                >
                  <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
                </svg>
                Saved
              </Link>
            )}
            <Link href="/how-it-works" className="nav-link hover:text-fg">
              {t("nav.how")}
            </Link>
            <Link href="/shipping-rates" className="nav-link hover:text-fg">
              {t("nav.shipping")}
            </Link>
            <Link href="/about" className="nav-link hover:text-fg">
              {t("nav.about")}
            </Link>
            <Link href="/contact" className="nav-link hover:text-fg">
              {t("nav.contact")}
            </Link>
          </nav>

          {/* Search */}
          <div className="hidden md:flex flex-1 max-w-[280px] lg:max-w-[360px] ml-auto">
            <SearchBar />
          </div>

          {/* Auth + cart */}
          <div className="flex items-center gap-3 ml-auto md:ml-0">
            {userEmail ? (
              <Link
                href="/account"
                className="hidden lg:flex items-center gap-1.5 text-[13px] text-fg-muted hover:text-fg"
                title={userEmail}
              >
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 16 16"
                  fill="none"
                  className="text-fg-subtle"
                >
                  <circle cx="8" cy="5.5" r="2.5" stroke="currentColor" strokeWidth="1.4" />
                  <path d="M3 13.5c.7-2 2.7-3 5-3s4.3 1 5 3" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
                </svg>
                <span className="truncate max-w-[120px]">
                  {userEmail.split("@")[0]}
                </span>
              </Link>
            ) : (
              <Link
                href="/login"
                className="hidden lg:inline-flex h-8 items-center px-3 rounded-md text-[12.5px] font-medium bg-cyan-600 text-white hover:bg-cyan-700"
              >
                Sign in
              </Link>
            )}

            <button
              onClick={() => setCartOpen(true)}
              aria-label={t("cart.title")}
              aria-expanded={cartOpen}
              className="relative w-10 h-10 flex items-center justify-center rounded-md border border-border hover:bg-slate-50 transition-colors text-fg-muted"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                <path
                  d="M3 3h2l2.4 12.2a2 2 0 0 0 2 1.8h8.6a2 2 0 0 0 2-1.6L21 8H6"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
                <circle cx="9" cy="20" r="1.4" fill="currentColor" />
                <circle cx="18" cy="20" r="1.4" fill="currentColor" />
              </svg>
              {count > 0 && (
                <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 rounded-full bg-emerald-600 text-white text-[10px] font-semibold flex items-center justify-center">
                  {count > 99 ? "99+" : count}
                </span>
              )}
            </button>

            <LangToggle />
          </div>
        </div>
      </header>

      <CartDrawer open={cartOpen} onClose={() => setCartOpen(false)} />
    </>
  );
}
