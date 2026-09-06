import { test, expect, type Page } from '@playwright/test';
import { waitForShowPage } from './helpers';

/*
  A toast has to be readable over an open dialog.

  It was not: the toast layer sat below the modal layer, so a toast raised while
  a dialog was open -- which is most of the ones that matter, because the dialog
  is usually what the reader is in the middle of -- rendered behind the backdrop
  and was simply never seen. Nothing looked broken; the message just did not
  arrive.

  The overlay layers are one ordered scale of tokens now (dropdown < popover <
  drawer < modal < toast). This pins the end of it that broke, and pins it by
  hit-testing a real toast against a real dialog rather than by reading the
  token file: the token can be right while an `!important` somewhere else undoes
  it, and a z-index comparison alone would not notice a stacking context that
  made the number meaningless.

  The toast is a real one, raised the way a reader raises it -- setting a status
  on a work while signed out. Manufacturing one is not optional here: the toast
  region is only in the DOM while a toast is showing, so a test that assumed it
  was always there would pass or fail on whether an unrelated airing
  notification happened to be up at the time.
*/

const SEED_SLUGS = ['hellsing', 'berserk', 'detective-conan-the-movie-the-last-wizard-of-the-century'];

async function firstResolvingSlug(page: Page): Promise<string | null> {
  for (const slug of SEED_SLUGS) {
    const res = await page.request.get(`/manga/${slug}`);
    if (res.status() === 200) return slug;
  }
  return null;
}

/**
 * Open the login dialog from the header.
 *
 * Retried: the header is server-rendered, so its buttons are clickable well
 * before the handlers behind them are wired up, and under a full parallel run
 * the first click lands in that gap and does nothing at all.
 */
async function openLoginDialog(page: Page) {
  const dialog = page.locator('.weeb-modal-card');
  await expect(async () => {
    await page.locator('nav').getByRole('button', { name: 'Login', exact: true }).click();
    await expect(dialog).toBeVisible({ timeout: 5000 });
  }).toPass({ timeout: 40000 });
  return dialog;
}

/** The stacking level of an element, or null when it has none of its own. */
function layerOf(page: Page, selector: string) {
  return page.evaluate((sel) => {
    const el = document.querySelector(sel);
    if (!el) return null;
    const parsed = Number.parseInt(getComputedStyle(el).zIndex, 10);
    return Number.isNaN(parsed) ? null : parsed;
  }, selector);
}

test.describe('Overlay layering', () => {
  test.setTimeout(120000);

  test('a toast raised while a dialog is open is still readable over it', async ({ page }) => {
    const slug = await firstResolvingSlug(page);
    test.skip(slug === null, 'no seeded work is in the read store yet');

    await page.goto(`/manga/${slug}`, { waitUntil: 'domcontentloaded', timeout: 60000 });
    await waitForShowPage(page);

    // Setting a status while signed out is refused, and says so in a toast.
    const trigger = page.locator('.wv-select-trigger').first();
    await expect(trigger).toBeVisible({ timeout: 20000 });
    const menu = page.locator('.wv-select-menu');
    await expect(async () => {
      await trigger.click();
      await expect(menu).toBeVisible({ timeout: 2000 });
    }).toPass({ timeout: 30000 });
    await menu.getByRole('option', { name: 'Reading', exact: true }).click();

    const toast = page.locator('[data-sonner-toast]').filter({ hasText: /Log in to keep track/i });
    await expect(toast).toBeVisible({ timeout: 20000 });

    // Now put a dialog up underneath it. This is the ordinary next thing to do:
    // the toast has just told the reader to log in.
    await openLoginDialog(page);
    await expect(toast, 'the toast must outlive opening the dialog').toBeVisible();

    // THE assertion: whatever is painted at the middle of the toast is part of
    // the toast, not the dialog's backdrop covering it over.
    const hit = await toast.evaluate((el) => {
      const box = el.getBoundingClientRect();
      const top = document.elementFromPoint(box.left + box.width / 2, box.top + box.height / 2);
      return {
        insideToast: !!top && el.contains(top),
        got: top ? `${top.tagName}.${(top as HTMLElement).className}`.slice(0, 120) : 'nothing'
      };
    });
    expect(hit.insideToast, `the dialog is painted over the toast; hit ${hit.got}`).toBe(true);

    // And the layer numbers agree, so a future change reads as a layer change
    // rather than as a mysterious hit-test failure.
    const [toaster, backdrop] = await Promise.all([
      layerOf(page, '[data-sonner-toaster]'),
      layerOf(page, '.weeb-modal-backdrop')
    ]);
    expect(toaster, 'the toast region carries no stacking level').not.toBeNull();
    expect(backdrop, 'the dialog backdrop carries no stacking level').not.toBeNull();
    expect(toaster!).toBeGreaterThan(backdrop!);
  });

  test('the drawer sits under the dialog it opens', async ({ page }) => {
    // The other end of the same scale. The drawer and the dialog are both
    // portaled to the body, and the login dialog is opened from *inside* the
    // drawer, so without an explicit order whichever painted last would win.
    await page.setViewportSize({ width: 390, height: 800 });
    await page.goto('/', { waitUntil: 'domcontentloaded', timeout: 60000 });

    const drawer = page.getByRole('dialog', { name: 'Menu' });
    await expect(async () => {
      await page.getByRole('button', { name: 'Open menu' }).click();
      await expect(drawer).toBeVisible({ timeout: 5000 });
    }).toPass({ timeout: 40000 });

    await drawer.getByRole('button', { name: 'Login', exact: true }).click();
    await expect(page.locator('.weeb-modal-card')).toBeVisible({ timeout: 15000 });

    const [drawerLayer, modalLayer] = await Promise.all([
      layerOf(page, '.drawer-backdrop'),
      layerOf(page, '.weeb-modal-backdrop')
    ]);
    expect(drawerLayer, 'the drawer carries no stacking level').not.toBeNull();
    expect(modalLayer, 'the dialog carries no stacking level').not.toBeNull();
    expect(modalLayer!).toBeGreaterThan(drawerLayer!);
  });

  test('a signed-out add prompts a login rather than failing quietly', async ({ page }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded', timeout: 60000 });
    const shows = page.locator('a[href^="/anime/"]');
    await shows.first().waitFor({ state: 'visible', timeout: 20000 });
    await page.goto((await shows.first().getAttribute('href'))!, {
      waitUntil: 'domcontentloaded',
      timeout: 60000
    });
    await waitForShowPage(page);

    const add = page.getByRole('button', { name: /^add to list$/i }).first();
    await expect(add).toBeVisible({ timeout: 20000 });
    const dialog = page.getByRole('dialog');

    await expect(async () => {
      // Centre it first -- the header is an overlay over the hero, and a button
      // sitting under it is visible but not clickable.
      await add.evaluate((el) => el.scrollIntoView({ block: 'center' }));
      await add.click();
      await expect(dialog).toBeVisible({ timeout: 5000 });
    }).toPass({ timeout: 40000 });

    // It is the auth dialog, not just any dialog: the point is that the add
    // leads somewhere the reader can act on.
    await expect(
      dialog.getByRole('heading', { name: /welcome back|sign in to keep track|create/i })
    ).toBeVisible({ timeout: 10000 });
  });
});
