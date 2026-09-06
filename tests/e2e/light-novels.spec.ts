import { test, expect } from '@playwright/test';

/*
  /light-novels -- the works catalogue, which is two pages wearing one URL.

  With no query string it is a shelf: three sorted rails, each a taster with a
  way through to the whole thing. With `?sort=` it is a single paged list. The
  seam between the two is where this can quietly break -- a shelf whose "See
  all" leads nowhere, or a paged view that renders page 2 with page 1's
  contents -- so the journey below crosses it in both directions and checks the
  slice really changed rather than trusting the URL.

  Cards here link to /manga/<slug>: light novels have no detail route of their
  own, and a card pointing at a route that doesn't exist would still look
  perfectly fine on the shelf.
*/

const CARD = 'a[href^="/manga/"]';

test.describe('Light novels', () => {
  test.setTimeout(120000);

  test('the shelf offers three sorted rails, each with a way into the full list', async ({ page }) => {
    await page.goto('/light-novels', { waitUntil: 'domcontentloaded', timeout: 60000 });

    await expect(page.getByRole('heading', { name: 'Light novels', level: 1 })).toBeVisible({
      timeout: 20000
    });
    // The size of the catalogue is the page's one piece of context.
    await expect(page.locator('.head-meta')).toContainText(/[\d,]+ titles/, { timeout: 15000 });

    for (const shelf of ['Most popular', 'Highest rated', 'Newest']) {
      await expect(page.getByRole('heading', { name: shelf, level: 2 })).toBeVisible();
    }

    // A shelf without a way off it is a dead end; there are three shelves and
    // so there must be three ways through.
    const seeAll = page.getByRole('link', { name: /See all/ });
    await expect(seeAll).toHaveCount(3);

    // And the cards go somewhere real.
    await expect(page.locator(CARD).first()).toBeVisible({ timeout: 20000 });
    const href = await page.locator(CARD).first().getAttribute('href');
    expect((await page.request.get(href!)).status()).toBe(200);
  });

  test('See all opens that shelf as a paged list, and back returns to the shelves', async ({ page }) => {
    await page.goto('/light-novels', { waitUntil: 'domcontentloaded', timeout: 60000 });
    await expect(page.getByRole('heading', { name: 'Highest rated', level: 2 })).toBeVisible({
      timeout: 20000
    });

    // The link that belongs to the "Highest rated" shelf, not just any of the three.
    await page.locator('a[href="/light-novels?sort=SCORE"]').first().click();

    await expect(page).toHaveURL(/sort=SCORE/, { timeout: 30000 });
    await expect(page.getByRole('heading', { name: 'Highest rated', level: 2 })).toBeVisible({
      timeout: 20000
    });
    // The other shelves are gone -- this is one list now, not the shelf view.
    await expect(page.getByRole('heading', { name: 'Most popular', level: 2 })).toHaveCount(0);
    await expect(page.locator('.head-meta')).toContainText(/page 1 of \d+/, { timeout: 15000 });

    await page.getByRole('link', { name: /All shelves/ }).click();
    await expect(page).toHaveURL(/\/light-novels$/, { timeout: 30000 });
    await expect(page.getByRole('heading', { name: 'Most popular', level: 2 })).toBeVisible({
      timeout: 20000
    });
  });

  test('paging forward shows a different slice, and marks where you are', async ({ page }) => {
    await page.goto('/light-novels?sort=POPULARITY', { waitUntil: 'domcontentloaded', timeout: 60000 });

    const pager = page.getByRole('navigation', { name: 'Pagination' });
    await expect(pager).toBeVisible({ timeout: 20000 });

    // Where you are has to be announced, not just underlined.
    await expect(pager.locator('[aria-current="page"]')).toHaveText('1');

    await expect(page.locator(CARD).first()).toBeVisible({ timeout: 20000 });
    const firstOnPageOne = await page.locator(CARD).first().getAttribute('href');

    await pager.getByRole('link', { name: 'Next' }).click();

    await expect(page).toHaveURL(/page=2/, { timeout: 30000 });
    await expect(page.locator('.head-meta')).toContainText(/page 2 of \d+/, { timeout: 20000 });
    await expect(page.getByRole('navigation', { name: 'Pagination' }).locator('[aria-current="page"]'))
      .toHaveText('2');

    // The whole point of a second page. A pager that changed the URL and
    // re-rendered the same 24 works would pass every assertion above this one.
    await expect(page.locator(CARD).first()).toBeVisible({ timeout: 20000 });
    expect(await page.locator(CARD).first().getAttribute('href')).not.toBe(firstOnPageOne);

    // And Previous gets back to where it started.
    await page
      .getByRole('navigation', { name: 'Pagination' })
      .getByRole('link', { name: 'Previous' })
      .click();
    await expect(page.locator('.head-meta')).toContainText(/page 1 of \d+/, { timeout: 20000 });
    expect(await page.locator(CARD).first().getAttribute('href')).toBe(firstOnPageOne);
  });

  test('a page past the end says so rather than rendering an empty shelf', async ({ page }) => {
    await page.goto('/light-novels?sort=POPULARITY&page=99999', {
      waitUntil: 'domcontentloaded',
      timeout: 60000
    });

    await expect(page.getByText(/Nothing on this page/i)).toBeVisible({ timeout: 20000 });
    // Two of them: the section header's and the empty state's own action. Either
    // is a way out, which is what matters here.
    await expect(page.getByRole('link', { name: /All shelves/ }).first()).toBeVisible();
  });
});
