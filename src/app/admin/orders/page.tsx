// /admin/orders
//
// Phase 17: admin order management.
//
// Server-rendered list. Joins profiles for buyer email/name, then
// inner-joins order_items for the row-level summaries (item count,
// first product image, total qty). Sorted by created_at desc.
//
// Filters (all URL query params, server-side):
//   ?status=pending_payment|paid|in_transit|delivered|cancelled
//   ?mode=air|sea
//   ?q=<text search over order_number, buyer email, source_id>
//   ?since=7d|30d|all (default 30d)
//
// Status counts: an extra "Open" row at the top shows the un-acked
// count (paid + pending_payment — the two states that need a human
// to act on).
//
// Every row links to /admin/orders/[id] which is the detail page
// with status-transition controls (built in a separate file).

import Link from "next/link";
import { getServiceRoleClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/portal-auth";
import { AdminPage, AdminPageHeader } from "@/components/admin-page";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type OrderStatus =
  | "pending_payment"
  | "paid"
  | "in_transit"
  | "delivered"
  | "cancelled";

type OrderRow = {
  id: number;
  status: OrderStatus;
  shipping_mode: "air" | "sea";
  product_subtotal_bdt: number;
  shipping_bdt: number;
  duty_bdt: number;
  vat_bdt: number;
  ait_bdt: number;
  total_bdt: number;
  payment_model: "full_prepay" | "deposit_balance";
  paid_at: string | null;
  tracking_number: string | null;
  created_at: string;
  buyer_email: string | null;
  buyer_full_name: string | null;
  item_count: number;
  total_qty: number;
  first_image: string | null;
  first_source_id: string | null;
};

const STATUS_TONE: Record<OrderStatus, string> = {
  pending_payment: "bg-amber-50 text-amber-800 border-amber-200",
  paid: "bg-cyan-50 text-cyan-800 border-cyan-200",
  in_transit: "bg-violet-50 text-violet-800 border-violet-200",
  delivered: "bg-emerald-50 text-emerald-800 border-emerald-200",
  cancelled: "bg-slate-100 text-slate-700 border-slate-200",
};

const STATUS_LABEL: Record<OrderStatus, string> = {
  pending_payment: "Pending payment",
  paid: "Paid",
  in_transit: "In transit",
  delivered: "Delivered",
  cancelled: "Cancelled",
};

function fmtBdt(n: number) {
  return `৳${n.toLocaleString("en-IN")}`;
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleString("en-GB", {
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function fmtOrderNum(id: number) {
  return `BS-${String(id).padStart(6, "0")}`;
}

function sinceIso(range: string): string | null {
  if (range === "all") return null;
  const days = range === "7d" ? 7 : range === "30d" ? 30 : 90;
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
}

export default async function AdminOrdersPage({
  searchParams,
}: {
  searchParams: Promise<{
    status?: string;
    mode?: string;
    q?: string;
    since?: string;
  }>;
}) {
  await requireAdmin("/admin/orders");
  const sp = await searchParams;
  const statusFilter = (sp.status ?? "") as OrderStatus | "";
  const modeFilter = sp.mode ?? "";
  const q = (sp.q ?? "").trim();
  const since = sp.since ?? "30d";

  const sb = getServiceRoleClient();

  // ── Headline counts (all-time, un-filtered) so the top of the
  //    page can show "X open orders to action" regardless of what
  //    the user is currently filtering by.
  const sinceIsoAll = sinceIso(since);
  let baseQuery = sb.from("orders").select("id", { count: "exact", head: true });
  if (sinceIsoAll) baseQuery = baseQuery.gte("created_at", sinceIsoAll);
  const { count: totalCount } = await baseQuery;

  const [pendingC, paidC, transitC, deliveredC, cancelledC, openC] =
    await Promise.all([
      sb
        .from("orders")
        .select("id", { count: "exact", head: true })
        .eq("status", "pending_payment")
        .gte("created_at", sinceIsoAll ?? "1970-01-01"),
      sb
        .from("orders")
        .select("id", { count: "exact", head: true })
        .eq("status", "paid")
        .gte("created_at", sinceIsoAll ?? "1970-01-01"),
      sb
        .from("orders")
        .select("id", { count: "exact", head: true })
        .eq("status", "in_transit")
        .gte("created_at", sinceIsoAll ?? "1970-01-01"),
      sb
        .from("orders")
        .select("id", { count: "exact", head: true })
        .eq("status", "delivered")
        .gte("created_at", sinceIsoAll ?? "1970-01-01"),
      sb
        .from("orders")
        .select("id", { count: "exact", head: true })
        .eq("status", "cancelled")
        .gte("created_at", sinceIsoAll ?? "1970-01-01"),
      sb
        .from("orders")
        .select("id", { count: "exact", head: true })
        .in("status", ["pending_payment", "paid"])
        .gte("created_at", sinceIsoAll ?? "1970-01-01"),
    ]);

  // ── Build the main list query
  //
  // Note: `orders.user_id` is FK to `auth.users(id)`, NOT to
  // `profiles(id)`. Supabase's foreign-key embedded-resource syntax
  // (`profiles!fk_name`) only works when there's an actual FK between
  // the two tables. Since orders → auth.users and profiles → auth.users
  // are two separate relationships, we fetch the user_ids and resolve
  // profiles in a second round-trip.
  let listQuery = sb
    .from("orders")
    .select(
      "id, status, shipping_mode, product_subtotal_bdt, shipping_bdt, duty_bdt, vat_bdt, ait_bdt, total_bdt, payment_model, paid_at, tracking_number, created_at, user_id, order_items(product_id, qty, image_snapshot, position, products(source_id))",
    )
    .order("created_at", { ascending: false })
    .limit(100);
  if (statusFilter && (STATUS_LABEL as Record<string, string>)[statusFilter]) {
    listQuery = listQuery.eq("status", statusFilter);
  }
  if (modeFilter === "air" || modeFilter === "sea") {
    listQuery = listQuery.eq("shipping_mode", modeFilter);
  }
  if (sinceIsoAll) {
    listQuery = listQuery.gte("created_at", sinceIsoAll);
  }
  if (q) {
    // Match order id (so "BS-000123" or "123" both work), or any
    // line-item product source_id. Email is matched post-query
    // (see the profile lookup below) since there's no FK to
    // profiles from orders.
    const qClean = q.replace(/^BS-/i, "");
    const asNum = Number(qClean);
    if (Number.isFinite(asNum) && asNum > 0) {
      listQuery = listQuery.eq("id", Math.floor(asNum));
    } else {
      // No clean way to filter source_id through the joined order_items
      // → products relationship with Supabase's `or` syntax (the
      // nested filter references the local column name, not the
      // foreign table's). So we apply the source_id filter as a
      // post-query step below.
      // First, do an `or` over the local columns that COULD match.
      listQuery = listQuery.or(
        `tracking_number.ilike.%${q}%,internal_note.ilike.%${q}%`,
      );
    }
  }

  const { data: ordersRaw, error: listErr } = await listQuery;
  if (listErr) {
    return (
      <AdminPage>
        <div className="card p-6 text-red-600 text-[13px]">
          Error: {listErr.message}
        </div>
      </AdminPage>
    );
  }

  // Resolve buyer profiles in a second round-trip (orders.user_id is
  // auth.users(id) — there's no FK to public.profiles, so we can't
  // use Supabase's `profiles!fk_name` embedded-resource syntax).
  const userIds = Array.from(
    new Set(((ordersRaw ?? []) as any[]).map((o) => o.user_id as string)),
  );
  const { data: profilesRaw } = userIds.length
    ? await sb
        .from("profiles")
        .select("id, email, full_name")
        .in("id", userIds)
    : { data: [] };
  const profileById = new Map(
    ((profilesRaw ?? []) as any[]).map((p) => [p.id as string, p]),
  );

  // Flatten Supabase's nested array (orders → order_items[] →
  // products (single per item)) into a flat row, plus the resolved
  // buyer profile.
  let orders: OrderRow[] = ((ordersRaw ?? []) as any[]).map((o) => {
    const items = Array.isArray(o.order_items) ? o.order_items : [];
    const sorted = [...items].sort(
      (a, b) => (a.position ?? 0) - (b.position ?? 0),
    );
    const first = sorted[0];
    const profile = profileById.get(o.user_id as string);
    return {
      id: o.id,
      status: o.status,
      shipping_mode: o.shipping_mode,
      product_subtotal_bdt: Number(o.product_subtotal_bdt),
      shipping_bdt: Number(o.shipping_bdt),
      duty_bdt: Number(o.duty_bdt),
      vat_bdt: Number(o.vat_bdt),
      ait_bdt: Number(o.ait_bdt),
      total_bdt: Number(o.total_bdt),
      payment_model: o.payment_model,
      paid_at: o.paid_at,
      tracking_number: o.tracking_number,
      created_at: o.created_at,
      buyer_email: profile?.email ?? null,
      buyer_full_name: profile?.full_name ?? null,
      item_count: items.length,
      total_qty: items.reduce((s, it) => s + (it.qty ?? 0), 0),
      first_image: first?.image_snapshot ?? null,
      first_source_id: first?.products?.source_id ?? null,
    };
  });

  // Post-query filter for q: match buyer email OR any line-item
  // source_id. We can't push this into Supabase's `or` because
  // there's no FK from orders → profiles.
  if (q) {
    const qLower = q.toLowerCase();
    orders = orders.filter((o) => {
      if (o.buyer_email?.toLowerCase().includes(qLower)) return true;
      // We don't have full source_ids for every item in the list
      // shape (only the first). For a search over ALL line items
      // we'd need a second query — defer to detail page for that.
      if (o.first_source_id?.toLowerCase().includes(qLower)) return true;
      return false;
    });
  }

  return (
    <AdminPage size="wide">
      <AdminPageHeader
        eyebrow="Inbound"
        title="Orders"
        dotColor="emerald"
        subtitle="Every order placed on BanglaSource. Click one to change status, add a tracking number, or leave an internal note. Newest first."
        actions={
          <span className="text-[12px] text-fg-muted font-mono tnum">
            {totalCount ?? 0} in window
          </span>
        }
      />

      {/* ── Stat strip ─────────────────────────────────────── */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-px bg-border border border-border rounded-lg overflow-hidden">
        <StatusCard
          label="Open to action"
          value={openC.count ?? 0}
          sub="pending payment + paid"
          href="/admin/orders?status=pending_payment"
        />
        <StatusCard
          label="Pending payment"
          value={pendingC.count ?? 0}
          sub="awaiting buyer wire"
          href="/admin/orders?status=pending_payment"
        />
        <StatusCard
          label="Paid"
          value={paidC.count ?? 0}
          sub="ready to ship"
          href="/admin/orders?status=paid"
        />
        <StatusCard
          label="In transit"
          value={transitC.count ?? 0}
          sub="handed to courier"
          href="/admin/orders?status=in_transit"
        />
        <StatusCard
          label="Delivered"
          value={deliveredC.count ?? 0}
          sub="paid + delivered"
          href="/admin/orders?status=delivered"
        />
      </div>

      {/* ── Filters ─────────────────────────────────────────── */}
      <form
        method="GET"
        className="mt-8 flex flex-wrap items-end gap-3 text-[12.5px]"
      >
        <Field label="Search">
          <input
            type="text"
            name="q"
            defaultValue={q}
            placeholder="Order #, buyer email, or source_id"
            className="h-9 px-3 w-72 rounded-md border border-border bg-bg text-[12.5px] outline-none focus:border-cyan-500"
          />
        </Field>
        <Field label="Status">
          <select
            name="status"
            defaultValue={statusFilter}
            className="h-9 px-3 rounded-md border border-border bg-bg text-[12.5px] outline-none focus:border-cyan-500"
          >
            <option value="">All</option>
            {(Object.keys(STATUS_LABEL) as OrderStatus[]).map((s) => (
              <option key={s} value={s}>
                {STATUS_LABEL[s]}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Mode">
          <select
            name="mode"
            defaultValue={modeFilter}
            className="h-9 px-3 rounded-md border border-border bg-bg text-[12.5px] outline-none focus:border-cyan-500"
          >
            <option value="">Both</option>
            <option value="air">Air</option>
            <option value="sea">Sea</option>
          </select>
        </Field>
        <Field label="Window">
          <select
            name="since"
            defaultValue={since}
            className="h-9 px-3 rounded-md border border-border bg-bg text-[12.5px] outline-none focus:border-cyan-500"
          >
            <option value="7d">Last 7d</option>
            <option value="30d">Last 30d</option>
            <option value="90d">Last 90d</option>
            <option value="all">All time</option>
          </select>
        </Field>
        <button
          type="submit"
          className="h-9 px-4 rounded-md bg-cyan-600 text-white text-[12.5px] font-medium hover:bg-cyan-700"
        >
          Apply
        </button>
        {(statusFilter || modeFilter || q || since !== "30d") && (
          <Link
            href="/admin/orders"
            className="h-9 px-3 inline-flex items-center text-fg-muted hover:text-fg"
          >
            Clear
          </Link>
        )}
      </form>

      {/* ── List ─────────────────────────────────────────────── */}
      <div className="mt-6 card overflow-hidden">
        {orders.length === 0 ? (
          <div className="p-8 text-center">
            <p className="text-[14px] text-fg">
              {q || statusFilter || modeFilter
                ? "No orders match those filters."
                : "No orders yet."}
            </p>
            <p className="mt-1.5 text-[12.5px] text-fg-muted">
              Orders will show up here as soon as a buyer places one.
            </p>
          </div>
        ) : (
          <table className="w-full text-[13px] min-w-[1100px]">
            <thead className="text-[11px] uppercase tracking-wider text-fg-subtle border-b border-border">
              <tr>
                <th className="text-left font-medium px-4 py-3">Order</th>
                <th className="text-left font-medium px-4 py-3">Buyer</th>
                <th className="text-left font-medium px-4 py-3">Items</th>
                <th className="text-left font-medium px-4 py-3">Mode</th>
                <th className="text-right font-medium px-4 py-3">Landed total</th>
                <th className="text-left font-medium px-4 py-3">Status</th>
                <th className="text-left font-medium px-4 py-3">Placed</th>
              </tr>
            </thead>
            <tbody>
              {orders.map((o) => {
                const num = fmtOrderNum(o.id);
                const modeLabel =
                  o.shipping_mode === "air" ? "Air" : "Sea";
                return (
                  <tr
                    key={o.id}
                    className="border-b border-border last:border-b-0 hover:bg-bg-soft"
                  >
                    <td className="px-4 py-2.5 font-mono tnum">
                      <Link
                        href={`/admin/orders/${o.id}`}
                        className="text-cyan-700 hover:underline"
                      >
                        {num}
                      </Link>
                      {o.tracking_number ? (
                        <div className="text-[10.5px] text-fg-subtle font-mono">
                          ✈ {o.tracking_number}
                        </div>
                      ) : null}
                    </td>
                    <td className="px-4 py-2.5 text-[12px] max-w-[220px]">
                      <div className="truncate">
                        {o.buyer_full_name ?? "—"}
                      </div>
                      <div className="text-fg-muted text-[11px] font-mono tnum truncate">
                        {o.buyer_email ?? "(no email)"}
                      </div>
                    </td>
                    <td className="px-4 py-2.5">
                      <div className="flex items-center gap-2">
                        {o.first_image ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={o.first_image}
                            alt=""
                            className="w-7 h-7 rounded object-cover border border-border shrink-0"
                          />
                        ) : (
                          <div className="w-7 h-7 rounded bg-bg-soft border border-border shrink-0" />
                        )}
                        <div className="text-[12px]">
                          <div className="font-medium">
                            {o.item_count}{" "}
                            {o.item_count === 1 ? "line" : "lines"} ·{" "}
                            {o.total_qty} pcs
                          </div>
                          {o.first_source_id ? (
                            <div className="text-fg-muted text-[10.5px] font-mono tnum">
                              {o.first_source_id}
                            </div>
                          ) : null}
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-2.5 text-[11.5px] uppercase tracking-wider text-fg-muted">
                      {modeLabel}
                    </td>
                    <td className="px-4 py-2.5 text-right font-mono tnum">
                      <div className="font-semibold">
                        {fmtBdt(o.total_bdt)}
                      </div>
                      <div className="text-fg-muted text-[10.5px]">
                        prod {fmtBdt(o.product_subtotal_bdt)} + ship{" "}
                        {fmtBdt(o.shipping_bdt)} + duty{" "}
                        {fmtBdt(o.duty_bdt)}
                      </div>
                    </td>
                    <td className="px-4 py-2.5">
                      <span
                        className={`text-[10px] font-medium tracking-wider uppercase px-1.5 py-0.5 border rounded ${STATUS_TONE[o.status]}`}
                      >
                        {STATUS_LABEL[o.status]}
                      </span>
                      {o.paid_at ? (
                        <div className="text-fg-muted text-[10px] mt-0.5 font-mono tnum">
                          paid {fmtDate(o.paid_at)}
                        </div>
                      ) : null}
                    </td>
                    <td className="px-4 py-2.5 font-mono tnum text-[12px] text-fg-muted">
                      {fmtDate(o.created_at)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Footer note */}
      {orders.length > 0 && (
        <p className="mt-4 text-[11.5px] text-fg-subtle">
          Showing {orders.length}
          {orders.length >= 100 ? "+ (capped at 100 — narrow filters to see more)" : ""}.
        </p>
      )}
    </AdminPage>
  );
}

function StatusCard({
  label,
  value,
  sub,
  href,
}: {
  label: string;
  value: number;
  sub: string;
  href: string;
}) {
  return (
    <Link
      href={href}
      className="bg-bg p-4 md:p-5 hover:bg-bg-soft transition-colors"
    >
      <p className="text-[10px] font-medium tracking-wider uppercase text-fg-subtle">
        {label}
      </p>
      <p className="mt-1.5 text-[24px] md:text-[28px] font-semibold leading-none font-mono tnum">
        {value}
      </p>
      <p className="mt-2 text-[11px] text-fg-muted">{sub}</p>
    </Link>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="block text-[10.5px] uppercase tracking-wider text-fg-subtle font-medium mb-1">
        {label}
      </span>
      {children}
    </label>
  );
}
