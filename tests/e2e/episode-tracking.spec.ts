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
  Ticking individual episodes.

  The assertion that matters is not "an episode can be marked" -- it is *which*
  ones come back marked. Progress used to be a single count on the list entry,
  which can only ever express "watched up to N", so marking episode 6 lit up
  1 through 6. Per-episode rows replaced that, and this test exists to prove the
  page renders those rows rather than quietly falling back to the count: it marks
  a middle episode and requires episode 1 to stay unmarked.

  That check also caught the regression it was written alongside. The data was
  correct and the query resolved, but the ticks never repainted, because the
  template called `isWatched(episode)` and Svelte tracks the values an expression
  references -- not what the function it calls reads from scope. Every assertion
  below passed against the old count fallback except the one about episode 1.

  One account, one flow, like the other logged-in specs: each test here is
  another registration against shared staging and another verification email.
*/

/** How many episodes in, to mark. Far enough that a count fallback is obvious. */
const TARGET_INDEX = 2;

function watchButton(page: Page, episodeNumber: number) {
  return page.getByRole('button', {
    name: new RegExp(`^Mark episode ${episodeNumber} (watched|unwatched)$`),
  });
}

/**
 * Register, verify and log in. Returns nothing; the page is left signed in.
 *
 * Verification is awaited rather than assumed: opening the link only starts the
 * request, and navigating away too early leaves the account unverified, which
 * then surfaces as a login that never redirects.
 */
async function signUpAndIn(page: Page, email: string, password: string) {
  await registerNewUser(page, email, password);

  const baseUrl = page.url().match(/^https?:\/\/[^/]+/)![0];
  const mail = await getLatestEmail(email);
  const link = extractVerificationLink(mail.HTML || mail.Text || '', baseUrl);
  expect(link).toBeTruthy();
  await page.goto(link!, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await expect(
    page.getByRole('heading', { name: /you're verified|this link didn't work/i }),
  ).toBeVisible({ timeout: 30000 });

  // Navigate to login explicitly -- the verification screen bounces there on a
  // timer, and racing that redirect fills a form that is being replaced.
  await page.goto('/auth/login', { waitUntil: 'domcontentloaded', timeout: 60000 });
  await waitForAuthForm(page);
  await page.fill('input[name="username"]', email);
  await page.fill('input[name="password"]', password);
  const submit = page.locator('form button[type="submit"]').first();
  await expect(submit).toBeEnabled({ timeout: 15000 });
  await submit.click();
  // Poll rather than waitForURL: staging's login is slow enough under load that
  // the single navigation predicate misses it, and the flow then fails on
  // something that did in fact succeed.
  await expect
    .poll(() => new URL(page.url()).pathname, { timeout: 90000, intervals: [1000] })
    .not.toContain('/auth/login');
}

/**
 * Put a show with a real episode list on the account, and return its episode
 * numbers, newest first.
 *
 * The episode ticks only exist once the show is tracked, so adding it is part of
 * finding one. Several candidates are tried because plenty of entries are films
 * or have no episodes scraped yet, and which ones the homepage shows changes
 * with the season.
 */
async function trackShowWithEpisodes(page: Page): Promise<number[]> {
  await page.goto('/', { waitUntil: 'domcontentloaded', timeout: 60000 });
  const links = page.locator('a[href^="/anime/"]');
  await links.first().waitFor({ state: 'visible', timeout: 20000 });

  const hrefs: string[] = [];
  for (const href of await links.evaluateAll((els) => els.map((e) => e.getAttribute('href')))) {
    if (href && !hrefs.includes(href)) hrefs.push(href);
    if (hrefs.length === 6) break;
  }

  for (const href of hrefs) {
    await page.goto(href, { waitUntil: 'domcontentloaded', timeout: 60000 });
    await waitForShowPage(page);

    const added = page.waitForResponse(
      (r) => r.url().includes('graphql') && (r.request().postData() || '').includes('AddAnime'),
      { timeout: 30000 },
    );
    const addButton = page.getByRole('button', { name: /add to list|\+ add/i }).first();
    if (!(await addButton.isVisible().catch(() => false))) continue;
    // Centre it first: the header is an overlay over the hero, and a button
    // sitting under it is visible but not clickable.
    await addButton.evaluate((el) => el.scrollIntoView({ block: 'center' }));
    await addButton.click();
    expect((await (await added).json()).data?.AddAnime?.id).toBeTruthy();

    // Reload so the server-loaded page comes back with userAnime set, which is
    // what makes the episode list trackable.
    await page.reload({ waitUntil: 'domcontentloaded' });
    await waitForShowPage(page);

    const numbers = await page
      .locator('li.ep-row .ep-num')
      .evaluateAll((els) => els.map((e) => Number(e.textContent?.trim())));
    if (numbers.length > TARGET_INDEX + 1) return numbers;
  }

  return [];
}

test.describe('Episode tracking (logged in)', () => {
  test.describe.configure({ mode: 'serial' });
  test.setTimeout(300000);

  let testEmail: string;
  const testPassword = 'Password1!';

  test.beforeEach(async () => {
    testEmail = `${uuidv4()}@weeb.vip`;
  });

  test.afterEach(async () => {
    await deleteEmailsForRecipient(testEmail);
  });

  test('marks one episode, not everything below it, and it survives a reload', async ({ page }) => {
    await signUpAndIn(page, testEmail, testPassword);

    const numbers = await trackShowWithEpisodes(page);
    test.skip(numbers.length === 0, 'no show on the homepage has a scraped episode list');

    const target = numbers[TARGET_INDEX];
    const lowest = Math.min(...numbers);
    expect(target).toBeGreaterThan(lowest);

    await expect(watchButton(page, target)).toHaveAttribute('aria-pressed', 'false');

    // --- mark it ---
    const marked = page.waitForResponse(
      (r) =>
        r.url().includes('graphql') && (r.request().postData() || '').includes('mutation MarkEpisodeWatched'),
      { timeout: 30000 },
    );
    await watchButton(page, target).click();
    expect((await (await marked).json()).data?.MarkEpisodeWatched?.episodeNumber).toBe(target);

    await expect(watchButton(page, target)).toHaveAttribute('aria-pressed', 'true', {
      timeout: 20000,
    });

    // The whole point. A count of one can only mean "up to episode 1", so if the
    // page is rendering the count rather than the rows, the lowest episode is
    // marked and the one actually clicked is not.
    await expect(watchButton(page, lowest)).toHaveAttribute('aria-pressed', 'false');

    // --- and it is really stored ---
    await page.reload({ waitUntil: 'domcontentloaded' });
    await waitForShowPage(page);
    await expect(watchButton(page, target)).toHaveAttribute('aria-pressed', 'true', {
      timeout: 20000,
    });
    await expect(watchButton(page, lowest)).toHaveAttribute('aria-pressed', 'false');

    // --- untick it again ---
    const unmarked = page.waitForResponse(
      (r) =>
        r.url().includes('graphql') && (r.request().postData() || '').includes('mutation UnmarkEpisodeWatched'),
      { timeout: 30000 },
    );
    await watchButton(page, target).click();
    await unmarked;
    await expect(watchButton(page, target)).toHaveAttribute('aria-pressed', 'false', {
      timeout: 20000,
    });
  });
});
