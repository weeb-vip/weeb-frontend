import { test, expect } from '@playwright/test';
import { v4 as uuidv4 } from 'uuid';
import { waitForAuthForm, waitForPageReady, deleteEmailsForRecipient, getLatestEmail, extractVerificationLink, registerNewUser } from './helpers';

// Regression coverage for a reported bug: Settings refused to save until a
// first and last name were filled in, but registration never asks for either,
// so they are blank on every new account. Changing only the username -- the one
// field the account actually has -- was blocked by a validation error about two
// fields the product had never requested.
//
// A freshly registered user is exactly that state, so the test registers one
// rather than reusing a fixture account.

test.describe('Profile settings', () => {
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

  test('a new account can change its username without setting a name', async ({ page }) => {
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

    await page.goto('/profile/settings', { waitUntil: 'domcontentloaded', timeout: 60000 });
    await waitForPageReady(page);

    // The precondition the bug depended on. If registration ever starts
    // collecting these, this assertion fails and says so rather than the test
    // quietly no longer covering anything.
    await expect(page.locator('#firstname')).toHaveValue('');
    await expect(page.locator('#lastname')).toHaveValue('');

    const newUsername = `renamed-${uuidv4().slice(0, 8)}`;
    await page.fill('#username', newUsername);
    // By accessible name, not button[type=submit]: the Button component renders
    // a bare <button> with no type attribute. It still submits the form it sits
    // in, but an attribute selector would never match it.
    await page.getByRole('button', { name: 'Save Changes' }).click();

    // The reported failure was this exact message, with nothing saved.
    await expect(
      page.getByText(/first name, last name, and username are required/i)
    ).toHaveCount(0);

    // And the change actually lands: the form still holds it after a reload,
    // which a client-side-only update would not survive.
    await page.reload({ waitUntil: 'domcontentloaded', timeout: 60000 });
    await waitForPageReady(page);
    await expect(page.locator('#username')).toHaveValue(newUsername, { timeout: 20000 });
  });
});
