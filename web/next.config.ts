import path from "node:path";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Enable standalone output for Docker deployments (Req 1.7, 38.4).
  output: "standalone",

  // Pin the workspace root to this directory. The legacy Vite/Express app
  // at the repo root (../package-lock.json) would otherwise be misdetected
  // as the workspace root since it sits one level up.
  turbopack: {
    root: path.join(__dirname),
  },

  // Image optimization configuration
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "*.supabase.co" },
    ],
  },
};

export default nextConfig;
