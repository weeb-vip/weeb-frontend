import { test, expect, type Page } from '@playwright/test';
import { waitForHomepage, waitForShowPage } from './helpers';

/*
  The source-work page at /manga/<slug>, and the link between a work and the
  anime adapted from it.

  On the skips in here. CI builds with APP_CONFIG=staging, and staging's read
  store holds no works at all -- they arrive only as the manga backfill runs. So
  every test that needs a work to exist checks first and skips with a reason
  when there is none, rather than failing a build over absent data. They start
  guarding the moment staging is backfilled.

  Finding a work is the awkward part: the schema exposes workBySlug and nothing
  that lists works, and the only route in is an anime that names its source.
  Walking the homepage does not find one -- it is seasonal anime, and none of
  the first twenty-five link to a source -- so these seed from known slugs
  instead and treat a 404 as "not backfilled yet". Add to the list rather than
  replacing it; a slug that stops resolving degrades to a skip, not a failure.
*/

const SEED_SLUGS = ['hellsing', 'detective-conan-the-movie-the-last-wizard-of-the-century'];

/** First seeded slug that actually resolves, or null if none are in the store. */
async function findWork(page: Page): Promise<string | null> {
  for (const slug of SEED_SLUGS) {
    const res = await page.request.get(`/manga/${slug}`);
    if (res.status() === 200) return `/manga/${slug}`;
  }
  return null;
}

test('an unknown manga slug is a 404, not an empty page', async ({ page }) => {
  // The loader has to tell "no work claims this slug" apart from "a work with
  // nothing in it". Getting that wrong serves a blank page with a 200 and lets
  // crawlers index it.
  const response = await page.goto('/manga/definitely-not-a-real-work-slug');

  expect(response?.status()).toBe(404);
});

test('the anime Information panel survives gaining a source link', async ({ page }) => {
  // The Source row became conditional markup -- a link when the source work is
  // known, plain text otherwise. A malformed branch there takes down the whole
  // panel, and the panel carries studios, rating, broadcast and air dates.
  await page.goto('/');
  await waitForHomepage(page);

  const firstAnime = page.locator('a[href^="/anime/"]').first();
  await expect(firstAnime).toBeVisible();
  await firstAnime.click();
  await waitForShowPage(page);

  await expect(page.getByRole('heading', { name: /information/i })).toBeVisible();
});

test('a work page renders its title and adaptations section', async ({ page }) => {
  const workHref = await findWork(page);
  test.skip(workHref === null, 'no seeded work is in the read store yet');

  await page.goto(workHref!);
  await waitForShowPage(page);

  // h1.hero-title specifically, not any h1: the error state renders an h1 too
  // ("This page could not load"), so a bare h1 assertion passes on the exact
  // failure this is meant to catch.
  await expect(page.locator('h1.hero-title')).toBeVisible();

  // The adaptations section is always present, adapted or not -- most works
  // were never adapted, and the page says so rather than dropping the section.
  await expect(page.getByRole('heading', { name: /anime adaptations/i })).toBeVisible();

  // And it is never a hole: either the grid has cards or the empty state
  // explains itself. A region with neither is what this guards against.
  const cards = await page.locator('.poster-grid a[href^="/anime/"]').count();
  const emptyState = await page.getByText(/no anime has been made from this/i).count();

  expect(cards > 0 || emptyState > 0).toBe(true);
});

test('an adaptation card leads to an anime that links back to the work', async ({ page }) => {
  // The link is a relationship, not a one-way pointer. If a work lists an anime
  // as its adaptation, that anime must name the work as its source. This is the
  // assertion that catches the two sides being wired to different ids -- each
  // page looks correct alone, and only the round trip disagrees.
  const workHref = await findWork(page);
  test.skip(workHref === null, 'no seeded work is in the read store yet');

  await page.goto(workHref!);
  await waitForShowPage(page);

  const card = page.locator('.poster-grid a[href^="/anime/"]').first();
  test.skip((await card.count()) === 0, 'the seeded work has no adaptations to follow');

  const animeHref = await card.getAttribute('href');
  await page.goto(animeHref!);
  await waitForShowPage(page);

  // Any link back is enough -- it renders both in the hero as "Adapted from"
  // and as the Information panel's Source row, and which one is present is a
  // layout decision this test should not pin down.
  await expect(page.locator(`a[href="${workHref}"]`).first()).toBeVisible();
});
