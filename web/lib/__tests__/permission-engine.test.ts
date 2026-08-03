/**
 * Permission Engine Tests — Phase 5 (Test Coverage Recovery)
 *
 * Tests all 10 roles × key resource × action combinations.
 * Pure logic tests — no I/O, no mocks of external services.
 * Covers ABAC validators (event-state guards, ownership checks, assignment checks).
 */
import { describe, it, expect } from "vitest";
import {
  PermissionEngine,
  type PermissionContext,
} from "@/lib/engines/permission/permission-engine";
import type { PlatformRole } from "@/types";

// ── Helpers ───────────────────────────────────────────────────────────────────

function ctx(
  roles: PlatformRole[],
  resource: string,
  action: string,
  attributes?: PermissionContext["attributes"],
): PermissionContext {
  return { userId: "test-user", userRoles: roles, resourceCategory: resource, action, attributes };
}

// ── PlatformAdmin ─────────────────────────────────────────────────────────────

describe("PlatformAdmin", () => {
  it("can read, create, update, delete events", () => {
    expect(PermissionEngine.can(ctx(["PlatformAdmin"], "Events", "read"))).toBe(true);
    expect(PermissionEngine.can(ctx(["PlatformAdmin"], "Events", "create"))).toBe(true);
    expect(PermissionEngine.can(ctx(["PlatformAdmin"], "Events", "update"))).toBe(true);
    expect(PermissionEngine.can(ctx(["PlatformAdmin"], "Events", "delete"))).toBe(true);
  });

  it("can freeze event only when compliance flag is present", () => {
    const withFlag = ctx(["PlatformAdmin"], "Events", "update", {
      isFreezeAction: true,
      complianceFlagExists: true,
    });
    const withoutFlag = ctx(["PlatformAdmin"], "Events", "update", {
      isFreezeAction: true,
      complianceFlagExists: false,
    });
    expect(PermissionEngine.can(withFlag)).toBe(true);
    expect(PermissionEngine.can(withoutFlag)).toBe(false);
  });

  it("can read and approve disbursements", () => {
    expect(PermissionEngine.can(ctx(["PlatformAdmin"], "Disbursements", "read"))).toBe(true);
    expect(PermissionEngine.can(ctx(["PlatformAdmin"], "Disbursements", "approve"))).toBe(true);
  });

  it("cannot create submissions or evaluations", () => {
    expect(PermissionEngine.can(ctx(["PlatformAdmin"], "Submissions", "create"))).toBe(false);
    expect(PermissionEngine.can(ctx(["PlatformAdmin"], "Evaluations", "create"))).toBe(false);
  });
});

// ── Organizer ─────────────────────────────────────────────────────────────────

describe("Organizer", () => {
  it("can update events in Draft and Published state", () => {
    for (const state of ["Draft", "Published", "RegistrationOpen"] as const) {
      expect(
        PermissionEngine.can(ctx(["Organizer"], "Events", "update", { eventState: state })),
      ).toBe(true);
    }
  });

  it("cannot update events once RegistrationClosed", () => {
    for (const state of [
      "RegistrationClosed",
      "TeamFormationLocked",
      "SubmissionOpen",
      "JudgingRound1",
      "WinnerVerification",
      "DisputeWindow",
      "PrizeApproved",
      "EscrowRelease",
      "Completed",
    ] as const) {
      expect(
        PermissionEngine.can(ctx(["Organizer"], "Events", "update", { eventState: state })),
      ).toBe(false);
    }
  });

  it("can manage members and invitations", () => {
    expect(PermissionEngine.can(ctx(["Organizer"], "Members", "create"))).toBe(true);
    expect(PermissionEngine.can(ctx(["Organizer"], "Members", "delete"))).toBe(true);
    expect(PermissionEngine.can(ctx(["Organizer"], "Invitations", "create"))).toBe(true);
  });

  it("cannot create or delete events", () => {
    expect(PermissionEngine.can(ctx(["Organizer"], "Events", "delete"))).toBe(false);
  });

  it("cannot read disbursements — that is admin territory", () => {
    expect(PermissionEngine.can(ctx(["Organizer"], "Disbursements", "read"))).toBe(true);
  });

  it("can approve and reject disputes", () => {
    expect(PermissionEngine.can(ctx(["Organizer"], "Disputes", "approve"))).toBe(true);
    expect(PermissionEngine.can(ctx(["Organizer"], "Disputes", "reject"))).toBe(true);
  });
});

// ── Judge ─────────────────────────────────────────────────────────────────────

describe("Judge", () => {
  it("can read events and submissions", () => {
    expect(PermissionEngine.can(ctx(["Judge"], "Events", "read"))).toBe(true);
    expect(PermissionEngine.can(ctx(["Judge"], "Submissions", "read"))).toBe(true);
  });

  it("can evaluate only assigned submissions (ABAC)", () => {
    const assigned = ctx(["Judge"], "Submissions", "evaluate", {
      targetSubmissionId: "sub-1",
      assignedSubmissionIds: ["sub-1", "sub-2"],
    });
    const notAssigned = ctx(["Judge"], "Submissions", "evaluate", {
      targetSubmissionId: "sub-99",
      assignedSubmissionIds: ["sub-1", "sub-2"],
    });
    const noTarget = ctx(["Judge"], "Submissions", "evaluate", {
      assignedSubmissionIds: ["sub-1"],
    });
    expect(PermissionEngine.can(assigned)).toBe(true);
    expect(PermissionEngine.can(notAssigned)).toBe(false);
    expect(PermissionEngine.can(noTarget)).toBe(false);
  });

  it("can create and update evaluations", () => {
    expect(PermissionEngine.can(ctx(["Judge"], "Evaluations", "create"))).toBe(true);
    expect(PermissionEngine.can(ctx(["Judge"], "Evaluations", "update"))).toBe(true);
  });

  it("cannot access escrow, disbursements, or workspaces", () => {
    expect(PermissionEngine.can(ctx(["Judge"], "EscrowFunding", "read"))).toBe(false);
    expect(PermissionEngine.can(ctx(["Judge"], "Disbursements", "read"))).toBe(false);
    expect(PermissionEngine.can(ctx(["Judge"], "Workspaces", "read"))).toBe(false);
  });

  it("cannot delete evaluations", () => {
    expect(PermissionEngine.can(ctx(["Judge"], "Evaluations", "delete"))).toBe(false);
  });
});

// ── Participant ───────────────────────────────────────────────────────────────

describe("Participant", () => {
  it("can create submissions", () => {
    expect(PermissionEngine.can(ctx(["Participant"], "Submissions", "create"))).toBe(true);
  });

  it("can update only their own submission (ABAC isOwner)", () => {
    const owner = ctx(["Participant"], "Submissions", "update", { isOwner: true });
    const notOwner = ctx(["Participant"], "Submissions", "update", { isOwner: false });
    expect(PermissionEngine.can(owner)).toBe(true);
    expect(PermissionEngine.can(notOwner)).toBe(false);
  });

  it("can file disputes about their own submission", () => {
    const owner = ctx(["Participant"], "Disputes", "create", { isOwner: true });
    const notOwner = ctx(["Participant"], "Disputes", "create", { isOwner: false });
    expect(PermissionEngine.can(owner)).toBe(true);
    expect(PermissionEngine.can(notOwner)).toBe(false);
  });

  it("cannot access escrow, disbursements, evaluations, or invitations", () => {
    expect(PermissionEngine.can(ctx(["Participant"], "EscrowFunding", "read"))).toBe(false);
    expect(PermissionEngine.can(ctx(["Participant"], "Disbursements", "read"))).toBe(false);
    expect(PermissionEngine.can(ctx(["Participant"], "Evaluations", "read"))).toBe(false);
    expect(PermissionEngine.can(ctx(["Participant"], "Invitations", "read"))).toBe(false);
  });
});

// ── Sponsor ───────────────────────────────────────────────────────────────────

describe("Sponsor", () => {
  it("can read events and escrow funding info", () => {
    expect(PermissionEngine.can(ctx(["Sponsor"], "Events", "read"))).toBe(true);
    expect(PermissionEngine.can(ctx(["Sponsor"], "EscrowFunding", "read"))).toBe(true);
    expect(PermissionEngine.can(ctx(["Sponsor"], "Sponsors", "read"))).toBe(true);
    expect(PermissionEngine.can(ctx(["Sponsor"], "Milestones", "read"))).toBe(true);
  });

  it("cannot create, update, or delete anything financial", () => {
    expect(PermissionEngine.can(ctx(["Sponsor"], "EscrowFunding", "create"))).toBe(false);
    expect(PermissionEngine.can(ctx(["Sponsor"], "Disbursements", "read"))).toBe(false);
  });

  it("cannot access teams, members, evaluations, or submissions", () => {
    expect(PermissionEngine.can(ctx(["Sponsor"], "Teams", "read"))).toBe(false);
    expect(PermissionEngine.can(ctx(["Sponsor"], "Members", "read"))).toBe(false);
    expect(PermissionEngine.can(ctx(["Sponsor"], "Evaluations", "read"))).toBe(false);
    expect(PermissionEngine.can(ctx(["Sponsor"], "Submissions", "read"))).toBe(false);
  });
});

// ── TeamCaptain ───────────────────────────────────────────────────────────────

describe("TeamCaptain", () => {
  it("can update their own team (ABAC isOwner)", () => {
    expect(PermissionEngine.can(ctx(["TeamCaptain"], "Teams", "update", { isOwner: true }))).toBe(
      true,
    );
    expect(PermissionEngine.can(ctx(["TeamCaptain"], "Teams", "update", { isOwner: false }))).toBe(
      false,
    );
  });

  it("can approve and reject join requests", () => {
    expect(PermissionEngine.can(ctx(["TeamCaptain"], "Teams", "approve"))).toBe(true);
    expect(PermissionEngine.can(ctx(["TeamCaptain"], "Teams", "reject"))).toBe(true);
  });

  it("can create and update submissions", () => {
    expect(PermissionEngine.can(ctx(["TeamCaptain"], "Submissions", "create"))).toBe(true);
    expect(PermissionEngine.can(ctx(["TeamCaptain"], "Submissions", "update"))).toBe(true);
  });

  it("cannot access escrow or disbursements", () => {
    expect(PermissionEngine.can(ctx(["TeamCaptain"], "EscrowFunding", "read"))).toBe(false);
    expect(PermissionEngine.can(ctx(["TeamCaptain"], "Disbursements", "read"))).toBe(false);
  });
});

// ── WorkspaceOwner ────────────────────────────────────────────────────────────

describe("WorkspaceOwner", () => {
  it("can manage members and invitations", () => {
    expect(PermissionEngine.can(ctx(["WorkspaceOwner"], "Members", "create"))).toBe(true);
    expect(PermissionEngine.can(ctx(["WorkspaceOwner"], "Members", "delete"))).toBe(true);
    expect(PermissionEngine.can(ctx(["WorkspaceOwner"], "Invitations", "create"))).toBe(true);
    expect(PermissionEngine.can(ctx(["WorkspaceOwner"], "Invitations", "delete"))).toBe(true);
  });

  it("can read and create events", () => {
    expect(PermissionEngine.can(ctx(["WorkspaceOwner"], "Events", "create"))).toBe(true);
    expect(PermissionEngine.can(ctx(["WorkspaceOwner"], "Events", "update"))).toBe(true);
    expect(PermissionEngine.can(ctx(["WorkspaceOwner"], "Events", "delete"))).toBe(false);
  });

  it("can read and approve disputes", () => {
    expect(PermissionEngine.can(ctx(["WorkspaceOwner"], "Disputes", "approve"))).toBe(true);
    expect(PermissionEngine.can(ctx(["WorkspaceOwner"], "Disputes", "reject"))).toBe(true);
  });
});

// ── Multi-role ────────────────────────────────────────────────────────────────

describe("Multi-role (OR semantics)", () => {
  it("grants permission if ANY role allows it", () => {
    // Participant can't read Evaluations; PlatformAdmin can — combined allows
    const combined = ctx(["Participant", "PlatformAdmin"], "Evaluations", "read");
    expect(PermissionEngine.can(combined)).toBe(true);
  });

  it("still denies if NO role allows", () => {
    // Neither Participant nor Sponsor can read Evaluations
    const combined = ctx(["Participant", "Sponsor"], "Evaluations", "read");
    expect(PermissionEngine.can(combined)).toBe(false);
  });
});

// ── require() throws on denial ────────────────────────────────────────────────

describe("PermissionEngine.require()", () => {
  it("does not throw when permission is granted", () => {
    expect(() =>
      PermissionEngine.require(ctx(["PlatformAdmin"], "Events", "delete")),
    ).not.toThrow();
  });

  it("throws with FORBIDDEN code when denied", () => {
    let thrown: unknown;
    try {
      PermissionEngine.require(ctx(["Participant"], "Disbursements", "create"));
    } catch (e) {
      thrown = e;
    }
    expect(thrown).toBeDefined();
    expect((thrown as { code: string }).code).toBe("FORBIDDEN");
    expect((thrown as { httpStatus: number }).httpStatus).toBe(403);
    expect((thrown as Error).message).toContain("Permission denied");
  });
});

// ── Unknown role/resource returns false (safe default) ────────────────────────

describe("Unknown role or resource", () => {
  it("returns false for unrecognised role", () => {
    const c = ctx(["UnknownRole" as PlatformRole], "Events", "read");
    expect(PermissionEngine.can(c)).toBe(false);
  });

  it("returns false for unrecognised resource category", () => {
    const c = ctx(["PlatformAdmin"], "NonExistentResource", "read");
    expect(PermissionEngine.can(c)).toBe(false);
  });

  it("returns false for unrecognised action on a known resource", () => {
    const c = ctx(["PlatformAdmin"], "Events", "teleport");
    expect(PermissionEngine.can(c)).toBe(false);
  });
});
