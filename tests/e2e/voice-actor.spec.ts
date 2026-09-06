import { test, expect, type Page } from '@playwright/test';
import { waitForShowPage } from './helpers';

/*
  /people/<slug> -- a voice actor and everything they have been in.

  The route is only ever reached from a show page's Characters & Staff section,
  so the journey starts there. Both ends matter: the show page has to emit the
  link, and the person page has to resolve the roles behind it. A page that
  rendered a name and an empty grid would look fine in a screenshot and be
  useless, which is why the assertions below are about the roles resolving to
  real anime links rather than about the header.

  The role filter is the other thing worth pinning: counts are baked into each
  chip's label, and those counts are what make it possible to assert that
  filtering actually narrowed something rather than re-rendering the same list.

  It is located by its label rather than by role, deliberately. The strip is
  currently rendered as `role="tablist"` with `role="tab"` children, which is
  the pattern the season strip was moved off -- there is no `tabpanel` anywhere
  in the app for those tabs to control. Asserting through `getByRole('tablist')`
  would pin that shape in place; asserting through the label leaves the fix
  free to land.
*/

const ROLE_CARD = '.va-role-card';

/** Voice-actor hrefs reachable from the show pages the homepage links to. */
async function voiceActorLinks(page: Page, wanted = 12): Promise<string[]> {
  await page.goto('/', { waitUntil: 'domcontentloaded', timeout: 60000 });
  const links = page.locator('a[href^="/anime/"]');
  await links.first().waitFor({ state: 'visible', timeout: 20000 });

  const shows: string[] = [];
  for (const href of await links.evaluateAll((els) => els.map((e) => e.getAttribute('href')))) {
    if (href && !shows.includes(href)) shows.push(href);
    if (shows.length === 6) break;
  }

  const found: string[] = [];
  for (const show of shows) {
    await page.goto(show, { waitUntil: 'domcontentloaded', timeout: 60000 });
    await waitForShowPage(page);
    for (const href of await page
      .locator('a[href^="/people/"]')
      .evaluateAll((els) => els.map((e) => e.getAttribute('href')))) {
      if (href && !found.includes(href)) found.push(href);
    }
    if (found.length >= wanted) break;
  }

  return found;
}

/** The first one of those with a credited voice actor behind it. */
async function firstVoiceActorLink(page: Page): Promise<string | null> {
  return (await voiceActorLinks(page, 1))[0] ?? null;
}

test.describe('Voice actor page', () => {
  test.setTimeout(120000);

  test('a character credit on a show page opens the voice actor behind it', async ({ page }) => {
    const va = await firstVoiceActorLink(page);
    test.skip(va === null, 'no show on the homepage has a credited voice actor');

    // Still on the show page the link was found on.
    await page.locator(`a[href="${va}"]`).first().click();
    await expect(page).toHaveURL(/\/people\//, { timeout: 30000 });

    await expect(page.getByText('Voice actor', { exact: true }).first()).toBeVisible({ timeout: 20000 });
    const name = page.getByRole('heading', { level: 1 });
    await expect(name).toBeVisible();
    expect((await name.innerText()).trim().length).toBeGreaterThan(0);

    // "415 roles · 365 anime · 80 main" -- the figures are the page's claim
    // about itself, and must agree with there being roles below.
    await expect(page.locator('.va-stats')).toContainText(/\d+ roles?/, { timeout: 15000 });
    await expect(page.getByRole('region', { name: 'Roles' })).toBeVisible();
    await expect(page.locator(ROLE_CARD).first()).toBeVisible({ timeout: 20000 });
  });

  test('a role card links back to the anime it is a credit for', async ({ page }) => {
    const va = await firstVoiceActorLink(page);
    test.skip(va === null, 'no show on the homepage has a credited voice actor');

    await page.goto(va!, { waitUntil: 'domcontentloaded', timeout: 60000 });
    await waitForShowPage(page);

    const animeLinks = page.locator(`${ROLE_CARD} a[href^="/anime/"]`);
    await expect(animeLinks.first()).toBeVisible({ timeout: 20000 });

    // Every card names a character as well as a show -- a grid of bare anime
    // links would mean the character join was dropped.
    await expect(page.locator('.va-char-name').first()).not.toHaveText('');

    await animeLinks.first().click();
    await expect(page).toHaveURL(/\/anime\//, { timeout: 30000 });
    await waitForShowPage(page);
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible({ timeout: 20000 });
  });

  test('the role filter narrows the list, and All puts it back', async ({ page }) => {
    // The strip only exists for someone with more than one kind of credit, so
    // the candidates are walked until one turns up rather than skipping on the
    // first voice actor who happens to have only main roles -- a test that skips
    // itself on ordinary data is not covering anything.
    const candidates = await voiceActorLinks(page);
    test.skip(candidates.length === 0, 'no show on the homepage has a credited voice actor');

    const filters = page.locator('[aria-label="Filter roles"]');
    let found = false;
    for (const href of candidates) {
      await page.goto(href, { waitUntil: 'domcontentloaded', timeout: 60000 });
      await waitForShowPage(page);
      await expect(page.locator(ROLE_CARD).first()).toBeVisible({ timeout: 20000 });
      if ((await filters.count()) > 0) {
        found = true;
        break;
      }
    }
    test.skip(!found, 'none of the reachable voice actors has more than one kind of role');

    // Matched on "label + count" rather than an anchored label: the chip's text
    // content is padded with the framework's own markers, so `/^All/` never
    // matches even though the chip reads "All 415".
    const all = filters.locator('button').filter({ hasText: /All\s*[\d,]+/ }).first();
    const main = filters.locator('button').filter({ hasText: /Main\s*[\d,]+/ }).first();
    await expect(all).toHaveAttribute('aria-selected', 'true');

    // The chips carry their counts, which is what lets a reader see the split
    // before clicking. Without them "Main" says nothing.
    const mainLabel = (await main.innerText()).trim();
    expect(mainLabel).toMatch(/\d/);
    const mainCount = Number(mainLabel.match(/([\d,]+)/)![1].replace(/,/g, ''));

    const before = await page.locator(ROLE_CARD).count();
    await main.click();
    await expect(main).toHaveAttribute('aria-selected', 'true');
    await expect(all).toHaveAttribute('aria-selected', 'false');

    // Filtering has to actually change the list. The reveal pages 24 at a time,
    // so the comparison is against what the chip promised, capped at a page.
    await expect
      .poll(() => page.locator(ROLE_CARD).count(), { timeout: 15000 })
      .toBe(Math.min(mainCount, 24));

    await all.click();
    await expect(all).toHaveAttribute('aria-selected', 'true');
    await expect.poll(() => page.locator(ROLE_CARD).count(), { timeout: 15000 }).toBe(before);
  });
});
