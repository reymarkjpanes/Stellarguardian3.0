/**
 * Empirical Test Harness for Milestone R1 (Organizer Onboarding Flow)
 * Target Verification:
 * 1. Navigation Guard consistency (AppNav vs Dashboard page vs Onboarding page)
 * 2. Infinite redirect loop detection between /dashboard and /onboarding
 * 3. API Error handling & state resilience (PATCH /api/users/me & POST /api/workspaces)
 * 4. UI edge cases (null user.name, casing mismatches, slugification bounds)
 */

import { describe, it, expect } from "vitest";

// Simulation of AppLayout data resolution
function resolveLayoutUserData(supabaseUser: { id: string; email: string; user_metadata?: { display_name?: string } } | null) {
  if (!supabaseUser) return null;
  const displayName = supabaseUser.user_metadata?.display_name ?? supabaseUser.email ?? "";
  const email = supabaseUser.email ?? "";
  return { id: supabaseUser.id, name: displayName, email };
}

// Simulation of AppNav client guard
function appNavGuard(
  user: { id: string; name: string; email: string } | null,
  workspaces: Array<{ id: string; name: string }>,
  currentPathname: string
): { redirect: boolean; target?: string } {
  if (
    user &&
    currentPathname !== "/onboarding" &&
    (!user.name || user.name === user.email || workspaces.length === 0)
  ) {
    return { redirect: true, target: "/onboarding" };
  }
  return { redirect: false };
}

// Simulation of Dashboard server guard
function dashboardServerGuard(
  user: { id: string; email: string } | null,
  dbProfile: { display_name: string | null } | null,
  dbWorkspaces: Array<{ workspace_id: string }>
): { redirect: boolean; target?: string } {
  if (!user) return { redirect: true, target: "/login" };

  if (
    !dbProfile?.display_name ||
    dbProfile.display_name === user.email ||
    (dbWorkspaces ?? []).length === 0
  ) {
    return { redirect: true, target: "/onboarding" };
  }
  return { redirect: false };
}

// Simulation of Onboarding server guard
function onboardingServerGuard(
  user: { id: string; email: string } | null,
  dbProfile: { display_name: string | null } | null,
  dbWorkspaces: Array<{ workspace_id: string }>
): { redirect: boolean; target?: string } {
  if (!user) return { redirect: true, target: "/login" };

  const hasValidDisplayName =
    !!dbProfile?.display_name && dbProfile.display_name !== user.email;
  const hasWorkspaces = (dbWorkspaces ?? []).length > 0;

  if (hasValidDisplayName && hasWorkspaces) {
    return { redirect: true, target: "/dashboard" };
  }
  return { redirect: false };
}

// Simulation of OnboardingForm state machine and API fetch sequence
async function simulateOnboardingSubmit(
  displayNameInput: string,
  workspaceNameInput: string,
  mockFetch: (url: string, init: RequestInit) => Promise<{ ok: boolean; status: number; json: () => Promise<any> }>
): Promise<{ success: boolean; error: string | null; stepReached: string }> {
  const trimmedName = displayNameInput.trim();
  const trimmedWorkspace = workspaceNameInput.trim();

  if (!trimmedName || trimmedName.length < 2) {
    return { success: false, error: "Display name must be at least 2 characters.", stepReached: "validation" };
  }
  if (!trimmedWorkspace || trimmedWorkspace.length < 2) {
    return { success: false, error: "Workspace name must be at least 2 characters.", stepReached: "validation" };
  }

  try {
    const patchRes = await mockFetch("/api/users/me", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ display_name: trimmedName }),
    });

    if (!patchRes.ok) {
      const patchJson = await patchRes.json().catch(() => ({}));
      throw new Error(
        patchJson.error?.message || "Failed to update display name. Please try again."
      );
    }

    const postWsRes = await mockFetch("/api/workspaces", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: trimmedWorkspace,
        slug: "generated-slug-1234",
      }),
    });

    if (!postWsRes.ok) {
      const postWsJson = await postWsRes.json().catch(() => ({}));
      throw new Error(
        postWsJson.error?.message || "Failed to create workspace. Please try again."
      );
    }

    return { success: true, error: null, stepReached: "complete" };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "An error occurred during onboarding.",
      stepReached: "failed",
    };
  }
}

describe("R1 Empirical Verification — Navigation Guards & Redirect Loops", () => {
  it("BUG DEMONSTRATION: Infinite redirect loop occurs when display_name is updated in public.users but not user_metadata", () => {
    // User profile in DB after completing onboarding:
    const dbProfile = { display_name: "Alice Organizer" };
    const dbWorkspaces = [{ workspace_id: "ws_123" }];

    // Supabase Auth user object (user_metadata was NOT updated by PATCH /api/users/me):
    const supabaseUser = {
      id: "usr_123",
      email: "alice@example.com",
      user_metadata: {}, // display_name missing in auth user_metadata
    };

    // Step 1: User requests GET /dashboard
    const dashGuard = dashboardServerGuard(supabaseUser, dbProfile, dbWorkspaces);
    expect(dashGuard.redirect).toBe(false); // Dashboard server allows rendering

    // Step 2: Layout resolves user props for AppNav
    const layoutUserProps = resolveLayoutUserData(supabaseUser);
    expect(layoutUserProps).toEqual({
      id: "usr_123",
      name: "alice@example.com", // Fallback to email!
      email: "alice@example.com",
    });

    // Step 3: AppNav mounts on client at /dashboard
    const appNavResult = appNavGuard(layoutUserProps, [{ id: "ws_123", name: "Workspace" }], "/dashboard");
    expect(appNavResult.redirect).toBe(true);
    expect(appNavResult.target).toBe("/onboarding"); // Client forces redirect to /onboarding!

    // Step 4: Browser lands on /onboarding
    const onboardGuard = onboardingServerGuard(supabaseUser, dbProfile, dbWorkspaces);
    expect(onboardGuard.redirect).toBe(true);
    expect(onboardGuard.target).toBe("/dashboard"); // Server forces redirect back to /dashboard!

    // STEP 5: INFINITE LOOP DETECTED!
    const isInfiniteLoop = appNavResult.target === "/onboarding" && onboardGuard.target === "/dashboard";
    expect(isInfiniteLoop).toBe(true);
  });

  it("UI CRASH DEMONSTRATION: Uncaught TypeError when user.name is null in AppNav render", () => {
    const userWithNullName = { id: "usr_123", name: null as unknown as string, email: "user@example.com" };

    // Line 129 of AppNav: user.name.charAt(0).toUpperCase()
    let threwTypeError = false;
    try {
      userWithNullName.name.charAt(0).toUpperCase();
    } catch (err) {
      threwTypeError = err instanceof TypeError;
    }

    expect(threwTypeError).toBe(true);
  });
});

describe("R1 Empirical Verification — API Failure Modes & Error Recovery", () => {
  it("Handles 422 Validation Error on PATCH /api/users/me", async () => {
    const mockFetch = async (url: string) => {
      if (url === "/api/users/me") {
        return {
          ok: false,
          status: 422,
          json: async () => ({ error: { code: "VALIDATION_ERROR", message: "Display name too short." } }),
        };
      }
      return { ok: true, status: 200, json: async () => ({}) };
    };

    const res = await simulateOnboardingSubmit("A", "Valid Workspace", mockFetch);
    expect(res.success).toBe(false);
    expect(res.error).toBe("Display name must be at least 2 characters."); // Caught client-side
  });

  it("Handles 500 Internal Server Error on PATCH /api/users/me", async () => {
    const mockFetch = async (url: string) => {
      if (url === "/api/users/me") {
        return {
          ok: false,
          status: 500,
          json: async () => ({ error: { code: "INTERNAL_ERROR", message: "Database connection failed" } }),
        };
      }
      return { ok: true, status: 200, json: async () => ({}) };
    };

    const res = await simulateOnboardingSubmit("Alice", "Valid Workspace", mockFetch);
    expect(res.success).toBe(false);
    expect(res.error).toBe("Database connection failed");
  });

  it("Handles Partial Failure: PATCH /api/users/me succeeds, but POST /api/workspaces returns 409 Conflict", async () => {
    const mockFetch = async (url: string) => {
      if (url === "/api/users/me") {
        return { ok: true, status: 200, json: async () => ({ data: { display_name: "Alice" } }) };
      }
      if (url === "/api/workspaces") {
        return {
          ok: false,
          status: 409,
          json: async () => ({ error: { code: "CONFLICT", message: "Workspace slug already exists." } }),
        };
      }
      return { ok: true, status: 200, json: async () => ({}) };
    };

    const res = await simulateOnboardingSubmit("Alice", "Acme Corp", mockFetch);
    expect(res.success).toBe(false);
    expect(res.error).toBe("Workspace slug already exists.");
  });

  it("Handles non-JSON 502 Bad Gateway response (HTML response fallback)", async () => {
    const mockFetch = async () => {
      return {
        ok: false,
        status: 502,
        json: async () => {
          throw new SyntaxError("Unexpected token '<', <html>...");
        },
      };
    };

    const res = await simulateOnboardingSubmit("Alice", "Acme Corp", mockFetch);
    expect(res.success).toBe(false);
    expect(res.error).toBe("Failed to update display name. Please try again.");
  });

  it("Handles simulated Network Failure (fetch promise rejection)", async () => {
    const mockFetch = async () => {
      throw new Error("Failed to fetch");
    };

    const res = await simulateOnboardingSubmit("Alice", "Acme Corp", mockFetch);
    expect(res.success).toBe(false);
    expect(res.error).toBe("Failed to fetch");
  });
});
