"use client";
import { createBrowserClient } from "@supabase/ssr";
import type { Database } from "./database.types";

let _browser: ReturnType<typeof createBrowserClient<Database>> | null = null;

/**
 * Browser-side Supabase client. RLS-respecting, anon-context by default.
 * Use this for sign-in / sign-up / sign-out on the client. For any
 * data fetch from a Server Component, use the server client instead.
 */
export function getBrowserClient() {
  if (_browser) return _browser;
  _browser = createBrowserClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
  );
  return _browser;
}
