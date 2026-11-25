/**
 * Maps Supabase Auth errors to messages that are useful to end users without
 * leaking whether an account exists.
 */
export function authErrorMessage(message: string | null | undefined): string {
  const raw = message?.trim() ?? "";
  const text = raw.toLowerCase();

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

  return raw || "Something went wrong. Please try again.";
}
