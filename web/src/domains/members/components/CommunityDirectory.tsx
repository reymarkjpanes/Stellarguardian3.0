"use client";

import { MemberDirectoryProjection } from "../api/dto/MemberProjections";

export function CommunityDirectory({
  members,
  isLoading,
}: {
  members: MemberDirectoryProjection[];
  isLoading?: boolean;
}) {
  if (isLoading) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
        {[1, 2, 3, 4, 5, 6].map((i) => (
          <div key={i} className="h-48 rounded-xl bg-muted animate-pulse"></div>
        ))}
      </div>
    );
  }

  if (!members || members.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center p-12 border border-dashed rounded-xl">
        <h3 className="text-lg font-medium">Nobody matches your filters.</h3>
        <p className="text-muted-foreground mt-1">Try adjusting your role or skills criteria.</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
      {members.map((member) => (
        <div
          key={member.userId}
          className="border rounded-xl p-5 hover:border-primary cursor-pointer transition-colors group bg-card"
        >
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-full bg-secondary flex items-center justify-center text-lg font-semibold overflow-hidden">
                {member.avatarUrl ? (
                  <img src={member.avatarUrl} alt="" className="h-full w-full object-cover" />
                ) : (
                  member.displayName.charAt(0)
                )}
              </div>
              <div>
                <h3 className="font-semibold group-hover:text-primary transition-colors">
                  {member.displayName}
                </h3>
                <p className="text-xs text-muted-foreground">{member.eventRole}</p>
              </div>
            </div>
            {member.activityStatus === "Available for Team" && (
              <span
                className="h-2.5 w-2.5 rounded-full bg-green-500"
                title="Looking for a team"
              ></span>
            )}
          </div>

          <div className="mt-4 flex flex-wrap gap-1.5">
            {member.skills?.slice(0, 3).map((skill: { id: string; name: string }) => (
              <span
                key={skill.id}
                className="text-[11px] font-medium px-2 py-0.5 rounded-md bg-secondary text-secondary-foreground"
              >
                {skill.name}
              </span>
            ))}
            {(member.skills?.length || 0) > 3 && (
              <span className="text-[11px] font-medium px-2 py-0.5 rounded-md bg-secondary text-secondary-foreground">
                +{(member.skills?.length || 0) - 3}
              </span>
            )}
          </div>

          <div className="mt-4 pt-4 border-t flex justify-between items-center text-xs text-muted-foreground">
            <span>{member.teamId ? member.teamName : "No Team"}</span>
            <span className="font-medium text-foreground">
              {member.profileCompletionScore}% Complete
            </span>
          </div>
        </div>
      ))}
    </div>
  );
}
