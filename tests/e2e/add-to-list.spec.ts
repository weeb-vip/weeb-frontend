import { test, expect } from '@playwright/test';
import { v4 as uuidv4 } from 'uuid';
import { waitForAuthForm, deleteEmailsForRecipient, getLatestEmail, extractVerificationLink, registerNewUser } from './helpers';

// Logged-in user can add anime to their list from a show page, including
// after the access token has expired. Regression coverage for
// "add to list doesn't work / authentication error".
//
// Registers a single account and exercises both behaviours in one flow to
// keep the load on the shared staging registration endpoint minimal.

test.describe('Add to list (logged in)', () => {
  test.describe.configure({ mode: 'serial' });
  test.setTimeout(150000);

  let testEmail: string;
  const testPassword = 'Password1!';

  test.beforeEach(async () => {
    testEmail = `${uuidv4()}@weeb.vip`;
  });

  test.afterEach(async () => {
    await deleteEmailsForRecipient(testEmail);
  });

  test('add to list works, and recovers after the access token expires', async ({ page, context }) => {
    // Register (helper retries the submit under staging flake)
    await registerNewUser(page, testEmail, testPassword);

    // Verify email
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

    // --- Happy path: add the first show to the list ---
    await page.goto('/', { waitUntil: 'domcontentloaded', timeout: 60000 });
    let shows = page.locator('a[href^="/show/"]');
    await shows.first().waitFor({ state: 'visible', timeout: 15000 });
    await shows.nth(0).click();
    await page.waitForURL(/\/show\//, { timeout: 30000 });

    const happyResponse = page.waitForResponse(
      (r) => r.url().includes('graphql') && r.request().postData()?.includes('AddAnime') === true,
      { timeout: 30000 }
    );
    let addButton = page
      .getByRole('button', { name: /add to list|add to my list|\+ add/i })
      .or(page.locator('[data-testid="add-to-list"]'))
      .first();
    await addButton.waitFor({ state: 'visible', timeout: 15000 });
    await addButton.click();
    const happyBody = await (await happyResponse).json();
    console.log('AddAnime (happy) body:', JSON.stringify(happyBody));
    expect(happyBody.data?.AddAnime?.id).toBeTruthy();
    await expect(page.getByText(/please log in|authentication error/i)).toHaveCount(0);

    const addedId = page.url().split('/show/')[1]?.split(/[/?#]/)[0];

    // Reload the show page: SSR must load userAnime (it forwards the
    // cookie, not a Bearer header) so the added status persists. This is
    // the regression for "add, refresh, and it no longer shows as added".
    await page.reload({ waitUntil: 'domcontentloaded', timeout: 60000 });
    const statusControl = page
      .getByRole('button', { name: /plan to watch|watching|completed|on hold|dropped/i })
      .first();
    await expect(statusControl).toBeVisible({ timeout: 20000 });
    // and it must NOT still offer to add it
    await expect(
      page.getByRole('button', { name: /^add to list$/i })
    ).toHaveCount(0);

    // The anime just added now shows a status dropdown instead of "Add to
    // List", so the expired-token check needs a *different* show.

    // --- Expired token: on a second (different) show, drop the access-token
    // cookies (keep refresh_token) so the mutation must refresh-and-retry ---
    await page.goto('/', { waitUntil: 'domcontentloaded', timeout: 60000 });
    shows = page.locator('a[href^="/show/"]');
    await shows.first().waitFor({ state: 'visible', timeout: 15000 });
    const hrefs: string[] = await shows.evaluateAll((els) =>
      els.map((e) => (e as HTMLAnchorElement).getAttribute('href') || '')
    );
    const otherHref = hrefs.find((h) => h.startsWith('/show/') && !h.includes(addedId));
    expect(otherHref, 'need a second distinct show to test against').toBeTruthy();
    await page.goto(otherHref!, { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.waitForURL(/\/show\//, { timeout: 30000 });

    await context.clearCookies({ name: 'access_token' });
    await context.clearCookies({ name: 'auth_token' });

    const attempts: boolean[] = [];
    let refreshFired = false;
    page.on('response', async (r) => {
      const post = r.request().postData() || '';
      if (!r.url().includes('graphql')) return;
      if (post.includes('RefreshToken')) refreshFired = true;
      if (post.includes('AddAnime')) {
        try {
          attempts.push(!!(await r.json())?.data?.AddAnime?.id);
        } catch {
          /* ignore */
        }
      }
    });

    addButton = page
      .getByRole('button', { name: /add to list|add to my list|\+ add/i })
      .or(page.locator('[data-testid="add-to-list"]'))
      .first();
    await addButton.waitFor({ state: 'visible', timeout: 15000 });
    await addButton.click();

    await expect.poll(() => attempts.some((ok) => ok), { timeout: 20000, intervals: [500] }).toBe(true);
    console.log('AddAnime (expired-token) attempts:', JSON.stringify(attempts), 'refreshFired:', refreshFired);
    expect(refreshFired).toBe(true);
    await expect(page.getByText(/please log in|authentication error/i)).toHaveCount(0);
  });
});
