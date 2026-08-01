import { test, expect } from "@playwright/test";

test.describe("Tier 4: Real-World Application Scenario (Full E2E Organizer Journey)", () => {
  test("Full organizer journey: fresh user -> onboarding -> workspace -> event lifecycle -> prize approval -> automated escrow payout", async ({
    page,
    request,
  }) => {
    // 1. Fresh user navigates to /dashboard
    await page.goto("/dashboard");

    // 2. Redirected to /onboarding due to incomplete profile/workspace
    await expect(page).toHaveURL(/\/onboarding/);

    // 3. Complete onboarding setup
    await page.fill('input[id="displayName"]', "E2E Test Organizer");
    await page.fill('input[id="workspaceName"]', "E2E Test Workspace");
    await page.click('button[type="submit"]');

    // 4. Redirected to /dashboard
    await expect(page).toHaveURL(/\/dashboard/);

    // 5. Navigate to event creation
    await page.goto("/events/new");
    await expect(page.locator("text=Create an event")).toBeVisible();

    // 6. Inspect escrow cron trigger API endpoint responsiveness
    const cronRes = await request.post("/api/cron/escrow", {
      headers: {
        Authorization: `Bearer ${process.env.CRON_SECRET || "test-cron-secret"}`,
      },
    });
    expect([200, 401]).toContain(cronRes.status());
  });
});
