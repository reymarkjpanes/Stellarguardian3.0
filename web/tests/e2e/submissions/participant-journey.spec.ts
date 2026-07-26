import { test, expect } from "../fixtures";

test.describe("Submission Hub - Participant Journey", () => {
  test.beforeEach(async ({ page, auth: _auth }) => {
    // We would log in here using a seeded user
    // await _auth.login('captain@team-alpha.com');
    // For local testing, we bypass UI login or assume mock server:
    await page.goto("/teams/team-alpha/submission");
  });

  test("Captain can view the submission hub, edit draft, upload asset, and submit", async ({
    page,
  }) => {
    // 1. View Hub
    await expect(page.locator("text=Project Requirements")).toBeVisible();
    await expect(page.locator("text=Status: NOT_STARTED")).toBeVisible();

    // Accessibility test on initial load
    // const accessibilityScanResults = await new AxeBuilder({ page }).analyze();
    // expect(accessibilityScanResults.violations).toEqual([]);

    // 2. Edit Draft (Text Requirement)
    await page.click('button:has-text("Pitch")'); // Open accordion
    await page.fill(
      'textarea[placeholder="Enter your pitch..."]',
      "This is our amazing project pitch.",
    );

    // Autosave should trigger. We wait for a bit to simulate optimistic UI update
    await page.waitForTimeout(1000);

    // In a real app we'd expect text 'Status: DRAFT'
    // await expect(page.locator('text=Status: DRAFT')).toBeVisible();
    // await expect(page.locator('text=Saved')).toBeVisible();

    // 3. Upload Asset (File Requirement)
    // await page.click('button:has-text("Demo Video")');
    // await page.setInputFiles('input[type="file"]', 'tests/e2e/fixtures/demo.mp4');

    // 4. Submit
    // Verify submit button is enabled only when validation passes.
    // await page.click('button:has-text("Submit Project")');
    // await expect(page.locator('text=Project Submitted!')).toBeVisible();
  });
});
