"use client";
// /components/newsletter-signup.tsx
//
// Phase 20: email capture for the "best weekly deals" newsletter.
// Double opt-in flow (the gold standard for deliverability):
//   1. User pastes email + clicks Subscribe.
//   2. /api/newsletter/subscribe stores the email with a fresh
//      confirm_token and emails a one-click confirmation link.
//   3. User clicks → /api/newsletter/confirm flips confirmed_at.
//   4. Only confirmed rows are eligible for the weekly campaign.
//
// The success message tells the user to check their inbox —
// this is the whole point of the double opt-in.

import { useState } from "react";

type Status = "idle" | "submitting" | "ok" | "error";

export function NewsletterSignup() {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<Status>("idle");
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (status === "submitting") return;
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setError("Please enter a valid email address.");
      return;
    }
    setStatus("submitting");
    setError(null);
    try {
      const r = await fetch("/api/newsletter/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      if (!r.ok) {
        const j = await r.json().catch(() => ({}));
        throw new Error(j.error ?? "Could not subscribe right now.");
      }
      // Keep the email visible in the success card so the user
      // knows which inbox to check. They can clear it manually
      // by typing a new one.
      setStatus("ok");
    } catch (e) {
      setStatus("error");
      setError((e as Error).message);
    }
  }

  return (
    <div className="grid md:grid-cols-2 gap-8 items-center">
      <div>
        <p className="text-[11px] text-fg-subtle uppercase tracking-wider font-medium">
          Weekly digest
        </p>
        <h2 className="mt-1 text-[26px] font-semibold tracking-[-0.01em]">
          The 5 best wholesale deals, every Sunday
        </h2>
        <p className="mt-2 text-[14px] text-fg-muted max-w-md">
          We hand-pick the top factory deals, the biggest price
          drops, and the most popular picks from the last 7 days.
          No spam, unsubscribe anytime.
        </p>
        <ul className="mt-4 space-y-1.5 text-[13px] text-fg-muted">
          <li className="flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
            Top 5 factory deals
          </li>
          <li className="flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
            Biggest price drops (15%+)
          </li>
          <li className="flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
            One Bangladesh-relevant tip per week
          </li>
        </ul>
      </div>

      <div>
        {status === "ok" ? (
          <div className="card p-6 bg-emerald-50/40 border-emerald-200">
            <p className="text-[14px] font-medium text-emerald-700">
              Check your inbox to confirm.
            </p>
            <p className="mt-1 text-[12.5px] text-fg-muted">
              We sent a confirmation link to <span className="font-mono">{email || "your email"}</span>.
              One click and you're in. (Check spam if it's not there in 2 minutes.)
            </p>
          </div>
        ) : (
          <form onSubmit={submit} className="card p-6">
            <label
              htmlFor="newsletter-email"
              className="text-[11px] text-fg-subtle uppercase tracking-wider font-medium"
            >
              Email address
            </label>
            <div className="mt-2 flex flex-col sm:flex-row gap-2">
              <input
                id="newsletter-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@business.bd"
                required
                className="flex-1 h-11 px-3 border border-border rounded-md text-[14px] focus:border-cyan-600 focus:outline-none"
              />
              <button
                type="submit"
                disabled={status === "submitting"}
                className="h-11 px-5 rounded-md bg-cyan-600 text-white text-[13.5px] font-medium hover:bg-cyan-700 disabled:opacity-50"
              >
                {status === "submitting" ? "Subscribing…" : "Subscribe"}
              </button>
            </div>
            {error && (
              <p className="mt-2 text-[12px] text-rose-600 font-mono">
                {error}
              </p>
            )}
            <p className="mt-2 text-[10.5px] text-fg-subtle">
              We never share your email. See{" "}
              <a href="#" className="underline hover:text-fg">
                privacy policy
              </a>
              .
            </p>
          </form>
        )}
      </div>
    </div>
  );
}
