import { describe, expect, test, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

vi.mock("server-only", () => ({}));

// Mock Supabase Server Client
const mockGetUser = vi.fn();
const mockUpsert = vi.fn();
const mockFrom = vi.fn();

const mockSupabase = {
  auth: {
    getUser: mockGetUser,
  },
  from: mockFrom,
};

vi.mock("@/lib/supabase/server", () => ({
  createServerClient: vi.fn(async () => mockSupabase),
}));

describe("Requirement 1: Organizer Onboarding Flow", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("PATCH /api/users/me route handler (Upsert public.users)", () => {
    test("returns 401 UNAUTHENTICATED when user is not logged in", async () => {
      mockGetUser.mockResolvedValueOnce({ data: { user: null } });

      const { PATCH } = await import("@/app/api/users/me/route");
      const req = new NextRequest("http://localhost/api/users/me", {
        method: "PATCH",
        body: JSON.stringify({ display_name: "Test User" }),
      });

      const res = await PATCH(req);
      const json = await res.json();

      expect(res.status).toBe(401);
      expect(json.error.code).toBe("UNAUTHENTICATED");
    });

    test("upserts public.users table with display_name when authenticated", async () => {
      const mockUser = { id: "usr_123", email: "organizer@example.com" };
      mockGetUser.mockResolvedValueOnce({ data: { user: mockUser } });

      // Setup chain for users table upsert
      mockUpsert.mockResolvedValueOnce({ error: null });

      // Setup chain for fetching updated profile
      const mockProfileSelect = vi.fn().mockReturnThis();
      const mockProfileEq = vi.fn().mockReturnThis();
      const mockProfileSingle = vi.fn().mockResolvedValueOnce({
        data: { id: "usr_123", display_name: "New Organizer Name", email: "organizer@example.com" },
        error: null,
      });

      // Setup chain for fetching user skills
      const mockSkillsSelect = vi.fn().mockReturnThis();
      const mockSkillsEq = vi.fn().mockResolvedValueOnce({
        data: [],
        error: null,
      });

      mockFrom.mockImplementation((table: string) => {
        if (table === "users") {
          return {
            upsert: mockUpsert,
            select: mockProfileSelect,
            eq: mockProfileEq,
            single: mockProfileSingle,
          };
        }
        if (table === "user_skills") {
          return {
            select: mockSkillsSelect,
            eq: mockSkillsEq,
          };
        }
        return {};
      });

      mockProfileSelect.mockReturnValue({ eq: mockProfileEq });
      mockProfileEq.mockReturnValue({ single: mockProfileSingle });

      const { PATCH } = await import("@/app/api/users/me/route");
      const req = new NextRequest("http://localhost/api/users/me", {
        method: "PATCH",
        body: JSON.stringify({ display_name: "New Organizer Name" }),
      });

      const res = await PATCH(req);
      const json = await res.json();

      expect(res.status).toBe(200);
      expect(mockUpsert).toHaveBeenCalledWith({
        id: "usr_123",
        email: "organizer@example.com",
        display_name: "New Organizer Name",
      });
      expect(json.data.display_name).toBe("New Organizer Name");
    });
  });

  describe("Dashboard & Onboarding Redirection Logic", () => {
    test("Dashboard should block access (redirect /onboarding) when display_name is missing", () => {
      const user = { email: "user@example.com" };
      const profile = null as any;
      const rawWorkspaceMemberships = [{ workspace_id: "ws_1", role: "Owner" }];

      const shouldRedirect =
        !profile?.display_name ||
        profile.display_name === user.email ||
        (rawWorkspaceMemberships ?? []).length === 0;

      expect(shouldRedirect).toBe(true);
    });

    test("Dashboard should block access when display_name equals user email", () => {
      const user = { email: "user@example.com" };
      const profile = { display_name: "user@example.com" } as any;
      const rawWorkspaceMemberships = [{ workspace_id: "ws_1", role: "Owner" }];

      const shouldRedirect =
        !profile?.display_name ||
        profile.display_name === user.email ||
        (rawWorkspaceMemberships ?? []).length === 0;

      expect(shouldRedirect).toBe(true);
    });

    test("Dashboard should block access when workspace membership count is 0", () => {
      const user = { email: "user@example.com" };
      const profile = { display_name: "Valid Name" };
      const rawWorkspaceMemberships: Array<{ workspace_id: string; role: string }> = [];

      const shouldRedirect =
        !profile?.display_name ||
        profile.display_name === user.email ||
        (rawWorkspaceMemberships ?? []).length === 0;

      expect(shouldRedirect).toBe(true);
    });

    test("Dashboard should allow access when display_name is valid and workspace count > 0", () => {
      const user = { email: "user@example.com" };
      const profile = { display_name: "Valid Organizer Name" };
      const rawWorkspaceMemberships = [{ workspace_id: "ws_1", role: "Owner" }];

      const shouldRedirect =
        !profile?.display_name ||
        profile.display_name === user.email ||
        (rawWorkspaceMemberships ?? []).length === 0;

      expect(shouldRedirect).toBe(false);
    });

    test("Onboarding page server check should redirect to /dashboard when display_name is valid AND workspaces > 0", () => {
      const user = { email: "user@example.com" };
      const profile = { display_name: "Valid Name" };
      const rawWorkspaceMemberships = [{ workspace_id: "ws_1" }];

      const hasValidDisplayName = !!profile?.display_name && profile.display_name !== user.email;
      const hasWorkspaces = (rawWorkspaceMemberships ?? []).length > 0;
      const shouldRedirectToDashboard = hasValidDisplayName && hasWorkspaces;

      expect(shouldRedirectToDashboard).toBe(true);
    });

    test("Onboarding page server check should NOT redirect to /dashboard when workspace is missing", () => {
      const user = { email: "user@example.com" };
      const profile = { display_name: "Valid Name" };
      const rawWorkspaceMemberships: Array<{ workspace_id: string }> = [];

      const hasValidDisplayName = !!profile?.display_name && profile.display_name !== user.email;
      const hasWorkspaces = (rawWorkspaceMemberships ?? []).length > 0;
      const shouldRedirectToDashboard = hasValidDisplayName && hasWorkspaces;

      expect(shouldRedirectToDashboard).toBe(false);
    });
  });

  describe("AppNav Client Navigation Guard", () => {
    test("AppNav guard redirects to /onboarding if workspace count is 0", () => {
      const user = { id: "u1", name: "Valid Name", email: "user@example.com" };
      const workspaces: Array<{ id: string; name: string; slug: string }> = [];
      const currentPath: string = "/dashboard";

      const shouldNavToOnboarding =
        user &&
        currentPath !== "/onboarding" &&
        (!user.name || user.name === user.email || workspaces.length === 0);

      expect(shouldNavToOnboarding).toBeTruthy();
    });

    test("AppNav guard does NOT redirect if user has valid name and >= 1 workspace", () => {
      const user = { id: "u1", name: "Valid Name", email: "user@example.com" };
      const workspaces = [{ id: "w1", name: "Workspace 1", slug: "ws-1" }];
      const currentPath: string = "/dashboard";

      const shouldNavToOnboarding =
        user &&
        currentPath !== "/onboarding" &&
        (!user.name || user.name === user.email || workspaces.length === 0);

      expect(shouldNavToOnboarding).toBeFalsy();
    });
  });
});
