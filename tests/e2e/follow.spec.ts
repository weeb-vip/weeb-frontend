import { test, expect, type Browser, type BrowserContext, type Page } from '@playwright/test';
import { v4 as uuidv4 } from 'uuid';
import {
  waitForAuthForm,
  waitForPageReady,
  deleteEmailsForRecipient,
  getLatestEmail,
  extractVerificationLink,
  registerNewUser
} from './helpers';

/**
 * The social layer end to end, against staging: two fresh accounts follow
 * each other through the real gateway, user-service, notifications-service
 * and its consumers.
 *
 *   1. A follows B (open account): button flips, B's bell counts one, the
 *      followers page lists A.
 *   2. B requires approval: A's follow becomes a request, B accepts it from
 *      the dashboard.
 *   3. B makes their lists public and adds an anime: it appears in A's feed.
 *
 * Two registrations cost two mail waits, so the budget is long. One spec
 * rather than three because every step needs the pair of accounts, and each
 * account is a registration against shared staging.
 */

const PASSWORD = 'Password1!';

interface Account {
  email: string;
  username: string;
  context: BrowserContext;
  page: Page;
}

async function signUp(browser: Browser, label: string): Promise<Account> {
  const context = await browser.newContext();
  const page = await context.newPage();
  const email = `${uuidv4()}@weeb.vip`;
  const username = `e2e${label}${Date.now().toString(36)}`.slice(0, 24);

  await registerNewUser(page, email, PASSWORD);

  const baseUrl = page.url().match(/^https?:\/\/[^\/]+/)![0];
  const mail = await getLatestEmail(email);
  const link = extractVerificationLink(mail.HTML || mail.Text || '', baseUrl);
  expect(link).toBeTruthy();
  await page.goto(link!, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await expect(page.getByRole('heading', { name: /you're verified|this link didn't work/i })).toBeVisible({ timeout: 20000 });

  await page.goto('/auth/login', { waitUntil: 'domcontentloaded', timeout: 60000 });
  await waitForAuthForm(page);
  await page.fill('input[name="username"]', email);
  await page.fill('input[name="password"]', PASSWORD);
  const loginButton = page.locator('form button[type="submit"]').first();
  await expect(loginButton).toBeEnabled({ timeout: 10000 });
  await loginButton.click();
  await page.waitForURL((url) => !url.pathname.includes('/auth/login'), { timeout: 60000 });

  // A public page needs a username; a fresh account has none until it picks one.
  await saveSettings(page, async () => {
    const input = page.locator('#username');
    await expect(input).toBeVisible({ timeout: 20000 });
    await input.fill(username);
  });

  return { email, username, context, page };
}

/** Opens settings, applies the edits, saves, and waits for the confirmation. */
async function saveSettings(page: Page, edit: () => Promise<void>) {
  await page.goto('/profile/settings', { waitUntil: 'domcontentloaded', timeout: 60000 });
  await waitForPageReady(page);
  await expect(page.getByRole('heading', { name: 'Profile Settings', level: 1 })).toBeVisible({ timeout: 20000 });
  await edit();
  const saved = page.waitForResponse(
    (r) => r.url().includes('graphql') && r.request().postData()?.includes('UpdateUserDetails') === true,
    { timeout: 30000 }
  );
  await page.getByRole('button', { name: 'Save Changes' }).click();
  const body = await (await saved).json();
  expect(body.errors, JSON.stringify(body.errors)).toBeFalsy();
  await expect(page.getByText('Profile updated successfully!')).toBeVisible({ timeout: 10000 });
}

async function visitUser(page: Page, username: string) {
  await page.goto(`/u/${username}`, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await waitForPageReady(page);
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible({ timeout: 20000 });
}

test.describe('Follows, notifications and the feed', () => {
  test.describe.configure({ mode: 'serial' });
  test.setTimeout(1200000);

  const accounts: Account[] = [];

  test.afterAll(async () => {
    for (const a of accounts) {
      await deleteEmailsForRecipient(a.email).catch(() => {});
      await a.context.close().catch(() => {});
    }
  });

  test('two people can follow each other, get told, and see what the other watches', async ({ browser }) => {
    const alice = await signUp(browser, 'a');
    accounts.push(alice);
    const bob = await signUp(browser, 'b');
    accounts.push(bob);

    // ── an empty feed explains itself ────────────────────────────────────
    await alice.page.goto('/feed', { waitUntil: 'domcontentloaded', timeout: 60000 });
    await waitForPageReady(alice.page);
    await expect(alice.page.getByRole('heading', { name: 'Your feed is quiet' })).toBeVisible({ timeout: 20000 });

    // ── open follow ──────────────────────────────────────────────────────
    await visitUser(alice.page, bob.username);
    const followButton = alice.page.getByRole('button', { name: `Follow ${bob.username}` });
    await expect(followButton).toBeVisible({ timeout: 20000 });
    await followButton.click();
    await expect(alice.page.getByRole('button', { name: `Unfollow ${bob.username}` })).toBeVisible({ timeout: 20000 });
    await expect(alice.page.getByRole('link', { name: /1 follower$/ })).toBeVisible();

    // Reloading keeps the state: it came back from the server, not the click.
    await visitUser(alice.page, bob.username);
    await expect(alice.page.getByRole('button', { name: `Unfollow ${bob.username}` })).toBeVisible({ timeout: 20000 });

    // Your own page has no follow button.
    await visitUser(alice.page, alice.username);
    await expect(alice.page.getByRole('button', { name: /^(Follow|Unfollow) / })).toHaveCount(0);

    // ── the followers page lists her ─────────────────────────────────────
    await bob.page.goto(`/u/${bob.username}/followers`, { waitUntil: 'domcontentloaded', timeout: 60000 });
    await waitForPageReady(bob.page);
    await expect(bob.page.getByRole('link', { name: new RegExp(alice.username) })).toBeVisible({ timeout: 20000 });

    // ── bob is told, through the bell ────────────────────────────────────
    // The notification is written by a consumer off a NATS subject, so it
    // may land a moment after the follow; reload until the bell counts it.
    await expect
      .poll(
        async () => {
          await bob.page.goto('/', { waitUntil: 'domcontentloaded', timeout: 60000 });
          return bob.page.getByRole('button', { name: 'Notifications, 1 unread' }).count();
        },
        { timeout: 120000, intervals: [3000] }
      )
      .toBe(1);
    await bob.page.getByRole('button', { name: 'Notifications, 1 unread' }).click();
    await expect(bob.page.getByRole('link', { name: new RegExp(`${alice.username} started following you`) })).toBeVisible({ timeout: 20000 });
    await bob.page.getByRole('button', { name: 'Mark all read' }).click();
    await expect(bob.page.getByRole('button', { name: 'Notifications', exact: true })).toBeVisible({ timeout: 20000 });

    // ── approval required: a follow becomes a request ────────────────────
    await saveSettings(bob.page, async () => {
      await bob.page.getByRole('switch', { name: 'Require approval before someone can follow me' }).click();
    });

    await visitUser(alice.page, bob.username);
    await alice.page.getByRole('button', { name: `Unfollow ${bob.username}` }).click();
    await expect(alice.page.getByRole('button', { name: `Follow ${bob.username}` })).toBeVisible({ timeout: 20000 });
    await alice.page.getByRole('button', { name: `Follow ${bob.username}` }).click();
    await expect(alice.page.getByRole('button', { name: `Withdraw follow request to ${bob.username}` })).toBeVisible({ timeout: 20000 });

    await bob.page.goto('/profile', { waitUntil: 'domcontentloaded', timeout: 60000 });
    await waitForPageReady(bob.page);
    await expect(bob.page.getByRole('heading', { name: 'Follow requests' })).toBeVisible({ timeout: 30000 });
    await bob.page.getByRole('button', { name: `Accept ${alice.username}` }).click();
    await expect(bob.page.getByRole('heading', { name: 'Follow requests' })).toHaveCount(0, { timeout: 20000 });

    await visitUser(alice.page, bob.username);
    await expect(alice.page.getByRole('button', { name: `Unfollow ${bob.username}` })).toBeVisible({ timeout: 20000 });

    // ── bob's list activity reaches alice's feed ─────────────────────────
    await saveSettings(bob.page, async () => {
      await bob.page.getByRole('switch', { name: 'Show my lists on my public page' }).click();
    });

    await bob.page.goto('/', { waitUntil: 'domcontentloaded', timeout: 60000 });
    const shows = bob.page.locator('a[href^="/anime/"]');
    await shows.first().waitFor({ state: 'visible', timeout: 15000 });
    await shows.first().click();
    await bob.page.waitForURL(/\/anime\//, { timeout: 30000 });
    const addResponse = bob.page.waitForResponse(
      (r) => r.url().includes('graphql') && r.request().postData()?.includes('AddAnime') === true,
      { timeout: 30000 }
    );
    const addButton = bob.page
      .getByRole('button', { name: /add to list|add to my list|\+ add/i })
      .or(bob.page.locator('[data-testid="add-to-list"]'))
      .first();
    await addButton.waitFor({ state: 'visible', timeout: 15000 });
    await addButton.click();
    const addBody = await (await addResponse).json();
    expect(addBody.data?.AddAnime?.id).toBeTruthy();
    const addedTitle = (await bob.page.getByRole('heading', { level: 1 }).first().textContent())?.trim() ?? '';
    expect(addedTitle).toBeTruthy();

    // Outbox relay -> NATS -> consumer -> fan-out: a few seconds, polled.
    await expect
      .poll(
        async () => {
          await alice.page.goto('/feed', { waitUntil: 'domcontentloaded', timeout: 60000 });
          return alice.page.getByRole('link', { name: new RegExp(bob.username) }).count();
        },
        { timeout: 180000, intervals: [5000] }
      )
      .toBeGreaterThan(0);
    await expect(alice.page.getByText(/plans to watch|started watching|has watched/).first()).toBeVisible({ timeout: 20000 });
  });
});
