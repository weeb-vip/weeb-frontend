import { test, expect } from '@playwright/test';
import { v4 as uuidv4 } from 'uuid';
import { waitForAuthForm, waitForPageReady, deleteEmailsForRecipient, getLatestEmail, extractVerificationLink, registerNewUser } from './helpers';

// Full logged-in profile flow: register -> verify email -> login -> /profile.
// Regression coverage for the user query dying with "No QueryClient was
// found in Svelte context" after login, which left the profile blank.


test.describe('Profile page (logged in)', () => {
  test.describe.configure({ mode: 'serial' });
  test.setTimeout(300000);
  // Budget note: registration now queues behind a global slot (see
  // helpers.withRegistrationSlot) and the mail wait runs to about three
  // minutes, so the old budget expired mid-wait and reported a bare test
  // timeout instead of the real cause.

  let testEmail: string;
  const testPassword = 'Password1!';

  test.beforeEach(async () => {
    testEmail = `${uuidv4()}@weeb.vip`;
  });

  test.afterEach(async () => {
    await deleteEmailsForRecipient(testEmail);
  });

  test('profile page renders user data after login', async ({ page }) => {
    // Register (helper retries the submit under staging flake)
    await registerNewUser(page, testEmail, testPassword);

    // Verify the email
    const baseUrl = page.url().match(/^https?:\/\/[^\/]+/)![0];
    const email = await getLatestEmail(testEmail);
    const verificationLink = extractVerificationLink(email.HTML || email.Text || '', baseUrl);
    expect(verificationLink).toBeTruthy();
    await page.goto(verificationLink!, { waitUntil: 'domcontentloaded', timeout: 60000 });
    await expect(page.getByRole('heading', { name: /you're verified|this link didn't work/i })).toBeVisible({ timeout: 20000 });

    // Login. The verification screen auto-bounces here after a few seconds, so
    // navigate explicitly to avoid racing that redirect mid-fill.
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

    // --- the image cropper opens at its larger size ---
    // Asserted here rather than in a spec of its own because reaching it costs
    // another account against shared staging, and this test is already signed
    // in on the page that owns it.
    //
    // The cropper is a crop UI in a dialog: at the default modal width the
    // frame is too small to position a crop in. It used to ask for the width
    // with `className="max-w-2xl"`, which Modal never applied -- the class went
    // nowhere and the dialog quietly rendered at the small size. Modal now takes
    // a `size`, and this pins the result rather than the prop: a dialog that
    // came back at 440px would pass any check on the attribute.
    const openCropper = page.getByRole('button', { name: 'Change profile picture' });
    await expect(openCropper).toBeVisible({ timeout: 20000 });
    await openCropper.click();

    const cropper = page.getByRole('dialog');
    await expect(cropper).toBeVisible({ timeout: 15000 });
    await expect(cropper.getByText(/Drop an image, or click to choose/i)).toBeVisible({
      timeout: 10000
    });

    const card = page.locator('.weeb-modal-card');
    await expect(card).toHaveClass(/weeb-modal-card--lg/);
    const width = (await card.boundingBox())!.width;
    // The small size is 440 and the large one 720; anything in between means the
    // size never reached the card.
    expect(width, 'the cropper must open at the large modal width').toBeGreaterThan(600);

    await page.keyboard.press('Escape');
    await expect(page.getByRole('dialog')).toHaveCount(0, { timeout: 10000 });
  });
});
