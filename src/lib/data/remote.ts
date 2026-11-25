"use client";

import { createClient, isSupabaseConfigured } from "@/lib/supabase/client";

/**
 * Thin Supabase access layer for the SpaceGo data store.
 *
 * Since 20261121_spacego_rls_hardening.sql the browser may only:
 *   - read published spaces through the sanitized `spacego_public_spaces` view
 *     (anon + authenticated),
 *   - read base tables that RLS filters to the signed-in user (or all rows for
 *     admins),
 *   - write `spacego_spaces` (owner/admin, guarded by triggers) and
 *     `spacego_favourites` (own rows) directly,
 *   - perform every other write through validated SECURITY DEFINER RPCs.
 *
 * Every function here returns a RemoteResult so callers can surface the
 * failure instead of assuming success.
 */

export const REMOTE_TABLES = {
  spaces: "spacego_spaces",
  bookings: "spacego_bookings",
  activations: "spacego_activations",
  demandSearches: "spacego_demand_searches",
  enquiries: "spacego_enquiries",
  notifications: "spacego_notifications",
  favourites: "spacego_favourites",
} as const;

export const REMOTE_VIEWS = {
  publicSpaces: "spacego_public_spaces",
  ownerActivations: "spacego_owner_activations",
} as const;

export const REMOTE_RPCS = {
  createBooking: "spacego_create_booking",
  updateBookingStatus: "spacego_update_booking_status",
  submitActivation: "spacego_submit_activation",
  updateActivationStatus: "spacego_update_activation_status",
  submitEnquiry: "spacego_submit_enquiry",
  updateEnquiryStatus: "spacego_update_enquiry_status",
  logDemand: "spacego_log_demand",
  demandAnalytics: "spacego_demand_analytics",
  markNotificationRead: "spacego_mark_notification_read",
} as const;

export type RemoteResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: string };

type Supabase = ReturnType<typeof createClient>;

interface PostgrestLikeError {
  message?: string;
  code?: string;
  details?: string | null;
  hint?: string | null;
}

let client: Supabase | null = null;

function getClient(): Supabase | null {
  if (!isSupabaseConfigured()) return null;
  if (typeof window === "undefined") return null;
  if (!client) client = createClient();
  return client;
}

export function isRemoteEnabled(): boolean {
  return isSupabaseConfigured();
}

const NOT_CONFIGURED: RemoteResult<never> = {
  ok: false,
  error: "The SpaceGo backend is not configured for this environment.",
};

/**
 * Convert a PostgREST / Postgres error into a message that is safe and useful
 * to show in a toast. RPC validation errors raised by the migration are
 * already written for end users, so they are passed through unchanged.
 */
export function friendlyError(error: PostgrestLikeError | null | undefined): string {
  if (!error) return "Something went wrong. Please try again.";

  const code = error.code ?? "";
  const message = (error.message ?? "").trim();

  // No row matched a .single() — usually RLS hid the row.
  if (code === "PGRST116") {
    return "That record was not found, or you do not have permission to change it.";
  }

  // RLS rejected the write (as opposed to an RPC permission check that raised
  // its own descriptive 42501 message).
  if (/row-level security/i.test(message)) {
    return "You do not have permission to make this change.";
  }

  // The function exists in the client but not in the database yet.
  if (code === "PGRST202" || code === "42883") {
    return "This action is not available yet: the database is missing the required function. Apply the latest SpaceGo migration.";
  }

  if (code === "42P01" || code === "PGRST205") {
    return "This data is not available yet: the database is missing the required view or table. Apply the latest SpaceGo migration.";
  }

  if (/failed to fetch|networkerror|network request failed|load failed/i.test(message)) {
    return "Could not reach the SpaceGo server. Check your connection and try again.";
  }

  if (/jwt|not authenticated|authentication required/i.test(message)) {
    return "Your session has expired. Please sign in again.";
  }

  return message || "Something went wrong. Please try again.";
}

function failure(error: unknown, context: string): { ok: false; error: string } {
  const pgError =
    error && typeof error === "object" ? (error as PostgrestLikeError) : { message: String(error) };
  console.error(`SpaceGo: ${context} failed`, pgError.code ?? "", pgError.message ?? error);
  return { ok: false, error: friendlyError(pgError) };
}

/** Read `{ id, data }` JSONB rows from a table or view the caller may see. */
export async function fetchRows<T>(source: string): Promise<RemoteResult<T[]>> {
  const supabase = getClient();
  if (!supabase) return NOT_CONFIGURED;

  try {
    const { data, error } = await supabase.from(source).select("id,data");
    if (error) return failure(error, `reading ${source}`);
    return {
      ok: true,
      data: (data ?? [])
        .map((row) => (row as { data: T | null }).data)
        .filter((item): item is T => item !== null && typeof item === "object"),
    };
  } catch (error) {
    return failure(error, `reading ${source}`);
  }
}

/** Space ids the given user has favourited (RLS limits this to auth.uid()). */
export async function fetchFavouriteIds(userId: string): Promise<RemoteResult<string[]>> {
  const supabase = getClient();
  if (!supabase) return NOT_CONFIGURED;

  try {
    const { data, error } = await supabase
      .from(REMOTE_TABLES.favourites)
      .select("space_id")
      .eq("user_id", userId);
    if (error) return failure(error, "reading favourites");
    return {
      ok: true,
      data: (data ?? []).map((row) => (row as { space_id: string }).space_id),
    };
  } catch (error) {
    return failure(error, "reading favourites");
  }
}

export async function callRpc<T>(
  fn: string,
  args: Record<string, unknown>
): Promise<RemoteResult<T>> {
  const supabase = getClient();
  if (!supabase) return NOT_CONFIGURED;

  try {
    const { data, error } = await supabase.rpc(fn, args);
    if (error) return failure(error, `rpc ${fn}`);
    return { ok: true, data: data as T };
  } catch (error) {
    return failure(error, `rpc ${fn}`);
  }
}

export async function insertSpaceRow<T extends { id: string }>(
  item: T
): Promise<RemoteResult<T>> {
  const supabase = getClient();
  if (!supabase) return NOT_CONFIGURED;

  try {
    const { data, error } = await supabase
      .from(REMOTE_TABLES.spaces)
      .insert({ id: item.id, data: item })
      .select("id,data")
      .single();
    if (error) return failure(error, `creating space ${item.id}`);
    return { ok: true, data: (data as { data: T }).data };
  } catch (error) {
    return failure(error, `creating space ${item.id}`);
  }
}

export async function updateSpaceRow<T extends { id: string }>(
  item: T
): Promise<RemoteResult<T>> {
  const supabase = getClient();
  if (!supabase) return NOT_CONFIGURED;

  try {
    const { data, error } = await supabase
      .from(REMOTE_TABLES.spaces)
      .update({ data: item })
      .eq("id", item.id)
      .select("id,data")
      .single();
    if (error) return failure(error, `updating space ${item.id}`);
    return { ok: true, data: (data as { data: T }).data };
  } catch (error) {
    return failure(error, `updating space ${item.id}`);
  }
}

/** Hard delete. Only the admin policy allows this; owners archive instead. */
export async function deleteSpaceRow(id: string): Promise<RemoteResult<null>> {
  const supabase = getClient();
  if (!supabase) return NOT_CONFIGURED;

  try {
    const { data, error } = await supabase
      .from(REMOTE_TABLES.spaces)
      .delete()
      .eq("id", id)
      .select("id");
    if (error) return failure(error, `deleting space ${id}`);
    if (!data || data.length === 0) {
      return {
        ok: false,
        error: "That workspace was not deleted. It may not exist, or you do not have permission to delete it.",
      };
    }
    return { ok: true, data: null };
  } catch (error) {
    return failure(error, `deleting space ${id}`);
  }
}

export async function setFavouriteRow(
  userId: string,
  spaceId: string,
  active: boolean
): Promise<RemoteResult<null>> {
  const supabase = getClient();
  if (!supabase) return NOT_CONFIGURED;

  try {
    if (active) {
      const { error } = await supabase
        .from(REMOTE_TABLES.favourites)
        .upsert(
          { user_id: userId, space_id: spaceId },
          { onConflict: "user_id,space_id" }
        );
      if (error) return failure(error, "saving favourite");
      return { ok: true, data: null };
    }

    const { error } = await supabase
      .from(REMOTE_TABLES.favourites)
      .delete()
      .eq("user_id", userId)
      .eq("space_id", spaceId);
    if (error) return failure(error, "removing favourite");
    return { ok: true, data: null };
  } catch (error) {
    return failure(error, active ? "saving favourite" : "removing favourite");
  }
}
