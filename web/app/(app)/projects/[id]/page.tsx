import React from "react";
import { ProjectDetailView } from "@/src/domains/submissions/components/ProjectDetailView";

export default function ProjectDetailPage({ params }: { params: { id: string } }) {
  // Mock data for demo purposes. Fetch via CQRS in real app.
  const project = {
    id: params.id,
    eventId: "00000000-0000-0000-0000-000000000000",
    title: "DeFi Aggregator",
    tagline: "The fastest way to swap tokens across multiple chains.",
    teamName: "Team Alpha",
    status: "Finalized",
    coverUrl: "https://images.unsplash.com/photo-1551288049-bebda4e38f71?auto=format&fit=crop&w=1200&q=80"
  };

  const requirements = [
    { id: "req_1", name: "Pitch", asset_type: "TEXT" },
    { id: "req_2", name: "Architecture", asset_type: "MARKDOWN" },
    { id: "req_3", name: "Repository", asset_type: "REPOSITORY" },
    { id: "req_4", name: "Demo Video", asset_type: "VIDEO" }
  ];

  const assets = [
    { requirement_id: "req_1", text_value: "We built a cross-chain aggregator that minimizes slippage..." },
    { requirement_id: "req_2", text_value: "# Architecture\n\nWe used Next.js, Rust, and Substrate..." },
    { requirement_id: "req_3", url_value: "https://github.com/team-alpha/defi-aggregator" },
    { requirement_id: "req_4", storage_path: "submissions/event/team/video.mp4" }
  ];

  return <ProjectDetailView project={project} requirements={requirements} assets={assets} />;
}
