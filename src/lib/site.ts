/**
 * Where this build is deployed, from NEXT_PUBLIC_SITE_URL (inlined at build
 * time, so the server and the browser always agree).
 */

/** The SpaceGo test site (Orun "stage"). It carries demo listings and is never indexed. */
export const TEST_SITE_HOSTS: readonly string[] = ["spacego-2-web-stage.orun-pool-9b971c2c.workers.dev"];

const FALLBACK_ORIGIN = "http://localhost:3000";

/** Absolute site URL for metadata; falls back to the local dev server. */
export function siteUrl(): URL {
  const raw = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  if (!raw) return new URL(FALLBACK_ORIGIN);
  try {
    const url = new URL(/^https?:\/\//i.test(raw) ? raw : `https://${raw}`);
    return url.protocol === "http:" || url.protocol === "https:" ? url : new URL(FALLBACK_ORIGIN);
  } catch {
    return new URL(FALLBACK_ORIGIN);
  }
}

export function siteOrigin(): string {
  return siteUrl().origin;
}

/** True only on the test site, so production is unchanged. */
export function isTestSite(): boolean {
  return TEST_SITE_HOSTS.includes(siteUrl().hostname.toLowerCase());
}
