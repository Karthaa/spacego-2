"use client";

import { createClient, isSupabaseConfigured } from "@/lib/supabase/client";

export const REMOTE_TABLES = {
  spaces: "spacego_spaces",
  bookings: "spacego_bookings",
  activations: "spacego_activations",
  demandSearches: "spacego_demand_searches",
  enquiries: "spacego_enquiries",
  notifications: "spacego_notifications",
  favourites: "spacego_favourites",
} as const;

type Supabase = ReturnType<typeof createClient>;

let client: Supabase | null = null;

function getClient(): Supabase | null {
  if (!isSupabaseConfigured()) return null;
  if (!client) client = createClient();
  return client;
}

export function isRemoteEnabled(): boolean {
  return isSupabaseConfigured();
}

/**
 * Read a JSONB-backed collection. Returns null when Supabase is not
 * configured or the request fails, so callers can keep local demo data.
 */
export async function fetchRows<T>(table: string): Promise<T[] | null> {
  const supabase = getClient();
  if (!supabase) return null;

  const { data, error } = await supabase.from(table).select("id,data");
  if (error) {
    console.error(`SpaceGo: failed to read ${table}`, error.message);
    return null;
  }

  return (data ?? []).map((row) => (row as { data: T }).data);
}

export async function seedRows<T extends { id: string }>(
  table: string,
  items: T[]
): Promise<void> {
  const supabase = getClient();
  if (!supabase || items.length === 0) return;

  const { error } = await supabase
    .from(table)
    .upsert(
      items.map((item) => ({ id: item.id, data: item })),
      { onConflict: "id" }
    );

  if (error) console.error(`SpaceGo: failed to seed ${table}`, error.message);
}

export async function saveRow<T extends { id: string }>(
  table: string,
  item: T
): Promise<void> {
  const supabase = getClient();
  if (!supabase) return;

  const { error } = await supabase
    .from(table)
    .upsert({ id: item.id, data: item });

  if (error) console.error(`SpaceGo: failed to save ${table}/${item.id}`, error.message);
}

export async function deleteRow(table: string, id: string): Promise<void> {
  const supabase = getClient();
  if (!supabase) return;

  const { error } = await supabase.from(table).delete().eq("id", id);
  if (error) console.error(`SpaceGo: failed to delete ${table}/${id}`, error.message);
}

export async function fetchFavourites(): Promise<Record<string, string[]> | null> {
  const supabase = getClient();
  if (!supabase) return null;

  const { data, error } = await supabase
    .from(REMOTE_TABLES.favourites)
    .select("user_id,space_id");

  if (error) {
    console.error("SpaceGo: failed to read favourites", error.message);
    return null;
  }

  const grouped: Record<string, string[]> = {};
  for (const row of data ?? []) {
    const { user_id, space_id } = row as { user_id: string; space_id: string };
    (grouped[user_id] ??= []).push(space_id);
  }
  return grouped;
}

export async function seedFavourites(
  favourites: Record<string, string[]>
): Promise<void> {
  const supabase = getClient();
  if (!supabase) return;

  const rows = Object.entries(favourites).flatMap(([user_id, spaceIds]) =>
    spaceIds.map((space_id) => ({ user_id, space_id }))
  );
  if (rows.length === 0) return;

  const { error } = await supabase
    .from(REMOTE_TABLES.favourites)
    .upsert(rows, { onConflict: "user_id,space_id" });
  if (error) console.error("SpaceGo: failed to seed favourites", error.message);
}

export async function setFavouriteRow(
  userId: string,
  spaceId: string,
  active: boolean
): Promise<void> {
  const supabase = getClient();
  if (!supabase) return;

  if (active) {
    const { error } = await supabase
      .from(REMOTE_TABLES.favourites)
      .upsert(
        { user_id: userId, space_id: spaceId },
        { onConflict: "user_id,space_id" }
      );
    if (error) console.error("SpaceGo: failed to save favourite", error.message);
    return;
  }

  const { error } = await supabase
    .from(REMOTE_TABLES.favourites)
    .delete()
    .eq("user_id", userId)
    .eq("space_id", spaceId);
  if (error) console.error("SpaceGo: failed to remove favourite", error.message);
}
