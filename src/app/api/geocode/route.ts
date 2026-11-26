import { NextResponse, type NextRequest } from "next/server";
import { getGeocodeProvider } from "@/lib/geo/geocode";

/**
 * GET /api/geocode?q=Kakkanad
 *
 * Server-side proxy so the provider key never reaches the browser. Answers:
 *  200 { results: [{ label, lat, lng }] }
 *  400 invalid query, 429 rate limited, 503 no provider configured,
 *  502 provider failed.
 */

const WINDOW_MS = 60_000;
const MAX_PER_WINDOW = 30;
// Best effort per isolate. Cloudflare may run several isolates, so this caps
// bursts rather than enforcing an exact global quota.
const hits = new Map<string, { count: number; reset: number }>();

function rateLimited(key: string): boolean {
  const now = Date.now();
  if (hits.size > 5_000) {
    for (const [k, v] of hits) if (v.reset < now) hits.delete(k);
  }
  const entry = hits.get(key);
  if (!entry || entry.reset < now) {
    hits.set(key, { count: 1, reset: now + WINDOW_MS });
    return false;
  }
  entry.count += 1;
  return entry.count > MAX_PER_WINDOW;
}

function json(body: unknown, status: number, cache = "no-store") {
  return NextResponse.json(body, { status, headers: { "Cache-Control": cache } });
}

export async function GET(request: NextRequest) {
  const q = (request.nextUrl.searchParams.get("q") ?? "").trim().replace(/\s+/g, " ");
  if (q.length < 2 || q.length > 120) {
    return json({ error: "Enter between 2 and 120 characters." }, 400);
  }

  const provider = getGeocodeProvider();
  if (!provider) {
    return json({ error: "not_configured" }, 503);
  }

  const ip =
    request.headers.get("cf-connecting-ip") ||
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    "unknown";
  if (rateLimited(ip)) {
    return json({ error: "Too many searches. Wait a moment and try again." }, 429);
  }

  const country = request.nextUrl.searchParams.get("country") ?? undefined;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 6_000);
  try {
    const results = await provider.search(q, {
      country: country && /^[a-z]{2}$/i.test(country) ? country.toLowerCase() : undefined,
      signal: controller.signal,
    });
    return json({ results }, 200, "public, max-age=300, s-maxage=86400");
  } catch {
    return json({ error: "Location search is unavailable right now." }, 502);
  } finally {
    clearTimeout(timer);
  }
}
