import type { MetadataRoute } from "next";
import { isTestSite, siteOrigin } from "@/lib/site";

export default function robots(): MetadataRoute.Robots {
  const origin = siteOrigin();
  // The test site carries demo listings: nothing on it should be crawled.
  if (isTestSite()) {
    return { rules: { userAgent: "*", disallow: "/" } };
  }
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
