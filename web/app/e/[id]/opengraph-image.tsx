/**
 * Dynamic Open Graph image for public event pages (M21).
 * Route: /e/[id]/opengraph-image
 */
import { ImageResponse } from "next/og";
import { createServiceClient } from "@/lib/supabase/service";

export const runtime = "edge";
export const alt = "Event on Stellar Guardian";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function Image({ params }: { params: { id: string } }) {
  const supabase = createServiceClient();
  const { data: event } = await supabase
    .from("events")
    .select("title, category, prize_pool_target, state")
    .eq("id", params.id)
    .single();

  const title = event?.title ?? "Event";
  const category = event?.category ?? "";
  const prize = event?.prize_pool_target ? `${event.prize_pool_target} XLM` : "";

  return new ImageResponse(
    (
      <div
        style={{
          height: "100%",
          width: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          padding: "60px 80px",
          backgroundColor: "#0f1117",
          color: "#f1f5f9",
          fontFamily: "system-ui",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "24px" }}>
          <div style={{ background: "#4f46e5", borderRadius: "8px", width: "32px", height: "32px" }} />
          <span style={{ fontSize: "20px", color: "#94a3b8" }}>Stellar Guardian</span>
        </div>
        <h1 style={{ fontSize: "52px", fontWeight: 700, lineHeight: 1.2, margin: 0, maxWidth: "900px" }}>
          {title}
        </h1>
        <div style={{ display: "flex", gap: "24px", marginTop: "32px", fontSize: "22px", color: "#94a3b8" }}>
          {category && <span>{category}</span>}
          {prize && <span style={{ color: "#818cf8" }}>Prize: {prize}</span>}
        </div>
      </div>
    ),
    { ...size },
  );
}
