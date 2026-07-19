import { test, expect } from "@playwright/test";

test.describe("Participant Registration & Submission", () => {
  test.beforeEach(async ({ page }) => {
    // Go to the starting url before each test.
    await page.goto("/");
  });

  // Marking this as skip or fixme because the UI workflows are not fully built yet.
  test.skip("should allow a participant to form a team and submit a project", async ({ page }) => {
    // 1. Sign in as Participant
    await page.goto("/auth/login");
    await page.fill('input[name="email"]', "participant@example.com");
    await page.fill('input[name="password"]', "password123");
    await page.click('button[type="submit"]');

    // 2. Navigate to Event Registration
    await page.click('text="Hackathons"');
    await page.click('text="Stellar Global Hackathon"');
    await page.click('text="Register for Event"');

    // 3. Form a Team
    await page.click('text="Create a Team"');
    await page.fill('input[name="teamName"]', "Team Alpha");
    await page.click('button:has-text("Create Team")');

    // Verify Team Creation
    await expect(page.locator(".team-status")).toHaveText("Registered");
    await expect(page.locator(".role")).toHaveText("Captain");

    // 4. Submit Project
    await page.click('text="Submit Project"');
    await page.fill('input[name="projectTitle"]', "Alpha Wallet");
    await page.fill(
      'textarea[name="projectDescription"]',
      "A fast, secure wallet for the Stellar network.",
    );
    await page.fill('input[name="projectUrl"]', "https://github.com/team-alpha/wallet");
    await page.click('button:has-text("Submit")');

    // 5. Verify Submission Success
    await expect(page.locator(".submission-status")).toHaveText("Submitted");
    await expect(page.locator(".version")).toHaveText("v1");
  });
});
