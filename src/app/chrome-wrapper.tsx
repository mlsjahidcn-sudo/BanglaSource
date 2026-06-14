"use client";
import { usePathname } from "next/navigation";
import { Nav } from "@/components/nav";
import { Footer } from "@/components/footer";
import { PageViewTracker } from "@/components/page-view-tracker";
import { ToastMount } from "@/components/toast-mount";
import { type ReactNode } from "react";

/**
 * Wraps the root layout content. Hides the public Nav + Footer on
 * portal routes (/admin/*, /buyer/*) because the portals have their
 * own sidebar + topbar shells.
 */
export function ChromeWrapper({ children }: { children: ReactNode }) {
  const pathname = usePathname() ?? "";
  const isPortal =
    pathname.startsWith("/admin") || pathname.startsWith("/buyer");
  if (isPortal) {
    // No Nav, no Footer, no PageViewTracker (portals are private; no analytics
    // pollution from /admin/* browsing). Toasts still work.
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
