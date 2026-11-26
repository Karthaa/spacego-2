/**
 * The user-facing message for a Supabase Auth error this app recognises, or
 * null when it doesn't recognise it. Messages never reveal whether an
 * account exists.
 */
function knownAuthErrorMessage(message: string | null | undefined): string | null {
  const text = message?.trim().toLowerCase() ?? "";

  if (text.includes("invalid login credentials")) {
    return "The email or password is incorrect.";
  }
  if (text.includes("email not confirmed")) {
    return "Please confirm your email address before signing in. Check your inbox for the confirmation link.";
  }
  if (text.includes("user already registered")) {
    return "An account with this email already exists. Try signing in instead.";
  }
  if (text.includes("password should be at least")) {
    return "Your password does not meet the minimum length requirement.";
  }
  if (text.includes("same password")) {
    return "Choose a password that is different from your current password.";
  }
  if (text.includes("rate limit") || text.includes("too many")) {
    return "Too many attempts. Please wait a moment and try again.";
  }
  if (text.includes("expired") || text.includes("invalid token")) {
    return "This link is invalid or has expired. Please request a new one.";
  }
  if (text.includes("fetch") || text.includes("network")) {
    return "We could not reach the authentication service. Check your connection and try again.";
  }
  return null;
}

/**
 * Maps an error returned by a Supabase Auth call to a message that is useful
 * to end users. Unrecognised errors are shown as Supabase worded them.
 */
export function authErrorMessage(message: string | null | undefined): string {
  return (
    knownAuthErrorMessage(message) ??
    (message?.trim() || "Something went wrong. Please try again.")
  );
}

export const AUTH_LINK_ERROR_FALLBACK =
  "That link didn't work. It may have expired or already been used. Request a new one, or sign in below.";

/**
 * For an error that arrives in the page URL (`/auth/login?error=…`). Anyone
 * can craft such a link, so only recognised messages are shown; any other
 * text gets a generic line instead of being repeated on the sign-in page.
 */
export function authLinkErrorMessage(message: string | null | undefined): string {
  return knownAuthErrorMessage(message) ?? AUTH_LINK_ERROR_FALLBACK;
}
