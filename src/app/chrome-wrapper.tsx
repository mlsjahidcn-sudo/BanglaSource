"use client";
import { usePathname } from "next/navigation";
import { Nav } from "@/components/nav";
import { Footer } from "@/components/footer";
import { PageViewTracker } from "@/components/page-view-tracker";
import { ToastMount } from "@/components/toast-mount";
import { type ReactNode } from "react";

/**
 * Wraps the root layout content. Hides the public Nav + Footer on:
 *   - portal routes (/admin/*, /buyer/*) — portals have their own
 *     sidebar + topbar shells
 *   - /login — auth pages need a chrome-less full-height split-pane
 *     layout (Phase 46 + Phase 47). Showing the marketing top-nav on
 *     /login competes with the in-page brand panel and dilutes focus.
 */
export function ChromeWrapper({ children }: { children: ReactNode }) {
  const pathname = usePathname() ?? "";
  const isPortal =
    pathname.startsWith("/admin") || pathname.startsWith("/buyer");
  const isAuth = pathname === "/login" || pathname.startsWith("/login/");
  if (isPortal || isAuth) {
    // No Nav, no Footer, no PageViewTracker (portals + auth are private;
    // no analytics pollution from internal browsing). Toasts still work.
    return (
      <>
        {children}
        <ToastMount />
      </>
    );
  }
  return (
    <>
      <PageViewTracker />
      <Nav />
      <main id="main-content" tabIndex={-1} className="flex-1">{children}</main>
      <Footer />
      <ToastMount />
    </>
  );
}
