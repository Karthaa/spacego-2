import type { NextRequest } from "next/server";

type RequestLike = Pick<NextRequest, "headers" | "nextUrl">;

/** NEXT_PUBLIC_SITE_URL as a URL; null when unset or invalid. */
function configuredSite(raw: string | undefined): URL | null {
  const value = raw?.trim();
  if (!value) return null;
  try {
    const url = new URL(/^https?:\/\//i.test(value) ? value : `https://${value}`);
    return url.protocol === "http:" || url.protocol === "https:" ? url : null;
  } catch {
    return null;
  }
}

function isLocalHostname(hostname: string): boolean {
  const name = hostname.toLowerCase();
  return (
    name === "localhost" ||
    name.endsWith(".localhost") ||
    name === "127.0.0.1" ||
    name === "[::1]"
  );
}

/** `protocol://host` from the request headers, or null if they don't form a bare origin. */
function headerOrigin(request: RequestLike): string | null {
  const forwardedHost = request.headers
    .get("x-forwarded-host")
    ?.split(",")[0]
    ?.trim();
  const host = forwardedHost || request.headers.get("host")?.trim();
  if (!host) return null;

  const forwardedProto = request.headers
    .get("x-forwarded-proto")
    ?.split(",")[0]
    ?.trim();
  const protocol =
    forwardedProto || request.nextUrl.protocol.replace(/:$/, "");
  if (protocol !== "http" && protocol !== "https") return null;

  try {
    const parsed = new URL(`${protocol}://${host}`);
    if (parsed.pathname !== "/" || parsed.username || parsed.password) {
      return null;
    }
    return parsed.origin;
  } catch {
    return null;
  }
}

/**
 * Resolves the public origin behind a proxy, for building redirect URLs.
 * Next's `nextUrl.origin` is built from the internal request URL, which can be
 * localhost in container and Worker runtimes, so the forwarded/Host headers
 * come first.
 *
 * Any client can send `X-Forwarded-Host`, and OpenNext copies it into `Host`
 * before Next sees the request. So when the build knows its public URL
 * (NEXT_PUBLIC_SITE_URL, set per environment in intent.yaml), a header origin
 * is used only if it names that host or a local development host; anything
 * else falls back to the configured site, never to a host the client chose.
 * Without NEXT_PUBLIC_SITE_URL (local development) the headers are used as
 * before, validated so they cannot smuggle a path or credentials.
 *
 * When the site moves to a new domain, update NEXT_PUBLIC_SITE_URL with it.
 *
 * `siteUrl` defaults to the build's NEXT_PUBLIC_SITE_URL; tests pass it in.
 */
export function requestOrigin(
  request: RequestLike,
  siteUrl: string | undefined = process.env.NEXT_PUBLIC_SITE_URL
): string {
  const fromHeaders = headerOrigin(request);
  const site = configuredSite(siteUrl);

  if (!site) return fromHeaders ?? request.nextUrl.origin;

  if (fromHeaders) {
    const candidate = new URL(fromHeaders);
    if (
      candidate.host.toLowerCase() === site.host.toLowerCase() ||
      isLocalHostname(candidate.hostname)
    ) {
      return fromHeaders;
    }
  }
  return site.origin;
}
