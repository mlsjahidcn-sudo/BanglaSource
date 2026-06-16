// /components/admin-page.tsx
//
// Phase 16 audit fix: standardized admin page layout.
//
// BEFORE: each admin page built its own wrapper. The three Phase 15c
// client-driven pages (/admin/images, /admin/products/new,
// /admin/discovery) forgot to add left padding, so their content sat
// flush against the sidebar. Server-rendered pages used
// `p-6 md:p-8 max-w-7xl`; client-rendered pages used
// `space-y-6 max-w-3xl` with no padding. Result: 12 admin pages had
// 4 different wrappers, 3 of them broken.
//
// AFTER: <AdminPage> is the single source of truth. All admin pages
// wrap their content in it. The header is a sibling component
// <AdminPageHeader> with the standard eyebrow (e.g. "Catalog") + h1
// (e.g. "Products") + subtitle + optional right-aligned actions.

import type { ReactNode } from "react";

export function AdminPage({
  children,
  size = "default",
  className = "",
}: {
  children: ReactNode;
  size?: "default" | "wide" | "narrow";
  className?: string;
}) {
  // Match the legacy "p-6 md:p-8 max-w-7xl" pattern (default) that
  // the server-rendered admin pages used. "wide" is for /admin/products
  // which uses max-w-[1800px]. "narrow" is for forms.
  const widths = {
    narrow: "max-w-3xl",
    default: "max-w-7xl",
    wide: "max-w-[1800px]",
  };
  return (
    <div className={`p-6 md:p-8 ${widths[size]} ${className}`}>{children}</div>
  );
}

/**
 * Standard admin page header.
 *
 *   eyebrow:    uppercase tracking-wider "Catalog", "Inbound", etc.
 *              paired with a colored dot (matches the section's theme color)
 *   title:      h1 (text-[32px] md:text-[40px], font-semibold, tracking-[-0.02em])
 *   subtitle:   1-2 line context line
 *   actions:    optional right-aligned buttons (rendered after the title)
 */
export function AdminPageHeader({
  eyebrow,
  title,
  subtitle,
  actions,
  dotColor = "cyan",
}: {
  eyebrow: string;
  title: string;
  subtitle?: ReactNode;
  actions?: ReactNode;
  dotColor?: "cyan" | "emerald" | "violet" | "amber" | "rose";
}) {
  // Brand-aligned defaults: cyan is the new accent (per the single-
  // brand-color polish). The other tones map to the semantic palette
  // (emerald = success, amber = warning, red/rose = danger, violet =
  // info) so admin pages can still group by intent.
  const dotClass = {
    cyan: "bg-cyan-600",
    emerald: "bg-emerald-500",
    violet: "bg-violet-500",
    amber: "bg-amber-500",
    rose: "bg-rose-500",
  }[dotColor];
  const eyebrowClass = {
    cyan: "text-cyan-700",
    emerald: "text-emerald-700",
    violet: "text-violet-700",
    amber: "text-amber-700",
    rose: "text-rose-700",
  }[dotColor];
  return (
    <div className="mb-8 pb-6 border-b border-border">
      <div className="flex items-end justify-between gap-4">
        <div className="min-w-0">
          <div className="flex items-center gap-2.5">
            <span
              className={`inline-block w-2 h-2 rounded-full ${dotClass}`}
              aria-hidden
            />
            <p
              className={`text-[11.5px] font-semibold tracking-[0.1em] uppercase ${eyebrowClass}`}
            >
              {eyebrow}
            </p>
          </div>
          <h1 className="mt-3 text-[32px] md:text-[40px] leading-[1.05] font-semibold tracking-[-0.02em]">
            {title}
          </h1>
          {subtitle && (
            <p className="mt-3 text-[14px] text-fg-muted max-w-2xl leading-relaxed">
              {subtitle}
            </p>
          )}
        </div>
        {actions && <div className="flex items-center gap-2 shrink-0">{actions}</div>}
      </div>
    </div>
  );
}
