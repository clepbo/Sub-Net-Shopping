import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Almost every screen is per-user and reads live data, so pages render
  // dynamically per request rather than using Cache Components.
  cacheComponents: false,
  experimental: {
    serverActions: {
      // Image uploads are capped at 2 MB; leave room for multipart overhead.
      bodySizeLimit: "3mb",
    },
  },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
