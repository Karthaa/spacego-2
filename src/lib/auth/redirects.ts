import type { UserRole } from "@/types";

const PLACEHOLDER_ORIGIN = "https://spacego.invalid";

/**
 * Only allow same-origin, absolute paths. This prevents open redirects through
 * the `redirect`/`next` query parameters used by the auth flows.
 */
export function safeNextPath(
  value: string | null | undefined
): string | null {
  if (!value) return null;
  if (!value.startsWith("/")) return null;
  if (value.startsWith("//")) return null;
  if (value.startsWith("/\\")) return null;
  if (/[\r\n\t]/.test(value)) return null;
  // Resolve it the way a browser does. Paths such as "/..//evil.example" or
  // "/.\evil.example" pass the checks above but resolve to "//evil.example".
  try {
    const resolved = new URL(value, PLACEHOLDER_ORIGIN);
    if (resolved.origin !== PLACEHOLDER_ORIGIN) return null;
    if (resolved.pathname.startsWith("//")) return null;
  } catch {
    return null;
  }
  return value;
}

export function homeForRole(role: UserRole | null | undefined): string {
  switch (role) {
    case "admin":
      return "/admin";
    case "owner":
      return "/owner";
    default:
      return "/dashboard";
  }
}
