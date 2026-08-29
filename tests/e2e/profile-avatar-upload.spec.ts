import { test, expect } from '@playwright/test';
import { v4 as uuidv4 } from 'uuid';
import path from 'path';
import { waitForAuthForm, waitForPageReady, deleteEmailsForRecipient, getLatestEmail, extractVerificationLink, registerNewUser } from './helpers';

// Regression coverage for a reported bug: uploading an avatar showed a brief
// spinner and then nothing -- no image, no error, avatar still unset.
//
// The upload itself was broken in the router, which dropped the file from the
// multipart request. What made it a *silent* failure was the client: every
// error path reported through debug.*, which gates on import.meta.env.DEV and
// is compiled out of production, and the button had no error state to render.
// A failure was pixel-identical to never having clicked.
//
// So this test forces the upload to fail and asserts the user is told. It does
// not depend on the router fix, and it writes nothing to the CDN -- both of
// which would make it a test of the environment rather than of this code.

const FIXTURE = path.join(__dirname, 'fixtures', 'avatar.png');

test.describe('Profile avatar upload', () => {
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

  test('a failed upload tells the user instead of failing silently', async ({ page }) => {
    await registerNewUser(page, testEmail, testPassword);

    const baseUrl = page.url().match(/^https?:\/\/[^\/]+/)![0];
    const email = await getLatestEmail(testEmail);
    const verificationLink = extractVerificationLink(email.HTML || email.Text || '', baseUrl);
    expect(verificationLink).toBeTruthy();
    await page.goto(verificationLink!, { waitUntil: 'domcontentloaded', timeout: 60000 });
    await expect(page.getByRole('heading', { name: /you're verified|this link didn't work/i })).toBeVisible({ timeout: 20000 });

    await page.goto('/auth/login', { waitUntil: 'domcontentloaded', timeout: 60000 });
    await waitForAuthForm(page);
    await page.fill('input[name="username"]', testEmail);
    await page.fill('input[name="password"]', testPassword);
    const loginButton = page.locator('form button[type="submit"]').first();
    await expect(loginButton).toBeEnabled({ timeout: 10000 });
    await loginButton.click();
    await page.waitForURL((url) => !url.pathname.includes('/auth/login'), { timeout: 60000 });

    // Fail only the upload mutation. Matching on the operation name rather than
    // the URL matters: the profile page issues several GraphQL calls against
    // this same endpoint, and failing all of them would test nothing.
    let uploadAttempted = false;
    await page.route('**/graphql', async (route) => {
      const body = route.request().postData() || '';
      if (body.includes('UploadProfileImage')) {
        uploadAttempted = true;
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ errors: [{ message: 'Simulated upload failure' }], data: null })
        });
        return;
      }
      await route.fallback();
    });

    await page.goto('/profile', { waitUntil: 'domcontentloaded', timeout: 60000 });
    await waitForPageReady(page);

    await page.getByRole('button', { name: /change profile picture/i }).click();

    // The input is visually hidden behind a styled dropzone; setInputFiles
    // drives it directly rather than opening a real file chooser.
    await page.locator('input[type="file"]').setInputFiles(FIXTURE);

    // The crop step has to finish before Upload appears -- it is only rendered
    // once a preview exists.
    const uploadButton = page.getByRole('button', { name: /^upload/i });
    await expect(uploadButton).toBeVisible({ timeout: 20000 });
    await uploadButton.click();

    // The bug: the request goes out, fails, and nothing is shown.
    await expect.poll(() => uploadAttempted, { timeout: 20000 }).toBe(true);
    await expect(page.getByRole('alert')).toBeVisible({ timeout: 20000 });
    await expect(page.getByRole('alert')).toContainText(/upload failed/i);

    // And the modal stays open, so the user can retry rather than losing the
    // image they picked.
    await expect(uploadButton).toBeVisible();
  });
});
