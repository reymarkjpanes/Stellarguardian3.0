import { describe, expect, it, vi, beforeEach } from "vitest";
import { TeamService } from "../team.service";
import { TeamRepository } from "@/lib/repositories/team.repository";
import { ConflictError, ForbiddenError } from "@/lib/errors";

vi.mock("@/lib/repositories/team.repository", () => ({
  TeamRepository: {
    createTeamWithCaptain: vi.fn(),
    resolveJoinRequest: vi.fn(),
  },
}));

describe("TeamService", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  describe("createTeam", () => {
    it("returns team ID on success", async () => {
      vi.mocked(TeamRepository.createTeamWithCaptain).mockResolvedValue("team-123");
      const result = await TeamService.createTeam("event-1", "user-1", "My Team");
      expect(result).toBe("team-123");
      expect(TeamRepository.createTeamWithCaptain).toHaveBeenCalledWith("event-1", "My Team", "user-1");
    });

    it("throws ConflictError if ALREADY_IN_TEAM", async () => {
      vi.mocked(TeamRepository.createTeamWithCaptain).mockRejectedValue(new Error("ALREADY_IN_TEAM"));
      await expect(TeamService.createTeam("event-1", "user-1", "My Team"))
        .rejects.toThrow(ConflictError);
    });

    it("throws ConflictError if TEAM_LIMIT_REACHED", async () => {
      vi.mocked(TeamRepository.createTeamWithCaptain).mockRejectedValue(new Error("TEAM_LIMIT_REACHED"));
      await expect(TeamService.createTeam("event-1", "user-1", "My Team"))
        .rejects.toThrow(ConflictError);
    });

    it("throws ConflictError if not in TeamFormation phase", async () => {
      vi.mocked(TeamRepository.createTeamWithCaptain).mockRejectedValue(new Error("Event is not in TeamFormation phase"));
      await expect(TeamService.createTeam("event-1", "user-1", "My Team"))
        .rejects.toThrow(ConflictError);
    });

    it("throws ForbiddenError if not accepted participant", async () => {
      vi.mocked(TeamRepository.createTeamWithCaptain).mockRejectedValue(new Error("Only accepted participants can create a team"));
      await expect(TeamService.createTeam("event-1", "user-1", "My Team"))
        .rejects.toThrow(ForbiddenError);
    });
  });

  describe("resolveJoinRequest", () => {
    it("returns request ID on success", async () => {
      vi.mocked(TeamRepository.resolveJoinRequest).mockResolvedValue("req-123");
      const result = await TeamService.resolveJoinRequest("event-1", "team-1", "req-123", "accept", "captain-1");
      expect(result).toBe("req-123");
      expect(TeamRepository.resolveJoinRequest).toHaveBeenCalledWith("req-123", "accept", "captain-1");
    });

    it("throws ConflictError if TEAM_FULL", async () => {
      vi.mocked(TeamRepository.resolveJoinRequest).mockRejectedValue(new Error("TEAM_FULL"));
      await expect(TeamService.resolveJoinRequest("event-1", "team-1", "req-123", "accept", "captain-1"))
        .rejects.toThrow(ConflictError);
    });

    it("throws ForbiddenError if not team captain", async () => {
      vi.mocked(TeamRepository.resolveJoinRequest).mockRejectedValue(new Error("Only the team captain can manage join requests"));
      await expect(TeamService.resolveJoinRequest("event-1", "team-1", "req-123", "accept", "user-2"))
        .rejects.toThrow(ForbiddenError);
    });
  });
});
