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

  /*
    The genre row is a chip group with counts, and a one-way reveal.

    Both halves have been lost before. The counts went missing when the row was
    rebuilt off a plain string list -- the chips still worked, but a reader had
    no way to tell a genre with four thousand titles from one with forty. And
    the reveal is deliberately one-way here: unlike the season page's tag row,
    once you have asked to see every genre the row stays open, because
    collapsing it back would hide a chip the reader had just selected. A
    "+N more" that turned into "Show less" would be that regression.
  */
  test('genre chips carry their counts', async ({ page }) => {
    await waitForBrowseReady(page);

    const chips = page.locator(GENRE_CHIP);
    expect(await chips.count()).toBeGreaterThan(1);

    // Every chip, not just one: a row where only the first had a count would be
    // a partially-applied fix.
    for (const label of await chips.allInnerTexts()) {
      expect(label.replace(/\s+/g, ' ').trim()).toMatch(/^.+\s[\d,]+$/);
    }

    // The row is a labelled group, so the chips are announced as a set rather
    // than as loose buttons scattered through the page.
    await expect(page.getByRole('group', { name: 'Filter by genre' })).toBeVisible();
  });

  test('the +N more reveal opens the full genre row and does not fold back', async ({ page }) => {
    await waitForBrowseReady(page);

    const more = page.locator('.genre-tag--more');
    test.skip((await more.count()) === 0, 'every genre already fits in the row');

    // The affordance says how many are hidden, so the click is an informed one.
    const label = (await more.innerText()).trim();
    expect(label).toMatch(/^\+\d+ more$/);
    const hidden = Number(label.match(/\d+/)![0]);

    const before = await page.locator(GENRE_CHIP).count();
    await more.click();

    // Everything that was hidden is now on screen...
    await expect
      .poll(() => page.locator(GENRE_CHIP).count(), { timeout: 15000 })
      .toBe(before + hidden);

    // ...and the way back is gone, on purpose.
    await expect(page.locator('.genre-tag--more')).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Show less' })).toHaveCount(0);

    // A revealed chip is a working chip, not just markup.
    const revealed = page.locator(GENRE_CHIP).nth(before);
    const name = (await revealed.innerText()).trim().split('\n')[0];
    await revealed.click();
    await expect(page).toHaveURL(/[?&]genre=/, { timeout: 15000 });
    await expect(page.locator(SELECTED_CHIP)).toContainText(name, { timeout: 15000 });
  });
});
