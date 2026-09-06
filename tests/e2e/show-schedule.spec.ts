import { test, expect, type Page } from '@playwright/test';
import { waitForShowPage } from './helpers';

/*
  The show page's broadcast panel has to come off the server.

  It used to be fed from a client-only countdown worker, so the panel appeared a
  beat after hydration and never appeared at all for a reader who got the HTML
  and no JS -- a crawler, a slow connection, a blocked bundle. The timing is now
  derived from the same episode data the page is server-rendered with, and the
  worker only refreshes it.

  A regression here is invisible in a normal browser test: the panel still shows
  up once the page hydrates. So the assertion is made against the raw server
  response for a page that *does* show the panel in a browser -- if it renders
  after hydration but is missing from the HTML, the derivation has gone back to
  being client-only.
*/

const PANEL = 'aside[aria-label="Broadcast schedule"]';

/** The first show on the homepage whose page renders a broadcast panel. */
async function firstShowWithSchedule(page: Page): Promise<string | null> {
  await page.goto('/', { waitUntil: 'domcontentloaded', timeout: 60000 });
  const links = page.locator('a[href^="/anime/"]');
  await links.first().waitFor({ state: 'visible', timeout: 20000 });

  const hrefs: string[] = [];
  for (const href of await links.evaluateAll((els) => els.map((e) => e.getAttribute('href')))) {
    if (href && !hrefs.includes(href)) hrefs.push(href);
    if (hrefs.length === 8) break;
  }

  for (const href of hrefs) {
    await page.goto(href, { waitUntil: 'domcontentloaded', timeout: 60000 });
    await waitForShowPage(page);
    if (await page.locator(PANEL).first().isVisible().catch(() => false)) return href;
  }

  return null;
}

test.describe('Show broadcast schedule', () => {
  test.setTimeout(150000);

  test('the panel a browser shows is already in the server HTML', async ({ page }) => {
    const href = await firstShowWithSchedule(page);
    test.skip(href === null, 'nothing on the homepage is currently scheduled');

    // In the browser it is there, and it says something -- a panel with no
    // label is the "worker has not answered yet" state, not a schedule.
    const panel = page.locator(PANEL).first();
    await expect(panel).toBeVisible();
    await expect(panel).toContainText(/Airing now|Recently aired|Next episode/, { timeout: 15000 });

    // And the same URL fetched as plain HTML, with no browser to hydrate it,
    // already carries the panel.
    const html = await (await page.request.get(href!)).text();
    expect(html, 'the broadcast panel is missing from the server response').toContain(
      'aria-label="Broadcast schedule"'
    );
    expect(html).toMatch(/Airing now|Recently aired|Next episode/);
  });

  test('the broadcast slot is a disclosure, not a permanent block of text', async ({ page }) => {
    const href = await firstShowWithSchedule(page);
    test.skip(href === null, 'nothing on the homepage is currently scheduled');

    const toggle = page.getByRole('button', { name: 'Broadcast time' });
    test.skip((await toggle.count()) === 0, 'this show has no raw broadcast slot recorded');

    await expect(toggle).toHaveAttribute('aria-expanded', 'false');
    await toggle.click();
    await expect(toggle).toHaveAttribute('aria-expanded', 'true');
    await expect(page.locator('#show-broadcast-slot')).toBeVisible({ timeout: 10000 });

    await toggle.click();
    await expect(toggle).toHaveAttribute('aria-expanded', 'false');
  });
});
