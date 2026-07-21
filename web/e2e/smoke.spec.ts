/**
 * E2E Smoke Tests — Critical User Journeys.
 *
 * These tests verify the platform's most important flows work end-to-end:
 * 1. Visitor can view landing page and navigate to discover
 * 2. Auth pages render correctly
 * 3. Health endpoints respond
 *
 * Prerequisites: dev server running (handled by playwright.config.ts webServer)
 */
import { test, expect } from "@playwright/test";

test.describe("Smoke Tests — Public Pages", () => {
  test("landing page loads and shows platform name", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator("text=Stellar Guardian")).toBeVisible();
    await expect(page.locator("text=Trustless prize distribution")).toBeVisible();
  });

  test("landing page has working navigation to discover", async ({ page }) => {
    await page.goto("/");
    await page.click('a[href="/discover"]');
    await expect(page).toHaveURL("/discover");
    await expect(page.locator("text=Discover Events")).toBeVisible();
  });

  test("login page renders with correct form fields", async ({ page }) => {
    await page.goto("/login");
    await expect(page.locator("text=Welcome back")).toBeVisible();
    await expect(page.locator("#email")).toBeVisible();
    await expect(page.locator("#password")).toBeVisible();
    await expect(page.locator('button[type="submit"]')).toBeVisible();
  });

  test("signup page renders with all required fields", async ({ page }) => {
    await page.goto("/signup");
    await expect(page.locator("text=Create your account")).toBeVisible();
    await expect(page.locator("#display-name")).toBeVisible();
    await expect(page.locator("#email")).toBeVisible();
    await expect(page.locator("#password")).toBeVisible();
    await expect(page.locator("#confirm-password")).toBeVisible();
    await expect(page.locator("#terms")).toBeVisible();
  });

  test("terms page loads", async ({ page }) => {
    await page.goto("/terms");
    await expect(page.locator("text=Terms of Service")).toBeVisible();
  });

  test("privacy page loads", async ({ page }) => {
    await page.goto("/privacy");
    await expect(page.locator("text=Privacy Policy")).toBeVisible();
  });
});

test.describe("Smoke Tests — API Health", () => {
  test("health endpoint returns ok", async ({ request }) => {
    const response = await request.get("/api/health");
    expect(response.ok()).toBeTruthy();
    const body = await response.json();
    expect(body.status).toBe("ok");
  });

  test("unauthenticated API returns 401", async ({ request }) => {
    const response = await request.get("/api/notifications");
    expect(response.status()).toBe(401);
    const body = await response.json();
    expect(body.error.code).toBe("UNAUTHENTICATED");
  });

  test("cron endpoint without secret returns 401", async ({ request }) => {
    const response = await request.post("/api/cron/transitions");
    expect(response.status()).toBe(401);
  });
});

test.describe("Smoke Tests — Auth Flow", () => {
  test("login with invalid credentials shows error", async ({ page }) => {
    await page.goto("/login");
    await page.fill("#email", "invalid@test.com");
    await page.fill("#password", "wrongpassword");
    await page.click('button[type="submit"]');
    // Should show an error alert
    await expect(page.locator('[role="alert"]')).toBeVisible({ timeout: 10000 });
  });

  test("signup without terms acceptance shows error", async ({ page }) => {
    await page.goto("/signup");
    await page.fill("#display-name", "Test User");
    await page.fill("#email", "test@example.com");
    await page.fill("#password", "TestPassword123");
    await page.fill("#confirm-password", "TestPassword123");
    // Don't check terms checkbox
    await page.click('button[type="submit"]');
    await expect(page.locator('[role="alert"]')).toBeVisible();
    await expect(page.locator("text=Terms of Service")).toBeVisible();
  });

  test("signup with mismatched passwords shows error", async ({ page }) => {
    await page.goto("/signup");
    await page.fill("#display-name", "Test User");
    await page.fill("#email", "test@example.com");
    await page.fill("#password", "TestPassword123");
    await page.fill("#confirm-password", "DifferentPassword");
    await page.check("#terms");
    await page.click('button[type="submit"]');
    await expect(page.locator('[role="alert"]')).toBeVisible();
    await expect(page.locator("text=do not match")).toBeVisible();
  });
});
