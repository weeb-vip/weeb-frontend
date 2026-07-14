import { test, expect } from '@playwright/test';
import { v4 as uuidv4 } from 'uuid';
import { waitForAuthForm, deleteEmailsForRecipient, getLatestEmail, extractVerificationLink } from './helpers';

// Logged-in user can add an anime to their list from a show page.
// Regression coverage for "add to list doesn't work / authentication error".

test.describe('Add to list (logged in)', () => {
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

  test('add anime to list from a show page', async ({ page }) => {
    // Register
    await page.goto('/auth/register', { waitUntil: 'domcontentloaded', timeout: 60000 });
    await waitForAuthForm(page);
    await page.locator('form').waitFor({ state: 'visible', timeout: 15000 });
    await page.locator('input[type="email"], input[name="username"]').first().fill(testEmail);
    await page.locator('input[name="password"][type="password"]').first().fill(testPassword);
    const confirm = page.locator('input[name="confirmPassword"]');
    if (await confirm.count() > 0) await confirm.fill(testPassword);
    const regBtn = page.locator('form button[type="submit"]').first();
    await expect(regBtn).toBeEnabled({ timeout: 10000 });
    await regBtn.click();
    await expect(page.locator('text=/registration.*successful|check.*email/i')).toBeVisible({ timeout: 15000 });

    // Verify
    const baseUrl = page.url().match(/^https?:\/\/[^\/]+/)![0];
    const email = await getLatestEmail(testEmail);
    const verificationLink = extractVerificationLink(email.HTML || email.Text || '', baseUrl);
    expect(verificationLink).toBeTruthy();
    await page.goto(verificationLink!, { waitUntil: 'domcontentloaded', timeout: 60000 });
    await expect(page.getByText(/verified successfully|verification failed/i).first()).toBeVisible({ timeout: 15000 });

    // Login
    await page.goto('/auth/login', { waitUntil: 'domcontentloaded', timeout: 60000 });
    await waitForAuthForm(page);
    await page.fill('input[name="username"]', testEmail);
    await page.fill('input[name="password"]', testPassword);
    const loginBtn = page.locator('form button[type="submit"]').first();
    await expect(loginBtn).toBeEnabled({ timeout: 10000 });
    await loginBtn.click();
    await page.waitForURL((url) => !url.pathname.includes('/auth/login'), { timeout: 60000 });

    // Open a show page from the homepage
    await page.goto('/', { waitUntil: 'domcontentloaded', timeout: 60000 });
    const firstShow = page.locator('a[href^="/show/"]').first();
    await firstShow.waitFor({ state: 'visible', timeout: 15000 });
    await firstShow.click();
    await page.waitForURL(/\/show\//, { timeout: 30000 });

    // Capture the AddAnime mutation request/response for diagnosis
    const addAnimeResponse = page.waitForResponse(
      (r) => r.url().includes('graphql') && r.request().postData()?.includes('AddAnime') === true,
      { timeout: 30000 }
    );

    // Click the add-to-list control (the default "Add to list" action)
    const addButton = page
      .getByRole('button', { name: /add to list|add to my list|\+ add/i })
      .or(page.locator('[data-testid="add-to-list"]'))
      .first();
    await addButton.waitFor({ state: 'visible', timeout: 15000 });
    await addButton.click();

    const response = await addAnimeResponse;
    const body = await response.json();
    console.log('AddAnime status:', response.status(), 'body:', JSON.stringify(body));

    // Must not be an auth error, and must return the created record
    const errorText = JSON.stringify(body.errors || '');
    expect(errorText.toLowerCase()).not.toMatch(/access denied|unauthorized|authentication|forbidden|jwt/);
    expect(body.data?.AddAnime?.id).toBeTruthy();

    // UI should reflect the added state (no auth error toast)
    await expect(page.getByText(/please log in|authentication error/i)).toHaveCount(0);
  });
  test('add to list recovers when the access token has expired', async ({ page, context }) => {
    // Register + verify + login
    await page.goto('/auth/register', { waitUntil: 'domcontentloaded', timeout: 60000 });
    await waitForAuthForm(page);
    await page.locator('form').waitFor({ state: 'visible', timeout: 15000 });
    await page.locator('input[type="email"], input[name="username"]').first().fill(testEmail);
    await page.locator('input[name="password"][type="password"]').first().fill(testPassword);
    const confirm = page.locator('input[name="confirmPassword"]');
    if (await confirm.count() > 0) await confirm.fill(testPassword);
    const regBtn = page.locator('form button[type="submit"]').first();
    await expect(regBtn).toBeEnabled({ timeout: 10000 });
    await regBtn.click();
    await expect(page.locator('text=/registration.*successful|check.*email/i')).toBeVisible({ timeout: 15000 });

    const baseUrl = page.url().match(/^https?:\/\/[^\/]+/)![0];
    const email = await getLatestEmail(testEmail);
    const verificationLink = extractVerificationLink(email.HTML || email.Text || '', baseUrl);
    await page.goto(verificationLink!, { waitUntil: 'domcontentloaded', timeout: 60000 });
    await expect(page.getByText(/verified successfully|verification failed/i).first()).toBeVisible({ timeout: 15000 });

    await page.goto('/auth/login', { waitUntil: 'domcontentloaded', timeout: 60000 });
    await waitForAuthForm(page);
    await page.fill('input[name="username"]', testEmail);
    await page.fill('input[name="password"]', testPassword);
    const loginBtn = page.locator('form button[type="submit"]').first();
    await expect(loginBtn).toBeEnabled({ timeout: 10000 });
    await loginBtn.click();
    await page.waitForURL((url) => !url.pathname.includes('/auth/login'), { timeout: 60000 });

    await page.goto('/', { waitUntil: 'domcontentloaded', timeout: 60000 });
    const firstShow = page.locator('a[href^="/show/"]').first();
    await firstShow.waitFor({ state: 'visible', timeout: 15000 });
    await firstShow.click();
    await page.waitForURL(/\/show\//, { timeout: 30000 });

    // Now that we're on the show page (client-side), drop the access-token
    // cookies but keep refresh_token. There is no further SSR navigation
    // before the click, so the mutation itself must refresh-and-retry.
    await context.clearCookies({ name: 'access_token' });
    await context.clearCookies({ name: 'auth_token' });

    // Collect every AddAnime attempt and whether a RefreshToken fired
    const addAttempts: Array<{ ok: boolean; body: any }> = [];
    let refreshFired = false;
    page.on('response', async (r) => {
      const post = r.request().postData() || '';
      if (!r.url().includes('graphql')) return;
      if (post.includes('RefreshToken')) refreshFired = true;
      if (post.includes('AddAnime')) {
        try {
          const body = await r.json();
          addAttempts.push({ ok: !!body?.data?.AddAnime?.id, body });
        } catch {
          /* ignore */
        }
      }
    });

    const addButton = page
      .getByRole('button', { name: /add to list|add to my list|\+ add/i })
      .or(page.locator('[data-testid="add-to-list"]'))
      .first();
    await addButton.waitFor({ state: 'visible', timeout: 15000 });
    await addButton.click();

    // Give the refresh-and-retry time to complete
    await expect
      .poll(() => addAttempts.some((a) => a.ok), { timeout: 20000, intervals: [500] })
      .toBe(true);

    console.log('AddAnime attempts:', JSON.stringify(addAttempts.map((a) => a.ok)), 'refreshFired:', refreshFired);
    expect(refreshFired).toBe(true); // the expired token must have been refreshed
    await expect(page.getByText(/please log in|authentication error/i)).toHaveCount(0);
  });
});
