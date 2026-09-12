import { test, expect, type Page } from '@playwright/test';

/**
 * Regression coverage for the manga half of /search.
 *
 * The bug these guard against: the works (manga and light novel) results were
 * fetched with a hardcoded `WORKS_HITS_PER_PAGE = 6` while the anime above them
 * used the reader-selectable page size, so every search rendered a full grid of
 * 24 anime sitting on top of a stub row of 6 manga, and the "Show N per page"
 * control moved only the top half of the page. The two indices are still paged
 * independently -- their rankings are not comparable -- but they are sized
 * together.
 *
 * The same commit left three smaller asymmetries behind, each covered below:
 * both headings claimed `id="works-heading"` (so the manga section's
 * aria-labelledby resolved to the *anime* heading), the manga header carried a
 * second copy of the view-mode toggle driving the same state as the first, and
 * the manga pagination sat outside its section entirely.
 */

/** Anime results are direct children of the page; manga live in their section. */
const ANIME_GRID = '.search-page > .results-grid';
const ANIME_LIST = '.search-page > .results-list';
const WORKS_GRID = '.works-section .results-grid';
const WORKS_LIST = '.works-section .results-list';
const ANIME_NAV = 'nav[aria-label="Search results pagination"]';
const WORKS_NAV = 'nav[aria-label="Manga results pagination"]';

/**
 * A query that matches far more than a full page of both anime and manga, so a
 * page-size assertion reads the size and not the size of the catalogue.
 */
const DEEP_QUERY = 'love';
/** A query whose manga fit on a single page, whatever size that page is. */
const SHALLOW_MANGA_QUERY = 'one piece';

const DEFAULT_PAGE_SIZE = 24;

/** Land on a search and wait for both indices to have answered. */
async function searchFor(page: Page, query: string) {
  await page.goto(`/search?query=${encodeURIComponent(query)}`);
  await page.waitForLoadState('domcontentloaded');
  await page.locator('.works-section').waitFor({ state: 'visible', timeout: 20000 });
  await expect(page.locator(`${WORKS_GRID} > *`).first()).toBeVisible({ timeout: 20000 });
}

const cardCount = (page: Page, grid: string) => page.locator(`${grid} > *`).count();

/** What a grid is currently showing, as the stable identity of each card. */
const hrefs = (page: Page, grid: string) =>
  page.locator(`${grid} a[href]`).evaluateAll((links) => links.map((link) => link.getAttribute('href')));

/** Drive the "Show N per page" select belonging to one pagination bar. */
async function setPageSize(page: Page, nav: string, size: number) {
  await page.locator(nav).getByRole('button', { name: 'Results per page' }).click();
  await page
    .getByRole('listbox', { name: 'Results per page' })
    .getByRole('option', { name: String(size), exact: true })
    .click();
}

test.describe('/search manga results', () => {
  test('fills the manga grid to the same size as the anime grid above it', async ({ page }) => {
    await searchFor(page, DEEP_QUERY);

    // Both indices have more than a page of matches, so both grids are full.
    await expect.poll(() => cardCount(page, ANIME_GRID), { timeout: 20000 }).toBe(DEFAULT_PAGE_SIZE);
    expect(await cardCount(page, WORKS_GRID)).toBe(DEFAULT_PAGE_SIZE);
  });

  test('resizes both grids when the reader changes the page size', async ({ page }) => {
    await searchFor(page, DEEP_QUERY);
    await expect.poll(() => cardCount(page, WORKS_GRID), { timeout: 20000 }).toBe(DEFAULT_PAGE_SIZE);

    await setPageSize(page, ANIME_NAV, 48);

    // The control lives on the anime bar but owns the whole page: a change that
    // moved only the top half is the bug.
    await expect.poll(() => cardCount(page, ANIME_GRID), { timeout: 20000 }).toBe(48);
    await expect.poll(() => cardCount(page, WORKS_GRID), { timeout: 20000 }).toBe(48);

    // And the manga bar reports the same size back.
    await expect(page.locator(WORKS_NAV).getByRole('button', { name: 'Results per page' })).toHaveText(
      '48',
    );
  });

  test('pages the manga without disturbing the anime above them', async ({ page }) => {
    await searchFor(page, DEEP_QUERY);

    // Compared by href rather than by the card's text: scores and list badges
    // fill in after the cards mount, so the rendered text of one card is not
    // stable enough to tell "a different card" from "the same card, later".
    const mangaBefore = await hrefs(page, WORKS_GRID);
    const animeBefore = await hrefs(page, ANIME_GRID);

    await page.locator(WORKS_NAV).getByRole('button', { name: 'Next page' }).click();

    await expect(page.locator(`${WORKS_NAV} .pg-info`)).toContainText('Page 2', { timeout: 20000 });
    await expect.poll(() => hrefs(page, WORKS_GRID), { timeout: 20000 }).not.toEqual(mangaBefore);

    // The two indices are ranked independently, so they page independently.
    await expect(page.locator(`${ANIME_NAV} .pg-info`)).toContainText('Page 1');
    expect(await hrefs(page, ANIME_GRID)).toEqual(animeBefore);
  });

  test('returns both grids to their first page when the page size changes', async ({ page }) => {
    await searchFor(page, DEEP_QUERY);

    await page.locator(WORKS_NAV).getByRole('button', { name: 'Next page' }).click();
    await expect(page.locator(`${WORKS_NAV} .pg-info`)).toContainText('Page 2', { timeout: 20000 });
    await page.locator(ANIME_NAV).getByRole('button', { name: 'Next page' }).click();
    await expect(page.locator(`${ANIME_NAV} .pg-info`)).toContainText('Page 2', { timeout: 20000 });

    await setPageSize(page, ANIME_NAV, 48);

    // Page 2 of 24-per-page is not page 2 of 48-per-page, for either grid.
    await expect(page.locator(`${ANIME_NAV} .pg-info`)).toContainText('Page 1', { timeout: 20000 });
    await expect(page.locator(`${WORKS_NAV} .pg-info`)).toContainText('Page 1', { timeout: 20000 });
  });

  test('shows no manga pagination when every match fits on one page', async ({ page }) => {
    await searchFor(page, SHALLOW_MANGA_QUERY);

    const manga = await cardCount(page, WORKS_GRID);
    expect(manga).toBeGreaterThan(0);
    expect(manga).toBeLessThan(DEFAULT_PAGE_SIZE);
    await expect(page.locator(WORKS_NAV)).toHaveCount(0);

    // The anime beside them have plenty of pages, so this is the manga bar
    // standing down rather than pagination being absent from the page.
    await expect(page.locator(ANIME_NAV)).toHaveCount(1);
  });

  test('keeps the manga pagination inside the section it pages', async ({ page }) => {
    await searchFor(page, DEEP_QUERY);

    await expect(page.locator(`.works-section ${WORKS_NAV}`)).toHaveCount(1);
  });
});

test.describe('/search page chrome is not duplicated across the two halves', () => {
  test('has one view-mode control, and it switches both grids', async ({ page }) => {
    await searchFor(page, DEEP_QUERY);

    // Two toggles driving one piece of state is two chances to disagree.
    const viewMode = page.getByRole('group', { name: 'View mode' });
    await expect(viewMode).toHaveCount(1);

    await viewMode.getByRole('button').nth(1).click();

    await expect(page.locator(ANIME_LIST)).toBeVisible({ timeout: 20000 });
    await expect(page.locator(WORKS_LIST)).toBeVisible();
    await expect(page.locator(ANIME_GRID)).toHaveCount(0);
    await expect(page.locator(WORKS_GRID)).toHaveCount(0);
  });

  test('labels the manga section with its own heading, not the anime one', async ({ page }) => {
    await searchFor(page, DEEP_QUERY);

    // Both headings once carried id="works-heading", so the section's
    // aria-labelledby resolved to the first match -- "Anime".
    const ids = await page.locator('.search-page h2').evaluateAll((headings) =>
      headings.map((heading) => heading.id).filter(Boolean),
    );
    expect(new Set(ids).size).toBe(ids.length);

    await expect(page.getByRole('region', { name: 'Manga & Light Novels' })).toBeVisible();
  });
});
