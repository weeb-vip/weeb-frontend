import { test as setup, expect } from '@playwright/test';
import { v4 as uuidv4 } from 'uuid';
import {
  waitForAuthForm,
  registerNewUser,
  getLatestEmail,
  extractVerificationLink,
  deleteEmailsForRecipient,
  authFile,
  authAccountFile
} from './helpers';

// Registers, verifies, and logs in ONE account, then saves its storage
// state (cookies) so authenticated specs can reuse the session instead of
// each running its own register+verify+login. This is what actually kills
// the staging-registration flake: the concurrent-registration burst from
// every authed spec collapses to a single registration here.

setup('authenticate', async ({ page }) => {
  const email = `${uuidv4()}@weeb.vip`;
  const password = 'Password1!';

  await registerNewUser(page, email, password);

  // Verify the email
  const baseUrl = page.url().match(/^https?:\/\/[^\/]+/)![0];
  const mail = await getLatestEmail(email);
  const verificationLink = extractVerificationLink(mail.HTML || mail.Text || '', baseUrl);
  expect(verificationLink, 'verification link in email').toBeTruthy();
  await page.goto(verificationLink!, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await expect(page.getByText(/verified successfully|verification failed/i).first())
    .toBeVisible({ timeout: 15000 });

  // Log in
  await page.goto('/auth/login', { waitUntil: 'domcontentloaded', timeout: 60000 });
  await waitForAuthForm(page);
  await page.fill('input[name="username"]', email);
  await page.fill('input[name="password"]', password);
  const loginBtn = page.locator('form button[type="submit"]').first();
  await expect(loginBtn).toBeEnabled({ timeout: 10000 });
  await loginBtn.click();
  await page.waitForURL((url) => !url.pathname.includes('/auth/login'), { timeout: 60000 });

  // Persist the authenticated session + the account it belongs to
  const fs = await import('node:fs/promises');
  await fs.mkdir('playwright/.auth', { recursive: true });
  await page.context().storageState({ path: authFile });
  await fs.writeFile(authAccountFile, JSON.stringify({ email, password }), 'utf-8');

  // Clean up the verification email so it can't collide with other specs
  await deleteEmailsForRecipient(email);
});
