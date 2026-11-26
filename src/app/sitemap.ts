import type { MetadataRoute } from "next";
import { isTestSite, siteOrigin } from "@/lib/site";

type Entry = {
  path: string;
  changeFrequency: NonNullable<MetadataRoute.Sitemap[number]["changeFrequency"]>;
  priority: number;
};

// Public, indexable routes only. Signed-in areas and auth callbacks are
// excluded here and disallowed in robots.ts.
const PUBLIC_ROUTES: Entry[] = [
  { path: "/", changeFrequency: "weekly", priority: 1 },
  { path: "/discover", changeFrequency: "daily", priority: 0.9 },
  { path: "/spaces", changeFrequency: "daily", priority: 0.9 },
  { path: "/activation", changeFrequency: "monthly", priority: 0.7 },
  { path: "/activation/track", changeFrequency: "monthly", priority: 0.4 },
  { path: "/auth/login", changeFrequency: "yearly", priority: 0.3 },
  { path: "/auth/register", changeFrequency: "yearly", priority: 0.5 },
];

export default function sitemap(): MetadataRoute.Sitemap {
  // The test site carries demo listings and is not indexed.
  if (isTestSite()) return [];
  const origin = siteOrigin();
  const lastModified = new Date();
  return PUBLIC_ROUTES.map(({ path, changeFrequency, priority }) => ({
    url: path === "/" ? origin : `${origin}${path}`,
    lastModified,
    changeFrequency,
    priority,
  }));
}
