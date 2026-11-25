const MISSING_CONFIG_HELP =
  "Supabase authentication is not configured. Set NEXT_PUBLIC_SUPABASE_URL and " +
  "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY (or the legacy NEXT_PUBLIC_SUPABASE_ANON_KEY) " +
  "in your environment. See .env.example.";

export interface SupabaseConfig {
  url: string;
  key: string;
  keySource: "publishable" | "anon";
}

function readEnv(value: string | undefined): string {
  return typeof value === "string" ? value.trim() : "";
}

/**
 * Resolves the public Supabase configuration.
 *
 * The publishable key is preferred. The anon key remains supported so existing
 * environments keep working while they migrate to the newer key format.
 *
 * Throws a descriptive error when the project is not configured. Callers that
 * can degrade gracefully should check `isSupabaseConfigured()` first.
 */
export function getSupabaseConfig(): SupabaseConfig {
  const url = readEnv(process.env.NEXT_PUBLIC_SUPABASE_URL);
  const publishableKey = readEnv(process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY);
  const anonKey = readEnv(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
  const key = publishableKey || anonKey;

  if (!url || !key) {
    const missing = [
      !url ? "NEXT_PUBLIC_SUPABASE_URL" : null,
      !key
        ? "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY (or NEXT_PUBLIC_SUPABASE_ANON_KEY)"
        : null,
    ]
      .filter(Boolean)
      .join(" and ");

    throw new Error(`${MISSING_CONFIG_HELP} Missing: ${missing}.`);
  }

  if (!/^https?:\/\//i.test(url)) {
    throw new Error(
      `NEXT_PUBLIC_SUPABASE_URL must be an absolute http(s) URL. Received "${url}".`
    );
  }

  if (
    url.includes("placeholder") ||
    url.includes("your-project-id") ||
    key.includes("placeholder") ||
    key.includes("your-supabase")
  ) {
    throw new Error(
      "Supabase configuration still contains a placeholder value. Replace it with the project's real URL and publishable key."
    );
  }

  return {
    url,
    key,
    keySource: publishableKey ? "publishable" : "anon",
  };
}

export function isSupabaseConfigured(): boolean {
  try {
    getSupabaseConfig();
    return true;
  } catch {
    return false;
  }
}
