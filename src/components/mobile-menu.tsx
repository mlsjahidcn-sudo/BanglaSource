"use client";
// /components/mobile-menu.tsx
//
// Phase 49 (2026-06-18): full-height mobile drawer with the same
// primary nav links that desktop shows in the header. Replaces the
// desktop nav links for screens < md (768px), since they don't fit.
//
// On the desktop nav (≥ md) the primary nav still renders inline.
// This drawer is `md:hidden` so it never appears on desktop.
//
// UX:
//   - Slides in from the right (mirror of the cart drawer)
//   - 100% width on phones (narrow viewport); max-w-sm on tablets
//   - Each link is 48px tall (Apple HIG 44 + 4px breathing room)
//   - Close on link tap (so user lands on the destination immediately)
//   - Close on Escape, close button, backdrop tap
//   - Auth section at the bottom: "Sign in" CTA if anon, "My account"
//     link if signed in
//
// i18n keys added in Phase 49: nav.menu.* and nav.mobile_signed_in_as.

import { useEffect, useRef } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useLang } from "@/lib/i18n";
import { LangToggle } from "@/components/ui/lang-toggle";

type Props = {
  open: boolean;
  onClose: () => void;
  userEmail: string | null;
};

type NavItem = {
  href: string;
  label: string;
  badge?: "rose" | "cyan";
  icon: React.ReactNode;
};

function HeartIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" className="text-rose-500" aria-hidden>
      <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
    </svg>
  );
}

function GroupBuyIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 16 16" fill="none" className="text-cyan-600" aria-hidden>
      <circle cx="5" cy="6" r="1.7" fill="currentColor" />
      <circle cx="11" cy="6" r="1.7" fill="currentColor" />
      <circle cx="8" cy="4" r="1.5" fill="currentColor" />
      <path d="M2 12.5c.5-1.7 1.7-2.5 3-2.5s2.5.8 3 2.5" stroke="currentColor" strokeWidth="1.4" fill="none" strokeLinecap="round" />
      <path d="M8 11.5c.5-1.4 1.5-2 2.5-2s2 .6 2.5 2" stroke="currentColor" strokeWidth="1.4" fill="none" strokeLinecap="round" />
    </svg>
  );
}

function ArrowRightIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-slate-400" aria-hidden>
      <path d="M9 18l6-6-6-6" />
    </svg>
  );
}

export function MobileMenu({ open, onClose, userEmail }: Props) {
  const { t } = useLang();
  const pathname = usePathname();
  const drawerRef = useRef<HTMLDivElement>(null);
  const closeBtnRef = useRef<HTMLButtonElement>(null);

  // Lock body scroll while open + Esc to close + focus management
  useEffect(() => {
    if (!open) return;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    // Focus the close button so keyboard users can tab through
    closeBtnRef.current?.focus();
    return () => {
      document.body.style.overflow = prevOverflow;
      document.removeEventListener("keydown", onKey);
    };
  }, [open, onClose]);

  // Close on route change (e.g. user taps a link)
  useEffect(() => {
    if (!open) return;
    onClose();
    // pathname is intentionally the dep so we re-fire on navigation
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]);

  const items: NavItem[] = [
    { href: "/categories", label: t("nav.catalog"), icon: <CatalogIcon /> },
    { href: "/how-it-works", label: t("nav.how"), icon: <HowIcon /> },
    { href: "/group-buys", label: t("nav.group_buys"), icon: <GroupBuyIcon />, badge: "cyan" },
    { href: "/shipping-rates", label: t("nav.shipping"), icon: <ShippingIcon /> },
    { href: "/about", label: t("nav.about"), icon: <AboutIcon /> },
    { href: "/contact", label: t("nav.contact"), icon: <ContactIcon /> },
    { href: "/blog", label: t("nav.blog") ?? "Blog", icon: <BlogIcon /> },
  ];

  if (userEmail) {
    items.push({
      href: "/buyer/saved",
      label: "Saved",
      icon: <HeartIcon />,
      badge: "rose",
    });
    items.push({
      href: "/account",
      label: t("nav.my_account") ?? "My account",
      icon: <AccountIcon />,
    });
  }

  return (
    <>
      {/* Backdrop — md:hidden so it never appears on desktop */}
      <div
        aria-hidden
        onClick={onClose}
        className={`md:hidden fixed inset-0 bg-slate-900/50 z-40 transition-opacity duration-200 ${
          open ? "opacity-100" : "opacity-0 pointer-events-none"
        }`}
      />
      {/* Drawer */}
      <div
        ref={drawerRef}
        role="dialog"
        aria-modal="true"
        aria-label="Main menu"
        className={`md:hidden fixed top-0 right-0 z-50 h-full w-full max-w-sm bg-bg shadow-2xl flex flex-col transition-transform duration-200 ease-out ${
          open ? "translate-x-0" : "translate-x-full"
        }`}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-border shrink-0">
          <span className="text-[13px] uppercase tracking-wider font-medium text-fg-subtle">
            Menu
          </span>
          <button
            ref={closeBtnRef}
            type="button"
            onClick={onClose}
            aria-label="Close menu"
            className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-md text-fg-muted hover:bg-slate-50 active:bg-slate-100"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden>
              <path d="M6 6l12 12M6 18L18 6" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
            </svg>
          </button>
        </div>

        {/* Scrollable nav list */}
        <nav className="flex-1 overflow-y-auto p-2">
          <ul className="space-y-1">
            {items.map((item) => {
              const active =
                pathname === item.href ||
                (item.href !== "/" && pathname.startsWith(item.href));
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    className={`flex items-center gap-3 min-h-[48px] px-3 rounded-md text-[14px] transition-colors ${
                      active
                        ? "bg-cyan-50 text-cyan-800 font-medium"
                        : "text-fg hover:bg-slate-50 active:bg-slate-100"
                    }`}
                  >
                    <span className="shrink-0 w-5 h-5 flex items-center justify-center">
                      {item.icon}
                    </span>
                    <span className="flex-1 min-w-0 truncate">{item.label}</span>
                    <ArrowRightIcon />
                  </Link>
                </li>
              );
            })}
          </ul>

          {/* Auth CTA + lang toggle at the bottom */}
          <div className="mt-6 px-3 pb-4 space-y-3">
            {!userEmail ? (
              <Link
                href="/login"
                className="block w-full text-center h-12 leading-[3rem] rounded-md bg-cyan-600 text-white text-[14px] font-medium hover:bg-cyan-700 active:bg-cyan-800"
              >
                {t("login.signin_cta")} →
              </Link>
            ) : (
              <div className="rounded-md border border-border bg-bg-soft p-3">
                <p className="text-[11px] uppercase tracking-wider font-medium text-fg-subtle">
                  Signed in as
                </p>
                <p className="mt-1 text-[13px] font-medium text-fg truncate">
                  {userEmail}
                </p>
              </div>
            )}
            {/* Language toggle — lives in the drawer on mobile so
                it stays 1-tap-away without crowding the top bar. */}
            <div className="flex items-center justify-between rounded-md border border-border bg-bg-soft p-3">
              <span className="text-[12px] uppercase tracking-wider font-medium text-fg-subtle">
                {t("nav.lang") ?? "Language"}
              </span>
              <LangToggle />
            </div>
          </div>
        </nav>
      </div>
    </>
  );
}

// ── Inline icon set (matches the visual language of nav.tsx desktop icons) ──

function CatalogIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="text-slate-600" aria-hidden>
      <rect x="3" y="3" width="7" height="7" rx="1" />
      <rect x="14" y="3" width="7" height="7" rx="1" />
      <rect x="3" y="14" width="7" height="7" rx="1" />
      <rect x="14" y="14" width="7" height="7" rx="1" />
    </svg>
  );
}

function HowIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="text-slate-600" aria-hidden>
      <circle cx="12" cy="12" r="9" />
      <path d="M9.5 9.5a2.5 2.5 0 015 0c0 1.5-2.5 2-2.5 4M12 17.5v.5" />
    </svg>
  );
}

function ShippingIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="text-slate-600" aria-hidden>
      <path d="M1 6h13v11H1zM14 9h5l3 3v5h-8" />
      <circle cx="6" cy="19" r="2" />
      <circle cx="18" cy="19" r="2" />
    </svg>
  );
}

function AboutIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="text-slate-600" aria-hidden>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 8v.5M11 12h1v5" />
    </svg>
  );
}

function ContactIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="text-slate-600" aria-hidden>
      <path d="M21 16.5v2a2 2 0 01-2.2 2 19.8 19.8 0 01-8.6-3 19.5 19.5 0 01-6-6A19.8 19.8 0 011.2 3 2 2 0 013.2 1h2a2 2 0 012 1.7c.1 1 .3 2 .6 3a2 2 0 01-.5 2L6 9a16 16 0 006 6l1.4-1.3a2 2 0 012-.5c1 .3 2 .5 3 .6a2 2 0 011.7 2z" />
    </svg>
  );
}

function BlogIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="text-slate-600" aria-hidden>
      <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7" />
      <path d="M18.5 2.5a2.1 2.1 0 013 3L12 15l-4 1 1-4 9.5-9.5z" />
    </svg>
  );
}

function AccountIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="text-slate-600" aria-hidden>
      <circle cx="12" cy="8" r="4" />
      <path d="M4 21a8 8 0 0116 0" />
    </svg>
  );
}