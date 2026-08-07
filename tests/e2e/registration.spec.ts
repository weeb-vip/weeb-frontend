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

// Registering from the modal now closes it and navigates to /auth/check-email,
// so the modal path and the /auth/register path end in the same place.
async function fillAndSubmitRegister(dialog: Locator, page: Page, email: string, password: string) {
  // Staging's registration endpoint intermittently drops the request under
  // parallel-shard load; retry the submit once if the redirect doesn't happen.
  const submit = dialog.locator('form button[type="submit"]');
  for (let attempt = 0; attempt < 2; attempt++) {
    if (page.url().includes('/auth/check-email')) break;
    try {
      // See helpers.registerNewUser: the submit button disables itself while the
      // mutation is in flight, so a slow first submit must not be retried
      // against a disabled button.
      await expect(submit).toBeEnabled({ timeout: 30000 });
      await dialog.locator('input[name="username"]').fill(email);
      await dialog.locator('input[name="password"]').fill(password);
      await dialog.locator('input[name="confirmPassword"]').fill(password);
      await submit.evaluate((btn) => (btn as HTMLButtonElement).click());
    } catch {
      // navigated away (modal closed / inputs detached) or never settled
    }
    try {
      await page.waitForURL(/\/auth\/check-email/, { timeout: 25000 });
      break;
    } catch {
      if (attempt === 0) console.log('Registration redirect did not happen from modal, retrying submit...');
    }
  }
  await expect(page).toHaveURL(/\/auth\/check-email/, { timeout: 20000 });
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

    // Registration now lands on a dedicated screen that names the address
    await expect(page.getByRole('heading', { name: /check your email/i })).toBeVisible({ timeout: 30000 });
    await expect(page.getByText(testEmail, { exact: false }).first()).toBeVisible({ timeout: 10000 });
    console.log('Landed on check-email screen, waiting for verification email...');

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

    // Success screen, then an automatic bounce to login with the email pre-filled.
    // (Verification can't mint a session — the mutation returns success + userID
    // only — so pre-filling is the closest we get to not making them retype.)
    await expect(page.getByRole('heading', { name: /you're verified/i })).toBeVisible({ timeout: 20000 });
    console.log('Email verified');

    await page.waitForURL(/\/auth\/login/, { timeout: 20000 });
    await waitForAuthForm(page);
    await expect(page.locator('input[name="username"]')).toHaveValue(testEmail, { timeout: 10000 });
    console.log('Bounced to login with the email pre-filled');

    await page.fill('input[name="password"]', testPassword);
    await page.locator('form button[type="submit"]').first().click();

    // On success, Login.svelte navigates to '/'. Wait for that (staging can be slow under load).
    await page.waitForURL((url) => !url.pathname.includes('/auth/login'), { timeout: 60000 });
    console.log('Login successful - registration flow complete!');
  });

  test('resend verification email from the check-email screen', async ({ page }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded', timeout: 60000 });
    await waitForHomepage(page);

    const dialog = await openRegisterModal(page);
    await fillAndSubmitRegister(dialog, page, testEmail, testPassword);

    // Consume the signup email so the one we assert on below is the resent one
    await getLatestEmail(testEmail);
    await deleteEmailsForRecipient(testEmail);

    // Resend without retyping the address — it travels in the URL
    const resendButton = page.getByRole('button', { name: /resend email/i });
    await resendButton.waitFor({ state: 'visible', timeout: 15000 });
    await resendButton.click();

    await expect(page.getByText(/sent again just now/i)).toBeVisible({ timeout: 15000 });
    console.log('Resend confirmed in place');

    const email = await getLatestEmail(testEmail);
    expect(email).toBeTruthy();
    console.log('Resent verification email received');
  });

  test('resend is rate-limited by a visible countdown', async ({ page }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded', timeout: 60000 });
    await waitForHomepage(page);

    const dialog = await openRegisterModal(page);
    await fillAndSubmitRegister(dialog, page, testEmail, testPassword);

    await page.getByRole('button', { name: /resend email/i }).click();
    await expect(page.getByText(/sent again just now/i)).toBeVisible({ timeout: 15000 });

    // A countdown replaces the button, so repeat taps can't fan out N emails
    await expect(page.getByText(/resend in \d+:\d{2}/i)).toBeVisible({ timeout: 5000 });
    await expect(page.getByRole('button', { name: /resend email/i })).toHaveCount(0);
    console.log('Resend cooldown is shown and the button is gone');
  });

  test('unverified login is blocked and explains why', async ({ page }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded', timeout: 60000 });
    await waitForHomepage(page);

    const dialog = await openRegisterModal(page);
    await fillAndSubmitRegister(dialog, page, testEmail, testPassword);

    // Try to login without verifying
    await page.goto('/auth/login', { waitUntil: 'domcontentloaded', timeout: 60000 });
    await waitForAuthForm(page);

    await page.fill('input[name="username"]', testEmail);
    await page.fill('input[name="password"]', testPassword);
    await page.locator('form button[type="submit"]').first().click();

    // The gateway returns INACTIVE_CREDENTIALS here, which the login form now
    // renders as a verification prompt instead of a credential error.
    await expect(page.getByText(/verify your email to continue/i)).toBeVisible({ timeout: 15000 });
    await expect(page.getByText(/verified email before you can log in/i)).toBeVisible();
    // The old copy blamed the password and sent people off to reset it
    await expect(page.getByText(/check your credentials/i)).toHaveCount(0);
    expect(page.url()).toContain('/auth/login');
    console.log('Login correctly blocked with a verification prompt');
  });

  test('the blocked-login banner resends without retyping the address', async ({ page }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded', timeout: 60000 });
    await waitForHomepage(page);

    const dialog = await openRegisterModal(page);
    await fillAndSubmitRegister(dialog, page, testEmail, testPassword);

    await getLatestEmail(testEmail);
    await deleteEmailsForRecipient(testEmail);

    await page.goto('/auth/login', { waitUntil: 'domcontentloaded', timeout: 60000 });
    await waitForAuthForm(page);
    await page.fill('input[name="username"]', testEmail);
    await page.fill('input[name="password"]', testPassword);
    await page.locator('form button[type="submit"]').first().click();

    const resend = page.getByRole('button', { name: /send a new link/i });
    await resend.waitFor({ state: 'visible', timeout: 15000 });
    await resend.click();

    await expect(page.getByText(/sent — check your inbox/i)).toBeVisible({ timeout: 15000 });

    const email = await getLatestEmail(testEmail);
    expect(email).toBeTruthy();
    console.log('Resent from the login banner without leaving the page');
  });

  test('a wrong password on a verified account still says the credentials are wrong', async ({ page }) => {
    // Guards the branch: INVALID_CREDENTIALS must NOT render the verification
    // prompt, or we would tell someone to check their email over a typo.
    await page.goto('/', { waitUntil: 'domcontentloaded', timeout: 60000 });
    await waitForHomepage(page);

    const dialog = await openRegisterModal(page);
    await fillAndSubmitRegister(dialog, page, testEmail, testPassword);

    const email = await getLatestEmail(testEmail);
    const baseUrl = page.url().match(/^https?:\/\/[^\/]+/)?.[0] || 'http://localhost:4321';
    const verificationLink = extractVerificationLink(email.HTML || email.Text || '', baseUrl);
    expect(verificationLink).toBeTruthy();

    await page.goto(verificationLink!, { waitUntil: 'domcontentloaded', timeout: 60000 });
    await expect(page.getByRole('heading', { name: /you're verified/i })).toBeVisible({ timeout: 20000 });

    await page.goto('/auth/login', { waitUntil: 'domcontentloaded', timeout: 60000 });
    await waitForAuthForm(page);
    await page.fill('input[name="username"]', testEmail);
    await page.fill('input[name="password"]', 'definitely-the-wrong-password');
    await page.locator('form button[type="submit"]').first().click();

    await expect(page.getByText(/unable to sign in|check your credentials/i)).toBeVisible({ timeout: 15000 });
    await expect(page.getByText(/verify your email to continue/i)).toHaveCount(0);
    expect(page.url()).toContain('/auth/login');
    console.log('Verified account with a bad password gets the credential error, not the verify prompt');
  });
});
