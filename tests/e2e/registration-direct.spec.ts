import { test, expect } from '@playwright/test';
import { v4 as uuidv4 } from 'uuid';

// This is an alternative test that navigates directly to the login page
// instead of using the modal, in case the modal has issues

test.describe('User Registration Flow (Direct Navigation)', () => {
  let testEmail: string;
  const testPassword = 'Password1!';

  test.beforeEach(async () => {
    // Generate unique email for this test run
    testEmail = `${uuidv4()}@weeb.vip`;
    console.log(`Testing with email: ${testEmail}`);
  });

  test('register user via direct navigation', async ({ page }) => {
    // Navigate directly to register page
    await page.goto('/auth/register');
    await page.waitForLoadState('networkidle');

    // Wait for client-side hydration and form to be ready
    // The form might not be immediately visible due to Svelte client:load hydration
    console.log('Waiting for registration form to load...');

    // Wait for the form element to appear (this indicates hydration is complete)
    await page.locator('form').waitFor({ state: 'visible', timeout: 15000 });

    // Additional wait for any async loading (query client initialization)
    await page.waitForTimeout(2000);

    // Fill registration form
    console.log('Filling registration form...');

    // Find and fill email field with more robust selector
    const emailInput = page.locator('input[type="email"], input[name="username"], input[placeholder*="email" i]').first();
    await emailInput.waitFor({ state: 'visible', timeout: 10000 });
    await emailInput.fill(testEmail);

    // Find and fill password field
    const passwordInput = page.locator('input[name="password"][type="password"]').first();
    await passwordInput.waitFor({ state: 'visible' });
    await passwordInput.fill(testPassword);

    // Find and fill confirm password if it exists
    const confirmPasswordInput = page.locator('input[name="confirmPassword"], input[placeholder*="confirm" i][type="password"]');
    if (await confirmPasswordInput.count() > 0) {
      await confirmPasswordInput.fill(testPassword);
    }

    // Submit registration
    console.log('Submitting registration...');
    const submitButton = page.locator('form button[type="submit"]').first();
    await submitButton.waitFor({ state: 'visible' });
    await submitButton.click();

    // Wait a moment for the API call to complete
    await page.waitForTimeout(3000);

    // Log the page content for debugging
    const pageText = await page.textContent('body');
    console.log('Page content after form submission:', pageText?.slice(0, 1500) + '...');

    // Check for any messages
    const allMessages = await page.locator('div').allTextContents();
    console.log('All div text contents:', allMessages.filter(text => text.includes('success') || text.includes('error') || text.includes('Registration') || text.includes('check')));

    // Try to find success message with multiple patterns
    const successMessage = page.locator('text=/registration.*successful|check.*email|success|verify/i');
    await expect(successMessage).toBeVisible({ timeout: 10000 });
    console.log('Registration successful!');

    // Verify we're not automatically logged in
    const profileLink = page.locator('a[href="/profile"], [data-testid="user-menu"]');
    const isLoggedIn = await profileLink.count() > 0;
    expect(isLoggedIn).toBe(false);
    console.log('Confirmed: User is not automatically logged in after registration');
  });

  test('verify resend verification page works', async ({ page }) => {
    // Navigate directly to resend verification page
    await page.goto('/auth/resend-verification');
    await page.waitForLoadState('networkidle');

    // Wait for client-side hydration
    await page.locator('form').waitFor({ state: 'visible', timeout: 15000 });
    await page.waitForTimeout(2000);

    // Check page loaded correctly
    await expect(page.locator('h2:has-text("Resend Email Verification")')).toBeVisible();

    // Fill in email
    const emailInput = page.locator('input[type="email"], input[name="username"]').first();
    await emailInput.waitFor({ state: 'visible' });
    await emailInput.fill(testEmail);

    // Submit
    const submitButton = page.locator('button[type="submit"], button:has-text("Send Verification Email")').first();
    await submitButton.click();

    // Should see either success or error message
    const messageSelector = page.locator('text=/sent|check.*inbox|not found|already verified/i');
    await expect(messageSelector).toBeVisible({ timeout: 10000 });
    console.log('Resend verification page is working');
  });
});
