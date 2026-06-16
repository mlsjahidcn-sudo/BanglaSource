import type { ReactNode } from "react";

/**
 * Badge tone — aligned with the design system.
 *   accent:   brand-cyan (use for promotional tags, "new", "featured")
 *   success:  emerald (verified, online, completed, paid)
 *   warning:  amber  (pending, awaiting action)
 *   danger:   red    (failed, cancelled, refunded)
 *   info:     violet (informational metadata, draft)
 *   neutral:  slate  (low-emphasis labels)
 *   outline:  no-fill, slate border (lowest emphasis)
 */
type Tone = "accent" | "success" | "warning" | "danger" | "info" | "neutral" | "outline";

const tones: Record<Tone, string> = {
  accent:  "bg-cyan-50 text-cyan-700 border border-cyan-200",
  success: "bg-emerald-50 text-emerald-700 border border-emerald-100",
  warning: "bg-amber-50 text-amber-700 border border-amber-100",
  danger:  "bg-red-50 text-red-700 border border-red-100",
  info:    "bg-violet-50 text-violet-700 border border-violet-100",
  neutral: "bg-slate-100 text-slate-700 border border-slate-200",
  outline: "bg-transparent text-fg-muted border border-border",
};

export function Badge({
  tone = "neutral",
  children,
  className = "",
}: {
  tone?: Tone;
  children: ReactNode;
  className?: string;
}) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2 py-0.5 text-[11px] font-medium tracking-wide uppercase rounded-full ${tones[tone]} ${className}`}
    >
      {children}
    </span>
  );
}
