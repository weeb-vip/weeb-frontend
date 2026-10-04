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
// Scoped to the anime half: the manga section below carries a count and a grid
// of its own, so the bare class matches two elements and trips strict mode.
// `search-manga-pagination.spec.ts` owns the manga side.
const RESULTS_COUNT = '.search-page > .results-header .results-count';
const RESULTS_GRID = '.search-page > .results-grid';

/** Wait for the browse page to hydrate, with its genre strip on screen. */
async function waitForBrowseReady(page: Page) {
  await page.goto('/search');
  await page.waitForLoadState('domcontentloaded');
  await page.locator(SEARCH_INPUT).waitFor({ state: 'visible', timeout: 15000 });
  // The strip is in the server's HTML; the browser fetches it only when the
  // server could not.
  await page.locator(GENRE_CHIP).first().waitFor({ state: 'visible', timeout: 20000 });
}

/** The custom Select: open it by its label, pick an option by its text. */
async function choose(page: Page, label: string, option: string) {
  await page.getByRole('button', { name: label }).click();
  await page.getByRole('option', { name: option, exact: true }).click();
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
    await page.waitForTimeout(750);
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
    await page.waitForTimeout(750);
    await expect(page.locator(SEARCH_INPUT)).toHaveValue('naruto');
  });

  test('deep link with both query and genre applies both filters', async ({ page }) => {
    await page.goto('/search?query=naruto&genre=Action');
    await page.waitForLoadState('domcontentloaded');

    await expect(page.locator(SEARCH_INPUT)).toHaveValue('naruto', { timeout: 20000 });
    await expect(page.locator(SELECTED_CHIP)).toContainText('Action', { timeout: 20000 });
    await expectResults(page);
  });

  test('deselecting the active genre returns to the whole catalogue, not a blank page', async ({ page }) => {
    await waitForBrowseReady(page);

    await page.locator(GENRE_CHIP).first().click();
    await expect(page).toHaveURL(/[?&]genre=/, { timeout: 15000 });
    await expectResults(page);
    await expect(page.locator(RESULTS_COUNT)).toContainText(' in ');

    // Clicking the selected chip again clears it.
    await page.locator(SELECTED_CHIP).click();

    await expect(page).not.toHaveURL(/[?&]genre=/, { timeout: 15000 });
    await expect(page.locator(SELECTED_CHIP)).toHaveCount(0);
    await expect(page.locator(RESULTS_COUNT)).not.toContainText(' in ', { timeout: 20000 });
    await expectResults(page);
    await expect(page.locator('.empty-state')).toHaveCount(0);
  });

  /*
    There is no blank state. /search with nothing in the URL used to render a
    "Browse anime" placeholder and wait to be typed into; it now shows the
    first page of the catalogue, and shows it from the server's HTML, so the
    page is full before any script runs.
  */
  test('the bare page shows the catalogue, in the HTML, before any script', async ({ browser }) => {
    const context = await browser.newContext({ javaScriptEnabled: false });
    const page = await context.newPage();
    await page.goto('/search');

    await expect(page.locator(RESULTS_COUNT)).toBeVisible();
    await expect(page.locator(RESULTS_COUNT)).toContainText(/^[\d,]+ results$/);
    expect(await page.locator(`${RESULTS_GRID} > *`).count()).toBeGreaterThan(0);
    await expect(page.locator(GENRE_CHIP).first()).toBeVisible();
    await expect(page.locator('.empty-state')).toHaveCount(0);

    await context.close();
  });

  /*
    Everything the reader chooses is in the URL -- the status, the year, the
    sort, the view and the page, not only the query and genre -- so a reload
    or Back lands on the same page rather than page one of everything.
  */
  test('the status filter goes into the URL and survives a reload', async ({ page }) => {
    await waitForBrowseReady(page);
    const unfiltered = (await page.locator(RESULTS_COUNT).innerText()).trim();

    await choose(page, 'Filter by status', 'Upcoming');

    await expect(page).toHaveURL(/[?&]status=NOT_YET_AIRED/, { timeout: 15000 });
    await expect(page.locator(RESULTS_COUNT)).not.toHaveText(unfiltered, { timeout: 20000 });
    await expectResults(page);
    // The pill row says what is narrowing the page.
    await expect(page.locator('.filter-pill')).toContainText('Upcoming');

    await page.reload();
    await page.waitForLoadState('domcontentloaded');

    await expect(page).toHaveURL(/[?&]status=NOT_YET_AIRED/);
    await expect(page.locator('.filter-pill')).toContainText('Upcoming', { timeout: 20000 });
    await expect(page.getByRole('button', { name: 'Filter by status' })).toContainText('Upcoming');
    await expectResults(page);
  });

  test('the page the reader is on comes back with Back', async ({ page }) => {
    await waitForBrowseReady(page);
    await expectResults(page);

    // Page two, then away to a show, then Back.
    await page.getByRole('button', { name: 'Next page' }).first().click();
    await expect(page).toHaveURL(/[?&]page=2/, { timeout: 15000 });
    await expectResults(page);
    // The card is the link; its href is the stable identity of what page two showed.
    const card = page.locator(`${RESULTS_GRID} a[href^="/anime/"]`).first();
    const href = await card.getAttribute('href');
    await card.click();
    await expect(page).toHaveURL(/\/anime\//, { timeout: 20000 });

    await page.goBack();

    await expect(page).toHaveURL(/[?&]page=2/, { timeout: 15000 });
    await expectResults(page);
    await expect(page.locator(`${RESULTS_GRID} a[href^="/anime/"]`).first()).toHaveAttribute('href', href!, { timeout: 20000 });
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
