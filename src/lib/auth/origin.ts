import type { NextRequest } from "next/server";

/**
 * Resolves the public origin behind a proxy. Next's `nextUrl.origin` is built
 * from the internal request URL, which can be localhost in container and
 * Worker runtimes. Prefer the forwarded/host headers, but validate them so a
 * crafted Host header cannot turn this into an open redirect.
 */
export function requestOrigin(request: NextRequest): string {
  const forwardedHost = request.headers
    .get("x-forwarded-host")
    ?.split(",")[0]
    ?.trim();
  const host = forwardedHost || request.headers.get("host")?.trim();
  if (!host) return request.nextUrl.origin;

  const forwardedProto = request.headers
    .get("x-forwarded-proto")
    ?.split(",")[0]
    ?.trim();
  const protocol =
    forwardedProto || request.nextUrl.protocol.replace(/:$/, "");

  if (protocol !== "http" && protocol !== "https") {
    return request.nextUrl.origin;
  }

  try {
    const parsed = new URL(`${protocol}://${host}`);
    if (parsed.pathname !== "/" || parsed.username || parsed.password) {
      return request.nextUrl.origin;
    }
    return parsed.origin;
  } catch {
    return request.nextUrl.origin;
  }
}
