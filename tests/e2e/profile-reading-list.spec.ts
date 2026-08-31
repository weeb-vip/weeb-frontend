import { test, expect, type Page } from '@playwright/test';
import { v4 as uuidv4 } from 'uuid';
import {
  waitForAuthForm,
  waitForShowPage,
  deleteEmailsForRecipient,
  getLatestEmail,
  extractVerificationLink,
  registerNewUser,
} from './helpers';

/*
  A manga on the profile's reading list.

  The reading list is the anime watchlist's counterpart, reached through the
  Anime | Manga switch on /profile/anime. This proves the whole path end to end:
  a work set to Reading on its own page shows up under the manga medium, on the
  Reading tab, linking back to itself -- which only works if UserWorks resolves
  the federated `work` behind each entry. A list that rendered workIDs with no
  titles or links would pass a mutation check and fail here.

  One account and one flow, like the other logged-in specs: every test is another
  registration against shared staging and another verification email.
*/

const SEED_SLUGS = ['hellsing', 'berserk', 'detective-conan-the-movie-the-last-wizard-of-the-century'];

async function firstResolvingSlug(page: Page): Promise<string | null> {
  for (const slug of SEED_SLUGS) {
    const res = await page.request.get(`/manga/${slug}`);
    if (res.status() === 200) return slug;
  }
  return null;
}

/**
 * Open the work's status menu and pick an option. Waits for the menu rather
 * than trusting the click: the control is interactive only once hydrated, and a
 * click that lands before then does nothing, surfacing later as a missing row.
 */
async function chooseStatus(page: Page, option: string) {
  const trigger = page.locator('.wv-select-trigger').first();
  await expect(trigger).toBeVisible({ timeout: 20000 });
  const menu = page.locator('.wv-select-menu');
  await expect(async () => {
    await trigger.click();
    await expect(menu).toBeVisible({ timeout: 2000 });
  }).toPass({ timeout: 30000 });
  await menu.getByRole('option', { name: option, exact: true }).click();
  await expect(menu).toHaveCount(0, { timeout: 10000 });
}

test.describe('Profile reading list (logged in)', () => {
  test.describe.configure({ mode: 'serial' });
  test.setTimeout(240000);

  let testEmail: string;
  const testPassword = 'Password1!';

  test.beforeEach(async () => {
    testEmail = `${uuidv4()}@weeb.vip`;
  });

  test.afterEach(async () => {
    await deleteEmailsForRecipient(testEmail);
  });

  test('a manga set to Reading appears on the reading list', async ({ page }) => {
    const slug = await firstResolvingSlug(page);
    test.skip(slug === null, 'no seeded work is in the read store yet');

    await registerNewUser(page, testEmail, testPassword);

    const baseUrl = page.url().match(/^https?:\/\/[^/]+/)![0];
    const email = await getLatestEmail(testEmail);
    const verificationLink = extractVerificationLink(email.HTML || email.Text || '', baseUrl);
    expect(verificationLink).toBeTruthy();
    await page.goto(verificationLink!, { waitUntil: 'domcontentloaded', timeout: 60000 });
    await expect(
      page.getByRole('heading', { name: /you're verified|this link didn't work/i }),
    ).toBeVisible({ timeout: 30000 });

    await page.goto('/auth/login', { waitUntil: 'domcontentloaded', timeout: 60000 });
    await waitForAuthForm(page);
    await page.fill('input[name="username"]', testEmail);
    await page.fill('input[name="password"]', testPassword);
    const loginButton = page.locator('form button[type="submit"]').first();
    await expect(loginButton).toBeEnabled({ timeout: 15000 });
    await loginButton.click();
    await expect
      .poll(() => new URL(page.url()).pathname, { timeout: 90000, intervals: [1000] })
      .not.toContain('/auth/login');

    // Put the work on the Reading shelf from its own page.
    await page.goto(`/manga/${slug}`, { waitUntil: 'domcontentloaded', timeout: 60000 });
    await waitForShowPage(page);
    const added = page.waitForResponse(
      (r) => r.url().includes('graphql') && (r.request().postData() || '').includes('AddWork'),
      { timeout: 30000 },
    );
    await chooseStatus(page, 'Reading');
    expect((await (await added).json()).data?.AddWork?.status).toBe('READING');

    // The reading list, manga medium, Reading tab.
    await page.goto('/profile/anime?medium=manga&status=READING', {
      waitUntil: 'domcontentloaded',
      timeout: 60000,
    });

    // The medium switch is the whole point of the shared page.
    await expect(page.getByRole('tab', { name: 'Manga' })).toHaveAttribute('aria-selected', 'true', {
      timeout: 20000,
    });

    // The work is there and links back to itself -- proof the federated `work`
    // resolved, not just that a UserWork row exists.
    const cardLink = page.locator(`a[href="/manga/${slug}"]`).first();
    await expect(cardLink).toBeVisible({ timeout: 20000 });
  });
});
