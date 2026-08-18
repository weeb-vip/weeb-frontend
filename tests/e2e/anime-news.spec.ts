import { test, expect } from '@playwright/test';
import { waitForShowPage } from './helpers';

/**
 * The News section is fed by fields added to getAnimeDetailsByID / getAnimeNewsByID.
 * As with the homepage sections (see home.spec.ts and PR #70), a query document that
 * stops resolving does NOT error — the section just silently disappears. These tests
 * exist to make that failure loud, because "no news yet" and "the query broke" look
 * identical to a user.
 *
 * Anime with news in staging. Hardcoded deliberately: the point is to assert against
 * real published data, the same way the homepage specs do.
 */
const ANIME_WITH_NEWS = 'a8f45313-b080-4f5a-8d53-5d04e7d2a315';
// Anime pages live at /anime/<slug>, but the route accepts the id too and
// redirects to the slug where one exists. Navigating by id keeps these tests
// working in every environment: staging has the column but no backfill, so its
// slugs are null, and hardcoding a production slug would 404 there.
const ANIME_PATH = `/anime/${ANIME_WITH_NEWS}`;
// Matches either form, since which one we land on depends on the environment.
const ANIME_URL = /\/anime\/[^/]+$/;
const ANIME_NEWS_URL = /\/anime\/[^/]+\/news$/;

/**
 * Open the news page and wait until it has actually rendered. Without this, a
 * `.count()` immediately after goto runs against an empty DOM — which reads as
 * "0 chips" and silently SKIPS the filter test rather than failing it. A test that
 * skips itself when the page is slow is worse than no test.
 */
async function gotoNewsPage(page: import('@playwright/test').Page) {
  await page.goto(`${ANIME_PATH}/news`);
  await page.waitForLoadState('domcontentloaded');
  await page.locator('.news-page').waitFor({ state: 'visible', timeout: 15000 });
  await page.locator('.news-rail article').first().waitFor({ state: 'visible', timeout: 15000 });
}

test.describe('legacy show URLs', () => {
  /**
   * ~32,000 /show/<id> URLs are in Google's index and spread across external
   * links. They must keep resolving, and specifically via a 301 -- a 302 would
   * ask Google to keep the old URL indexed instead of transferring its ranking
   * to the slug, which is the entire point of the migration.
   */
  test('/show/<id> permanently redirects to /anime/<slug>', async ({ page }) => {
    const response = await page.goto(`/show/${ANIME_WITH_NEWS}`);

    await expect(page).toHaveURL(ANIME_URL);

    // The redirect itself, not just where the browser ended up.
    const redirect = response?.request().redirectedFrom();
    expect(redirect, 'expected a server redirect, not a client-side navigation').toBeTruthy();
    expect((await redirect!.response())?.status()).toBe(301);
  });

  test('/show/<id>/news permanently redirects too', async ({ page }) => {
    const response = await page.goto(`/show/${ANIME_WITH_NEWS}/news`);

    await expect(page).toHaveURL(ANIME_NEWS_URL);

    const redirect = response?.request().redirectedFrom();
    expect(redirect).toBeTruthy();
    expect((await redirect!.response())?.status()).toBe(301);
  });

  test('an unknown id still 404s rather than redirecting somewhere wrong', async ({ page }) => {
    const response = await page.goto('/show/00000000-0000-0000-0000-000000000000');
    expect(response?.status()).toBe(404);
  });
});

test.describe('anime news', () => {
  /**
   * The section is behind the `anime-news` flag. Tests force it on rather than depending
   * on PostHog's rollout in whatever environment they run against — otherwise the suite
   * would pass or fail on flag state rather than on the code under test.
   *
   * PostHog is NOT initialised in local dev (no key), so window.posthog is undefined and
   * isFeatureEnabled returns false for everything. A patch-what-exists approach therefore
   * has nothing to attach to; this installs a stub when absent and re-patches if the real
   * SDK loads later and replaces it.
   */
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      const FLAG = 'anime-news';
      const install = () => {
        const w = window as any;
        if (!w.posthog) {
          w.posthog = { isFeatureEnabled: (key: string) => key === FLAG };
          return;
        }
        if (w.posthog.__flagPatched) return;
        const original = typeof w.posthog.isFeatureEnabled === 'function'
          ? w.posthog.isFeatureEnabled.bind(w.posthog)
          : () => false;
        w.posthog.isFeatureEnabled = (key: string) => (key === FLAG ? true : original(key));
        w.posthog.__flagPatched = true;
      };
      install();
      const iv = setInterval(install, 25);
      setTimeout(() => clearInterval(iv), 10000);
    });
  });

  test('the show page renders a News tab and section', async ({ page }) => {
    await page.goto(ANIME_PATH);
    await waitForShowPage(page);

    // The tab is guarded on news.length, so its presence proves the query resolved.
    await expect(page.getByRole('button', { name: /^News/ })).toBeVisible();
    await expect(page.getByRole('heading', { name: /^News$/ })).toBeVisible();

    // …and that the section actually populated, not just rendered its heading.
    const rows = page.locator('.news-rail article');
    expect(await rows.count()).toBeGreaterThan(0);
  });

  test('the section caps at five items and links to the full list', async ({ page }) => {
    await page.goto(ANIME_PATH);
    await waitForShowPage(page);

    // 5 is the cap the show page passes; more than that would mean the limit prop
    // stopped being applied and the page grew an unbounded section.
    const rows = page.locator('.news-rail article');
    expect(await rows.count()).toBeLessThanOrEqual(5);

    const viewAll = page.getByRole('link', { name: /view all \d+ news/i });
    await expect(viewAll).toBeVisible();
    await viewAll.click();
    await expect(page).toHaveURL(ANIME_NEWS_URL);
  });

  test('the news page identifies its anime and lists stories', async ({ page }) => {
    await gotoNewsPage(page);

    // The compact hero is what makes this page make sense from a shared link.
    await expect(page.locator('.hero h1')).toBeVisible();
    await expect(page.getByText(/News\s*·\s*\d+ stor/i)).toBeVisible();
    await expect(page.getByRole('link', { name: /back to/i })).toBeVisible();

    expect(await page.locator('.news-rail article').count()).toBeGreaterThan(0);
  });

  test('every story links out to its source in a new tab', async ({ page }) => {
    await gotoNewsPage(page);

    // Regression guard: the row used to be one big anchor, which made reference
    // chips unclickable because anchors cannot nest. The headline must be its own
    // link, and nothing may nest.
    const headline = page.locator('.news-rail a.title-link').first();
    await expect(headline).toHaveAttribute('href', /^https?:\/\//);
    await expect(headline).toHaveAttribute('target', '_blank');
    await expect(headline).toHaveAttribute('rel', /noopener/);

    expect(await page.locator('a a').count()).toBe(0);
  });

  test('category filters narrow the list and survive a reload', async ({ page }) => {
    await gotoNewsPage(page);

    // Filters only render above the volume threshold; skip rather than fail if this
    // anime's published news has dropped below it.
    const chips = page.locator('.filters .chip');
    const chipCount = await chips.count();
    test.skip(chipCount === 0, 'this anime has too few stories for filters to render');

    const total = await page.locator('.news-rail article').count();

    // Retry the click until the URL responds. The markup is server-rendered, so the
    // chip is visible and clickable BEFORE Svelte hydrates — a single click can land
    // on a button with no handler yet and silently do nothing.
    // Same retry-the-assertion shape as pagination, for the same flag-gate reason.
    let filtered = 0;
    await expect(async () => {
      await chips.nth(1).click();                   // first real category
      await expect(page).toHaveURL(/[?&]category=/, { timeout: 1000 });
      filtered = await page.locator('.news-rail article').count();
      expect(filtered).toBeGreaterThan(0);
      expect(filtered).toBeLessThanOrEqual(total);
    }).toPass({ timeout: 20000 });

    // Filtering is server-rendered from the URL, so a reload must reproduce it.
    const url = page.url();
    await page.reload();
    // Wait for the reloaded page the same way gotoNewsPage does — counting straight
    // after reload measures an empty DOM, not a broken filter.
    await page.locator('.news-rail article').first().waitFor({ state: 'visible', timeout: 15000 });
    expect(page.url()).toBe(url);
    expect(await page.locator('.news-rail article').count()).toBe(filtered);
  });

  test('pagination shows a different slice on page 2', async ({ page }) => {
    await gotoNewsPage(page);
    const pager = page.locator('.pager');
    test.skip(await pager.count() === 0, 'this anime fits on a single page');

    const firstRange = await page.locator('.resultline').first().innerText();

    // Navigated directly rather than clicked. The click path is covered below; asserting
    // the RENDERED SLICE after a click couples this to the feature-flag gate, which
    // resolves via a client-side poll and can tear down and recreate the list mid-click.
    // Going straight to the URL tests the actual contract — page=2 renders items 11-20 —
    // deterministically, and still fails if paging is broken.
    await page.goto(`${ANIME_PATH}/news?page=2`);
    await page.locator('.news-rail article').first().waitFor({ state: 'visible', timeout: 15000 });

    const secondRange = await page.locator('.resultline').first().innerText();
    expect(secondRange).not.toBe(firstRange);
    expect(secondRange).toMatch(/Showing 11/);
  });

  test('the pager updates the URL', async ({ page }) => {
    await gotoNewsPage(page);
    test.skip(await page.locator('.pager').count() === 0, 'this anime fits on a single page');

    // Retried: the news block sits behind a feature flag resolved by a client-side poll,
    // so a click can land while Svelte is recreating that block and be lost.
    await expect(async () => {
      await page.getByRole('button', { name: '2', exact: true }).click();
      await expect(page).toHaveURL(/[?&]page=2/, { timeout: 1000 });
    }).toPass({ timeout: 20000 });
  });
});
