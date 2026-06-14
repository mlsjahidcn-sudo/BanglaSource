// /admin/rfqs/[id]
//
// Phase 22: admin RFQ detail + quote form.
//
// Server-rendered header (RFQ metadata + buyer profile +
// spec) + a client form for the quote payload (price, MOQ,
// lead days, notes). Form posts to PATCH /api/admin/rfqs/[id].

import Link from "next/link";
import { notFound } from "next/navigation";
import { requireAdmin } from "@/lib/portal-auth";
import { getServiceRoleClient } from "@/lib/supabase/server";
import { AdminPage } from "@/components/admin-page";
import { RFQQuoteForm } from "./_client";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type RFQStatus = "open" | "quoted" | "accepted" | "rejected" | "cancelled";

type RFQRow = {
  id: number;
  user_id: string;
  title: string;
  spec_text: string;
  target_qty: number;
  target_price_cny_fen: number | null;
  image_urls: string[];
  destination_country: string;
  notes: string | null;
  status: RFQStatus;
  quoted_price_cny_fen: number | null;
  quoted_min_qty: number | null;
  quoted_lead_days: number | null;
  quoted_notes: string | null;
  quoted_at: string | null;
  closed_at: string | null;
  admin_owner_id: string | null;
  created_at: string;
  updated_at: string;
};

export default async function AdminRFQDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireAdmin("/admin/rfqs");
  const { id } = await params;
  const rfqId = Number(id);
  if (!Number.isInteger(rfqId) || rfqId <= 0) notFound();

  const sb = getServiceRoleClient();
  const { data: rfq, error } = await sb
    .from("rfqs")
    .select(
      "id, user_id, title, spec_text, target_qty, target_price_cny_fen, image_urls, destination_country, notes, status, quoted_price_cny_fen, quoted_min_qty, quoted_lead_days, quoted_notes, quoted_at, closed_at, admin_owner_id, created_at, updated_at",
    )
    .eq("id", rfqId)
    .maybeSingle();
  if (error || !rfq) notFound();

  const r = rfq as RFQRow;

  // Two-step profile lookup (orders.user_id has no FK to
  // profiles — same gotcha as the orders admin page).
  const { data: profile } = await sb
    .from("profiles")
    .select("email, full_name, phone, company, country")
    .eq("id", r.user_id)
    .maybeSingle();

  const num = `RFQ-${String(r.id).padStart(6, "0")}`;
  const isOpen = r.status === "open";

  return (
    <AdminPage>
      <div className="flex items-center gap-2 text-[12px] text-fg-muted mb-3">
        <Link href="/admin/rfqs" className="hover:text-fg">
          RFQs
        </Link>
        <span>/</span>
        <span className="font-mono">{num}</span>
      </div>

      <div className="flex items-start justify-between gap-6 flex-wrap">
        <div className="min-w-0 flex-1">
          <p className="text-[12px] font-medium tracking-wider uppercase text-fg-subtle">
            Inbound · RFQ
          </p>
          <h1 className="mt-2 text-[28px] md:text-[36px] leading-[1.05] font-semibold tracking-[-0.02em]">
            {r.title}
          </h1>
          <p className="mt-2 text-[12.5px] text-fg-muted">
            Submitted{" "}
            {new Date(r.created_at).toLocaleString("en-GB", {
              day: "numeric",
              month: "short",
              year: "numeric",
              hour: "2-digit",
              minute: "2-digit",
            })}{" "}
            · {r.destination_country}
          </p>
        </div>
        <div className="flex flex-col items-end gap-1.5">
          <span
            className={`text-[11px] font-medium tracking-wider uppercase px-2 py-1 border rounded ${
              r.status === "open"
                ? "border-cyan-200 bg-cyan-50 text-cyan-800"
                : r.status === "quoted"
                  ? "border-violet-200 bg-violet-50 text-violet-800"
                  : r.status === "accepted"
                    ? "border-emerald-200 bg-emerald-50 text-emerald-800"
                    : r.status === "rejected"
                      ? "border-amber-200 bg-amber-50 text-amber-800"
                      : "border-border bg-bg-soft text-fg-muted"
            }`}
          >
            {r.status.toUpperCase()}
          </span>
        </div>
      </div>

      <div className="mt-8 grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left: spec + images + buyer */}
        <div className="lg:col-span-7 space-y-6">
          <section className="card p-6">
            <h2 className="text-[14px] font-semibold">Spec</h2>
            <pre className="mt-3 whitespace-pre-wrap text-[13px] leading-relaxed text-fg font-sans">
              {r.spec_text}
            </pre>
            {r.image_urls.length > 0 && (
              <div className="mt-4 grid grid-cols-2 sm:grid-cols-4 gap-2">
                {r.image_urls.map((u, i) => (
                  <a
                    key={i}
                    href={u}
                    target="_blank"
                    rel="noreferrer"
                    className="block aspect-square rounded-md border border-border overflow-hidden bg-bg-soft hover:border-cyan-400"
                  >
                    <img
                      src={u}
                      alt={`Reference ${i + 1}`}
                      className="w-full h-full object-cover"
                      loading="lazy"
                    />
                  </a>
                ))}
              </div>
            )}
          </section>

          {r.notes && (
            <section className="card p-6">
              <h2 className="text-[14px] font-semibold">Buyer notes</h2>
              <pre className="mt-3 whitespace-pre-wrap text-[13px] leading-relaxed text-fg font-sans">
                {r.notes}
              </pre>
            </section>
          )}

          <section className="card p-6">
            <h2 className="text-[14px] font-semibold">Buyer</h2>
            <dl className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-3 text-[13px]">
              <Row label="Name" value={profile?.full_name ?? "—"} />
              <Row
                label="Email"
                value={
                  profile?.email ? (
                    <a
                      href={`mailto:${profile.email}`}
                      className="text-cyan-700 hover:underline"
                    >
                      {profile.email}
                    </a>
                  ) : (
                    "—"
                  )
                }
              />
              <Row label="Phone" value={profile?.phone ?? "—"} />
              <Row label="Company" value={profile?.company ?? "—"} />
              <Row
                label="RFQ history"
                value={
                  <Link
                    href={`/admin/orders?buyer_email=${encodeURIComponent(profile?.email ?? "")}`}
                    className="text-cyan-700 hover:underline"
                  >
                    All RFQs from this buyer →
                  </Link>
                }
              />
            </dl>
          </section>
        </div>

        {/* Right: target + quote form */}
        <div className="lg:col-span-5 space-y-6">
          <section className="card p-6">
            <h2 className="text-[14px] font-semibold">Buyer's target</h2>
            <dl className="mt-3 grid grid-cols-2 gap-3 text-[13px]">
              <Row label="Quantity" value={r.target_qty.toLocaleString()} mono />
              <Row
                label="Target FOB / unit"
                value={
                  r.target_price_cny_fen
                    ? `¥${(r.target_price_cny_fen / 100).toFixed(2)}`
                    : "—"
                }
                mono
              />
            </dl>
          </section>

          <section className="card p-6">
            <h2 className="text-[14px] font-semibold">Factory quote</h2>
            {isOpen ? (
              <p className="mt-2 text-[12px] text-fg-muted">
                Set the factory FOB, MOQ, and lead time below to
                send a quote. The buyer gets an email and can
                accept from /buyer/rfqs.
              </p>
            ) : (
              <div className="mt-3">
                {r.quoted_price_cny_fen && (
                  <p className="text-[22px] font-semibold font-mono">
                    ¥{(r.quoted_price_cny_fen / 100).toFixed(2)}{" "}
                    <span className="text-[12px] text-fg-muted font-normal">/ unit</span>
                  </p>
                )}
                <p className="mt-1 text-[12.5px] text-fg-muted">
                  MOQ {r.quoted_min_qty?.toLocaleString() ?? "—"} · Lead{" "}
                  {r.quoted_lead_days ?? "—"} days
                </p>
                {r.quoted_at && (
                  <p className="mt-1 text-[11.5px] text-fg-subtle">
                    Quoted{" "}
                    {new Date(r.quoted_at).toLocaleString("en-GB", {
                      day: "numeric",
                      month: "short",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </p>
                )}
                {r.quoted_notes && (
                  <pre className="mt-3 whitespace-pre-wrap text-[12.5px] leading-relaxed text-fg font-sans bg-bg-soft rounded-md p-3">
                    {r.quoted_notes}
                  </pre>
                )}
              </div>
            )}
            <div className="mt-4">
              <RFQQuoteForm
                rfqId={r.id}
                disabled={!isOpen}
                initialPriceCny={r.quoted_price_cny_fen}
                initialMinQty={r.quoted_min_qty}
                initialLeadDays={r.quoted_lead_days}
                initialNotes={r.quoted_notes}
              />
            </div>
          </section>
        </div>
      </div>
    </AdminPage>
  );
}

function Row({
  label,
  value,
  mono,
}: {
  label: string;
  value: React.ReactNode;
  mono?: boolean;
}) {
  return (
    <div>
      <dt className="text-[10.5px] uppercase tracking-wider text-fg-subtle font-medium">
        {label}
      </dt>
      <dd className={`mt-0.5 text-[13px] ${mono ? "font-mono" : ""}`}>{value}</dd>
    </div>
  );
}
