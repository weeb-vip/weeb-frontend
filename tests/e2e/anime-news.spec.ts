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

/**
 * Open the news page and wait until it has actually rendered. Without this, a
 * `.count()` immediately after goto runs against an empty DOM — which reads as
 * "0 chips" and silently SKIPS the filter test rather than failing it. A test that
 * skips itself when the page is slow is worse than no test.
 */
async function gotoNewsPage(page: import('@playwright/test').Page) {
  await page.goto(`/show/${ANIME_WITH_NEWS}/news`);
  await page.waitForLoadState('domcontentloaded');
  await page.locator('.news-page').waitFor({ state: 'visible', timeout: 15000 });
  await page.locator('.news-rail article').first().waitFor({ state: 'visible', timeout: 15000 });
}

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
    await page.goto(`/show/${ANIME_WITH_NEWS}`);
    await waitForShowPage(page);

    // The tab is guarded on news.length, so its presence proves the query resolved.
    await expect(page.getByRole('button', { name: /^News/ })).toBeVisible();
    await expect(page.getByRole('heading', { name: /^News$/ })).toBeVisible();

    // …and that the section actually populated, not just rendered its heading.
    const rows = page.locator('.news-rail article');
    expect(await rows.count()).toBeGreaterThan(0);
  });

  test('the section caps at five items and links to the full list', async ({ page }) => {
    await page.goto(`/show/${ANIME_WITH_NEWS}`);
    await waitForShowPage(page);

    // 5 is the cap the show page passes; more than that would mean the limit prop
    // stopped being applied and the page grew an unbounded section.
    const rows = page.locator('.news-rail article');
    expect(await rows.count()).toBeLessThanOrEqual(5);

    const viewAll = page.getByRole('link', { name: /view all \d+ news/i });
    await expect(viewAll).toBeVisible();
    await viewAll.click();
    await expect(page).toHaveURL(new RegExp(`/show/${ANIME_WITH_NEWS}/news$`));
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
    await expect(async () => {
      await chips.nth(1).click();                   // first real category
      await expect(page).toHaveURL(/[?&]category=/, { timeout: 1000 });
    }).toPass({ timeout: 15000 });

    const filtered = await page.locator('.news-rail article').count();
    expect(filtered).toBeGreaterThan(0);
    expect(filtered).toBeLessThanOrEqual(total);

    // Filtering is server-rendered from the URL, so a reload must reproduce it.
    const url = page.url();
    await page.reload();
    // Wait for the reloaded page the same way gotoNewsPage does — counting straight
    // after reload measures an empty DOM, not a broken filter.
    await page.locator('.news-rail article').first().waitFor({ state: 'visible', timeout: 15000 });
    expect(page.url()).toBe(url);
    expect(await page.locator('.news-rail article').count()).toBe(filtered);
  });

  test('pagination moves through the list', async ({ page }) => {
    await gotoNewsPage(page);

    const pager = page.locator('.pager');
    test.skip(await pager.count() === 0, 'this anime fits on a single page');

    const firstRange = await page.locator('.resultline').first().innerText();

    // Same hydration race as the filter test; exact:true so "2" cannot match a button
    // that merely contains a 2 (e.g. a count).
    await expect(async () => {
      await page.getByRole('button', { name: '2', exact: true }).click();
      await expect(page).toHaveURL(/[?&]page=2/, { timeout: 1000 });
    }).toPass({ timeout: 15000 });

    // The range line must actually advance — a pager that changes the URL without
    // changing the slice is the failure worth catching.
    await expect(page.locator('.resultline').first()).not.toHaveText(firstRange);
  });
});
