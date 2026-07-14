import { test, expect } from '@playwright/test';
import { waitForPageReady, authFile, authAccountFile } from './helpers';

// Uses the shared authenticated session from auth.setup.ts — no per-test
// registration. Regression coverage for the user query dying with
// "No QueryClient was found in Svelte context" after login.
test.use({ storageState: authFile });

test.describe('Profile page (logged in)', () => {
  test('profile page renders user data', async ({ page }) => {
    const fs = await import('node:fs/promises');
    const { email } = JSON.parse(await fs.readFile(authAccountFile, 'utf-8'));

    // Track console errors: the regression surfaced as
    // "No QueryClient was found in Svelte context"
    const consoleErrors: string[] = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') consoleErrors.push(msg.text());
    });

    await page.goto('/profile', { waitUntil: 'domcontentloaded', timeout: 60000 });
    await waitForPageReady(page);
    await expect(page).toHaveURL(/\/profile/);

    // Profile content renders (not a blank page)
    const emailUser = email.split('@')[0];
    const profileContent = page
      .locator(`text=${emailUser}`)
      .or(page.locator(`text=${email}`))
      .or(page.getByRole('heading', { name: /profile|my anime|watchlist/i }));
    await expect(profileContent.first()).toBeVisible({ timeout: 20000 });

    // The user query must not have died on a missing QueryClient
    expect(consoleErrors.filter((e) => e.includes('No QueryClient'))).toEqual([]);

    // Header shows logged-in state, not Login/Register
    await expect(page.locator('nav').getByRole('button', { name: 'Register', exact: true })).toHaveCount(0);
  });
});
