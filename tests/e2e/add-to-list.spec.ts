import { test, expect } from '@playwright/test';
import { authFile } from './helpers';

// Uses the shared authenticated session from auth.setup.ts — no per-test
// registration. Regression coverage for "add to list doesn't work /
// authentication error", including recovery after the access token expires.
test.use({ storageState: authFile });

test.describe('Add to list (logged in)', () => {
  test.setTimeout(120000);

  test('add to list works, and recovers after the access token expires', async ({ page, context }) => {
    // --- Happy path: add the first show to the list ---
    await page.goto('/', { waitUntil: 'domcontentloaded', timeout: 60000 });
    let shows = page.locator('a[href^="/show/"]');
    await shows.first().waitFor({ state: 'visible', timeout: 15000 });
    await shows.nth(0).click();
    await page.waitForURL(/\/show\//, { timeout: 30000 });

    // The anime may already be on the shared account's list from a previous
    // run; only assert the add flow when an Add control is actually shown.
    const addButtonSel = () =>
      page
        .getByRole('button', { name: /add to list|add to my list|\+ add/i })
        .or(page.locator('[data-testid="add-to-list"]'))
        .first();

    let addButton = addButtonSel();
    if (await addButton.isVisible().catch(() => false)) {
      const happyResponse = page.waitForResponse(
        (r) => r.url().includes('graphql') && r.request().postData()?.includes('AddAnime') === true,
        { timeout: 30000 }
      );
      await addButton.click();
      const happyBody = await (await happyResponse).json();
      console.log('AddAnime (happy) body:', JSON.stringify(happyBody));
      expect(happyBody.data?.AddAnime?.id).toBeTruthy();
      await expect(page.getByText(/please log in|authentication error/i)).toHaveCount(0);
    }
    const addedId = page.url().split('/show/')[1]?.split(/[/?#]/)[0];

    // --- Expired token: on a different show that is NOT yet on the list,
    // drop the access-token cookies (keep refresh_token) so the mutation
    // itself must refresh-and-retry ---
    await page.goto('/', { waitUntil: 'domcontentloaded', timeout: 60000 });
    shows = page.locator('a[href^="/show/"]');
    await shows.first().waitFor({ state: 'visible', timeout: 15000 });
    const hrefs: string[] = await shows.evaluateAll((els) =>
      els.map((e) => (e as HTMLAnchorElement).getAttribute('href') || '')
    );

    // Try candidate shows until we land on one showing an Add control
    const candidates = [...new Set(hrefs.filter((h) => h.startsWith('/show/') && !h.includes(addedId)))];
    let ready = false;
    for (const href of candidates) {
      await page.goto(href, { waitUntil: 'domcontentloaded', timeout: 60000 });
      if (await addButtonSel().isVisible({ timeout: 8000 }).catch(() => false)) {
        ready = true;
        break;
      }
    }
    expect(ready, 'a show with an Add control to test the expired-token path').toBe(true);

    // Expire the access token, then add
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

    await addButtonSel().click();
    await expect.poll(() => attempts.some((ok) => ok), { timeout: 20000, intervals: [500] }).toBe(true);
    console.log('AddAnime (expired-token) attempts:', JSON.stringify(attempts), 'refreshFired:', refreshFired);
    expect(refreshFired).toBe(true);
    await expect(page.getByText(/please log in|authentication error/i)).toHaveCount(0);
  });
});
