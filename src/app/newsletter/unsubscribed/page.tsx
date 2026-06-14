// /newsletter/unsubscribed
//
// Phase 20: landing page after /api/newsletter/unsubscribe.

import Link from "next/link";

type Status = "ok" | "invalid" | "error" | "rate_limited";

const COPY: Record<Status, { title: string; body: string; tone: "ok" | "warn" }> = {
  ok: {
    title: "You've been unsubscribed.",
    body: "You won't get any more newsletter emails from us. Sorry to see you go — you can re-subscribe anytime from the footer.",
    tone: "ok",
  },
  invalid: {
    title: "This link isn't valid.",
    body: "It may have already been used. You can unsubscribe from the link in any past email we sent, or just ignore this — the next email won't come anyway.",
    tone: "warn",
  },
  rate_limited: {
    title: "Slow down a moment.",
    body: "Too many requests. Try again in a minute.",
    tone: "warn",
  },
  error: {
    title: "Something went wrong.",
    body: "We couldn't process your unsubscribe just now. Try the link in the next newsletter, or hit us on WhatsApp.",
    tone: "warn",
  },
};

export default async function NewsletterUnsubscribedPage({
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
          c.tone === "ok" ? "border-l-emerald-500" : "border-l-amber-500"
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
            Back to BanglaSource
          </Link>
        </div>
      </div>
    </div>
  );
}
