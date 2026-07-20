import React from "react";
import { ProjectGallery } from "@/src/domains/submissions/components/ProjectGallery";

export default function ProjectsPage({ params }: { params: { id: string } }) {
  // Mock data for demo purposes. In reality, fetch via CQRS ListPublicSubmissionsQuery.
  const projects = [
    {
      id: "proj_1",
      title: "DeFi Aggregator",
      tagline: "The fastest way to swap tokens across multiple chains.",
      teamName: "Team Alpha",
      status: "Finalized",
      tags: ["DeFi", "React", "Rust"],
      coverUrl: "https://images.unsplash.com/photo-1551288049-bebda4e38f71?auto=format&fit=crop&w=800&q=80"
    },
    {
      id: "proj_2",
      title: "NFT Marketplace",
      tagline: "Buy and sell digital assets with zero gas fees.",
      teamName: "Beta Builders",
      status: "Submitted",
      tags: ["NFT", "Solidity", "Next.js"],
      coverUrl: null
    }
  ];

  return (
    <div className="bg-gray-50 min-h-screen">
      <div className="bg-indigo-600 pb-32">
        <div className="max-w-7xl mx-auto py-16 px-4 sm:py-24 sm:px-6 lg:px-8">
          <div className="text-center">
            <h1 className="text-4xl font-extrabold text-white sm:text-5xl sm:tracking-tight lg:text-6xl">
              Project Gallery
            </h1>
            <p className="max-w-xl mt-5 mx-auto text-xl text-indigo-200">
              Explore the amazing projects built during the hackathon.
            </p>
          </div>
        </div>
      </div>
      <main className="-mt-32 relative z-10">
        <div className="max-w-7xl mx-auto pb-12 px-4 sm:px-6 lg:px-8">
          <div className="bg-white rounded-lg shadow-xl overflow-hidden">
             <ProjectGallery projects={projects} />
          </div>
        </div>
      </main>
    </div>
  );
}
