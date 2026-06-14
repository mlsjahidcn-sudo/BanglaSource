"use client";
/**
 * PortalShell — the full-screen shell used by /admin/* and /buyer/*.
 *
 * Layout:
 *   - Left: 64px icon rail (always visible)
 *   - Left: 0 or 240px full sidebar (toggleable via Cmd+B / hamburger)
 *   - Top: 56px top bar with breadcrumbs, search, user menu
 *   - Main: the page content
 *
 * No public Nav / Footer. Full-screen app feel.
 */

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, useEffect, useCallback, type ReactNode } from "react";
import { cn } from "@/lib/utils";

export type NavGroup = {
  label: string;
  items: NavItem[];
};
export type NavItem = {
  label: string;
  href: string;
  icon: ReactNode;
  badge?: string | number;
  exact?: boolean;
};

type User = {
  email: string;
  fullName: string | null;
  isAdmin: boolean;
} | null;

export function PortalShell({
  brand,
  groups,
  user,
  switchToHref,
  switchToLabel,
  children,
  topbar,
}: {
  brand: string;
  groups: NavGroup[];
  user: User;
  switchToHref?: string;
  switchToLabel?: string;
  children: ReactNode;
  topbar?: ReactNode;
}) {
  const pathname = usePathname();
  const [expanded, setExpanded] = useState(true);

  // Cmd/Ctrl + B to toggle the sidebar
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "b") {
        e.preventDefault();
        setExpanded((v) => !v);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const railWidth = 64;
  const fullWidth = 256;
  const sidebarWidth = expanded ? fullWidth : railWidth;

  return (
    <div className="h-screen w-screen flex flex-col bg-bg text-fg overflow-hidden">
      <div className="flex flex-1 min-h-0">
        {/* ───────────────────  SIDEBAR  ─────────────────── */}
        <aside
          className="shrink-0 border-r border-border bg-bg-soft flex flex-col transition-[width] duration-200"
          style={{ width: sidebarWidth }}
        >
          {/* Brand row */}
          <div
            className={cn(
              "h-14 flex items-center border-b border-border shrink-0",
              expanded ? "px-4" : "px-0 justify-center",
            )}
          >
            <Link
              href="/"
              className={cn(
                "flex items-center gap-2.5 group",
                expanded ? "" : "justify-center",
              )}
            >
              <div
                className={cn(
                  "w-8 h-8 rounded-md bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-emerald-700 font-semibold text-[14px] shrink-0",
                )}
              >
                BS
              </div>
              {expanded && (
                <div className="min-w-0">
                  <p className="text-[13px] font-semibold tracking-tight leading-none truncate">
                    {brand}
                  </p>
                  <p className="text-[10px] text-fg-subtle tracking-wider uppercase mt-0.5">
                    {switchToHref ? "Portal" : "BanglaSource"}
                  </p>
                </div>
              )}
            </Link>
          </div>

          {/* Toggle button (only shown when expanded so the rail is self-contained) */}
          {expanded && (
            <button
              onClick={() => setExpanded(false)}
              className="absolute mt-2 ml-[228px] z-10 w-6 h-6 rounded-full bg-bg border border-border hover:bg-bg-soft hidden lg:flex items-center justify-center text-fg-muted"
              aria-label="Collapse sidebar"
              title="Collapse (⌘B)"
            >
              <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                <path
                  d="M6 2L3 5l3 3"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </button>
          )}

          {/* Nav groups */}
          <nav className="flex-1 overflow-y-auto py-3 px-2">
            {groups.map((group, gi) => (
              <div key={group.label} className={gi > 0 ? "mt-5" : ""}>
                {expanded && (
                  <p className="text-[10px] uppercase tracking-wider text-fg-subtle font-medium px-2 mb-1.5">
                    {group.label}
                  </p>
                )}
                <ul className="space-y-0.5">
                  {group.items.map((item) => {
                    const active = isActive(pathname, item.href, item.exact);
                    return (
                      <li key={item.href}>
                        <Link
                          href={item.href}
                          className={cn(
                            "flex items-center gap-2.5 rounded-md h-9 px-2.5 text-[13px] transition-colors group",
                            expanded ? "" : "justify-center",
                            active
                              ? "bg-emerald-500/10 text-emerald-800 font-medium"
                              : "text-fg-muted hover:bg-bg hover:text-fg",
                          )}
                          title={!expanded ? item.label : undefined}
                        >
                          <span
                            className={cn(
                              "shrink-0 w-5 h-5 flex items-center justify-center",
                              active
                                ? "text-emerald-700"
                                : "text-fg-subtle group-hover:text-fg-muted",
                            )}
                          >
                            {item.icon}
                          </span>
                          {expanded && (
                            <>
                              <span className="truncate flex-1">
                                {item.label}
                              </span>
                              {item.badge != null && (
                                <span
                                  className={cn(
                                    "text-[10px] font-mono px-1.5 py-0.5 rounded",
                                    active
                                      ? "bg-emerald-500/20 text-emerald-800"
                                      : "bg-bg-soft text-fg-muted",
                                  )}
                                >
                                  {item.badge}
                                </span>
                              )}
                            </>
                          )}
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              </div>
            ))}
          </nav>

          {/* Footer: switch portal + user */}
          <div className="border-t border-border p-2 shrink-0">
            {switchToHref && expanded && (
              <Link
                href={switchToHref}
                className="flex items-center gap-2.5 rounded-md h-9 px-2.5 text-[13px] text-fg-muted hover:bg-bg hover:text-fg transition-colors"
              >
                <span className="w-5 h-5 flex items-center justify-center text-fg-subtle">
                  <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                    <path
                      d="M2 4h10M2 7h10M2 10h6"
                      stroke="currentColor"
                      strokeWidth="1.4"
                      strokeLinecap="round"
                    />
                  </svg>
                </span>
                <span className="truncate">{switchToLabel}</span>
              </Link>
            )}
            {expanded ? (
              <UserPanel user={user} />
            ) : (
              <button
                onClick={() => setExpanded(true)}
                className="w-full h-9 flex items-center justify-center text-fg-subtle hover:text-fg"
                aria-label="Expand sidebar"
                title="Expand (⌘B)"
              >
                <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                  <path
                    d="M4 2l3 4-3 4"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </button>
            )}
          </div>
        </aside>

        {/* ───────────────────  MAIN  ─────────────────── */}
        <div className="flex-1 flex flex-col min-w-0">
          {/* Top bar */}
          <header className="h-14 border-b border-border bg-bg flex items-center px-5 shrink-0 gap-3">
            {topbar}
          </header>
          {/* Page content — id matches the skip-link target
              in /app/layout.tsx so the skip-nav lands here. */}
          <main id="main-content" tabIndex={-1} className="flex-1 overflow-y-auto">{children}</main>
        </div>
      </div>
    </div>
  );
}

function isActive(pathname: string, href: string, exact?: boolean) {
  if (exact) return pathname === href;
  return pathname === href || pathname.startsWith(href + "/");
}

function UserPanel({ user }: { user: User }) {
  const [open, setOpen] = useState(false);
  const close = useCallback(() => setOpen(false), []);
  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      const t = e.target as HTMLElement | null;
      if (t && !t.closest("[data-user-menu]")) close();
    };
    document.addEventListener("click", onClick);
    return () => document.removeEventListener("click", onClick);
  }, [open, close]);
  return (
    <div className="relative" data-user-menu>
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center gap-2.5 rounded-md h-10 px-2 text-[12px] hover:bg-bg transition-colors"
      >
        <div className="w-6 h-6 rounded-full bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-emerald-700 text-[10px] font-semibold">
          {(user?.fullName ?? user?.email ?? "?")
            .split(/\s+/)
            .map((s) => s[0])
            .slice(0, 2)
            .join("")
            .toUpperCase()}
        </div>
        <div className="flex-1 min-w-0 text-left">
          <p className="font-medium truncate leading-none">
            {user?.fullName ?? user?.email ?? "Signed in"}
          </p>
          <p className="text-[10px] text-fg-subtle mt-1 truncate">
            {user?.isAdmin ? "Admin" : "Buyer"} · {user?.email}
          </p>
        </div>
        <svg
          width="10"
          height="10"
          viewBox="0 0 10 10"
          fill="none"
          className="text-fg-subtle shrink-0"
        >
          <path
            d="M2 4l3 3 3-3"
            stroke="currentColor"
            strokeWidth="1.4"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </button>
      {open && (
        <div
          className="absolute bottom-12 left-2 right-2 card p-1 z-50"
          data-user-menu
        >
          <Link
            href="/buyer/profile"
            className="block px-2.5 py-1.5 text-[12px] rounded hover:bg-bg-soft"
            onClick={close}
          >
            Profile
          </Link>
          <Link
            href="/buyer/settings"
            className="block px-2.5 py-1.5 text-[12px] rounded hover:bg-bg-soft"
            onClick={close}
          >
            Settings
          </Link>
          <div className="my-1 border-t border-border" />
          <form action="/api/auth/signout" method="post">
            <button
              type="submit"
              className="w-full text-left px-2.5 py-1.5 text-[12px] rounded hover:bg-bg-soft text-rose-600"
            >
              Sign out
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
