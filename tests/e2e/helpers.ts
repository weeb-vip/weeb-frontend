import { expect, type Page } from '@playwright/test';

// Saved shared authenticated session (written by auth.setup.ts)
export const authFile = 'playwright/.auth/user.json';
export const authAccountFile = 'playwright/.auth/account.json';

/**
 * Wait for page to be ready with explicit element checks instead of networkidle.
 * networkidle waits for ALL network requests which is unreliable with external APIs.
 */
export async function waitForPageReady(page: Page, options?: {
  selector?: string;
  timeout?: number;
}) {
  const { selector = 'body', timeout = 15000 } = options || {};

  // Wait for DOM content loaded first
  await page.waitForLoadState('domcontentloaded');

  // Then wait for the specific element to be visible
  await page.locator(selector).first().waitFor({ state: 'visible', timeout });
}

/**
 * Wait for homepage to be ready - checks for nav/header
 */
export async function waitForHomepage(page: Page) {
  await page.waitForLoadState('domcontentloaded');
  // Wait for navigation to be visible (indicates hydration complete)
  await page.locator('nav, header').first().waitFor({ state: 'visible', timeout: 15000 });
}

/**
 * Wait for season page to be ready - checks for season heading
 */
export async function waitForSeasonPage(page: Page) {
  await page.waitForLoadState('domcontentloaded');
  // Wait for the season heading to appear
  await page.getByRole('heading', { level: 1 }).waitFor({ state: 'visible', timeout: 15000 });
}

/**
 * Wait for auth page form to be ready
 */
export async function waitForAuthForm(page: Page) {
  await page.waitForLoadState('domcontentloaded');
  // Wait for form to be visible (indicates hydration complete)
  await page.locator('form').first().waitFor({ state: 'visible', timeout: 15000 });
}

/**
 * Wait for show detail page - handles both success and 404 cases
 */
export async function waitForShowPage(page: Page) {
  await page.waitForLoadState('domcontentloaded');
  // Wait for main content area
  await page.locator('main, body').first().waitFor({ state: 'visible', timeout: 15000 });
}

/**
 * Delete emails for a recipient from Mailpit (staging email server)
 */
export async function deleteEmailsForRecipient(recipientEmail: string) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 10000);

  try {
    const response = await fetch('https://mailhog.staging.weeb.vip/api/v1/messages', {
      signal: controller.signal
    });
    const data = await response.json();

    if (!data.messages || data.messages.length === 0) {
      clearTimeout(timeoutId);
      return;
    }

    const emailsToDelete = data.messages
      .filter((msg: any) => {
        const toMatch = msg.To?.some((t: any) => t.Address === recipientEmail);
        const bccMatch = msg.Bcc?.some((t: any) => t.Address === recipientEmail);
        return toMatch || bccMatch;
      })
      .map((msg: any) => msg.ID);

    if (emailsToDelete.length > 0) {
      await fetch('https://mailhog.staging.weeb.vip/api/v1/messages', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ IDs: emailsToDelete }),
        signal: controller.signal
      });
      console.log(`Cleaned up ${emailsToDelete.length} emails for ${recipientEmail}`);
    }
    clearTimeout(timeoutId);
  } catch (error) {
    clearTimeout(timeoutId);
    if (error instanceof Error && error.name === 'AbortError') {
      console.log('Email cleanup timed out, continuing...');
    } else {
      console.log('Could not delete emails:', error);
    }
  }
}

// Helper function to check Mailpit for emails
export async function getLatestEmail(recipientEmail: string, retries = 15, delay = 3000) {
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

export function extractVerificationLink(emailContent: string, baseUrl: string): string | null {
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


/**
 * Register a new account from /auth/register and wait for the success
 * message. The staging registration endpoint is intermittently slow under
 * parallel-shard load, so the submit is retried once if the confirmation
 * doesn't appear — this is the single most common source of e2e flake.
 */
export async function registerNewUser(page: Page, email: string, password: string) {
  await page.goto('/auth/register', { waitUntil: 'domcontentloaded', timeout: 60000 });
  await waitForAuthForm(page);
  await page.locator('form').waitFor({ state: 'visible', timeout: 15000 });

  await page.locator('input[type="email"], input[name="username"]').first().fill(email);
  await page.locator('input[name="password"][type="password"]').first().fill(password);
  const confirm = page.locator('input[name="confirmPassword"]');
  if ((await confirm.count()) > 0) await confirm.fill(password);

  const submitButton = page.locator('form button[type="submit"]').first();
  await submitButton.waitFor({ state: 'visible' });
  // wait out the hydration gate before the first click
  await page.waitForFunction(
    () => {
      const btn = document.querySelector('form button[type="submit"]') as HTMLButtonElement | null;
      return !!btn && !btn.disabled;
    },
    { timeout: 15000 }
  );

  const success = page.locator('text=/registration.*successful|check.*email/i');
  for (let attempt = 0; attempt < 2; attempt++) {
    await submitButton.click();
    try {
      await success.waitFor({ state: 'visible', timeout: 20000 });
      return;
    } catch {
      if (attempt === 0) {
        // eslint-disable-next-line no-console
        console.log('Registration confirmation not shown, retrying submit...');
      }
    }
  }
  await expect(success).toBeVisible({ timeout: 20000 });
}
