"use client";

import { useState } from "react";
import { EntityDrawer } from "@/components/ui/entity-drawer";
import { TeamListDTO } from "../../teams/api/dto/TeamDTO";

export function TeamProfileDrawer({
  team,
  isOpen,
  onClose,
  onRequestJoin,
}: {
  team: TeamListDTO | null;
  isOpen: boolean;
  onClose: () => void;
  onRequestJoin?: (teamId: string) => void;
}) {
  const [activeTab, setActiveTab] = useState("overview");

  if (!team) return null;

  const actions = (
    <>
      <button className="px-4 py-2 border rounded-md text-sm font-medium hover:bg-muted transition-colors">
        View Team Workspace
      </button>
      <button 
        onClick={() => onRequestJoin?.(team.id)}
        className="px-4 py-2 bg-primary text-primary-foreground rounded-md text-sm font-medium hover:bg-primary/90 transition-colors"
      >
        Request to Join
      </button>
    </>
  );

  return (
    <EntityDrawer
      isOpen={isOpen}
      onClose={onClose}
      title={team.name}
      subtitle={`Recruiting • ${team.memberCount}/${team.maxMembers} Members`}
      actions={actions}
      tabs={[
        { id: "overview", label: "Overview" },
        { id: "members", label: "Members" },
        { id: "open-roles", label: "Open Roles" }
      ]}
      activeTab={activeTab}
      onTabChange={setActiveTab}
    >
      {activeTab === "overview" && (
        <div className="space-y-6">
          <section>
            <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">About Team</h3>
            <p className="text-sm">{team.tagline || "No description provided."}</p>
          </section>
          
          <section>
            <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">Technology Stack</h3>
            <div className="flex flex-wrap gap-2">
              <span className="px-2.5 py-1 rounded-md bg-secondary text-secondary-foreground text-sm font-medium">Rust</span>
              <span className="px-2.5 py-1 rounded-md bg-secondary text-secondary-foreground text-sm font-medium">React</span>
            </div>
          </section>
        </div>
      )}

      {activeTab === "members" && (
        <div className="space-y-4">
           {/* Mock Member List */}
           {[1, 2].map((i) => (
             <div key={i} className="flex items-center gap-3 p-3 border rounded-lg hover:border-primary cursor-pointer transition-colors">
                <div className="h-10 w-10 rounded-full bg-muted flex items-center justify-center font-bold">U{i}</div>
                <div>
                  <p className="font-medium text-sm">User {i}</p>
                  <p className="text-xs text-muted-foreground">{i === 1 ? 'Captain' : 'Member'}</p>
                </div>
             </div>
           ))}
        </div>
      )}
    </EntityDrawer>
  );
}
