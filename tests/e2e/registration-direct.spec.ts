import { test, expect } from '@playwright/test';
import { v4 as uuidv4 } from 'uuid';
import { waitForAuthForm, deleteEmailsForRecipient, registerNewUser } from './helpers';

// This is an alternative test that navigates directly to the auth pages
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
    // Register (helper waits out hydration, retries the submit under staging
    // registration flake, and asserts the check-email redirect)
    await registerNewUser(page, testEmail, testPassword);
    console.log('Registration successful!');

    // Verify we're not automatically logged in — verification still gates login
    const profileLink = page.locator('a[href="/profile"], [data-testid="user-menu"]');
    const isLoggedIn = await profileLink.count() > 0;
    expect(isLoggedIn).toBe(false);
    console.log('Confirmed: User is not automatically logged in after registration');
  });

  test('register page sets the expectation before submitting', async ({ page }) => {
    await page.goto('/auth/register', { waitUntil: 'domcontentloaded', timeout: 60000 });
    await waitForAuthForm(page);

    // The helper line under the email field is what makes the next screen
    // expected rather than a surprise
    await expect(page.getByText(/send a link here to confirm/i)).toBeVisible({ timeout: 15000 });
  });

  test('check-email screen offers recovery without retyping the address', async ({ page }) => {
    await registerNewUser(page, testEmail, testPassword);

    // The address is on screen, so a typo is visible and fixable
    await expect(page.getByText(testEmail, { exact: false }).first()).toBeVisible();

    // The short token lifetime is stated, not left as a mystery failure
    await expect(page.getByText(/expires in 15 minutes/i)).toBeVisible();
    await expect(page.getByText(/spam/i).first()).toBeVisible();

    // And the way out of a typo is one click, not a support ticket
    await expect(page.getByRole('link', { name: /sign up again/i })).toHaveAttribute('href', '/auth/register');
  });

  test('check-email screen degrades gracefully with no email in the URL', async ({ page }) => {
    // Someone lands here from history or a shared link
    await page.goto('/auth/check-email', { waitUntil: 'domcontentloaded', timeout: 60000 });

    await expect(page.getByRole('heading', { name: /check your email/i })).toBeVisible({ timeout: 15000 });
    // Without an address there is nothing to resend to, so the primary action
    // must fall back to something that still works
    await expect(page.getByRole('link', { name: /go to log in/i })).toBeVisible();
  });

  test('a broken verification link explains itself and offers a new one', async ({ page }) => {
    // The gateway can't distinguish an expired token from a malformed one —
    // both come back as "Access denied" — so there is one honest failure state.
    await page.goto(
      `/auth/verification?email=${encodeURIComponent(testEmail)}&token=not-a-real-token`,
      { waitUntil: 'domcontentloaded', timeout: 60000 }
    );

    await expect(page.getByRole('heading', { name: /this link didn't work/i })).toBeVisible({ timeout: 25000 });
    await expect(page.getByText(/expire 15 minutes/i)).toBeVisible();
    // Recovery uses the address already in the URL
    await expect(page.getByRole('button', { name: /send a new link/i })).toBeVisible();
    await expect(page.getByText(/account and password are unchanged/i)).toBeVisible();
  });

  test('a truncated verification link is called out as truncated', async ({ page }) => {
    // Email clients cut long links; without a token there is nothing to verify
    // and no point pretending the server rejected it.
    await page.goto('/auth/verification', { waitUntil: 'domcontentloaded', timeout: 60000 });

    await expect(page.getByRole('heading', { name: /this link is incomplete/i })).toBeVisible({ timeout: 20000 });
    await expect(page.getByRole('link', { name: /send me a new link/i })).toBeVisible();
  });

  test('verify resend verification page still works', async ({ page }) => {
    // The standalone page is no longer linked from the login form, but stays
    // reachable for anyone who has it bookmarked or arrives from an old email.
    await page.goto('/auth/resend-verification', { waitUntil: 'domcontentloaded', timeout: 60000 });
    await waitForAuthForm(page);

    await expect(page.locator('h2:has-text("Resend Email Verification")')).toBeVisible();

    const emailInput = page.locator('input[type="email"], input[name="username"]').first();
    await emailInput.waitFor({ state: 'visible' });
    await emailInput.fill(testEmail);

    // Submit - use evaluate for reliable click
    const submitButton = page.locator('button[type="submit"], button:has-text("Send Verification Email")').first();
    await submitButton.waitFor({ state: 'visible' });
    await submitButton.evaluate((btn) => (btn as HTMLButtonElement).click());

    // Should see either success or error message
    const messageSelector = page.locator('text=/sent|check.*inbox|not found|already verified/i');
    await expect(messageSelector.first()).toBeVisible({ timeout: 15000 });
    console.log('Resend verification page is working');
  });
});
