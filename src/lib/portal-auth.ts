// /lib/portal-auth.ts
//
// Server-side helper for portal pages (admin/buyer). Reads the
// Supabase session and joins profiles to get the is_admin flag.

import "server-only";
import { redirect } from "next/navigation";
import { getServerClient } from "./supabase/server";
import type { User } from "@supabase/supabase-js";

export type PortalUser = {
  id: string;
  email: string;
  fullName: string | null;
  isAdmin: boolean;
  country: string | null;
  company: string | null;
};

/**
 * Require a signed-in user. If not signed in, redirect to /login
 * with ?redirect=… set to the current path.
 */
export async function requireUser(returnTo: string): Promise<PortalUser> {
  const supabase = await getServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    redirect(`/login?redirect=${encodeURIComponent(returnTo)}`);
  }
  return await loadPortalUser(user, returnTo);
}

/**
 * Require an admin user. If not signed in, redirect to /login.
 * If signed in but not admin, redirect to /buyer (or /login if no session).
 */
export async function requireAdmin(returnTo: string): Promise<PortalUser> {
  const u = await requireUser(returnTo);
  if (!u.isAdmin) {
    redirect("/buyer");
  }
  return u;
}

/**
 * Soft variant — returns null instead of redirecting. Use when the
 * page handles both signed-in and signed-out states.
 */
export async function getCurrentUser(): Promise<PortalUser | null> {
  const supabase = await getServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  return await loadPortalUser(user, "/");
}

/**
 * API-route-friendly admin guard. Returns `{ ok: true, user }` if
 * the requester is signed in AND is_admin; otherwise a JSON error
 * response. Use this in /api/admin/* routes where a redirect would
 * be wrong (the client expects JSON).
 */
export async function requireAdminApi(
  req: Request,
): Promise<
  | { ok: true; user: PortalUser }
  | { ok: false; status: 401 | 403; error: string }
> {
  const supabase = await getServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { ok: false, status: 401, error: "unauthenticated" };
  }
  const { data: profile } = await supabase
    .from("profiles")
    .select("email, full_name, is_admin, country, company")
    .eq("id", user.id)
    .maybeSingle();
  if (!profile?.is_admin) {
    return { ok: false, status: 403, error: "forbidden" };
  }
  return {
    ok: true,
    user: {
      id: user.id,
      email: profile.email ?? user.email ?? "",
      fullName: profile.full_name ?? null,
      isAdmin: true,
      country: profile.country ?? null,
      company: profile.company ?? null,
    },
  };
}

/**
 * API-route-friendly user guard. Same shape as requireAdminApi but
 * for any signed-in user (not just admin). Use this in /api/buyer/*
 * routes that need a session but don't need an admin check.
 */
export async function requireUserApi(
  req: Request,
): Promise<
  | { ok: true; user: PortalUser }
  | { ok: false; status: 401; error: string }
> {
  const supabase = await getServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { ok: false, status: 401, error: "unauthenticated" };
  }
  const { data: profile } = await supabase
    .from("profiles")
    .select("email, full_name, is_admin, country, company")
    .eq("id", user.id)
    .maybeSingle();
  return {
    ok: true,
    user: {
      id: user.id,
      email: profile?.email ?? user.email ?? "",
      fullName: profile?.full_name ?? null,
      isAdmin: profile?.is_admin ?? false,
      country: profile?.country ?? null,
      company: profile?.company ?? null,
    },
  };
}

async function loadPortalUser(
  user: User,
  returnTo: string,
): Promise<PortalUser> {
  const supabase = await getServerClient();
  const { data: profile } = await supabase
    .from("profiles")
    .select("email, full_name, is_admin, country, company")
    .eq("id", user.id)
    .maybeSingle();
  return {
    id: user.id,
    email: profile?.email ?? user.email ?? "",
    fullName: profile?.full_name ?? null,
    isAdmin: profile?.is_admin ?? false,
    country: profile?.country ?? null,
    company: profile?.company ?? null,
  };
}
