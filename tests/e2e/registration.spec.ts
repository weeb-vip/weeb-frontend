import { test, expect, type Page, type Locator } from '@playwright/test';
import { v4 as uuidv4 } from 'uuid';
import { waitForHomepage, waitForAuthForm, waitForPageReady } from './helpers';

// Helper function to check Mailpit for emails
async function getLatestEmail(recipientEmail: string, retries = 15, delay = 3000) {
  console.log(`Looking for email for ${recipientEmail}...`);

  for (let i = 0; i < retries; i++) {
    try {
      const response = await fetch('https://mailhog.staging.weeb.vip/api/v1/messages');
      const data = await response.json();

      console.log(`Attempt ${i + 1}: Found ${data.messages?.length || 0} total emails in Mailpit`);

      if (data.messages && data.messages.length > 0) {
        const recipients = data.messages.map((msg: any) => msg.To?.[0]?.Address).filter(Boolean);
        console.log(`Recipients found: ${recipients.join(', ')}`);

        const email = data.messages.find((msg: any) => {
          const toAddresses = msg.To?.map((t: any) => t.Address) || [];
          return toAddresses.some((addr: string) =>
            addr === recipientEmail || addr === `<${recipientEmail}>`
          );
        });

        if (email) {
          console.log(`Found email for ${recipientEmail}! Fetching full message...`);
          // Fetch full message to get body content
          const fullMsgResponse = await fetch(`https://mailhog.staging.weeb.vip/api/v1/message/${email.ID}`);
          const fullMsg = await fullMsgResponse.json();
          return fullMsg;
        }
      }
    } catch (error) {
      console.log(`Attempt ${i + 1} failed:`, error instanceof Error ? error.message : String(error));
    }

    await new Promise(resolve => setTimeout(resolve, delay));
  }

  throw new Error(`No email found for ${recipientEmail} after ${retries} attempts`);
}

function extractVerificationLink(emailContent: string, baseUrl: string): string | null {
  let decodedContent = emailContent
    .replace(/=\r?\n/g, '')
    .replace(/=3D/g, '=')
    .replace(/=20/g, ' ')
    .replace(/=2F/g, '/')
    .replace(/=3A/g, ':')
    .replace(/=40/g, '@');

  const linkPattern = /<a[^>]+href\s*=\s*(?:3D)?\\?["']([^"']*verification\?email=[^"']*)/gi;
  const match = linkPattern.exec(decodedContent);

  if (match && match[1]) {
    let link = match[1];
    link = link.replace(/&amp;/g, '&');
    link = link.replace(/&#x3D;/g, '=');
    link = link.replace(/\\/g, '');

    if (!link.startsWith('http')) {
      link = `${baseUrl}${link.startsWith('/') ? '' : '/'}${link}`;
    } else {
      const url = new URL(link);
      const testUrl = new URL(baseUrl);
      url.protocol = testUrl.protocol;
      url.host = testUrl.host;
      url.port = testUrl.port;
      link = url.toString();
    }

    console.log(`Found verification link in email: ${link}`);
    return link;
  }

  const directUrlPattern = /https?:\/\/[^\/\s]+\/auth\/verification\?email=[^&\s]+&token=[^&\s"]+/gi;
  const directMatch = directUrlPattern.exec(decodedContent);
  if (directMatch) {
    let link = directMatch[0];
    link = link.replace(/&amp;/g, '&');

    const url = new URL(link);
    const testUrl = new URL(baseUrl);
    url.protocol = testUrl.protocol;
    url.host = testUrl.host;
    url.port = testUrl.port;
    link = url.toString();

    console.log(`Found verification link (direct pattern): ${link}`);
    return link;
  }

  return null;
}

async function deleteEmailsForRecipient(recipientEmail: string) {
  let deletedCount = 0;
  try {
    while (true) {
      const response = await fetch('https://mailhog.staging.weeb.vip/api/v1/messages');
      const data = await response.json();

      if (!data.messages || data.messages.length === 0) {
        break;
      }

      const email = data.messages.find((msg: any) =>
        msg.To?.some((t: any) => t.Address === recipientEmail)
      );

      if (!email) break;

      await fetch(`https://mailhog.staging.weeb.vip/api/v1/messages/${email.ID}`, { method: 'DELETE' });
      deletedCount++;
    }

    if (deletedCount > 0) {
      console.log(`Cleaned up ${deletedCount} emails for ${recipientEmail}`);
    }
  } catch (error) {
    console.log('Could not delete emails:', error);
  }
}

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

async function fillAndSubmitRegister(dialog: Locator, email: string, password: string) {
  await dialog.locator('input[name="username"]').fill(email);
  await dialog.locator('input[name="password"]').fill(password);
  await dialog.locator('input[name="confirmPassword"]').fill(password);
  // Use evaluate for more reliable click
  await dialog.locator('form button[type="submit"]').evaluate((btn) => (btn as HTMLButtonElement).click());
}

test.describe('User Registration Flow', () => {
  // Run tests serially within this file — they all hit shared staging Mailhog
  // and can race when running in parallel.
  test.describe.configure({ mode: 'serial' });

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
    await page.goto('/');
    await waitForHomepage(page);

    const dialog = await openRegisterModal(page);
    await fillAndSubmitRegister(dialog, testEmail, testPassword);

    // Success message is rendered inside the modal
    await expect(dialog.locator('text=/registration.*successful/i')).toBeVisible({ timeout: 15000 });
    console.log('Registration successful, checking for verification email...');

    const email = await getLatestEmail(testEmail);
    expect(email).toBeTruthy();
    console.log('Verification email received');

    const emailBody = email.HTML || email.Text || '';
    const baseUrl = page.url().match(/^https?:\/\/[^\/]+/)?.[0] || 'http://localhost:4321';
    const verificationLink = extractVerificationLink(emailBody, baseUrl);
    expect(verificationLink).toBeTruthy();
    console.log(`Verification link found: ${verificationLink}`);

    await page.goto(verificationLink!);
    await waitForPageReady(page);

    // Wait for the verification page to render and resolve
    await expect(page.getByRole('heading', { name: /Email Verification/i })).toBeVisible({ timeout: 15000 });
    await expect(page.getByText(/verified successfully|verification failed/i).first())
      .toBeVisible({ timeout: 15000 });
    console.log('Email verification page loaded');

    // Try to login with verified account on /auth/login
    await page.goto('/auth/login');
    await waitForAuthForm(page);

    await page.fill('input[name="username"]', testEmail);
    await page.fill('input[name="password"]', testPassword);
    await page.locator('form button[type="submit"]').first().click();

    // On success, Login.svelte navigates to '/'. Wait for that (staging can be slow under load).
    await page.waitForURL((url) => !url.pathname.includes('/auth/login'), { timeout: 30000 });
    console.log('Login successful - registration flow complete!');
  });

  test('resend verification email', async ({ page }) => {
    await page.goto('/');
    await waitForHomepage(page);

    const dialog = await openRegisterModal(page);
    await fillAndSubmitRegister(dialog, testEmail, testPassword);

    await expect(dialog.locator('text=/registration.*successful/i')).toBeVisible({ timeout: 15000 });

    // Navigate to resend verification page
    await page.goto('/auth/resend-verification');
    await waitForAuthForm(page);

    await page.fill('input[name="username"], input[type="email"]', testEmail);
    await page.getByRole('button', { name: /send verification email/i }).click();

    // The resend page shows: "Verification email sent! Please check your inbox and spam folder."
    await expect(page.getByText(/verification email sent|check your inbox/i).first())
      .toBeVisible({ timeout: 10000 });
    console.log('Resend verification email successful');

    const email = await getLatestEmail(testEmail);
    expect(email).toBeTruthy();
    console.log('Resent verification email received');
  });

  test('prevent login before email verification', async ({ page }) => {
    await page.goto('/');
    await waitForHomepage(page);

    const dialog = await openRegisterModal(page);
    await fillAndSubmitRegister(dialog, testEmail, testPassword);

    await expect(dialog.locator('text=/registration.*successful/i')).toBeVisible({ timeout: 15000 });

    // Try to login without verification
    await page.goto('/auth/login');
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
