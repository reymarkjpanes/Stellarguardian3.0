import { test, expect } from "@playwright/test";

test.describe("Requirement R1: Organizer Onboarding Flow", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
  });

  test("R1-T1-01 & R1-T1-02: Redirects user with missing display_name or workspace to /onboarding", async ({
    page,
  }) => {
    // When accessing /dashboard directly without completing onboarding
    await page.goto("/dashboard");

    // Expect to be redirected to /onboarding
    await expect(page).toHaveURL(/\/onboarding/);
    await expect(page.locator("h1")).toContainText("Welcome to Stellar Guardian");
  });

  test("R1-T1-04 & R1-T1-05: Submitting onboarding form updates display name, creates workspace, and redirects to /dashboard", async ({
    page,
  }) => {
    await page.goto("/onboarding");

    // Fill display name and workspace name
    await page.fill('input[id="displayName"]', "Alice Organizer");
    await page.fill('input[id="workspaceName"]', "Acme Hackathons");

    // Click submit
    await page.click('button[type="submit"]');

    // On completion, should navigate to dashboard
    await expect(page).toHaveURL(/\/dashboard/);
  });

  test("R1-T2-01: Displays validation error when display name is shorter than 2 characters", async ({
    page,
  }) => {
    await page.goto("/onboarding");

    await page.fill('input[id="displayName"]', "A");
    await page.fill('input[id="workspaceName"]', "Valid Workspace");
    await page.click('button[type="submit"]');

    await expect(page.locator('div[role="alert"]')).toContainText(
      "Display name must be at least 2 characters.",
    );
  });

  test("R1-T2-02: Displays validation error when workspace name is shorter than 2 characters", async ({
    page,
  }) => {
    await page.goto("/onboarding");

    await page.fill('input[id="displayName"]', "Alice Organizer");
    await page.fill('input[id="workspaceName"]', "W");
    await page.click('button[type="submit"]');

    await expect(page.locator('div[role="alert"]')).toContainText(
      "Workspace name must be at least 2 characters.",
    );
  });
});
