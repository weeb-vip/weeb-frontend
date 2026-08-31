import { test, expect } from '@playwright/test';
import { waitForHomepage } from './helpers';

/*
  The manga row on the homepage.

  It is server-rendered from currentlyPublishingWorks, so what is asserted here
  is that works reach the page at all and that their cards point somewhere real
  -- the failure this guards against is a shelf of covers that 404 on click,
  which is what happens if a work without a url_slug is rendered.

  Skipped rather than failed when the section is absent: the row only renders
  when the read store holds ongoing works, and an environment seeded with
  nothing but anime is a legitimate state, not a regression.
*/

const SECTION = 'Still Publishing';

test.describe('Homepage manga row', () => {
  test('lists ongoing works, each linking to its own page', async ({ page }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded', timeout: 60000 });
    await waitForHomepage(page);

    const heading = page.getByRole('heading', { name: SECTION });
    const present = await heading.isVisible().catch(() => false);
    test.skip(!present, 'no ongoing works in this environment');

    // The section, not the page: /manga/ links elsewhere would pass this while
    // the row itself was empty.
    const section = page.locator('section').filter({ has: heading });
    const links = section.locator('a[href^="/manga/"]');
    await expect(links.first()).toBeVisible({ timeout: 15000 });

    const hrefs = await links.evaluateAll((els) =>
      els.map((el) => el.getAttribute('href') ?? ''),
    );
    expect(hrefs.length).toBeGreaterThan(0);

    // Every card needs a slug after /manga/. A work whose slug the scraper has
    // not assigned yet renders as /manga/ or /manga/null and dies on click.
    for (const href of hrefs) {
      expect(href).toMatch(/^\/manga\/[^/]+$/);
      expect(href).not.toMatch(/\/(null|undefined)$/);
    }

    // And the first one actually resolves, rather than merely looking right.
    const first = hrefs[0];
    const response = await page.request.get(first);
    expect(response.status()).toBe(200);
  });

  test('a card in the row opens the work it names', async ({ page }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded', timeout: 60000 });
    await waitForHomepage(page);

    const heading = page.getByRole('heading', { name: SECTION });
    const present = await heading.isVisible().catch(() => false);
    test.skip(!present, 'no ongoing works in this environment');

    const section = page.locator('section').filter({ has: heading });
    const card = section.locator('a[href^="/manga/"]').first();
    const href = await card.getAttribute('href');

    // Centre it first: the header is an overlay, and a card under it is visible
    // but not clickable.
    await card.evaluate((el) => el.scrollIntoView({ block: 'center' }));
    await card.click();

    await page.waitForURL(`**${href}`, { timeout: 30000 });
    // The work page renders a status control whether or not anyone is signed
    // in, so it is the cheapest proof the page really loaded.
    await expect(page.locator('.wv-select-trigger').first()).toBeVisible({ timeout: 20000 });
  });
});
