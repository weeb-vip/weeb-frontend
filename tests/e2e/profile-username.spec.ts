import { test, expect } from '@playwright/test';
import { v4 as uuidv4 } from 'uuid';
import {
  waitForAuthForm,
  waitForPageReady,
  deleteEmailsForRecipient,
  getLatestEmail,
  extractVerificationLink,
  registerNewUser
} from './helpers';

// The settings form must reflect a username error the right way: a collision is
// about the username field and belongs on it, while any other failure belongs
// in the page banner. The UpdateUserDetails response is stubbed so both shapes
// are exercised deterministically -- the real uniqueness enforcement lives in
// the user-service and is covered there.
test.describe('Profile settings — username errors', () => {
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

  test('a taken username lands on the field; any other error lands in the banner', async ({ page }) => {
    // Register -> verify -> login (same path as profile.spec).
    await registerNewUser(page, testEmail, testPassword);

    const baseUrl = page.url().match(/^https?:\/\/[^\/]+/)![0];
    const email = await getLatestEmail(testEmail);
    const link = extractVerificationLink(email.HTML || email.Text || '', baseUrl);
    expect(link).toBeTruthy();
    await page.goto(link!, { waitUntil: 'domcontentloaded', timeout: 60000 });
    await expect(
      page.getByRole('heading', { name: /you're verified|this link didn't work/i })
    ).toBeVisible({ timeout: 20000 });

    await page.goto('/auth/login', { waitUntil: 'domcontentloaded', timeout: 60000 });
    await waitForAuthForm(page);
    await page.fill('input[name="username"]', testEmail);
    await page.fill('input[name="password"]', testPassword);
    const loginButton = page.locator('form button[type="submit"]').first();
    await expect(loginButton).toBeEnabled({ timeout: 10000 });
    await loginButton.click();
    await page.waitForURL((url) => !url.pathname.includes('/auth/login'), { timeout: 60000 });

    // Settings, with the username field populated from the real user query.
    await page.goto('/profile/settings', { waitUntil: 'domcontentloaded', timeout: 60000 });
    await waitForPageReady(page);
    const usernameInput = page.locator('#username');
    await expect(usernameInput).toBeVisible({ timeout: 20000 });

    // Stub only the update mutation; everything else (including the user query
    // this page already loaded) passes through untouched.
    let mode: 'taken' | 'generic' = 'taken';
    await page.route('**/graphql', async (route) => {
      const post = route.request().postData() || '';
      if (!post.includes('UpdateUserDetails')) return route.continue();
      const body =
        mode === 'taken'
          ? {
              data: null,
              errors: [
                {
                  message: 'That username is already taken',
                  extensions: {
                    code: 'USERNAME_TAKEN',
                    message: 'That username is already taken',
                    error: 'That username is already taken'
                  }
                }
              ]
            }
          : {
              data: null,
              errors: [
                {
                  message: 'Something went wrong',
                  extensions: { code: 'INTERNAL_ERROR', message: 'Something went wrong', error: 'db down' }
                }
              ]
            };
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(body) });
    });

    // --- USERNAME_TAKEN -> inline on the field, not the banner ---
    await usernameInput.fill('taken-' + uuidv4().slice(0, 8));
    await page.getByRole('button', { name: 'Save Changes' }).click();

    const fieldError = page.locator('#username-error');
    await expect(fieldError).toBeVisible({ timeout: 15000 });
    await expect(fieldError).toContainText(/already taken/i);
    await expect(page.locator('#username.has-error')).toBeVisible();

    // Editing the username clears the inline error.
    await usernameInput.fill('fresh-' + uuidv4().slice(0, 8));
    await expect(fieldError).toHaveCount(0);

    // --- Any other error -> page banner, and NOT on the field ---
    mode = 'generic';
    await page.getByRole('button', { name: 'Save Changes' }).click();
    await expect(page.getByText('Something went wrong')).toBeVisible({ timeout: 15000 });
    await expect(page.locator('#username-error')).toHaveCount(0);
  });
});
