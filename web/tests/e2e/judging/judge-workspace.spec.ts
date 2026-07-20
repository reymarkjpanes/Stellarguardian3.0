import { test, expect } from '@playwright/test';
import { setupJudgingFixture } from '../fixtures/judging.fixture';

test.describe('Judging Workspace - Split Screen', () => {
  let judgeAuth: any;
  let workspaceData: any;

  test.beforeEach(async ({ page }) => {
    // We would use a fixture to seed the event, submission, and judge assignment
    // const fixture = await setupJudgingFixture();
    // judgeAuth = fixture.judgeAuth;
    // workspaceData = fixture.workspaceData;
    // await page.goto(`/auth/login`);
    // await login(page, judgeAuth.email, judgeAuth.password);
    // await page.goto(`/events/${workspaceData.eventId}/judge/workspace/${workspaceData.submissionId}`);
  });

  test('should render split screen layout with submission and scoring panels', async ({ page }) => {
    // Placeholder for actual test implementation
    // await expect(page.locator('text=Evaluation Workspace')).toBeVisible();
    // await expect(page.locator('text=Evaluation Rubric')).toBeVisible();
  });

  test('should autosave draft after score changes', async ({ page }) => {
    // Fill in a score input
    // await page.locator('input[type="number"]').first().fill('8');
    // await expect(page.locator('text=Saving...')).toBeVisible();
    // await expect(page.locator('text=Saved just now')).toBeVisible({ timeout: 5000 });
  });

  test('should enforce validation rules and prevent invalid submission', async ({ page }) => {
    // Enter score exceeding max
    // await page.locator('input[type="number"]').first().fill('999');
    // await expect(page.locator('text=Validation Errors')).toBeVisible();
    // await expect(page.getByRole('button', { name: 'Submit Evaluation' })).toBeDisabled();
  });
});
