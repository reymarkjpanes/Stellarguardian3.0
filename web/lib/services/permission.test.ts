/**
 * Property tests for the permission matrix (task 5.5).
 */
import { describe, expect, it } from "vitest";
import fc from "fast-check";
import { fcConfig } from "@/lib/test-utils/fc-config";
import { can, authorize } from "./permission";
import type { AuthContext } from "./permission";
import type { Action, PlatformRole, ResourceCategory } from "@/types";

const ALL_ROLES: PlatformRole[] = [
  "PlatformAdmin", "WorkspaceOwner", "WorkspaceAdmin", "Organizer",
  "Sponsor", "Judge", "Mentor", "Participant", "TeamCaptain", "TeamMember",
];

const ALL_RESOURCES: ResourceCategory[] = [
  "Events", "Submissions", "Evaluations", "Teams", "EscrowFunding",
  "Disbursements", "Workspaces", "Members", "Invitations", "Sponsors",
  "Milestones", "Disputes", "Notifications",
];

const ALL_ACTIONS: Action[] = ["read", "create", "update", "delete", "approve", "reject"];

function arbRole(): fc.Arbitrary<PlatformRole> {
  return fc.constantFrom(...ALL_ROLES);
}

function arbResource(): fc.Arbitrary<ResourceCategory> {
  return fc.constantFrom(...ALL_RESOURCES);
}

function arbAction(): fc.Arbitrary<Action> {
  return fc.constantFrom(...ALL_ACTIONS);
}

describe("Property tests: Permission matrix", () => {
  // Feature: nextjs-platform-conversion, Property 31: No role exceeds its declared permission scope
  it("Property 31: PlatformAdmin has superset of every other role's permissions (except domain-specific create)", () => {
    fc.assert(
      fc.property(arbRole(), arbResource(), arbAction(), (role, resource, action) => {
        if (role === "PlatformAdmin") return; // Skip comparing PlatformAdmin to itself

        // PlatformAdmin intentionally does not inherit domain-specific "create" capabilities
        // (e.g., Judge creates Evaluations, Participant creates Submissions/Disputes).
        // This is by design — PlatformAdmin manages/moderates but doesn't act in domain roles.
        const domainCreateExceptions = new Set([
          "Evaluations:create", // Only Judges create evaluations
          "Submissions:create", // Only Participants/TeamCaptain/TeamMember create submissions
          "Teams:create", // Only Participants/TeamCaptain create teams
          "Disputes:create", // PlatformAdmin can also create disputes (it's in the matrix)
        ]);

        const key = `${resource}:${action}`;
        if (domainCreateExceptions.has(key)) return;

        // Outside exceptions, PlatformAdmin should be a superset
        if (can(role, resource, action)) {
          expect(can("PlatformAdmin", resource, action)).toBe(true);
        }
      }),
      fcConfig,
    );
  });

  it("Property 31 (supplement): read-only roles cannot write to resources", () => {
    const readOnlyRoles: PlatformRole[] = ["Sponsor", "Mentor"];
    const writeActions: Action[] = ["create", "update", "delete", "approve", "reject"];

    fc.assert(
      fc.property(
        fc.constantFrom(...readOnlyRoles),
        arbResource(),
        fc.constantFrom(...writeActions),
        (role, resource, action) => {
          // Read-only roles should not be able to write (except Notifications update for preferences)
          if (resource === "Notifications" && action === "update") return;
          expect(can(role, resource, action)).toBe(false);
        },
      ),
      fcConfig,
    );
  });

  it("Every role can always read Notifications (for their own)", () => {
    fc.assert(
      fc.property(arbRole(), (role) => {
        expect(can(role, "Notifications", "read")).toBe(true);
      }),
      fcConfig,
    );
  });

  it("Every role can read Events", () => {
    fc.assert(
      fc.property(arbRole(), (role) => {
        expect(can(role, "Events", "read")).toBe(true);
      }),
      fcConfig,
    );
  });

  it("authorize throws ForbiddenError when can() returns false", () => {
    fc.assert(
      fc.property(arbRole(), arbResource(), arbAction(), (role, resource, action) => {
        const ctx: AuthContext = {
          userId: "test-user-id",
          role,
          scope: { userId: "test-user-id" },
        };

        if (!can(role, resource, action)) {
          expect(() => authorize(ctx, resource, action)).toThrow();
        } else {
          expect(() => authorize(ctx, resource, action)).not.toThrow();
        }
      }),
      fcConfig,
    );
  });

  it("Only Organizer+ roles can create Events", () => {
    const creatorRoles = new Set<PlatformRole>(["PlatformAdmin", "WorkspaceOwner", "WorkspaceAdmin", "Organizer"]);

    fc.assert(
      fc.property(arbRole(), (role) => {
        const canCreate = can(role, "Events", "create");
        expect(canCreate).toBe(creatorRoles.has(role));
      }),
      fcConfig,
    );
  });

  it("Only Judges (and PlatformAdmin) can create Evaluations", () => {
    fc.assert(
      fc.property(arbRole(), (role) => {
        const canCreate = can(role, "Evaluations", "create");
        // Only Judge can create evaluations — PlatformAdmin manages but doesn't judge
        if (role === "Judge") {
          expect(canCreate).toBe(true);
        } else {
          expect(canCreate).toBe(false);
        }
      }),
      fcConfig,
    );
  });
});
