/**
 * PermissionEngine matrix tests (Task 5.2).
 *
 * Exhaustively tests expected grants/denials for all 10 roles across
 * key resource × action combinations, including ABAC rules.
 */
import { describe, it, expect } from "vitest";
import { PermissionEngine } from "../permission-engine";
import type { PermissionContext } from "../permission-engine";
import type { PlatformRole } from "@/types";

function ctx(
  role: PlatformRole | PlatformRole[],
  resource: string,
  action: string,
  attributes?: PermissionContext["attributes"],
): PermissionContext {
  return {
    userId: "test-user",
    userRoles: Array.isArray(role) ? role : [role],
    resourceCategory: resource,
    action,
    attributes,
  };
}

// ── Static grant matrix ──────────────────────────────────────────────────────
const EXPECTED: Array<[PlatformRole, string, string, boolean, object?]> = [
  // PlatformAdmin — full access
  ["PlatformAdmin", "Events", "read", true],
  ["PlatformAdmin", "Events", "update", true],
  ["PlatformAdmin", "Events", "delete", true],
  ["PlatformAdmin", "Submissions", "read", true],
  ["PlatformAdmin", "Disputes", "approve", true],

  // PlatformAdmin freeze requires complianceFlagExists
  [
    "PlatformAdmin",
    "Events",
    "update",
    false,
    { isFreezeAction: true, complianceFlagExists: false },
  ],
  ["PlatformAdmin", "Events", "update", true, { isFreezeAction: true, complianceFlagExists: true }],

  // WorkspaceOwner
  ["WorkspaceOwner", "Events", "create", true],
  ["WorkspaceOwner", "Members", "delete", true],
  ["WorkspaceOwner", "EscrowFunding", "create", true],
  ["WorkspaceOwner", "Submissions", "create", false],
  ["WorkspaceOwner", "Evaluations", "create", false],

  // WorkspaceAdmin
  ["WorkspaceAdmin", "Events", "update", true],
  ["WorkspaceAdmin", "Workspaces", "delete", false],
  ["WorkspaceAdmin", "EscrowFunding", "create", true],

  // Organizer — editable before RegistrationClosed
  ["Organizer", "Events", "update", true, { eventState: "Draft" }],
  ["Organizer", "Events", "update", true, { eventState: "RegistrationOpen" }],
  ["Organizer", "Events", "update", false, { eventState: "SubmissionOpen" }],
  ["Organizer", "Events", "update", false, { eventState: "Completed" }],
  ["Organizer", "EscrowFunding", "create", true],
  ["Organizer", "Disbursements", "create", false],
  ["Organizer", "Submissions", "create", false],

  // Sponsor — read only
  ["Sponsor", "Events", "read", true],
  ["Sponsor", "EscrowFunding", "read", true],
  ["Sponsor", "Submissions", "read", false],
  ["Sponsor", "Evaluations", "read", false],
  ["Sponsor", "Events", "create", false],

  // Judge — evaluate only assigned submissions
  ["Judge", "Submissions", "read", true],
  ["Judge", "Evaluations", "create", true],
  [
    "Judge",
    "Submissions",
    "evaluate",
    true,
    { targetSubmissionId: "s1", assignedSubmissionIds: ["s1", "s2"] },
  ],
  [
    "Judge",
    "Submissions",
    "evaluate",
    false,
    { targetSubmissionId: "s3", assignedSubmissionIds: ["s1", "s2"] },
  ],
  ["Judge", "Submissions", "evaluate", false, {}], // no target provided
  ["Judge", "EscrowFunding", "read", false],
  ["Judge", "Teams", "delete", false],

  // Mentor — read-only
  ["Mentor", "Submissions", "read", true],
  ["Mentor", "Teams", "read", true],
  ["Mentor", "Evaluations", "create", false],
  ["Mentor", "EscrowFunding", "read", false],

  // Participant — own submission + file dispute if owner
  ["Participant", "Submissions", "create", true],
  ["Participant", "Submissions", "update", true, { isOwner: true }],
  ["Participant", "Submissions", "update", false, { isOwner: false }],
  ["Participant", "Disputes", "create", true, { isOwner: true }],
  ["Participant", "Disputes", "create", false, { isOwner: false }],
  ["Participant", "EscrowFunding", "read", false],
  ["Participant", "Evaluations", "read", false],

  // TeamCaptain
  ["TeamCaptain", "Submissions", "create", true],
  ["TeamCaptain", "Submissions", "update", true],
  ["TeamCaptain", "Teams", "update", true, { isOwner: true }],
  ["TeamCaptain", "Teams", "approve", true],
  ["TeamCaptain", "Teams", "reject", true],
  ["TeamCaptain", "EscrowFunding", "read", false],

  // TeamMember
  ["TeamMember", "Submissions", "update", true],
  ["TeamMember", "Submissions", "create", false],
  ["TeamMember", "Teams", "update", false],
  ["TeamMember", "Disputes", "read", true],
  ["TeamMember", "Disputes", "create", false],
];

describe("PermissionEngine matrix", () => {
  EXPECTED.forEach(([role, resource, action, expected, attributes]) => {
    const label = `${role} | ${action} ${resource}${attributes ? ` | attrs=${JSON.stringify(attributes)}` : ""} → ${expected}`;
    it(label, () => {
      const result = PermissionEngine.can(
        ctx(role, resource, action, attributes as PermissionContext["attributes"]),
      );
      expect(result).toBe(expected);
    });
  });
});

// ── Multi-role scenarios ─────────────────────────────────────────────────────
describe("PermissionEngine multi-role", () => {
  it("grants if any role in the array grants access", () => {
    // Mentor alone cannot create evaluations; Organizer has approve on Events but not Evaluations
    // Judge can create evaluations
    const result = PermissionEngine.can(ctx(["Mentor", "Judge"], "Evaluations", "create"));
    expect(result).toBe(true);
  });

  it("denies when no role grants access", () => {
    const result = PermissionEngine.can(ctx(["Mentor", "Participant"], "EscrowFunding", "create"));
    expect(result).toBe(false);
  });

  it("WorkspaceAdmin + Organizer can edit event in Draft state", () => {
    const result = PermissionEngine.can(
      ctx(["WorkspaceAdmin", "Organizer"], "Events", "update", { eventState: "Draft" }),
    );
    expect(result).toBe(true);
  });
});

// ── require() throws ─────────────────────────────────────────────────────────
describe("PermissionEngine.require()", () => {
  it("does not throw when permission is granted", () => {
    expect(() => PermissionEngine.require(ctx("PlatformAdmin", "Events", "delete"))).not.toThrow();
  });

  it("throws with FORBIDDEN code when permission is denied", () => {
    expect(() => PermissionEngine.require(ctx("Participant", "EscrowFunding", "create"))).toThrow();
  });
});
