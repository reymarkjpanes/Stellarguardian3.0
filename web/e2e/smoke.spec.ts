/**
 * E2E Smoke Tests — Critical User Journeys.
 *
 * These tests verify the platform's most important flows work end-to-end:
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
    // Add specific heading locator or first()
    await expect(page.locator("text=Stellar Guardian").first()).toBeVisible();
  });

  test("landing page has working navigation to discover", async ({ page }) => {
    await page.goto("/");
    await page.click("text=Browse events");
    await expect(page).toHaveURL(/.*\/discover/);
  });

  test("login page renders with correct form fields", async ({ page }) => {
    await page.goto("/login");
    await expect(page.locator('input[type="email"]')).toBeVisible();
    await expect(page.locator('input[type="password"]')).toBeVisible();
    await expect(page.locator('button[type="submit"]')).toBeVisible();
  });

  test("signup page renders with all required fields", async ({ page }) => {
    await page.goto("/signup");
    await expect(page.locator('input[type="text"]')).toBeVisible();
    await expect(page.locator('input[type="email"]')).toBeVisible();
    await expect(page.locator('input[type="password"]')).toHaveCount(2); // password and confirm
    await expect(page.locator('button[type="submit"]')).toBeVisible();
  });

  test("terms page loads", async ({ page }) => {
    await page.goto("/terms");
    await expect(page.locator("text=Terms of Service").first()).toBeVisible();
  });

  test("privacy page loads", async ({ page }) => {
    await page.goto("/privacy");
    await expect(page.locator("text=Privacy Policy").first()).toBeVisible();
  });
});

test.describe("Smoke Tests — API Health", () => {
  test("health endpoint returns ok", async ({ request }) => {
    const response = await request.get("/api/health");
    expect(response.status()).toBe(200);
    const body = await response.json();
    expect(body.status).toBe("ok");
  });

  test("unauthenticated API returns 401", async ({ request }) => {
    const response = await request.post("/api/events/123/register", {
      data: { role: "Participant" },
    });
    expect(response.status()).toBe(401);
  });

  test("cron endpoint without secret returns 401", async ({ request }) => {
    const response = await request.get("/api/cron/process-escrow");
    expect(response.status()).toBe(401);
  });
});

test.describe("Smoke Tests — Auth Flow", () => {
  test("login with invalid credentials shows error", async ({ page }) => {
    await page.goto("/login");
    await page.fill('input[type="email"]', "fake@example.com");
    await page.fill('input[type="password"]', "wrongpassword");
    await page.click('button[type="submit"]');
    await expect(page.locator('div[role="alert"]').filter({ hasNot: page.locator('#__next-route-announcer__') }).first()).toBeVisible();
  });

  test("signup without terms acceptance shows error", async ({ page }) => {
    await page.goto("/signup");
    await page.fill('#display-name', "Test User");
    await page.fill('#email', "test" + Date.now() + "@example.com");
    await page.fill('#password', "Password123!");
    await page.fill('#confirm-password', "Password123!");
    // Don't check terms checkbox
    await page.click('button[type="submit"]');
    await expect(page.locator('div[role="alert"]').filter({ hasNot: page.locator('#__next-route-announcer__') }).first()).toBeVisible();
    await expect(page.locator("text=Terms of Service").first()).toBeVisible();
  });

  test("signup with mismatched passwords shows error", async ({ page }) => {
    await page.goto("/signup");
    await page.fill('#display-name', "Test User");
    await page.fill('#email', "test" + Date.now() + "@example.com");
    await page.fill('#password', "Password123!");
    await page.fill('#confirm-password', "Different123!");
    await page.check("#terms");
    await page.click('button[type="submit"]');
    await expect(page.locator('div[role="alert"]').filter({ hasNot: page.locator('#__next-route-announcer__') }).first()).toBeVisible();
    await expect(page.locator("text=do not match").first()).toBeVisible();
  });
});
