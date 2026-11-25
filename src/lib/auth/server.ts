import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { homeForRole } from "@/lib/auth/redirects";
import type { UserProfile, UserRole } from "@/types";

const PROFILE_COLUMNS =
  "id,email,full_name,role,avatar_url,phone,company_name,created_at";

export interface ServerAuth {
  userId: string;
  profile: UserProfile | null;
}

/**
 * Verifies the session server-side with `getClaims()` (not `getSession()`) and
 * loads the role from the protected public profile table.
 *
 * Returns null when there is no verified session. Returns a ServerAuth with a
 * null profile when the session is valid but the profile row is missing, so
 * callers can distinguish "signed out" from "signed in without a profile".
 */
export async function getServerAuth(): Promise<ServerAuth | null> {
  const supabase = await createClient();

  const {
    data: claimsData,
    error: claimsError,
  } = await supabase.auth.getClaims();

  const userId = claimsData?.claims?.sub;
  if (claimsError || !userId) {
    return null;
  }

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select(PROFILE_COLUMNS)
    .eq("id", userId)
    .maybeSingle();

  if (profileError) {
    console.error("Unable to load the authenticated profile:", profileError.message);
    return { userId, profile: null };
  }

  return {
    userId,
    profile: (profile as UserProfile | null) ?? null,
  };
}

function loginRedirect(target: string, reason?: "profile_missing"): never {
  const params = new URLSearchParams({ redirect: target });
  if (reason) params.set("reason", reason);
  redirect(`/auth/login?${params.toString()}`);
}

/**
 * Requires a verified session and a public profile. Any authenticated role is
 * accepted; use `requireRole` for owner/admin-only areas.
 */
export async function requireProfile(target: string): Promise<UserProfile> {
  const auth = await getServerAuth();

  if (!auth) {
    return loginRedirect(target);
  }

  if (!auth.profile) {
    return loginRedirect(target, "profile_missing");
  }

  return auth.profile;
}

/**
 * Requires a verified session whose protected profile role matches `role`.
 * Unauthorized roles are redirected to their own portal, never to a page they
 * cannot access.
 */
export async function requireRole(
  role: UserRole,
  target: string
): Promise<UserProfile> {
  const auth = await getServerAuth();

  if (!auth) {
    return loginRedirect(target);
  }

  if (!auth.profile) {
    return loginRedirect(target, "profile_missing");
  }

  if (auth.profile.role !== role) {
    redirect(homeForRole(auth.profile.role));
  }

  return auth.profile;
}
