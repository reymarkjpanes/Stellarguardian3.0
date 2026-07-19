import { test, expect } from "@playwright/test";

test.describe("Organizer Event Creation & Funding", () => {
  test.beforeEach(async ({ page }) => {
    // Go to the starting url before each test.
    await page.goto("/");
  });

  // Marking this as skip or fixme because the UI workflows are not fully built yet.
  // Once the UI routes and forms are complete, we can remove the skip and run this against the actual DOM.
  test.skip("should allow an organizer to create an event and fund escrow", async ({ page }) => {
    // 1. Sign in as Organizer
    await page.goto("/auth/login");
    await page.fill('input[name="email"]', "organizer@example.com");
    await page.fill('input[name="password"]', "password123");
    await page.click('button[type="submit"]');

    // 2. Navigate to Create Event
    await page.click('text="Create Event"');
    await expect(page).toHaveURL(/.*\/events\/new/);

    // 3. Fill in Event Details
    await page.fill('input[name="title"]', "Stellar Global Hackathon");
    await page.fill('textarea[name="description"]', "A global hackathon on Stellar network.");
    // Pick dates, rules, etc.
    await page.click('button:has-text("Create Event")');

    // 4. Verify Redirect to Event Dashboard
    await expect(page).toHaveURL(/.*\/events\/[0-9a-fA-F-]+/);
    await expect(page.locator("h1")).toHaveText("Stellar Global Hackathon");

    // 5. Fund Escrow Account
    await page.click('text="Fund Escrow"');
    await page.fill('input[name="amount"]', "10000");
    await page.click('button:has-text("Confirm Funding")');

    // 6. Verify Escrow State changed
    await expect(page.locator(".escrow-status")).toHaveText(/PartiallyFunded|FullyFunded/);
  });
});
