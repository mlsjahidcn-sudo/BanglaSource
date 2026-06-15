import "server-only";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import type { Database } from "./database.types";

/**
 * Per-request Supabase client.
 *
 * - Reads the session from the request's cookies (via @supabase/ssr)
 * - Returns the user/anon context (RLS still applies)
 * - Use this in server components, route handlers, and server actions
 *   whenever you need to honor the signed-in user's permissions.
 *
 * If you need to bypass RLS (admin reads, server-side writes after the
 * user has been authenticated), use `getServiceRoleClient()` below.
 */
export async function getServerClient() {
  const cookieStore = await cookies();

  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            for (const { name, value, options } of cookiesToSet) {
              cookieStore.set(name, value, options);
            }
          } catch {
            // Called from a Server Component (read-only cookies).
            // Safe to ignore — middleware handles session refresh.
          }
        },
      },
    },
  );
}

/**
 * Service-role client. Bypasses RLS. SERVER-ONLY.
 * Never expose to the browser. Never use to "log in" — that's the
 * publishable key + signed-in cookies.
 */
type ServiceClient = ReturnType<typeof createSupabaseClient<Database>>;
let _service: ServiceClient | null = null;
export function getServiceRoleClient(): ServiceClient {
  if (_service) return _service;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) {
    throw new Error(
      "SUPABASE_SERVICE_ROLE_KEY is not set. Add it to .env.local from the Supabase dashboard (Project Settings → API → service_role).",
    );
  }
  _service = createSupabaseClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    key,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    },
  );
  return _service;
}
