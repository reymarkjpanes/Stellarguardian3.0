/**
 * Dynamic sitemap generation for SEO (Next.js metadata API).
 */
import { createServiceClient } from "@/lib/supabase/service";
import type { MetadataRoute } from "next";

export const dynamic = "force-dynamic";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const supabase = createServiceClient();
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://stellarguardian.app";

  // Static pages
  const staticPages: MetadataRoute.Sitemap = [
    { url: baseUrl, lastModified: new Date(), changeFrequency: "daily", priority: 1 },
    {
      url: `${baseUrl}/discover`,
      lastModified: new Date(),
      changeFrequency: "hourly",
      priority: 0.9,
    },
    {
      url: `${baseUrl}/login`,
      lastModified: new Date(),
      changeFrequency: "monthly",
      priority: 0.3,
    },
    {
      url: `${baseUrl}/signup`,
      lastModified: new Date(),
      changeFrequency: "monthly",
      priority: 0.3,
    },
  ];

  // Dynamic event pages (public, non-draft)
  const { data: events } = await supabase
    .from("events")
    .select("id, updated_at")
    .not("state", "eq", "Draft")
    .order("updated_at", { ascending: false })
    .limit(200);

  const eventPages: MetadataRoute.Sitemap = (events ?? []).map((event) => ({
    url: `${baseUrl}/events/${event.id}`,
    lastModified: new Date(event.updated_at ?? new Date()),
    changeFrequency: "daily" as const,
    priority: 0.7,
  }));

  return [...staticPages, ...eventPages];
}
