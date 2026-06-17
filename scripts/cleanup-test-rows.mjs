// Cleanup test rows left behind by automated tests. Idempotent.
import { createClient } from "@supabase/supabase-js";
const SB = process.env.SUPABASE_SERVICE_ROLE_KEY;
const sb = createClient(
  "https://xgudiwguopfxqiwofkuz.supabase.co",
  SB,
);
// Cancel (don't delete) test orders so the schema's history is intact
// but the dashboard shows zero open work
const { data: testOrders, error } = await sb
  .from("orders")
  .update({ status: "cancelled" })
  .eq("address_snapshot->>district", "Gulshan, Dhaka")
  .in("status", ["pending_payment", "paid"])
  .neq("address_snapshot->>full_name", "Real Buyer")
  .select("id");
console.log("cancelled test orders:", testOrders?.length ?? 0, error?.message ?? "");

// Group buys: hard-delete (test-only data)
const { data: gb } = await sb
  .from("group_buys")
  .delete()
  .neq("created_by", "00000000-0000-0000-0000-000000000000")
  .select("id");
console.log("deleted group_buys:", gb?.length ?? 0);