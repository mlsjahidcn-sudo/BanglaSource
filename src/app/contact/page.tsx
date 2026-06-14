"use client";
// /contact — wired contact form (Phase 24).
//
// The form posts to /api/contact (which inserts into
// public.contact_messages and emails ops). On
// success, we show a thank-you with a "Send another"
// button. On failure, we surface the server-side
// error message (already i18n-friendly: most errors
// are short and self-explanatory).
//
// The contact info (WhatsApp, email, address, hours)
// is read from /lib/contact.ts so the brand
// constants live in one place.

import { useState } from "react";
import { Container } from "@/components/ui/container";
import { BRAND, whatsappLink } from "@/lib/contact";

type FieldErrors = Partial<Record<"name" | "phone" | "email" | "message", string>>;

export default function ContactPage() {
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [company, setCompany] = useState("");
  const [message, setMessage] = useState("");
  const [errors, setErrors] = useState<FieldErrors>({});
  const [topError, setTopError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [sent, setSent] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setTopError(null);
    setErrors({});
    // Light client-side validation so the user
    // doesn't have to round-trip for obvious issues.
    const next: FieldErrors = {};
    if (name.trim().length < 2) next.name = "Name is required.";
    if (phone.trim().length < 4) next.phone = "Phone is required.";
    if (email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()))
      next.email = "Enter a valid email or leave it empty.";
    if (message.trim().length < 10) next.message = "Tell us a bit more (≥10 chars).";
    if (Object.keys(next).length > 0) {
      setErrors(next);
      return;
    }
    setSubmitting(true);
    try {
      const r = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          phone: phone.trim(),
          email: email.trim() || undefined,
          company: company.trim() || undefined,
          message: message.trim(),
          source: "contact-page",
        }),
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) {
        setTopError(j.message ?? j.error ?? `HTTP ${r.status}`);
        return;
      }
      setSent(true);
    } catch (e) {
      setTopError((e as Error).message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Container className="pt-16 md:pt-20 pb-24">
      <div className="grid lg:grid-cols-12 gap-12">
        <div className="lg:col-span-5">
          <p className="text-[12px] font-medium tracking-wider uppercase text-emerald-700">
            Contact
          </p>
          <h1 className="mt-3 text-[40px] md:text-[48px] leading-[1.05] font-semibold tracking-[-0.02em]">
            Talk to us
          </h1>
          <p className="mt-4 text-[16px] text-fg-muted max-w-md leading-relaxed">
            We answer in Bangla or English. WhatsApp is
            fastest — same desk, same number whether
            you tap the button on a product or write
            from this page.
          </p>

          <div className="mt-10 space-y-7 text-[14px]">
            <div>
              <p className="text-[11px] text-fg-subtle uppercase tracking-wider font-medium">
                WhatsApp
              </p>
              <a
                href={whatsappLink(
                  "Hi BanglaSource, I'd like to talk to a sourcing specialist.",
                )}
                target="_blank"
                rel="noreferrer"
                className="mt-1.5 inline-block text-[15px] font-medium hover:text-emerald-700 font-mono tnum"
              >
                {BRAND.whatsappDisplay}
              </a>
            </div>
            <div>
              <p className="text-[11px] text-fg-subtle uppercase tracking-wider font-medium">
                Email
              </p>
              <a
                href={`mailto:${BRAND.email}`}
                className="mt-1.5 inline-block text-[15px] font-medium hover:text-emerald-700"
              >
                {BRAND.email}
              </a>
            </div>
            <div>
              <p className="text-[11px] text-fg-subtle uppercase tracking-wider font-medium">
                Phone
              </p>
              <a
                href={`tel:${BRAND.phoneBdE164}`}
                className="mt-1.5 inline-block text-[15px] font-medium hover:text-emerald-700 font-mono tnum"
              >
                {BRAND.phoneBdDisplay}
              </a>
            </div>
            <div>
              <p className="text-[11px] text-fg-subtle uppercase tracking-wider font-medium">
                Address
              </p>
              <p className="mt-1.5 text-fg-muted leading-relaxed">
                {BRAND.address.map((line, i) => (
                  <span key={i}>
                    {line}
                    {i < BRAND.address.length - 1 && <br />}
                  </span>
                ))}
              </p>
            </div>
            <div>
              <p className="text-[11px] text-fg-subtle uppercase tracking-wider font-medium">
                Hours
              </p>
              <p className="mt-1.5 text-fg-muted leading-relaxed">
                {BRAND.hours}
                <br />
                <span className="text-fg-subtle">{BRAND.hoursCn}</span>
              </p>
            </div>
          </div>
        </div>

        <div className="lg:col-span-7">
          <div className="card p-7 md:p-10">
            {sent ? (
              <div className="py-12 text-center" role="status" aria-live="polite">
                <div className="inline-flex w-12 h-12 items-center justify-center rounded-full bg-emerald-50 text-emerald-600">
                  <svg width="22" height="22" viewBox="0 0 22 22" fill="none">
                    <path
                      d="M5 11.5L9 15.5L17 7.5"
                      stroke="currentColor"
                      strokeWidth="1.6"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </div>
                <h2 className="mt-5 text-[22px] font-semibold tracking-tight">
                  Message sent
                </h2>
                <p className="mt-2 text-fg-muted max-w-sm mx-auto">
                  We&apos;ll get back to you within one
                  business day via the phone number you
                  provided. For something urgent, WhatsApp
                  is faster.
                </p>
                <a
                  href={whatsappLink()}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-5 inline-flex h-9 px-4 items-center text-[13px] font-medium rounded-md bg-emerald-600 text-white hover:bg-emerald-700"
                >
                  Open WhatsApp
                </a>
                <button
                  type="button"
                  onClick={() => {
                    setSent(false);
                    setName("");
                    setPhone("");
                    setEmail("");
                    setCompany("");
                    setMessage("");
                  }}
                  className="mt-6 block mx-auto text-[13px] font-medium text-fg-muted hover:text-fg"
                >
                  Send another message
                </button>
              </div>
            ) : (
              <form onSubmit={onSubmit} className="space-y-5" noValidate>
                {topError && (
                  <div
                    className="text-[12.5px] text-rose-700 bg-rose-50 border border-rose-200 rounded-md p-2.5"
                    role="alert"
                  >
                    {topError}
                  </div>
                )}
                <div className="grid sm:grid-cols-2 gap-5">
                  <Field label="Full name" required error={errors.name}>
                    <input
                      required
                      type="text"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      className="w-full h-11 px-3.5 border border-border rounded-md focus:border-emerald-600 focus:outline-none"
                    />
                  </Field>
                  <Field label="Phone (BD mobile)" required error={errors.phone}>
                    <input
                      required
                      type="tel"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      placeholder="01XXX-XXXXXX"
                      className="w-full h-11 px-3.5 border border-border rounded-md focus:border-emerald-600 focus:outline-none font-mono tnum"
                    />
                  </Field>
                </div>
                <Field label="Email (optional)" error={errors.email}>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full h-11 px-3.5 border border-border rounded-md focus:border-emerald-600 focus:outline-none"
                  />
                </Field>
                <Field label="Shop / company name">
                  <input
                    type="text"
                    value={company}
                    onChange={(e) => setCompany(e.target.value)}
                    className="w-full h-11 px-3.5 border border-border rounded-md focus:border-emerald-600 focus:outline-none"
                  />
                </Field>
                <Field label="What are you sourcing?" required error={errors.message}>
                  <textarea
                    required
                    rows={4}
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    placeholder="e.g. TWS earbuds, 200 pcs, 4 colors, want to ship by mid-July"
                    className="w-full p-3.5 border border-border rounded-md focus:border-emerald-600 focus:outline-none resize-none"
                  />
                </Field>
                <div className="pt-2">
                  <button
                    type="submit"
                    disabled={submitting}
                    className="h-11 px-5 rounded-md bg-cyan-600 text-white text-[14px] font-medium hover:bg-cyan-700 disabled:opacity-50"
                  >
                    {submitting ? "Sending…" : "Send message"}
                  </button>
                  <p className="mt-3 text-[11px] text-fg-subtle">
                    By submitting you agree to our privacy
                    policy. We&apos;ll only contact you about
                    your inquiry.
                  </p>
                </div>
              </form>
            )}
          </div>
        </div>
      </div>
    </Container>
  );
}

function Field({
  label,
  required,
  error,
  children,
}: {
  label: string;
  required?: boolean;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="text-[12px] text-fg-subtle uppercase tracking-wider font-medium">
        {label}
        {required && <span className="text-emerald-600 ml-1">*</span>}
      </span>
      <div className="mt-2">{children}</div>
      {error && (
        <span className="mt-1.5 block text-[11.5px] text-rose-600">
          {error}
        </span>
      )}
    </label>
  );
}
