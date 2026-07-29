import { test, expect } from "@playwright/test";

test.describe("Organizer Event Creation & Funding", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
  });

  // Skipped until test environment supports auto-confirm or test seeded users
  test.skip("should allow an organizer to create an event through the 4-step wizard", async ({ page }) => {
    // 1. Sign up as Organizer
    const timestamp = Date.now();
    await page.goto("/signup");
    await page.fill('input[type="text"]', "Test Organizer");
    await page.fill('input[type="email"]', `organizer_${timestamp}@example.com`);
    await page.fill('input[type="password"]', "Password123!");
    await page.fill('input[id="confirm-password"]', "Password123!");
    await page.check('input[id="terms"]');
    await page.click('button[type="submit"]');

    // Wait for auth to complete
    await expect(page.locator("text=Check your email").first()).toBeVisible({ timeout: 15000 });

    // Assuming we are now logged in and on the dashboard
    // (This requires bypassing email confirmation in the test env)
    await page.goto("/dashboard");

    // 2. Create Workspace
    await page.click('a[href="/workspaces/new"]');
    await page.fill('input[id="name"]', "Test Workspace");
    await page.click('button[type="submit"]');
    await expect(page.locator("text=Workspace created")).toBeVisible();

    // 3. Create Event
    await page.goto("/events/new");
    await expect(page.locator("text=Create an event")).toBeVisible();

    // Step 1: Basic Info
    await page.fill('input[id="title"]', "E2E Test Hackathon");
    await page.fill('textarea[id="desc"]', "This is a comprehensive description for the E2E test hackathon. It meets the length requirements.");
    await page.selectOption('select[id="cat"]', "hackathon");
    await page.click('button:has-text("Continue →")');

    // Step 2: Team & Timeline
    await expect(page.locator("text=Team & Timeline")).toBeVisible();
    await page.fill('input[id="tsmin"]', "1");
    await page.fill('input[id="tsmax"]', "4");
    // Registration deadline optional, skipping
    await page.click('button:has-text("Continue →")');

    // Step 3: Prize & Network
    await expect(page.locator("text=Prize & Network")).toBeVisible();
    await page.fill('input[id="prize"]', "5000");
    await page.click('button:has-text("testnet")');
    await page.fill('input[id="rw"]', "72");
    await page.selectOption('select[id="split"]', "equal_split");
    await page.click('button:has-text("Continue →")');

    // Step 4: Review
    await expect(page.locator("text=Review & Launch")).toBeVisible();
    await expect(page.locator("text=E2E Test Hackathon")).toBeVisible();
    await expect(page.locator("text=5000 XLM")).toBeVisible();
    await page.click('button:has-text("Create Event")');

    // 4. Verify successful creation and redirect
    await expect(page.url()).toMatch(/\/events\/[a-zA-Z0-9-]+$/);
    await expect(page.locator("text=Draft")).toBeVisible();
  });
});
