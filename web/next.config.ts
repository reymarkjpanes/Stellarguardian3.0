import path from "node:path";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Note: output: "standalone" is intentionally omitted here.
  // Standalone mode is for Docker/self-hosted deployments only.
  // Vercel manages its own build output — setting standalone breaks Vercel serving.

  // Pin the workspace root to the repo root so Turbopack can resolve
  // monorepo-level linked dependencies (contracts, packages, shared-kernel).
  // Without this, files outside web/ are not resolvable.
  turbopack: {
    root: path.join(__dirname, ".."),
  },

  cacheComponents: false, // Explicitly disable Partial Prerendering to avoid Suspense errors

  experimental: {
    // When turbopack.root is set to a parent directory, Turbopack resolves
    // PostCSS config relative to that root — missing web/postcss.config.mjs
    // entirely and silently skipping all CSS processing (Tailwind not applied).
    // This flag forces per-directory PostCSS config resolution so
    // web/postcss.config.mjs is found and @tailwindcss/postcss runs correctly.
    turbopackLocalPostcssConfig: true,
  },

  // Image optimization configuration
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "*.supabase.co" },
      { protocol: "https", hostname: "avatars.githubusercontent.com" },
      { protocol: "https", hostname: "lh3.googleusercontent.com" },
    ],
  },
};

export default nextConfig;
