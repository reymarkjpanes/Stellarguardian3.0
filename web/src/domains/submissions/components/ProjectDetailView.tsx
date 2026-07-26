import React from "react";
import Link from "next/link";
import { RequirementRow, AssetRow } from "./RequirementRenderer";

export interface ProjectSummary {
  id: string;
  eventId: string;
  title: string;
  tagline?: string;
  teamName: string;
  status: string;
  coverUrl?: string | null;
  tags?: string[];
}

interface ProjectDetailViewProps {
  project: ProjectSummary;
  requirements: RequirementRow[];
  assets: AssetRow[];
}

export function ProjectDetailView({ project, requirements, assets }: ProjectDetailViewProps) {
  const getAsset = (reqId: string): AssetRow | undefined =>
    assets.find((a) => a.requirement_id === reqId);

  // Group by type for clean rendering
  const textBlocks = requirements.filter(
    (r) => r.asset_type === "TEXT" || r.asset_type === "MARKDOWN",
  );
  const mediaBlocks = requirements.filter(
    (r) => r.asset_type === "IMAGE" || r.asset_type === "VIDEO" || r.asset_type === "FILE",
  );
  const linkBlocks = requirements.filter(
    (r) => r.asset_type === "URL" || r.asset_type === "REPOSITORY",
  );

  return (
    <div className="bg-white min-h-screen pb-20">
      {/* Hero Section */}
      <div className="w-full h-80 bg-gray-900 relative">
        {project.coverUrl ? (
          <img src={project.coverUrl} className="w-full h-full object-cover opacity-60" alt="" />
        ) : (
          <div className="w-full h-full bg-gradient-to-r from-indigo-900 to-purple-900 opacity-80" />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-gray-900 to-transparent" />
        <div className="absolute bottom-0 left-0 w-full">
          <div className="max-w-4xl mx-auto px-6 pb-12">
            <Link
              href={`/events/${project.eventId}/projects`}
              className="text-gray-300 hover:text-white flex items-center text-sm mb-6"
            >
              <svg className="w-4 h-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  d="M10 19l-7-7m0 0l7-7m-7 7h18"
                />
              </svg>
              Back to Gallery
            </Link>
            <div className="flex items-center gap-3 mb-3">
              <span className="px-3 py-1 rounded-full text-xs font-medium bg-indigo-500 text-white">
                {project.teamName}
              </span>
              <span className="px-3 py-1 rounded-full text-xs font-medium bg-gray-800 text-gray-300 border border-gray-700">
                {project.status}
              </span>
            </div>
            <h1 className="text-4xl md:text-5xl font-extrabold text-white mb-4 tracking-tight">
              {project.title}
            </h1>
            <p className="text-xl text-gray-300 max-w-2xl">{project.tagline}</p>
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-6 py-12">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-12">
          {/* Main Content (Text/Markdown) */}
          <div className="md:col-span-2 space-y-12">
            {textBlocks.map((req) => {
              const asset = getAsset(req.id);
              if (!asset?.text_value) return null;
              return (
                <section key={req.id}>
                  <h2 className="text-2xl font-bold text-gray-900 mb-6">{req.name}</h2>
                  <div className="prose prose-indigo max-w-none text-gray-700">
                    <p className="whitespace-pre-wrap">{asset.text_value}</p>
                  </div>
                </section>
              );
            })}
          </div>

          {/* Sidebar (Links, Media, Files) */}
          <div className="space-y-8">
            {/* Links */}
            {linkBlocks.length > 0 && (
              <div className="bg-gray-50 rounded-xl p-6 border border-gray-200">
                <h3 className="text-sm font-bold text-gray-900 uppercase tracking-wider mb-4">
                  Resources
                </h3>
                <ul className="space-y-4">
                  {linkBlocks.map((req) => {
                    const asset = getAsset(req.id);
                    if (!asset?.url_value) return null;
                    return (
                      <li key={req.id}>
                        <a
                          href={asset.url_value}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center text-indigo-600 hover:text-indigo-800 font-medium"
                        >
                          <svg
                            className="w-5 h-5 mr-2"
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth="2"
                              d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1"
                            />
                          </svg>
                          {req.name}
                        </a>
                      </li>
                    );
                  })}
                </ul>
              </div>
            )}

            {/* Files/Media */}
            {mediaBlocks.length > 0 && (
              <div className="bg-white rounded-xl p-6 border border-gray-200 shadow-sm">
                <h3 className="text-sm font-bold text-gray-900 uppercase tracking-wider mb-4">
                  Files
                </h3>
                <ul className="space-y-4">
                  {mediaBlocks.map((req) => {
                    const asset = getAsset(req.id);
                    if (!asset?.storage_path) return null;
                    return (
                      <li key={req.id} className="flex items-start gap-3">
                        <div className="bg-indigo-100 p-2 rounded-lg text-indigo-600">
                          <svg
                            className="w-5 h-5"
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth="2"
                              d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
                            />
                          </svg>
                        </div>
                        <div>
                          <p className="text-sm font-medium text-gray-900">{req.name}</p>
                          <a
                            href={`#download-${asset.storage_path}`}
                            className="text-xs text-indigo-600 hover:underline"
                          >
                            Download file
                          </a>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              </div>
            )}

            {/* Future extension points */}
            <div className="hidden">
              <div id="SubmissionAIReviewCard" />
              <div id="MentorFeedbackCard" />
              <div id="JudgePreviewCard" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
