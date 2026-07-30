import { test, expect } from "@playwright/test";

test.describe("System Admin Flow", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
  });

  // Skipped until test environment supports seeded admin users
  test.skip("should allow a system admin to view platform analytics and audit logs", async ({ page }) => {
    // 1. Sign in as Admin
    // (Assuming a specific admin email that is seeded in the test DB)
    await page.goto("/auth/login");
    await page.fill('input[name="email"]', "admin@stellarguardian.com");
    await page.fill('input[name="password"]', "AdminPassword123!");
    await page.click('button[type="submit"]');

    // 2. Navigate to Admin Dashboard
    await page.goto("/admin");

    // 3. Verify Admin Access
    await expect(page.locator("text=System Administration")).toBeVisible();
    await expect(page.locator("text=Platform Analytics")).toBeVisible();

    // 4. View Audit Logs
    await page.click('a[href="/admin/audit"]');
    await expect(page.locator("text=Security & Audit Logs")).toBeVisible();
    
    // Check if a table or list of logs is rendered
    // Even if empty, the UI should render the state correctly
    const tableVisible = await page.locator("table").isVisible();
    const emptyStateVisible = await page.locator("text=No audit logs found").isVisible();
    expect(tableVisible || emptyStateVisible).toBeTruthy();
  });
});
