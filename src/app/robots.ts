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

export default function robots(): MetadataRoute.Robots {
  const origin = siteOrigin();
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/dashboard", "/owner", "/admin", "/auth/callback", "/api"],
    },
    sitemap: `${origin}/sitemap.xml`,
    host: origin,
  };
}
