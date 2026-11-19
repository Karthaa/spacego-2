import type { NextConfig } from "next";

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
};

export default nextConfig;
