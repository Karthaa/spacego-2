import { createBrowserClient } from "@supabase/ssr";

export function createClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";

  // Return real client if configured, otherwise provide placeholder that falls back gracefully
  return createBrowserClient(
    supabaseUrl || "https://placeholder-spacego.supabase.co",
    supabaseAnonKey || "placeholder-anon-key"
  );
}

export const isSupabaseConfigured = (): boolean => {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";

  return Boolean(
    url &&
      anonKey &&
      !url.includes("placeholder") &&
      !url.includes("your-project-id") &&
      !anonKey.includes("placeholder") &&
      !anonKey.includes("your-supabase-anon-key")
  );
};
