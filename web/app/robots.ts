/**
 * robots.txt generation (Next.js metadata API).
 */
import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://stellarguardian.app";

  return {
    rules: [
      {
        userAgent: "*",
        allow: ["/", "/discover"],
        disallow: ["/api/", "/admin/", "/settings", "/dashboard"],
      },
    ],
    sitemap: `${baseUrl}/sitemap.xml`,
  };
}
