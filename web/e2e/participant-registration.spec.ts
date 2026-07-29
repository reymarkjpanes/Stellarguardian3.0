import { test, expect } from "@playwright/test";

test.describe("Participant Registration & Submission", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
  });

  // Skipped until test environment supports auto-confirm or test seeded users
  test.skip("should allow a participant to register, form a team, and submit a project", async ({ page }) => {
    // 1. Sign up as Participant
    const timestamp = Date.now();
    await page.goto("/signup");
    await page.fill('input[type="text"]', "Test Hacker");
    await page.fill('input[type="email"]', `hacker_${timestamp}@example.com`);
    await page.fill('input[type="password"]', "Password123!");
    await page.fill('input[id="confirm-password"]', "Password123!");
    await page.check('input[id="terms"]');
    await page.click('button[type="submit"]');

    // Wait for auth to complete
    await expect(page.locator("text=Check your email").first()).toBeVisible({ timeout: 15000 });

    // Assuming logged in
    await page.goto("/discover");

    // 2. Navigate to Event Registration
    await expect(page.locator("text=Hackathons")).toBeVisible();
    await page.click('text="E2E Test Hackathon"'); // Click the event we created in the other test
    
    // Event Details Page
    await page.click('text="Apply to Participate"'); // Now correctly navigates to /register

    // Registration Form (Terms and Conditions)
    await expect(page.locator("text=Terms and Rules")).toBeVisible();
    await page.check('input[type="checkbox"]'); // Agree to terms
    await page.click('button:has-text("Confirm Registration")');

    // Wait for redirect to dashboard
    await expect(page.url()).toMatch(/\/events\/[a-zA-Z0-9-]+$/);
    await expect(page.locator("text=Pending")).toBeVisible(); // Depends on auto-approve setting

    // 3. Form a Team (Assuming Organizer approved them)
    await page.goto(page.url() + "/teams");
    await page.click('button:has-text("Create Team")');
    await page.fill('input[name="teamName"]', "Team Alpha");
    await page.click('button:has-text("Confirm")');

    // Verify Team Creation
    await expect(page.locator("text=Team Alpha")).toBeVisible();
    await expect(page.locator("text=Captain")).toBeVisible();

    // 4. Submit Project
    await page.click('a:has-text("Submissions")');
    await page.click('text="Submit Project"');
    await page.fill('input[name="title"]', "Alpha Wallet");
    await page.fill('textarea[name="description"]', "A fast, secure wallet for the Stellar network.");
    await page.fill('input[name="github_url"]', "https://github.com/team-alpha/wallet");
    await page.fill('input[name="demo_url"]', "https://youtu.be/dQw4w9WgXcQ");
    await page.click('button:has-text("Submit")');

    // 5. Verify Submission Success
    await expect(page.locator("text=Submitted")).toBeVisible();
    await expect(page.locator("text=Alpha Wallet")).toBeVisible();
  });
});
