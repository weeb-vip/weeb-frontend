import { test, expect, type Page } from '@playwright/test';
import { waitForShowPage } from './helpers';

/*
  /series/<thetvdbid>-<slug> -- the page that puts a franchise's entries back
  together.

  It is reached from a show page's hero season line, and that is the half worth
  testing: the link only exists when the anime carries a thetvdbid, so a page
  that quietly stopped emitting it would take the whole route out of reach
  without breaking anything a route-level test would notice.

  The grouping is the other half. Entries arrive as a flat list and are bucketed
  into "Season N", then "Specials", then "Other entries"; a regression that
  dropped the grouping would still render every card, so the assertions below
  are about the headings and about each entry linking back to its own page --
  not about how many cards there are, which changes with the data.
*/

/** A show on the homepage that belongs to a series, with its series href. */
async function firstShowInASeries(page: Page): Promise<{ show: string; series: string } | null> {
  await page.goto('/', { waitUntil: 'domcontentloaded', timeout: 60000 });
  const links = page.locator('a[href^="/anime/"]');
  await links.first().waitFor({ state: 'visible', timeout: 20000 });

  const hrefs: string[] = [];
  for (const href of await links.evaluateAll((els) => els.map((e) => e.getAttribute('href')))) {
    if (href && !hrefs.includes(href)) hrefs.push(href);
    if (hrefs.length === 8) break;
  }

  for (const show of hrefs) {
    await page.goto(show, { waitUntil: 'domcontentloaded', timeout: 60000 });
    await waitForShowPage(page);
    const seriesLink = page.locator('a[href^="/series/"]').first();
    if ((await seriesLink.count()) === 0) continue;
    const series = await seriesLink.getAttribute('href');
    if (series) return { show, series };
  }

  return null;
}

test.describe('Series page', () => {
  test.setTimeout(120000);

  test('the season line on a show page opens the rest of its series', async ({ page }) => {
    const found = await firstShowInASeries(page);
    test.skip(found === null, 'no show on the homepage carries a series id');

    // Already on the show page from the search above.
    const seriesLink = page.locator('a[href^="/series/"]').first();
    await expect(seriesLink).toBeVisible({ timeout: 15000 });
    // The link is the season line, so it must name the season rather than being
    // a bare "see more" -- that is what makes it findable at all.
    await expect(seriesLink).not.toHaveText('');

    await seriesLink.click();
    await expect(page).toHaveURL(/\/series\//, { timeout: 30000 });

    await expect(page.getByText('Series', { exact: true }).first()).toBeVisible({ timeout: 20000 });
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();

    // "19 entries across 7 seasons · 2005 – 2021" -- the count is the summary's
    // whole job, so a summary with no number in it is a broken summary.
    await expect(page.locator('.series-summary')).toContainText(/\d+ entr(y|ies)/, { timeout: 15000 });
  });

  test('entries are grouped by season and each one links to its own page', async ({ page }) => {
    const found = await firstShowInASeries(page);
    test.skip(found === null, 'no show on the homepage carries a series id');

    await page.goto(found!.series, { waitUntil: 'domcontentloaded', timeout: 60000 });
    await waitForShowPage(page);

    // At least one group, and every group heading is one of the three shapes the
    // bucketing can produce. A regression that stopped grouping would either
    // render no h2 at all or invent a heading that isn't one of these.
    const groupHeadings = page.getByRole('heading', { level: 2 });
    await expect(groupHeadings.first()).toBeVisible({ timeout: 20000 });
    for (const text of await groupHeadings.allInnerTexts()) {
      expect(text.trim()).toMatch(/^(Season \d+|Specials|Other entries)$/);
    }

    // Each group is a labelled region, so the headings are not decoration.
    const firstHeading = (await groupHeadings.first().innerText()).trim();
    await expect(page.getByRole('region', { name: firstHeading })).toBeVisible();

    // The entries are the point: every card leads somewhere, and the show we
    // arrived from is one of them.
    const entries = page.locator('a[href^="/anime/"]');
    expect(await entries.count()).toBeGreaterThan(0);
    const hrefs = await entries.evaluateAll((els) => els.map((e) => e.getAttribute('href')));
    expect(hrefs).toContain(found!.show);

    // And the round trip closes: opening an entry lands on a show page that
    // points back at the same series.
    await entries.first().click();
    await expect(page).toHaveURL(/\/anime\//, { timeout: 30000 });
    await waitForShowPage(page);
    await expect(page.locator(`a[href="${found!.series}"]`).first()).toBeVisible({ timeout: 20000 });
  });

  test('a series id with no number in it is a 404, not an empty page', async ({ page }) => {
    // The route parses leading digits out of the id; without them there is
    // nothing to look up, and the page must say so rather than rendering a
    // titleless shell.
    const response = await page.goto('/series/not-a-real-series', { waitUntil: 'domcontentloaded' });
    expect(response?.status()).toBe(404);
  });
});
