"use client";
// /components/nav.tsx
//
// Public site nav. Renders the sticky header with logo, primary
// navigation, search, lang toggle, and cart.
//
// MOBILE (md:hidden):
//   - Logo (compact, links home)
//   - Search icon button (opens search bar inline below the header)
//   - Lang toggle
//   - Hamburger button (opens MobileMenu drawer)
//   - Cart button (44x44 touch target)
//
// DESKTOP (md:flex):
//   - Logo + inline nav links + inline SearchBar + lang + cart

import { useEffect, useState } from "react";
import Link from "next/link";
import { useLang } from "@/lib/i18n";
import { LangToggle } from "@/components/ui/lang-toggle";
import { SearchBar } from "@/components/search-bar";
import { CartDrawer } from "@/components/cart-drawer";
import { MobileMenu } from "@/components/mobile-menu";
import { useCart } from "@/lib/cart";
import { getBrowserClient } from "@/lib/supabase/browser";

export function Nav() {
  const { t } = useLang();
  const { count } = useCart();
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [cartOpen, setCartOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [mobileSearchOpen, setMobileSearchOpen] = useState(false);

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
        <div className="mx-auto max-w-7xl px-4 md:px-10 h-16 flex items-center gap-3 md:gap-6">
          {/* Logo — link target is full 64px height (h-16 on parent). */}
          <Link
            href="/"
            className="flex items-center gap-2 shrink-0 min-h-[44px] -ml-1 pl-1 pr-2"
            aria-label="BanglaSource home"
          >
            <svg
              width="22"
              height="22"
              viewBox="0 0 22 22"
              fill="none"
              className="text-cyan-700"
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

          {/* Primary nav — desktop only */}
          <nav className="hidden md:flex items-center gap-6 text-[14px] text-fg-muted">
            <Link href="/categories" className="nav-link hover:text-fg min-h-[44px] inline-flex items-center">
              {t("nav.catalog")}
            </Link>
            {userEmail && (
              <Link
                href="/buyer/saved"
                className="nav-link hover:text-fg flex items-center gap-1 min-h-[44px]"
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
            <Link href="/how-it-works" className="nav-link hover:text-fg min-h-[44px] inline-flex items-center">
              {t("nav.how")}
            </Link>
            <Link href="/group-buys" className="nav-link hover:text-fg flex items-center gap-1 min-h-[44px]">
              <svg
                width="13"
                height="13"
                viewBox="0 0 16 16"
                fill="none"
                className="text-cyan-600"
              >
                <circle cx="5" cy="6" r="1.7" fill="currentColor" />
                <circle cx="11" cy="6" r="1.7" fill="currentColor" />
                <circle cx="8" cy="4" r="1.5" fill="currentColor" />
                <path
                  d="M2 12.5c.5-1.7 1.7-2.5 3-2.5s2.5.8 3 2.5"
                  stroke="currentColor"
                  strokeWidth="1.4"
                  fill="none"
                  strokeLinecap="round"
                />
                <path
                  d="M8 11.5c.5-1.4 1.5-2 2.5-2s2 .6 2.5 2"
                  stroke="currentColor"
                  strokeWidth="1.4"
                  fill="none"
                  strokeLinecap="round"
                />
              </svg>
              {t("nav.group_buys")}
            </Link>
            <Link href="/shipping-rates" className="nav-link hover:text-fg min-h-[44px] inline-flex items-center">
              {t("nav.shipping")}
            </Link>
            <Link href="/about" className="nav-link hover:text-fg min-h-[44px] inline-flex items-center">
              {t("nav.about")}
            </Link>
            <Link href="/contact" className="nav-link hover:text-fg min-h-[44px] inline-flex items-center">
              {t("nav.contact")}
            </Link>
          </nav>

          {/* Search — desktop only, pushed to the right */}
          <div className="hidden md:flex flex-1 max-w-[280px] lg:max-w-[360px] ml-auto">
            <SearchBar />
          </div>

          {/* Right cluster: mobile = search-icon + hamburger + lang + cart */}
          <div className="flex items-center gap-1 md:gap-3 ml-auto md:ml-0">
            {/* Mobile search-icon (only on mobile, opens inline search) */}
            <button
              type="button"
              onClick={() => setMobileSearchOpen(!mobileSearchOpen)}
              aria-label={mobileSearchOpen ? "Close search" : "Open search"}
              aria-expanded={mobileSearchOpen}
              className="md:hidden min-h-[44px] min-w-[44px] flex items-center justify-center rounded-md text-fg-muted hover:bg-slate-50 active:bg-slate-100 transition-colors"
            >
              <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden>
                <circle cx="9" cy="9" r="6" stroke="currentColor" strokeWidth="1.6" />
                <path
                  d="m13.5 13.5 3 3"
                  stroke="currentColor"
                  strokeWidth="1.6"
                  strokeLinecap="round"
                />
              </svg>
            </button>

            {/* Hamburger — mobile only, opens MobileMenu drawer */}
            <button
              type="button"
              onClick={() => setMenuOpen(true)}
              aria-label="Open menu"
              aria-expanded={menuOpen}
              className="md:hidden min-h-[44px] min-w-[44px] flex items-center justify-center rounded-md text-fg-muted hover:bg-slate-50 active:bg-slate-100 transition-colors"
            >
              <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden>
                <path d="M3 6h14M3 10h14M3 14h14" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
              </svg>
            </button>

            {/* Auth — desktop only */}
            {userEmail ? (
              <Link
                href="/account"
                className="hidden lg:flex items-center gap-1.5 text-[13px] text-fg-muted hover:text-fg min-h-[44px]"
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

            {/* Cart button — 44x44 touch target (iOS HIG) */}
            <button
              onClick={() => setCartOpen(true)}
              aria-label={t("cart.title")}
              aria-expanded={cartOpen}
              className="relative min-h-[44px] min-w-[44px] flex items-center justify-center rounded-md border border-border hover:bg-slate-50 active:bg-slate-100 transition-colors text-fg-muted"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden>
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
                <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-1 rounded-full bg-cyan-600 text-white text-[10px] font-semibold flex items-center justify-center">
                  {count > 99 ? "99+" : count}
                </span>
              )}
            </button>

            <div className="hidden md:inline-flex">
              <LangToggle />
            </div>
          </div>
        </div>

        {/* Mobile search bar — collapsible, full-width below the header.
            Sits OUTSIDE the h-16 row so it can expand without disturbing
            the nav. */}
        {mobileSearchOpen && (
          <div className="md:hidden border-t border-border bg-bg px-4 py-3">
            <SearchBar
              onResultClick={() => setMobileSearchOpen(false)}
              className="w-full"
            />
          </div>
        )}
      </header>

      <CartDrawer open={cartOpen} onClose={() => setCartOpen(false)} />
      <MobileMenu
        open={menuOpen}
        onClose={() => setMenuOpen(false)}
        userEmail={userEmail}
      />
    </>
  );
}