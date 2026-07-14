import { test, expect } from '@playwright/test';
import { v4 as uuidv4 } from 'uuid';
import { waitForAuthForm, deleteEmailsForRecipient, registerNewUser } from './helpers';

// This is an alternative test that navigates directly to the login page
// instead of using the modal, in case the modal has issues

test.describe('User Registration Flow (Direct Navigation)', () => {
  // Run serially — these hit the shared staging API which can throttle parallel requests
  test.describe.configure({ mode: 'serial' });

  // Increase timeout for CI where network to staging is slower
  test.setTimeout(90000);

  let testEmail: string;
  const testPassword = 'Password1!';

  test.beforeEach(async () => {
    // Generate unique email for this test run
    testEmail = `${uuidv4()}@weeb.vip`;
    console.log(`Testing with email: ${testEmail}`);
  });

  test.afterEach(async () => {
    await deleteEmailsForRecipient(testEmail);
  });

  test('register user via direct navigation', async ({ page }) => {
    // Register (helper waits out hydration and retries the submit under
    // staging registration flake)
    await registerNewUser(page, testEmail, testPassword);
    console.log('Registration successful!');

    // Verify we're not automatically logged in
    const profileLink = page.locator('a[href="/profile"], [data-testid="user-menu"]');
    const isLoggedIn = await profileLink.count() > 0;
    expect(isLoggedIn).toBe(false);
    console.log('Confirmed: User is not automatically logged in after registration');
  });

  test('verify resend verification page works', async ({ page }) => {
    // Navigate directly to resend verification page
    await page.goto('/auth/resend-verification', { waitUntil: 'domcontentloaded', timeout: 60000 });
    await waitForAuthForm(page);
    await page.waitForTimeout(2000);

    // Check page loaded correctly
    await expect(page.locator('h2:has-text("Resend Email Verification")')).toBeVisible();

    // Fill in email
    const emailInput = page.locator('input[type="email"], input[name="username"]').first();
    await emailInput.waitFor({ state: 'visible' });
    await emailInput.fill(testEmail);

    // Submit - use evaluate for reliable click
    const submitButton = page.locator('button[type="submit"], button:has-text("Send Verification Email")').first();
    await submitButton.waitFor({ state: 'visible' });
    await submitButton.evaluate((btn) => (btn as HTMLButtonElement).click());

    // Should see either success or error message
    const messageSelector = page.locator('text=/sent|check.*inbox|not found|already verified/i');
    await expect(messageSelector).toBeVisible({ timeout: 15000 });
    console.log('Resend verification page is working');
  });
});
