// /buyer/addresses
//
// Phase 19: address book. Server-rendered list of the buyer's
// saved shipping addresses + a "New address" affordance. The
// form (add / edit / set-default / delete) is a client component
// because it has lots of small interactive bits (edit toggle,
// confirm-delete, etc.) that would be tedious in pure HTML.
//
// The page is a thin server component: load addresses from
// Supabase, decide whether to show the empty state / the list /
// the new-form / the edit-form, then hand off to the client
// component. Mode is driven by `?action=new` or `?action=edit&id=N`.

import { requireUser } from "@/lib/portal-auth";
import { getServerClient } from "@/lib/supabase/server";
import { AddressesClient, type Address } from "./_client";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function BuyerAddressesPage({
  searchParams,
}: {
  searchParams: Promise<{ action?: string; id?: string }>;
}) {
  const user = await requireUser("/buyer/addresses");
  const sp = await searchParams;
  const editingId =
    sp.action === "edit" && sp.id ? Number(sp.id) : null;
  const mode: "new" | "edit" | null =
    sp.action === "new"
      ? "new"
      : sp.action === "edit" && editingId
        ? "edit"
        : null;

  const sb = await getServerClient();
  const { data: rawAddresses } = await sb
    .from("addresses")
    .select("id, label, full_name, phone, country, district, address_line, is_default, created_at, updated_at")
    .eq("user_id", user.id)
    .order("is_default", { ascending: false })
    .order("updated_at", { ascending: false });

  const addresses = (rawAddresses ?? []) as Address[];
  const editing = editingId
    ? addresses.find((a) => a.id === editingId)
    : undefined;

  return (
    <div className="p-6 md:p-8 max-w-4xl">
      <div className="mb-8">
        <p className="text-[12px] font-medium tracking-wider uppercase text-fg-subtle">
          Account
        </p>
        <h1 className="mt-2 text-[32px] md:text-[40px] leading-[1.05] font-semibold tracking-[-0.02em]">
          Saved addresses
        </h1>
        <p className="mt-3 text-[14px] text-fg-muted max-w-2xl">
          Pre-fill /checkout with one tap. Save multiple
          destinations (Home, Office, 3PL warehouse, factory
          pickup). One is the default — that's the one the cart
          uses unless you switch at checkout.
        </p>
      </div>

      <AddressesClient
        addresses={addresses}
        mode={mode}
        editing={editing}
      />
    </div>
  );
}
