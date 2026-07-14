import { test, expect } from '@playwright/test';
import { v4 as uuidv4 } from 'uuid';
import { waitForAuthForm, waitForPageReady, deleteEmailsForRecipient, getLatestEmail, extractVerificationLink } from './helpers';

// Full logged-in profile flow: register -> verify email -> login -> /profile.
// Regression coverage for the user query dying with "No QueryClient was
// found in Svelte context" after login, which left the profile blank.


test.describe('Profile page (logged in)', () => {
  test.describe.configure({ mode: 'serial' });
  test.setTimeout(120000);

  let testEmail: string;
  const testPassword = 'Password1!';

  test.beforeEach(async () => {
    testEmail = `${uuidv4()}@weeb.vip`;
  });

  test.afterEach(async () => {
    await deleteEmailsForRecipient(testEmail);
  });

  test('profile page renders user data after login', async ({ page }) => {
    // Register via the direct page
    await page.goto('/auth/register', { waitUntil: 'domcontentloaded', timeout: 60000 });
    await waitForAuthForm(page);
    await page.locator('form').waitFor({ state: 'visible', timeout: 15000 });

    await page.locator('input[type="email"], input[name="username"]').first().fill(testEmail);
    await page.locator('input[name="password"][type="password"]').first().fill(testPassword);
    const confirm = page.locator('input[name="confirmPassword"]');
    if (await confirm.count() > 0) await confirm.fill(testPassword);

    const submitButton = page.locator('form button[type="submit"]').first();
    await expect(submitButton).toBeEnabled({ timeout: 10000 }); // waits for hydration gate
    await submitButton.click();
    await expect(page.locator('text=/registration.*successful|check.*email/i')).toBeVisible({ timeout: 15000 });

    // Verify the email
    const baseUrl = page.url().match(/^https?:\/\/[^\/]+/)![0];
    const email = await getLatestEmail(testEmail);
    const verificationLink = extractVerificationLink(email.HTML || email.Text || '', baseUrl);
    expect(verificationLink).toBeTruthy();
    await page.goto(verificationLink!, { waitUntil: 'domcontentloaded', timeout: 60000 });
    await expect(page.getByText(/verified successfully|verification failed/i).first()).toBeVisible({ timeout: 15000 });

    // Login
    await page.goto('/auth/login', { waitUntil: 'domcontentloaded', timeout: 60000 });
    await waitForAuthForm(page);
    await page.fill('input[name="username"]', testEmail);
    await page.fill('input[name="password"]', testPassword);
    const loginButton = page.locator('form button[type="submit"]').first();
    await expect(loginButton).toBeEnabled({ timeout: 10000 });
    await loginButton.click();
    await page.waitForURL((url) => !url.pathname.includes('/auth/login'), { timeout: 60000 });

    // Track console errors from here: the profile regression surfaced as
    // "No QueryClient was found in Svelte context"
    const consoleErrors: string[] = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') consoleErrors.push(msg.text());
    });

    // Visit the profile page (hooks must NOT redirect back to login)
    await page.goto('/profile', { waitUntil: 'domcontentloaded', timeout: 60000 });
    await waitForPageReady(page);
    await expect(page).toHaveURL(/\/profile/);

    // Profile content renders (not a blank page): the page shows the
    // username/email or profile sections once the user query resolves
    const emailUser = testEmail.split('@')[0];
    const profileContent = page
      .locator(`text=${emailUser}`)
      .or(page.locator(`text=${testEmail}`))
      .or(page.getByRole('heading', { name: /profile|my anime|watchlist/i }));
    await expect(profileContent.first()).toBeVisible({ timeout: 20000 });

    // The user query must not have died on a missing QueryClient
    const queryClientErrors = consoleErrors.filter((e) => e.includes('No QueryClient'));
    expect(queryClientErrors).toEqual([]);

    // Header shows the logged-in avatar/menu rather than Login/Register
    await expect(page.locator('nav').getByRole('button', { name: 'Register', exact: true })).toHaveCount(0);
  });
});
