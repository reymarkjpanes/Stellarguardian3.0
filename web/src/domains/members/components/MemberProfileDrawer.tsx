"use client";

import { useState } from "react";
import { EntityDrawer } from "@/components/ui/entity-drawer";
import { MemberProfileProjection } from "../api/dto/MemberProjections";

export function MemberProfileDrawer({
  member,
  isOpen,
  onClose,
  onInvite,
}: {
  member: MemberProfileProjection | null;
  isOpen: boolean;
  onClose: () => void;
  onInvite?: (memberId: string) => void;
}) {
  const [activeTab, setActiveTab] = useState("overview");

  if (!member) return null;

  const actions = (
    <>
      <button className="px-4 py-2 border rounded-md text-sm font-medium hover:bg-muted transition-colors">
        View Full Profile
      </button>
      {member.activityStatus === "Available for Team" && (
        <button
          onClick={() => onInvite?.(member.userId)}
          className="px-4 py-2 bg-primary text-primary-foreground rounded-md text-sm font-medium hover:bg-primary/90 transition-colors"
        >
          Invite to Team
        </button>
      )}
    </>
  );

  return (
    <EntityDrawer
      isOpen={isOpen}
      onClose={onClose}
      title={member.displayName}
      subtitle={`${member.eventRole} • ${member.activityStatus}`}
      actions={actions}
      tabs={[
        { id: "overview", label: "Overview" },
        { id: "skills", label: "Skills & Experience" },
        { id: "activity", label: "Activity" },
      ]}
      activeTab={activeTab}
      onTabChange={setActiveTab}
    >
      {activeTab === "overview" && (
        <div className="space-y-6">
          <section>
            <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">
              About
            </h3>
            <p className="text-sm">{member.bio || "No bio provided."}</p>
          </section>

          <section>
            <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">
              Compatibility Score
            </h3>
            <div className="p-4 rounded-xl border bg-muted/30">
              <div className="flex items-end gap-2 mb-2">
                <span className="text-3xl font-bold text-primary">92%</span>
                <span className="text-sm text-muted-foreground mb-1">Match</span>
              </div>
              <div className="grid grid-cols-2 gap-2 text-sm mt-4">
                <div className="flex justify-between">
                  <span>Skills</span> <span className="font-medium text-green-500">★★★★★</span>
                </div>
                <div className="flex justify-between">
                  <span>Timezone</span> <span className="font-medium text-green-500">★★★★★</span>
                </div>
                <div className="flex justify-between">
                  <span>Languages</span> <span className="font-medium text-yellow-500">★★★★☆</span>
                </div>
                <div className="flex justify-between">
                  <span>Experience</span> <span className="font-medium text-yellow-500">★★★☆☆</span>
                </div>
              </div>
            </div>
          </section>

          <section>
            <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">
              Current Team
            </h3>
            {member.teamId ? (
              <div className="p-3 rounded border flex items-center justify-between cursor-pointer hover:border-primary transition-colors">
                <span className="font-medium">{member.teamName}</span>
                <span className="text-xs text-primary">View Team →</span>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">Not in a team yet.</p>
            )}
          </section>
        </div>
      )}

      {activeTab === "skills" && (
        <div className="space-y-6">
          <section>
            <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">
              Top Skills
            </h3>
            <div className="flex flex-wrap gap-2">
              {member.skills?.map(
                (s: { id: string; name: string; experienceLevel?: string | null }) => (
                  <span
                    key={s.id}
                    className="px-2.5 py-1 rounded-md bg-secondary text-secondary-foreground text-sm font-medium"
                  >
                    {s.name}{" "}
                    {s.experienceLevel && (
                      <span className="text-muted-foreground font-normal opacity-75">
                        · {s.experienceLevel}
                      </span>
                    )}
                  </span>
                ),
              )}
            </div>
          </section>
        </div>
      )}
    </EntityDrawer>
  );
}
