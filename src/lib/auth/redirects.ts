import type { UserRole } from "@/types";

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
