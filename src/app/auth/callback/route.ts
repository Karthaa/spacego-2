import { NextResponse, type NextRequest } from "next/server";
import type { EmailOtpType } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { requestOrigin } from "@/lib/auth/origin";
import { safeNextPath } from "@/lib/auth/redirects";

const ALLOWED_OTP_TYPES = new Set<EmailOtpType>([
  "signup",
  "invite",
  "magiclink",
  "recovery",
  "email_change",
  "email",
]);

function redirectTo(path: string, origin: string): NextResponse {
  const response = NextResponse.redirect(new URL(path, origin));
  response.headers.set(
    "Cache-Control",
    "private, no-cache, no-store, must-revalidate, max-age=0"
  );
  return response;
}

function loginError(origin: string, message: string): NextResponse {
  const params = new URLSearchParams({ error: message });
  return redirectTo(`/auth/login?${params.toString()}`, origin);
}

/**
 * Handles both PKCE code exchanges (the @supabase/ssr default) and token-hash
 * links from customised Supabase email templates.
 */
export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const origin = requestOrigin(request);
  const next = safeNextPath(searchParams.get("next")) ?? "/dashboard";

  const errorDescription =
    searchParams.get("error_description") ?? searchParams.get("error");
  if (errorDescription) {
    return loginError(origin, errorDescription);
  }

  const code = searchParams.get("code");
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;

  const supabase = await createClient();

  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      return redirectTo(next, origin);
    }
    return loginError(origin, error.message);
  }

  if (tokenHash && type && ALLOWED_OTP_TYPES.has(type)) {
    const { error } = await supabase.auth.verifyOtp({
      token_hash: tokenHash,
      type,
    });
    if (!error) {
      return redirectTo(next, origin);
    }
    return loginError(origin, error.message);
  }

  return loginError(
    origin,
    "This authentication link is invalid or has expired. Please request a new one."
  );
}
