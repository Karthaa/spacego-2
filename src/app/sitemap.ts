import type { MetadataRoute } from "next";

function siteOrigin(): string {
  const fallback = "http://localhost:3000";
  const raw = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  if (!raw) return fallback;
  try {
    const url = new URL(/^https?:\/\//i.test(raw) ? raw : `https://${raw}`);
    return url.origin;
  } catch {
    return fallback;
  }
}

type Entry = {
  path: string;
  changeFrequency: NonNullable<MetadataRoute.Sitemap[number]["changeFrequency"]>;
  priority: number;
};

// Public, indexable routes only. Signed-in areas and auth callbacks are
// excluded here and disallowed in robots.ts.
const PUBLIC_ROUTES: Entry[] = [
  { path: "/", changeFrequency: "weekly", priority: 1 },
  { path: "/spaces", changeFrequency: "daily", priority: 0.9 },
  { path: "/activation", changeFrequency: "monthly", priority: 0.7 },
  { path: "/activation/track", changeFrequency: "monthly", priority: 0.4 },
  { path: "/auth/login", changeFrequency: "yearly", priority: 0.3 },
  { path: "/auth/register", changeFrequency: "yearly", priority: 0.5 },
];

export default function sitemap(): MetadataRoute.Sitemap {
  const origin = siteOrigin();
  const lastModified = new Date();
  return PUBLIC_ROUTES.map(({ path, changeFrequency, priority }) => ({
    url: path === "/" ? origin : `${origin}${path}`,
    lastModified,
    changeFrequency,
    priority,
  }));
}
