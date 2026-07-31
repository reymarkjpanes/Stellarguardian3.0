"use client";

import { useState, useRef, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

export interface WorkspaceItem {
  id: string;
  name: string;
  slug: string;
  logo_url: string | null;
  role: string;
}

interface WorkspaceSwitcherProps {
  workspaces: WorkspaceItem[];
  currentWorkspaceId?: string;
}

export function WorkspaceSwitcher({ workspaces, currentWorkspaceId }: WorkspaceSwitcherProps) {
  const [open, setOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const router = useRouter();

  // On mount, if no currentWorkspaceId but we have workspaces, maybe we want to set a cookie?
  // We'll leave that to the caller or a middleware. Here we just read currentWorkspaceId.

  const currentWorkspace = workspaces.find((w) => w.id === currentWorkspaceId) || workspaces[0];

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    if (open) document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  if (!workspaces || workspaces.length === 0) return null;

  return (
    <div className="relative ml-2" ref={dropdownRef}>
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-2 px-3 py-1.5 rounded-md hover:bg-[var(--bg-muted)] transition-colors focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
        aria-label="Switch workspace"
        aria-expanded={open}
      >
        <div className="w-6 h-6 rounded-md bg-[var(--accent)] flex items-center justify-center text-white text-xs font-bold overflow-hidden shrink-0">
          {currentWorkspace?.logo_url ? (
            <img
              src={currentWorkspace.logo_url}
              alt={currentWorkspace.name}
              className="w-full h-full object-cover"
            />
          ) : (
            currentWorkspace?.name.charAt(0).toUpperCase()
          )}
        </div>
        <div className="flex flex-col items-start hidden sm:flex">
          <span className="text-sm font-medium text-[var(--text)] leading-tight truncate max-w-[120px]">
            {currentWorkspace?.name}
          </span>
          <span className="text-[10px] text-[var(--text-muted)] leading-tight uppercase tracking-wide">
            {currentWorkspace?.role}
          </span>
        </div>
        <svg
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className={`text-[var(--text-muted)] transition-transform ${open ? "rotate-180" : ""}`}
        >
          <polyline points="6 9 12 15 18 9"></polyline>
        </svg>
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} aria-hidden="true" />
          <div className="absolute left-0 top-full mt-2 w-64 card shadow-lg z-50 overflow-hidden">
            <div className="p-2 border-b border-[var(--border)]">
              <p className="text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wider px-2 py-1">
                Your Workspaces
              </p>
            </div>
            <div className="max-h-[300px] overflow-y-auto p-1">
              {workspaces.map((ws) => (
                <button
                  key={ws.id}
                  onClick={() => {
                    document.cookie = `active_workspace_id=${ws.id}; path=/; max-age=31536000`;
                    setOpen(false);
                    router.refresh();
                  }}
                  className={`w-full flex items-center gap-3 px-2 py-2 rounded-md hover:bg-[var(--bg-muted)] transition-colors text-left ${ws.id === currentWorkspace?.id ? "bg-[var(--bg-muted)]" : ""}`}
                >
                  <div className="w-8 h-8 rounded-md bg-[var(--accent)] flex items-center justify-center text-white text-sm font-bold overflow-hidden shrink-0">
                    {ws.logo_url ? (
                      <img src={ws.logo_url} alt={ws.name} className="w-full h-full object-cover" />
                    ) : (
                      ws.name.charAt(0).toUpperCase()
                    )}
                  </div>
                  <div className="flex-1 min-w-0 flex flex-col justify-center">
                    <span className="text-sm font-medium text-[var(--text)] truncate block">
                      {ws.name}
                    </span>
                    <span className="text-xs text-[var(--text-muted)] block">{ws.role}</span>
                  </div>
                  {ws.id === currentWorkspace?.id && (
                    <svg
                      width="16"
                      height="16"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      className="text-[var(--accent)] shrink-0"
                    >
                      <polyline points="20 6 9 17 4 12"></polyline>
                    </svg>
                  )}
                </button>
              ))}
            </div>
            <div className="p-2 border-t border-[var(--border)]">
              <Link
                href="/settings/workspaces/new"
                onClick={() => setOpen(false)}
                className="w-full flex items-center gap-2 px-2 py-2 rounded-md text-sm font-medium text-[var(--text)] hover:bg-[var(--bg-muted)] transition-colors"
              >
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <line x1="12" y1="5" x2="12" y2="19"></line>
                  <line x1="5" y1="12" x2="19" y2="12"></line>
                </svg>
                Create Workspace
              </Link>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
