import { test, expect, type Page, type Locator } from '@playwright/test';
import { v4 as uuidv4 } from 'uuid';
import { waitForHomepage, waitForAuthForm, waitForPageReady, deleteEmailsForRecipient, getLatestEmail, extractVerificationLink } from './helpers';

// Opens the auth modal in register mode and returns the dialog locator.
// Handles both desktop (direct header button) and mobile (drawer) flows.
async function openRegisterModal(page: Page): Promise<Locator> {
  const dialog = page.getByRole('dialog');

  const mobileMenu = page.getByRole('button', { name: 'Open menu' });
  const isMobile = await mobileMenu.isVisible().catch(() => false);

  if (isMobile) {
    console.log('Opening mobile drawer');
    await mobileMenu.click();
    // Drawer uses a fly transition; wait for it to settle
    const drawerRegister = page.getByRole('button', { name: 'Register', exact: true });
    await drawerRegister.waitFor({ state: 'visible', timeout: 5000 });
    await drawerRegister.click();
  } else {
    console.log('Clicking desktop header Register');
    await page.locator('nav').getByRole('button', { name: 'Register', exact: true }).click();
  }

  await dialog.waitFor({ state: 'visible', timeout: 10000 });

  // Auth state can race — if the modal opened in login mode, click "Sign up" to switch.
  const createAccountHeading = dialog.getByRole('heading', { name: 'Create account' });
  if (!(await createAccountHeading.isVisible().catch(() => false))) {
    console.log('Modal opened in login mode — switching to register');
    await dialog.getByRole('button', { name: 'Sign up' }).click();
  }

  await expect(createAccountHeading).toBeVisible({ timeout: 10000 });
  return dialog;
}

async function fillAndSubmitRegister(dialog: Locator, page: Page, email: string, password: string) {
  // Staging's registration endpoint intermittently drops the request under
  // parallel-shard load; retry the submit once if the success confirmation
  // doesn't appear in the modal.
  const success = dialog.locator('text=/registration.*successful/i');
  for (let attempt = 0; attempt < 2; attempt++) {
    await dialog.locator('input[name="username"]').fill(email);
    await dialog.locator('input[name="password"]').fill(password);
    await dialog.locator('input[name="confirmPassword"]').fill(password);
    await dialog.locator('form button[type="submit"]').evaluate((btn) => (btn as HTMLButtonElement).click());
    try {
      await success.waitFor({ state: 'visible', timeout: 20000 });
      return;
    } catch {
      if (attempt === 0) console.log('Registration confirmation not shown in modal, retrying submit...');
    }
  }
  await expect(success).toBeVisible({ timeout: 20000 });
}

test.describe('User Registration Flow', () => {
  // Run tests serially within this file — they all hit shared staging Mailhog
  // and can race when running in parallel.
  test.describe.configure({ mode: 'serial' });

  // Increase timeout for CI where network to staging is slower
  test.setTimeout(90000);

  let testEmail: string;
  const testPassword = 'Password1!';

  test.beforeEach(async () => {
    testEmail = `${uuidv4()}@weeb.vip`;
    console.log(`Testing with email: ${testEmail}`);
  });

  test.afterEach(async () => {
    await deleteEmailsForRecipient(testEmail);
  });

  test('complete registration and email verification flow', async ({ page }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded', timeout: 60000 });
    await waitForHomepage(page);

    const dialog = await openRegisterModal(page);
    await fillAndSubmitRegister(dialog, page, testEmail, testPassword);

    // Success message is rendered inside the modal
    await expect(dialog.locator('text=/registration.*successful/i')).toBeVisible({ timeout: 30000 });
    console.log('Registration successful, checking for verification email...');

    const email = await getLatestEmail(testEmail);
    expect(email).toBeTruthy();
    console.log('Verification email received');

    const emailBody = email.HTML || email.Text || '';
    const baseUrl = page.url().match(/^https?:\/\/[^\/]+/)?.[0] || 'http://localhost:4321';
    const verificationLink = extractVerificationLink(emailBody, baseUrl);
    expect(verificationLink).toBeTruthy();
    console.log(`Verification link found: ${verificationLink}`);

    await page.goto(verificationLink!, { waitUntil: 'domcontentloaded', timeout: 60000 });
    await waitForPageReady(page);

    // Wait for the verification page to render and resolve
    await expect(page.getByRole('heading', { name: /Email Verification/i })).toBeVisible({ timeout: 15000 });
    await expect(page.getByText(/verified successfully|verification failed/i).first())
      .toBeVisible({ timeout: 15000 });
    console.log('Email verification page loaded');

    // Try to login with verified account on /auth/login
    await page.goto('/auth/login', { waitUntil: 'domcontentloaded', timeout: 60000 });
    await waitForAuthForm(page);

    await page.fill('input[name="username"]', testEmail);
    await page.fill('input[name="password"]', testPassword);
    await page.locator('form button[type="submit"]').first().click();

    // On success, Login.svelte navigates to '/'. Wait for that (staging can be slow under load).
    await page.waitForURL((url) => !url.pathname.includes('/auth/login'), { timeout: 60000 });
    console.log('Login successful - registration flow complete!');
  });

  test('resend verification email', async ({ page }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded', timeout: 60000 });
    await waitForHomepage(page);

    const dialog = await openRegisterModal(page);
    await fillAndSubmitRegister(dialog, page, testEmail, testPassword);

    await expect(dialog.locator('text=/registration.*successful/i')).toBeVisible({ timeout: 30000 });

    // Navigate to resend verification page
    await page.goto('/auth/resend-verification', { waitUntil: 'domcontentloaded', timeout: 60000 });
    await waitForAuthForm(page);

    await page.fill('input[name="username"], input[type="email"]', testEmail);

    // Wait for button to be ready and use evaluate for reliable click
    const submitBtn = page.getByRole('button', { name: /send verification email/i });
    await submitBtn.waitFor({ state: 'visible' });
    await submitBtn.evaluate((btn) => (btn as HTMLButtonElement).click());

    // The resend page shows: "Verification email sent! Please check your inbox and spam folder."
    await expect(page.getByText(/verification email sent|check your inbox/i).first())
      .toBeVisible({ timeout: 15000 });
    console.log('Resend verification email successful');

    const email = await getLatestEmail(testEmail);
    expect(email).toBeTruthy();
    console.log('Resent verification email received');
  });

  test('prevent login before email verification', async ({ page }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded', timeout: 60000 });
    await waitForHomepage(page);

    const dialog = await openRegisterModal(page);
    await fillAndSubmitRegister(dialog, page, testEmail, testPassword);

    await expect(dialog.locator('text=/registration.*successful/i')).toBeVisible({ timeout: 30000 });

    // Try to login without verification
    await page.goto('/auth/login', { waitUntil: 'domcontentloaded', timeout: 60000 });
    await waitForAuthForm(page);

    await page.fill('input[name="username"]', testEmail);
    await page.fill('input[name="password"]', testPassword);
    await page.locator('form button[type="submit"]').first().click();

    // Login should fail. The login form shows a generic credential error.
    // Verify we did NOT navigate away from /auth/login AND an error banner is shown.
    await expect(page.getByText(/unable to sign in|check your credentials/i).first())
      .toBeVisible({ timeout: 10000 });
    expect(page.url()).toContain('/auth/login');
    console.log('Login correctly blocked for unverified email');
  });
});
