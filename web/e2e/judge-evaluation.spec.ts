import { test, expect } from "@playwright/test";

test.describe("Judge Evaluation Flow", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
  });

  // Skipped until test environment supports seeded events/judges
  test.skip("should allow a judge to evaluate a submission", async ({ page }) => {
    // 1. Sign in as Judge
    const timestamp = Date.now();
    await page.goto("/signup");
    await page.fill('input[type="text"]', "Test Judge");
    await page.fill('input[type="email"]', `judge_${timestamp}@example.com`);
    await page.fill('input[type="password"]', "Password123!");
    await page.fill('input[id="confirm-password"]', "Password123!");
    await page.check('input[id="terms"]');
    await page.click('button[type="submit"]');

    // Wait for auth to complete
    await expect(page.locator("text=Check your email").first()).toBeVisible({ timeout: 15000 });

    // Assuming we are logged in
    await page.goto("/dashboard");

    // 2. Navigate to Assigned Event Judging Dashboard
    // In a real flow, the judge would see their assigned events on their dashboard or workspace.
    // We assume they navigate to the judging dashboard.
    // For test purposes, we'd navigate to the event id we know they are a judge of.
    await page.click('text="E2E Test Hackathon"');
    await page.click('text="Judging Dashboard"');

    // 3. View Submissions
    await expect(page.locator("text=Assigned Submissions")).toBeVisible();
    await page.click('text="Alpha Wallet"'); // The submission created by participant

    // 4. Fill Rubric Evaluation
    await expect(page.locator("text=Evaluation Rubric")).toBeVisible();
    
    // Select scores for different criteria (assuming criteria sliders or inputs exist)
    // Here we'll use generic locators for a 1-10 slider or select box
    const scoreInputs = page.locator('input[type="range"]'); // Assuming slider
    const count = await scoreInputs.count();
    for (let i = 0; i < count; i++) {
        await scoreInputs.nth(i).fill("8"); // Give a score of 8
    }

    // Add comment
    await page.fill('textarea[name="feedback"]', "Great project! Very secure and fast.");
    
    // Submit evaluation
    await page.click('button:has-text("Submit Evaluation")');

    // 5. Verify Success
    await expect(page.locator("text=Evaluation submitted successfully")).toBeVisible();
    await expect(page.locator("text=Completed")).toBeVisible();
  });
});
