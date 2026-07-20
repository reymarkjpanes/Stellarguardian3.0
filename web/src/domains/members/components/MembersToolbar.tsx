"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback } from "react";

export function MembersToolbar() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const currentView = searchParams.get("view") || "community";

  const setView = useCallback(
    (view: string) => {
      const params = new URLSearchParams(searchParams.toString());
      params.set("view", view);
      router.push(pathname + "?" + params.toString(), { scroll: false });
    },
    [searchParams, pathname, router]
  );

  return (
    <div className="flex flex-col sm:flex-row justify-between items-center mb-6 gap-4">
      <div className="flex gap-2">
        <button 
          onClick={() => setView("community")}
          className={`px-4 py-2 rounded-md font-medium text-sm transition-colors ${currentView === 'community' ? 'bg-primary text-primary-foreground' : 'bg-muted hover:bg-muted/80'}`}
        >
          Community
        </button>
        <button 
          onClick={() => setView("recruitment")}
          className={`px-4 py-2 rounded-md font-medium text-sm transition-colors ${currentView === 'recruitment' ? 'bg-primary text-primary-foreground' : 'bg-muted hover:bg-muted/80'}`}
        >
          Recruitment
        </button>
        <button 
          onClick={() => setView("management")}
          className={`px-4 py-2 rounded-md font-medium text-sm transition-colors ${currentView === 'management' ? 'bg-primary text-primary-foreground' : 'bg-muted hover:bg-muted/80'}`}
        >
          Management
        </button>
      </div>

      <div className="flex gap-2">
        {/* Placeholder for action buttons like "Export" or "Create Team" depending on view */}
      </div>
    </div>
  );
}
