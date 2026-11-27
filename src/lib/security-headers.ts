/**
 * HTTP security headers, applied to every route by next.config.ts.
 *
 * The Content-Security-Policy comes in two layers:
 *  - BASE_CSP is always enforced. Its directives cannot break the app: other
 *    sites may not frame it, and <base>, plugins and cross-site form posts
 *    are refused.
 *  - The full policy also limits where scripts, styles, images, workers and
 *    network calls may come from. Production builds send it as
 *    Content-Security-Policy-Report-Only, so violations show in the browser
 *    console and nothing is blocked. Build with CSP_MODE=enforce to enforce
 *    it, after a stage deploy's console shows no violations.
 *
 * Scripts keep 'unsafe-inline': most pages are prerendered at build time, so
 * per-request nonces are not available, and Next.js starts each page with
 * inline scripts. The policy still refuses scripts from any other origin.
 *
 * No imports: next.config.ts and the unit tests load this file directly.
 */

export interface SecurityHeaderEnv {
  NODE_ENV?: string;
  /** "enforce" enforces the full CSP; anything else keeps it report-only. */
  CSP_MODE?: string;
  NEXT_PUBLIC_SUPABASE_URL?: string;
  NEXT_PUBLIC_MAPTILER_KEY?: string;
  NEXT_PUBLIC_MAP_STYLE_URL?: string;
}

export interface SecurityHeader {
  key: string;
  value: string;
}

/** Enforced everywhere, development included. */
export const BASE_CSP_DIRECTIVES: Readonly<Record<string, readonly string[]>> = {
  "base-uri": ["'self'"],
  "object-src": ["'none'"],
  "frame-ancestors": ["'none'"],
  "form-action": ["'self'"],
};

/** The default basemap (src/lib/geo/mapStyle.ts): style, tiles, glyphs, sprites. */
const OPENFREEMAP = "https://tiles.openfreemap.org";
const MAPTILER = "https://api.maptiler.com";

function originOf(raw: string | undefined): string | null {
  const value = raw?.trim();
  if (!value) return null;
  try {
    const url = new URL(value);
    return url.protocol === "https:" || url.protocol === "http:" ? url.origin : null;
  } catch {
    return null;
  }
}

function serialize(directives: Readonly<Record<string, readonly string[]>>): string {
  return Object.entries(directives)
    .map(([name, sources]) => `${name} ${[...new Set(sources)].join(" ")}`)
    .join("; ");
}

export const BASE_CSP = serialize(BASE_CSP_DIRECTIVES);

/** The full policy, for the hosts this build talks to. */
export function contentSecurityPolicy(env: SecurityHeaderEnv): string {
  const connect = ["'self'", OPENFREEMAP];
  const supabase = originOf(env.NEXT_PUBLIC_SUPABASE_URL);
  if (supabase) connect.push(supabase);
  if (env.NEXT_PUBLIC_MAPTILER_KEY?.trim()) connect.push(MAPTILER);
  // A custom style may load tiles from further hosts; add them here if so.
  const mapStyle = originOf(env.NEXT_PUBLIC_MAP_STYLE_URL);
  if (mapStyle) connect.push(mapStyle);

  return serialize({
    "default-src": ["'self'"],
    "script-src": ["'self'", "'unsafe-inline'"],
    "style-src": ["'self'", "'unsafe-inline'"],
    // Listing photos come from Supabase Storage and, in sample data, Unsplash.
    "img-src": ["'self'", "data:", "blob:", "https:"],
    "font-src": ["'self'", "data:"],
    "connect-src": connect,
    // MapLibre runs its tile worker from a blob: URL.
    "worker-src": ["'self'", "blob:"],
    "child-src": ["'self'", "blob:"],
    "frame-src": ["'none'"],
    "manifest-src": ["'self'"],
    "media-src": ["'self'"],
    ...BASE_CSP_DIRECTIVES,
  });
}

export function securityHeaders(env: SecurityHeaderEnv): SecurityHeader[] {
  const headers: SecurityHeader[] = [
    // Browsers ignore HSTS on plain-http responses, so local development is unaffected.
    { key: "Strict-Transport-Security", value: "max-age=31536000; includeSubDomains" },
    { key: "X-Content-Type-Options", value: "nosniff" },
    { key: "X-Frame-Options", value: "DENY" },
    { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
    // Location stays available to this site only, for the "Near me" button.
    { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(self), payment=(), usb=()" },
    { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
  ];

  if (env.NODE_ENV !== "production") {
    // `next dev` needs eval and a websocket; keep its CSP to the safe subset.
    headers.push({ key: "Content-Security-Policy", value: BASE_CSP });
  } else if (env.CSP_MODE === "enforce") {
    headers.push({ key: "Content-Security-Policy", value: contentSecurityPolicy(env) });
  } else {
    headers.push(
      { key: "Content-Security-Policy", value: BASE_CSP },
      { key: "Content-Security-Policy-Report-Only", value: contentSecurityPolicy(env) }
    );
  }

  return headers;
}
