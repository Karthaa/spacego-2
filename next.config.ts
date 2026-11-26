import type { NextConfig } from "next";
import { securityHeaders } from "./src/lib/security-headers";

const nextConfig: NextConfig = {
  // OpenNext bundles Next's standalone output into the Worker.
  output: "standalone",
  images: {
    // Cloudflare Workers has no Next image optimizer; serve remote images as-is.
    unoptimized: true,
    remotePatterns: [
      {
        protocol: "https",
        hostname: "images.unsplash.com",
      },
      {
        protocol: "https",
        hostname: "plus.unsplash.com",
      },
      {
        protocol: "https",
        hostname: "**.supabase.co",
      },
    ],
  },
  // Security headers for every route (see src/lib/security-headers.ts).
  // Evaluated at build time, so CSP_MODE and the NEXT_PUBLIC_* values come
  // from the build environment.
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders(process.env) }];
  },
};

export default nextConfig;
