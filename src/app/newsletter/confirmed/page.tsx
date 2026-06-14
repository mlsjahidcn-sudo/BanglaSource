// /newsletter/confirmed
//
// Phase 20: landing page after /api/newsletter/confirm. Shows
// one of several states (ok, already, invalid, error,
// unsubscribed) based on a `?status=` query. Public, no auth.

import { useLang } from "@/lib/i18n";
import Link from "next/link";

type Status = "ok" | "already" | "invalid" | "error" | "unsubscribed";

const COPY: Record<
  Status,
  { title: string; body: string; tone: "ok" | "neutral" | "warn" }
> = {
  ok: {
    title: "You're in. Welcome to the newsletter.",
    body: "We'll send new arrivals, price drops, and bulk-deal alerts. No spam, no third-party sharing, unsubscribe anytime.",
    tone: "ok",
  },
  already: {
    title: "Already on the list.",
    body: "Your email is already confirmed. Nothing more to do.",
    tone: "neutral",
  },
  invalid: {
    title: "This link isn't valid.",
    body: "It may have already been used, or it expired. Subscribe again to get a fresh confirmation link.",
    tone: "warn",
  },
  unsubscribed: {
    title: "This link is no longer active.",
    body: "You've unsubscribed from this list. Sign up again below to receive future emails.",
    tone: "neutral",
  },
  error: {
    title: "Something went wrong on our end.",
    body: "We couldn't confirm your subscription just now. Try again in a few minutes, or hit us on WhatsApp.",
    tone: "warn",
  },
};

export default async function NewsletterConfirmedPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const sp = await searchParams;
  const status = (sp.status as Status) ?? "ok";
  const c = COPY[status] ?? COPY.invalid;
  return (
    <div className="mx-auto max-w-xl px-6 py-24">
      <div
        className={`card p-8 text-center border-l-4 ${
          c.tone === "ok"
            ? "border-l-emerald-500"
            : c.tone === "warn"
              ? "border-l-amber-500"
              : "border-l-border"
        }`}
      >
        <h1 className="text-[24px] font-semibold tracking-[-0.01em]">
          {c.title}
        </h1>
        <p className="mt-3 text-[14px] text-fg-muted leading-relaxed">
          {c.body}
        </p>
        <div className="mt-6 flex items-center justify-center gap-3">
          <Link
            href="/"
            className="h-9 px-4 inline-flex items-center rounded-md bg-cyan-600 text-white text-[13px] font-medium hover:bg-cyan-700"
          >
            Browse the catalog
          </Link>
          {status === "invalid" && (
            <Link
              href="/#newsletter"
              className="h-9 px-3 inline-flex items-center text-[12.5px] text-fg-muted hover:text-fg"
            >
              Sign up again →
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}
