import { test, expect, type Page } from './account.fixture';
import { waitForShowPage } from './helpers';

/*
  Putting a manga on your list, and taking it off again.

  One account and one flow, deliberately: this registers against the shared
  staging endpoint, and every extra test here is another account and another
  verification email. The whole round trip -- set, reload, remove, reload -- is
  cheaper as one test than as four.

  The reloads are the point. Both bugs this covers were invisible without them:
  the control reported "Not tracking" immediately after a successful write, and
  the page's data never refreshed because it is server-loaded and invalidating
  the query cache does nothing for it. A test that only checked the mutation
  response would have passed while the UI lied.
*/

const SEED_SLUGS = ['hellsing', 'detective-conan-the-movie-the-last-wizard-of-the-century'];

/** First seeded slug that resolves, or null when the store has no works yet. */
async function findWork(page: Page): Promise<string | null> {
  for (const slug of SEED_SLUGS) {
    const res = await page.request.get(`/manga/${slug}`);
    if (res.status() === 200) return `/manga/${slug}`;
  }

  return null;
}

function statusControl(page: Page) {
  return page.locator('.wv-select-trigger').first();
}

/**
 * Open the status menu and pick an option.
 *
 * Waits for the menu rather than trusting the click: the control is interactive
 * only once the page has hydrated, and a click that lands before then does
 * nothing at all -- which surfaces later as a mutation that never fires, with
 * nothing pointing at the real cause.
 */
async function chooseStatus(page: Page, option: string) {
  const trigger = statusControl(page);
  await expect(trigger).toBeVisible({ timeout: 20000 });

  const menu = page.locator('.wv-select-menu');
  await expect(async () => {
    await trigger.click();
    await expect(menu).toBeVisible({ timeout: 2000 });
  }).toPass({ timeout: 30000 });

  await menu.getByRole('option', { name: option, exact: true }).click();
  await expect(menu).toHaveCount(0, { timeout: 10000 });
}

test.describe('Manga tracking (logged in)', () => {
  test.describe.configure({ mode: 'serial' });
  test.setTimeout(180000);

  test('a reader can set a status, and it survives a reload', async ({ page }) => {
    const workHref = await findWork(page);
    test.skip(workHref === null, 'no seeded work is in the read store yet');


    await page.goto(workHref!, { waitUntil: 'domcontentloaded', timeout: 60000 });
    await waitForShowPage(page);

    await expect(statusControl(page)).toBeVisible({ timeout: 20000 });
    // The account is shared by the specs on this worker; a previous one may
    // have left the work on a shelf. Start from "not tracking" either way.
    if (!/not tracking/i.test((await statusControl(page).innerText()) ?? '')) {
      const cleared = page.waitForResponse(
        (r) => r.url().includes('graphql') && (r.request().postData() || '').includes('DeleteWork'),
        { timeout: 30000 },
      );
      await chooseStatus(page, 'Not tracking');
      await cleared;
    }
    await expect(statusControl(page)).toHaveText(/not tracking/i, { timeout: 15000 });

    // --- set it ---
    const added = page.waitForResponse(
      (r) => r.url().includes('graphql') && (r.request().postData() || '').includes('AddWork'),
      { timeout: 30000 },
    );
    await chooseStatus(page, 'Reading');
    const addBody = await (await added).json();
    expect(addBody.data?.AddWork?.id).toBeTruthy();
    expect(addBody.data?.AddWork?.status).toBe('READING');

    // The control must show the choice without waiting for a reload. It used to
    // revert here while the row existed in the database.
    await expect(statusControl(page)).toHaveText(/reading/i, { timeout: 15000 });

    // --- and it is really stored ---
    await page.reload({ waitUntil: 'domcontentloaded' });
    await waitForShowPage(page);
    await expect(statusControl(page)).toHaveText(/reading/i, { timeout: 20000 });

    // --- take it off again ---
    const removed = page.waitForResponse(
      (r) => r.url().includes('graphql') && (r.request().postData() || '').includes('DeleteWork'),
      { timeout: 30000 },
    );
    await chooseStatus(page, 'Not tracking');
    const removeBody = await (await removed).json();
    expect(removeBody.data?.DeleteWork).toBe(true);

    await expect(statusControl(page)).toHaveText(/not tracking/i, { timeout: 15000 });

    await page.reload({ waitUntil: 'domcontentloaded' });
    await waitForShowPage(page);
    await expect(statusControl(page)).toHaveText(/not tracking/i, { timeout: 20000 });
  });
});

// Outside the shared account on purpose: this one is about a visitor who is
// not signed in, so it starts from an empty storage state.
test.describe('signed out', () => {
  test.use({ storageState: { cookies: [], origins: [] } });

  test('the status control is present but inert when signed out', async ({ page }) => {
    const workHref = await findWork(page);
    test.skip(workHref === null, 'no seeded work is in the read store yet');

    await page.goto(workHref!, { waitUntil: 'domcontentloaded' });
    await waitForShowPage(page);

    // Signed out, userWork resolves to null rather than erroring -- which it did
    // not always do: the Work entity reference panicked in list-service and took
    // the whole page query down with it. The control rendering at all is the
    // guard on that.
    await expect(statusControl(page)).toBeVisible({ timeout: 20000 });
    await expect(statusControl(page)).toHaveText(/not tracking/i);
  });
});
