import { createBrowserClient } from "@supabase/ssr";
import { getSupabaseConfig, isSupabaseConfigured } from "./config";

export { isSupabaseConfigured };

/**
 * Browser Supabase client. `createBrowserClient` is a singleton in the browser,
 * so calling this from multiple components is safe.
 *
 * Throws a descriptive error when the public configuration is missing.
 */
export function createClient() {
  const { url, key } = getSupabaseConfig();
  return createBrowserClient(url, key);
}
