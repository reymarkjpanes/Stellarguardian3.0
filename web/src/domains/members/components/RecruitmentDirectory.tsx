"use client";

import { TeamListDTO } from "../../teams/api/dto/TeamDTO";

export function RecruitmentDirectory({ teams, isLoading }: { teams: TeamListDTO[], isLoading?: boolean }) {
  if (isLoading) {
    return <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
      {[1, 2, 3, 4, 5, 6].map(i => <div key={i} className="h-56 rounded-xl bg-muted animate-pulse"></div>)}
    </div>;
  }

  if (!teams || teams.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center p-12 border border-dashed rounded-xl">
        <h3 className="text-lg font-medium">No recruiting teams.</h3>
        <p className="text-muted-foreground mt-1">Create your own team or check back later.</p>
        <button className="mt-4 px-4 py-2 bg-primary text-primary-foreground rounded-md text-sm font-medium">
          Create Team
        </button>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
      {teams.map(team => (
        <div key={team.id} className="border rounded-xl p-5 hover:border-primary cursor-pointer transition-colors group bg-card">
          <div className="flex items-start justify-between">
            <div>
              <h3 className="font-bold text-lg group-hover:text-primary transition-colors">{team.name}</h3>
              <p className="text-sm text-muted-foreground line-clamp-2 mt-1">{team.tagline}</p>
            </div>
            {/* Compatibility Badge placeholder */}
            <span className="text-xs font-semibold bg-accent text-accent-foreground px-2 py-1 rounded-md">
              92% Match
            </span>
          </div>
          
          <div className="mt-4">
            <h4 className="text-xs font-semibold text-muted-foreground mb-2 uppercase tracking-wider">Looking For</h4>
            <div className="flex flex-wrap gap-1.5">
              <span className="text-[11px] font-medium px-2 py-0.5 rounded-md bg-secondary text-secondary-foreground border border-border">Backend Developer</span>
              <span className="text-[11px] font-medium px-2 py-0.5 rounded-md bg-secondary text-secondary-foreground border border-border">Rust</span>
            </div>
          </div>

          <div className="mt-5 pt-4 border-t flex justify-between items-center">
            <div className="flex -space-x-2">
               {[1,2,3].map(i => (
                 <div key={i} className="h-7 w-7 rounded-full bg-muted border-2 border-card flex items-center justify-center text-[10px]">U{i}</div>
               ))}
            </div>
            <button className="text-sm font-medium text-primary hover:underline">
              Request to Join
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
