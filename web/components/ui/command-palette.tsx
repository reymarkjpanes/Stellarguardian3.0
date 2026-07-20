"use client";

import * as React from "react";
import { Command } from "cmdk";
import { useRouter, useParams } from "next/navigation";
import { Search } from "lucide-react";

export function CommandPalette() {
  const [open, setOpen] = React.useState(false);
  const router = useRouter();
  const params = useParams();
  
  const eventId = params?.id as string | undefined;
  const workspaceId = params?.workspace_id as string | undefined;

  React.useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen((open) => !open);
      }
    };

    document.addEventListener("keydown", down);
    return () => document.removeEventListener("keydown", down);
  }, []);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-[20vh] bg-neutral-900/50 backdrop-blur-sm">
      <div 
        className="fixed inset-0 z-0" 
        onClick={() => setOpen(false)} 
      />
      <Command 
        className="relative z-10 w-full max-w-lg rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-950 shadow-2xl overflow-hidden flex flex-col"
        onKeyDown={(e) => {
          if (e.key === "Escape") setOpen(false);
        }}
      >
        <div className="flex items-center border-b border-neutral-200 dark:border-neutral-800 px-3">
          <Search className="w-5 h-5 text-neutral-400" />
          <Command.Input 
            autoFocus 
            placeholder="Search commands or jump to..." 
            className="flex-1 bg-transparent border-0 outline-none px-3 py-4 text-sm dark:text-neutral-100 placeholder:text-neutral-400" 
          />
        </div>

        <Command.List className="max-h-[300px] overflow-y-auto p-2">
          <Command.Empty className="py-6 text-center text-sm text-neutral-500">No results found.</Command.Empty>

          <Command.Group heading="Navigation" className="text-xs font-medium text-neutral-500 [&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:py-1.5">
            {eventId ? (
              <>
                <Command.Item 
                  className="flex items-center px-2 py-2 text-sm rounded-md cursor-pointer hover:bg-neutral-100 dark:hover:bg-neutral-800 aria-selected:bg-neutral-100 dark:aria-selected:bg-neutral-800"
                  onSelect={() => { router.push(`/events/${eventId}`); setOpen(false); }}
                >
                  Overview
                </Command.Item>
                <Command.Item 
                  className="flex items-center px-2 py-2 text-sm rounded-md cursor-pointer hover:bg-neutral-100 dark:hover:bg-neutral-800 aria-selected:bg-neutral-100 dark:aria-selected:bg-neutral-800"
                  onSelect={() => { router.push(`/events/${eventId}/teams`); setOpen(false); }}
                >
                  Teams
                </Command.Item>
                <Command.Item 
                  className="flex items-center px-2 py-2 text-sm rounded-md cursor-pointer hover:bg-neutral-100 dark:hover:bg-neutral-800 aria-selected:bg-neutral-100 dark:aria-selected:bg-neutral-800"
                  onSelect={() => { router.push(`/events/${eventId}/submissions`); setOpen(false); }}
                >
                  Submissions
                </Command.Item>
                <Command.Item 
                  className="flex items-center px-2 py-2 text-sm rounded-md cursor-pointer hover:bg-neutral-100 dark:hover:bg-neutral-800 aria-selected:bg-neutral-100 dark:aria-selected:bg-neutral-800"
                  onSelect={() => { router.push(`/events/${eventId}/judging`); setOpen(false); }}
                >
                  Judging
                </Command.Item>
                <Command.Item 
                  className="flex items-center px-2 py-2 text-sm rounded-md cursor-pointer hover:bg-neutral-100 dark:hover:bg-neutral-800 aria-selected:bg-neutral-100 dark:aria-selected:bg-neutral-800"
                  onSelect={() => { router.push(`/events/${eventId}/settings`); setOpen(false); }}
                >
                  Settings
                </Command.Item>
              </>
            ) : workspaceId ? (
              <>
                <Command.Item 
                  className="flex items-center px-2 py-2 text-sm rounded-md cursor-pointer hover:bg-neutral-100 dark:hover:bg-neutral-800 aria-selected:bg-neutral-100 dark:aria-selected:bg-neutral-800"
                  onSelect={() => { router.push(`/workspaces/${workspaceId}`); setOpen(false); }}
                >
                  Workspace Dashboard
                </Command.Item>
                <Command.Item 
                  className="flex items-center px-2 py-2 text-sm rounded-md cursor-pointer hover:bg-neutral-100 dark:hover:bg-neutral-800 aria-selected:bg-neutral-100 dark:aria-selected:bg-neutral-800"
                  onSelect={() => { router.push(`/workspaces/${workspaceId}/members`); setOpen(false); }}
                >
                  Workspace Members
                </Command.Item>
                <Command.Item 
                  className="flex items-center px-2 py-2 text-sm rounded-md cursor-pointer hover:bg-neutral-100 dark:hover:bg-neutral-800 aria-selected:bg-neutral-100 dark:aria-selected:bg-neutral-800"
                  onSelect={() => { router.push(`/workspaces/${workspaceId}/settings`); setOpen(false); }}
                >
                  Workspace Settings
                </Command.Item>
              </>
            ) : (
              <Command.Item 
                className="flex items-center px-2 py-2 text-sm rounded-md cursor-pointer hover:bg-neutral-100 dark:hover:bg-neutral-800 aria-selected:bg-neutral-100 dark:aria-selected:bg-neutral-800"
                onSelect={() => { router.push(`/dashboard`); setOpen(false); }}
              >
                Go to Dashboard
              </Command.Item>
            )}
          </Command.Group>
        </Command.List>

        <div className="flex items-center justify-between border-t border-neutral-200 dark:border-neutral-800 px-4 py-2 text-xs text-neutral-500">
          <div className="flex items-center gap-4">
            <span className="flex items-center gap-1">
              <kbd className="font-sans border border-neutral-200 dark:border-neutral-700 rounded px-1">↑↓</kbd>
              Navigate
            </span>
            <span className="flex items-center gap-1">
              <kbd className="font-sans border border-neutral-200 dark:border-neutral-700 rounded px-1">Enter</kbd>
              Open
            </span>
          </div>
          <span className="flex items-center gap-1">
            <kbd className="font-sans border border-neutral-200 dark:border-neutral-700 rounded px-1">Esc</kbd>
            Close
          </span>
        </div>
      </Command>
    </div>
  );
}
