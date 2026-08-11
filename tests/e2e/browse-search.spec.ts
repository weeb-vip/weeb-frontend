import { test, expect, type Page } from '@playwright/test';

/**
 * Regression coverage for the /search (Browse Anime) page.
 *
 * The bug these guard against: query and genre were written to the URL with
 * SvelteKit's `replaceState` (shallow routing), which updates the address bar
 * and `$page.state` but NOT `$page.url`. The URL-sync reactive block therefore
 * compared a pre-advanced `lastSeenSearch` against a stale `$page.url` and
 * "corrected" the state back — wiping the selection the user just made, so no
 * search ever ran. Every assertion below fails if that behaviour returns.
 */

const GENRE_CHIP = '.genre-tag:not(.genre-tag--more)';
const SELECTED_CHIP = '.genre-tag.selected';
const SEARCH_INPUT = '.search-bar-input';
const RESULTS_COUNT = '.results-count';
const RESULTS_GRID = '.results-grid';

/** Wait for the browse page to hydrate and its Algolia genre facets to land. */
async function waitForBrowseReady(page: Page) {
  await page.goto('/search');
  await page.waitForLoadState('domcontentloaded');
  await page.locator(SEARCH_INPUT).waitFor({ state: 'visible', timeout: 15000 });
  // Genre chips come from an Algolia facet query, so they arrive after hydration.
  await page.locator(GENRE_CHIP).first().waitFor({ state: 'visible', timeout: 20000 });
}

/** A results grid holding at least one card, i.e. a search actually resolved. */
async function expectResults(page: Page) {
  await expect(page.locator(RESULTS_COUNT)).toBeVisible({ timeout: 20000 });
  await expect(page.locator(`${RESULTS_GRID} > *`).first()).toBeVisible({ timeout: 20000 });
  expect(await page.locator(`${RESULTS_GRID} > *`).count()).toBeGreaterThan(0);
}

test.describe('/search browse page', () => {
  test('clicking a genre chip runs a search and keeps the chip selected', async ({ page }) => {
    await waitForBrowseReady(page);

    const firstChip = page.locator(GENRE_CHIP).first();
    const genreName = (await firstChip.innerText()).trim().split('\n')[0];

    await firstChip.click();

    // URL is the source of truth and must carry the genre.
    await expect(page).toHaveURL(/[?&]genre=/, { timeout: 15000 });

    // The chip must stay selected. Under the bug the state was reverted from a
    // stale $page.url a tick later, so the chip silently deselected itself.
    await expect(page.locator(SELECTED_CHIP)).toHaveCount(1, { timeout: 15000 });
    await expect(page.locator(SELECTED_CHIP)).toContainText(genreName);

    await expectResults(page);

    // Hold, then re-assert: the revert happened asynchronously after the click.
    await page.waitForTimeout(2000);
    await expect(page.locator(SELECTED_CHIP)).toHaveCount(1);
    await expect(page.locator(`${RESULTS_GRID} > *`).first()).toBeVisible();
  });

  test('submitting a text query runs a search and puts it in the URL', async ({ page }) => {
    await waitForBrowseReady(page);

    await page.locator(SEARCH_INPUT).fill('naruto');
    await page.locator(SEARCH_INPUT).press('Enter');

    await expect(page).toHaveURL(/[?&]query=naruto/, { timeout: 15000 });
    await expect(page.locator(RESULTS_COUNT)).toContainText('naruto', { timeout: 20000 });
    await expectResults(page);

    // The input must not be reset by the URL-sync block.
    await page.waitForTimeout(2000);
    await expect(page.locator(SEARCH_INPUT)).toHaveValue('naruto');
  });

  test('deep link with both query and genre applies both filters', async ({ page }) => {
    await page.goto('/search?query=naruto&genre=Action');
    await page.waitForLoadState('domcontentloaded');

    await expect(page.locator(SEARCH_INPUT)).toHaveValue('naruto', { timeout: 20000 });
    await expect(page.locator(SELECTED_CHIP)).toContainText('Action', { timeout: 20000 });
    await expectResults(page);
  });

  test('deselecting the active genre returns to the browse placeholder', async ({ page }) => {
    await waitForBrowseReady(page);

    await page.locator(GENRE_CHIP).first().click();
    await expect(page).toHaveURL(/[?&]genre=/, { timeout: 15000 });
    await expectResults(page);

    // Clicking the selected chip again clears it.
    await page.locator(SELECTED_CHIP).click();

    await expect(page).not.toHaveURL(/[?&]genre=/, { timeout: 15000 });
    await expect(page.locator(SELECTED_CHIP)).toHaveCount(0);
    await expect(page.locator(RESULTS_COUNT)).toHaveCount(0);
    await expect(page.locator('.empty-state')).toBeVisible();
  });

  test('genre selection survives a reload via the URL', async ({ page }) => {
    await waitForBrowseReady(page);

    await page.locator(GENRE_CHIP).first().click();
    await expect(page).toHaveURL(/[?&]genre=/, { timeout: 15000 });
    const selectedBefore = (await page.locator(SELECTED_CHIP).innerText()).trim();

    await page.reload();
    await page.waitForLoadState('domcontentloaded');

    await expect(page.locator(SELECTED_CHIP)).toHaveCount(1, { timeout: 20000 });
    expect((await page.locator(SELECTED_CHIP).innerText()).trim()).toBe(selectedBefore);
    await expectResults(page);
  });
});
