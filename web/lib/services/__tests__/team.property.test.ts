import { describe, expect, it } from "vitest";
import fc from "fast-check";
import { fcConfig } from "@/lib/test-utils/fc-config";
import { TeamRules, GlobalTeamState } from "@/lib/engines/business-rules/team-rules";

describe("Property tests: Team Constraints", () => {
  it("Maximum team size is never exceeded upon approval", () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 10 }), // maxTeamSize
        fc.integer({ min: 1, max: 20 }), // current members count
        (maxTeamSize, currentMembersCount) => {
          const state: GlobalTeamState = {
            events: { "e1": { maxTeamSize } },
            teams: { "t1": { id: "t1", captainId: "c1", memberIds: Array.from({ length: currentMembersCount }, (_, i) => `m${i}`) } },
            userTeams: { "e1": { "c1": "t1" } },
          };

          const result = TeamRules.canApproveJoinRequest(state, "e1", "t1", "u1", "c1");

          if (currentMembersCount >= maxTeamSize) {
            expect(result.ok).toBe(false);
            expect(result.error).toBe("TEAM_FULL");
          } else {
            expect(result.ok).toBe(true);
          }
        }
      ),
      fcConfig
    );
  });

  it("Users cannot belong to multiple teams within the same event", () => {
    fc.assert(
      fc.property(
        fc.boolean(), // whether they are in another team or the same team
        (inSameTeam) => {
          const state: GlobalTeamState = {
            events: { "e1": { maxTeamSize: 5 } },
            teams: { "t1": { id: "t1", captainId: "c1", memberIds: ["c1"] } },
            userTeams: { "e1": { "u1": inSameTeam ? "t1" : "t2" } },
          };

          const result = TeamRules.canApproveJoinRequest(state, "e1", "t1", "u1", "c1");
          expect(result.ok).toBe(false);
          expect(result.error).toMatch(/ALREADY_IN/);
        }
      ),
      fcConfig
    );
  });

  it("Maximum teams limit is enforced per event", () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 50 }),
        fc.integer({ min: 0, max: 60 }),
        (maxTeams, currentTeams) => {
          const userTeams: Record<string, string> = {};
          for (let i = 0; i < currentTeams; i++) {
            userTeams[`u${i}`] = `t${i}`;
          }

          const state: GlobalTeamState = {
            events: { "e1": { maxTeams } },
            teams: {},
            userTeams: { "e1": userTeams },
          };

          const result = TeamRules.canCreateTeam(state, "e1", "captain-new");

          if (currentTeams >= maxTeams) {
            expect(result.ok).toBe(false);
            expect(result.error).toBe("TEAM_LIMIT_REACHED");
          } else {
            expect(result.ok).toBe(true);
          }
        }
      ),
      fcConfig
    );
  });
});
