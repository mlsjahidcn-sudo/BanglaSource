import { getServiceRoleClient } from "@/lib/supabase/server";
import { AdminPage, AdminPageHeader } from "@/components/admin-page";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type UserRow = {
  id: string;
  email: string;
  full_name: string | null;
  company: string | null;
  country: string | null;
  is_admin: boolean;
  created_at: string;
  quote_count: number;
};

async function loadUsers() {
  const supabase = getServiceRoleClient();
  const { data: profiles } = await supabase
    .from("profiles")
    .select("id,email,full_name,company,country,is_admin,created_at")
    .order("created_at", { ascending: false });
  const { data: quotes } = await supabase
    .from("quotes")
    .select("user_id");
  const quoteCount = new Map<string, number>();
  for (const q of quotes ?? []) {
    quoteCount.set(q.user_id, (quoteCount.get(q.user_id) ?? 0) + 1);
  }
  return (profiles ?? []).map((p) => ({
    ...p,
    quote_count: quoteCount.get(p.id) ?? 0,
  })) as UserRow[];
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-GB", {
    month: "short",
    day: "2-digit",
    year: "numeric",
  });
}

export default async function AdminUsersPage() {
  const users = await loadUsers();
  return (
    <AdminPage>
      <AdminPageHeader
        eyebrow="Audience"
        title="Users"
        dotColor="violet"
        subtitle={`${users.length} registered buyer${users.length === 1 ? "" : "s"}.`}
      />

      <div className="card overflow-hidden">
        {users.length === 0 ? (
          <div className="p-6 text-[13px] text-fg-muted">No users yet.</div>
        ) : (
          <table className="w-full text-[13px]">
            <thead className="text-[11px] uppercase tracking-wider text-fg-subtle border-b border-border">
              <tr>
                <th className="text-left font-medium px-4 py-3">Email</th>
                <th className="text-left font-medium px-4 py-3">Name</th>
                <th className="text-left font-medium px-4 py-3">Company</th>
                <th className="text-left font-medium px-4 py-3">Country</th>
                <th className="text-right font-medium px-4 py-3">Quotes</th>
                <th className="text-left font-medium px-4 py-3">Role</th>
                <th className="text-left font-medium px-4 py-3">Joined</th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr
                  key={u.id}
                  className="border-b border-border last:border-b-0 hover:bg-bg-soft"
                >
                  <td className="px-4 py-2.5 font-mono tnum text-[12px]">
                    {u.email}
                  </td>
                  <td className="px-4 py-2.5 text-[12px]">
                    {u.full_name ?? "—"}
                  </td>
                  <td className="px-4 py-2.5 text-[12px] text-fg-muted">
                    {u.company ?? "—"}
                  </td>
                  <td className="px-4 py-2.5 text-[12px] text-fg-muted">
                    {u.country ?? "—"}
                  </td>
                  <td className="px-4 py-2.5 text-right font-mono tnum">
                    {u.quote_count}
                  </td>
                  <td className="px-4 py-2.5">
                    {u.is_admin ? (
                      <span className="text-[10px] font-medium tracking-wider uppercase px-1.5 py-0.5 border border-emerald-200 bg-emerald-100 text-emerald-800 rounded">
                        admin
                      </span>
                    ) : (
                      <span className="text-[10px] font-medium tracking-wider uppercase px-1.5 py-0.5 border border-border bg-bg-soft text-fg-muted rounded">
                        buyer
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-2.5 font-mono tnum text-[12px] text-fg-muted">
                    {fmtDate(u.created_at)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </AdminPage>
  );
}
