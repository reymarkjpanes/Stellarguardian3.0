import React, { useState } from "react";
import Link from "next/link";

interface ProjectCardProps {
  project: any;
  viewMode: "grid" | "list";
}

export function ProjectCard({ project, viewMode }: ProjectCardProps) {
  if (viewMode === "list") {
    return (
      <Link href={`/projects/${project.id}`} className="block hover:bg-gray-50 transition-colors">
        <div className="flex items-center px-6 py-4 border-b border-gray-200">
          <div className="h-16 w-16 flex-shrink-0 bg-gray-200 rounded-md overflow-hidden mr-6">
            {project.coverUrl ? (
              <img src={project.coverUrl} alt="" className="h-full w-full object-cover" />
            ) : (
              <div className="h-full w-full flex items-center justify-center text-gray-400">No Image</div>
            )}
          </div>
          <div className="flex-1 min-w-0">
            <h4 className="text-lg font-semibold text-gray-900 truncate">{project.title}</h4>
            <p className="text-sm text-gray-500 truncate">{project.tagline}</p>
          </div>
          <div className="ml-6 flex-shrink-0 flex items-center gap-4 text-sm text-gray-500">
             <span>{project.teamName}</span>
             <span className="px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">{project.status}</span>
          </div>
        </div>
      </Link>
    );
  }

  return (
    <Link href={`/projects/${project.id}`} className="block group">
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden transition-all duration-200 group-hover:shadow-md group-hover:border-gray-300">
        <div className="aspect-w-16 aspect-h-9 bg-gray-200 w-full">
          {project.coverUrl ? (
            <img src={project.coverUrl} alt="" className="h-full w-full object-cover" />
          ) : (
             <div className="h-full w-full flex items-center justify-center text-gray-400">No Cover</div>
          )}
        </div>
        <div className="p-5">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-medium text-indigo-600 uppercase tracking-wide">{project.teamName}</span>
            <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-gray-100 text-gray-800">{project.status}</span>
          </div>
          <h4 className="text-lg font-bold text-gray-900 mb-1">{project.title}</h4>
          <p className="text-sm text-gray-600 line-clamp-2">{project.tagline}</p>
          
          {project.tags && project.tags.length > 0 && (
            <div className="mt-4 flex flex-wrap gap-2">
              {project.tags.slice(0, 3).map((tag: string) => (
                <span key={tag} className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-600">
                  {tag}
                </span>
              ))}
              {project.tags.length > 3 && <span className="text-xs text-gray-400">+{project.tags.length - 3}</span>}
            </div>
          )}
        </div>
      </div>
    </Link>
  );
}

export function ProjectGallery({ projects }: { projects: any[] }) {
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [search, setSearch] = useState("");

  const filteredProjects = projects.filter(p => p.title.toLowerCase().includes(search.toLowerCase()));

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-8">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Submitted Projects</h2>
          <p className="text-sm text-gray-500 mt-1">Discover what teams have built.</p>
        </div>
        <div className="mt-4 sm:mt-0 flex items-center gap-4">
          <div className="relative">
            <input 
              type="text" 
              placeholder="Search projects..." 
              className="block w-full sm:w-64 border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm pl-10"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            <svg className="h-5 w-5 text-gray-400 absolute left-3 top-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </div>
          <div className="flex bg-gray-100 p-1 rounded-md">
            <button 
              className={`p-1.5 rounded ${viewMode === 'grid' ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500 hover:text-gray-700'}`}
              onClick={() => setViewMode('grid')}
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" /></svg>
            </button>
            <button 
              className={`p-1.5 rounded ${viewMode === 'list' ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500 hover:text-gray-700'}`}
              onClick={() => setViewMode('list')}
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 10h16M4 14h16M4 18h16" /></svg>
            </button>
          </div>
        </div>
      </div>

      {viewMode === "grid" ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {filteredProjects.map(p => <ProjectCard key={p.id} project={p} viewMode="grid" />)}
        </div>
      ) : (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200">
          {filteredProjects.map(p => <ProjectCard key={p.id} project={p} viewMode="list" />)}
        </div>
      )}
      
      {filteredProjects.length === 0 && (
         <div className="text-center py-20 bg-gray-50 rounded-lg border-2 border-dashed border-gray-300">
           <p className="text-gray-500">No projects found.</p>
         </div>
      )}
    </div>
  );
}
