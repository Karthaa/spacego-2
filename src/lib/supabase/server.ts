import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { getSupabaseConfig } from "./config";

/**
 * Request-scoped Supabase client for Server Components, Route Handlers and
 * Server Actions.
 *
 * Server Components cannot write cookies. The Proxy refreshes the auth cookies
 * on every request, so writes here are best-effort and ignored when Next.js
 * rejects them outside a mutable cookie context.
 */
export async function createClient() {
  const cookieStore = await cookies();
  const { url, key } = getSupabaseConfig();

  return createServerClient(url, key, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => {
            cookieStore.set(name, value, options);
          });
        } catch {
          // Called from a Server Component. The Proxy is responsible for
          // persisting refreshed auth cookies.
        }
      },
    },
  });
}
