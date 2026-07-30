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
    coverUrl:
      "https://images.unsplash.com/photo-1551288049-bebda4e38f71?auto=format&fit=crop&w=1200&q=80",
    short_description: "The fastest way to swap tokens across multiple chains.",
    detailed_description: "DeFi Aggregator is a next-generation decentralized exchange aggregator that optimizes your token swaps. By routing trades across various liquidity pools on Ethereum, Polygon, and Arbitrum, it ensures you get the best possible rates with minimal slippage.\n\nOur platform utilizes an advanced smart routing algorithm that factors in gas fees and pool depth in real-time.",
    problem_statement: "Currently, users have to manually check multiple DEXes to find the best rate, which is time-consuming and often leads to suboptimal trades due to sudden market shifts and hidden fees. Liquidity is heavily fragmented across Layer 1s and Layer 2s.",
    video_url: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
    github_url: "https://github.com/team-alpha/defi-aggregator",
    live_demo_url: "https://defi-aggregator.demo",
    presentation_url: "https://pitch.com/v/defi-aggregator",
    tech_stack: ["Next.js", "Solidity", "Tailwind CSS", "ethers.js", "The Graph"],
    screenshots: [
      "https://images.unsplash.com/photo-1618044733300-9472054094ee?auto=format&fit=crop&w=800&q=80",
      "https://images.unsplash.com/photo-1639762681485-074b7f4eccd4?auto=format&fit=crop&w=800&q=80",
      "https://images.unsplash.com/photo-1640161704729-cbe966a08476?auto=format&fit=crop&w=800&q=80"
    ],
  };

  const requirements = [
    { id: "req_1", name: "Pitch", asset_type: "TEXT" as const, is_required: true },
    { id: "req_2", name: "Architecture", asset_type: "MARKDOWN" as const, is_required: true },
    { id: "req_3", name: "Repository", asset_type: "REPOSITORY" as const, is_required: true },
    { id: "req_4", name: "Demo Video", asset_type: "VIDEO" as const, is_required: false },
  ];

  const assets = [
    {
      id: "asset_1",
      requirement_id: "req_1",
      text_value: "We built a cross-chain aggregator that minimizes slippage...",
    },
    {
      id: "asset_2",
      requirement_id: "req_2",
      text_value: "# Architecture\n\nWe used Next.js, Rust, and Substrate...",
    },
    {
      id: "asset_3",
      requirement_id: "req_3",
      url_value: "https://github.com/team-alpha/defi-aggregator",
    },
    { id: "asset_4", requirement_id: "req_4", storage_path: "submissions/event/team/video.mp4" },
  ];

  return <ProjectDetailView project={project} requirements={requirements} assets={assets} />;
}
