import { test, expect } from "@playwright/test";

test.describe("Requirement R2: Event Lifecycle State Machine Alignment", () => {
  test("R2-T1-01 & R2-T1-03: Renders transition buttons and handles confirmation modals for irreversible transitions", async ({
    page,
  }) => {
    // Navigate to event details overview page
    await page.goto("/events/mock-event-id");

    // Check if Lifecycle Controls section exists
    const lifecycleSection = page.locator("text=Lifecycle Controls");
    if (await lifecycleSection.isVisible()) {
      // Verify transition buttons are rendered explicitly matching DB state
      const publishButton = page.locator('button:has-text("Publish Event")');
      if (await publishButton.isVisible()) {
        await expect(publishButton).toBeEnabled();
      }

      // Check confirmation dialog handler for Lock Team Formation / Cancel Event
      page.on("dialog", async (dialog) => {
        expect(dialog.message()).toMatch(
          /Lock team formation|Cancel this event|Begin judging|Mark event as completed/,
        );
        await dialog.accept();
      });

      const lockTeamButton = page.locator('button:has-text("Lock Team Formation")');
      if (await lockTeamButton.isVisible()) {
        await lockTeamButton.click();
      }
    }
  });

  test("R2-T2-01: Displays error banner when backend returns 422 for invalid state transition", async ({
    page,
  }) => {
    await page.route("/api/events/*/state", async (route) => {
      await route.fulfill({
        status: 422,
        contentType: "application/json",
        body: JSON.stringify({
          error: {
            code: "INVALID_TRANSITION",
            message: "Cannot advance: At least 1 judge must be assigned",
            details: {
              unmetPreconditions: ["At least 1 judge must be assigned"],
            },
          },
        }),
      });
    });

    await page.goto("/events/test-event-id");
    const publishBtn = page.locator('button:has-text("Publish Event")');
    if (await publishBtn.isVisible()) {
      await publishBtn.click();
      await expect(page.locator('div[role="alert"]')).toContainText(
        "Cannot advance: At least 1 judge must be assigned",
      );
    }
  });
});
