import { test, expect, type Page } from '@playwright/test';

/*
  Opening the login modal from inside the mobile drawer must not throw the
  reader back to the top of the page.

  The body scroll lock works by pinning the body with `position: fixed` and a
  negative `top`, then scrolling back to that offset on release. When each
  overlay owned its own lock there were two owners in this journey: the drawer
  pinned at the real offset, and the modal -- which pins while the body is
  already fixed, and therefore reads `window.scrollY` as 0 -- saved 0. Whichever
  released last won, so closing put the reader at the top of a page they had
  scrolled a long way down.

  The lock is refcounted at module scope now: the first owner saves the offset
  and only the last one restores it. The assertion that pins this is the middle
  one -- that opening the second overlay leaves the *first* overlay's offset in
  place. Under the bug that value was rewritten to 0, and every other check here
  would still have passed.

  The offset is read off the page rather than assumed from what was scrolled to:
  the homepage keeps growing as its rails fill in, so where the reader actually
  is when the drawer opens is not necessarily where the test put them.
*/

/** The offset the body is currently pinned at, or null when it isn't pinned. */
async function pinnedOffset(page: Page): Promise<number | null> {
  return page.evaluate(() => {
    const { position, top } = document.body.style;
    if (position !== 'fixed' || !top) return null;
    return Math.abs(Number.parseInt(top, 10));
  });
}

/**
 * Scroll a good way down and stay there, returning the offset that stuck.
 *
 * The homepage keeps growing and re-laying-out as its rails resolve, and a
 * scroll issued mid-reflow gets clamped to whatever the document height was at
 * the time -- so a single `scrollTo` lands somewhere near the top often enough
 * to make this test skip itself. Scrolling repeatedly until the offset holds
 * still across two frames is what makes the rest of the test worth running.
 */
async function scrollDownAndSettle(page: Page): Promise<number> {
  let settled = 0;
  await expect(async () => {
    settled = await page.evaluate(() => {
      const max = document.documentElement.scrollHeight - window.innerHeight;
      window.scrollTo(0, Math.min(600, Math.floor(max * 0.5)));
      return window.scrollY;
    });
    await page.waitForTimeout(250);
    const after = await page.evaluate(() => window.scrollY);
    expect(after).toBe(settled);
    expect(settled).toBeGreaterThan(150);
  }).toPass({ timeout: 30000 });

  return settled;
}

/**
 * Open the drawer without letting Playwright scroll the page first.
 *
 * A normal `.click()` runs actionability checks that scroll the target into
 * view, and the menu button lives in a header that moves with the page -- so
 * the click itself drags the reader back up before the lock ever engages, and
 * the test would then be measuring its own side effect.
 */
async function openDrawer(page: Page) {
  const openMenu = page.getByRole('button', { name: 'Open menu' });
  await expect(openMenu).toBeVisible({ timeout: 20000 });
  await openMenu.evaluate((btn) => (btn as HTMLButtonElement).click());

  const drawer = page.getByRole('dialog', { name: 'Menu' });
  await expect(drawer).toBeVisible({ timeout: 15000 });
  return drawer;
}

test.describe('Mobile drawer scroll lock', () => {
  test.setTimeout(90000);
  test.use({ viewport: { width: 390, height: 800 } });

  test('a login opened from the drawer returns you where you were, not to the top', async ({ page }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded', timeout: 60000 });
    // The rails fill in after hydration, so let the page have a height before
    // scrolling into it.
    await page.locator('a[href^="/anime/"]').first().waitFor({ state: 'visible', timeout: 20000 });
    const before = await scrollDownAndSettle(page);

    const drawer = await openDrawer(page);

    // The drawer pinned the body, and it pinned it where the reader actually
    // was -- otherwise the rest of this proves nothing.
    const pinned = await pinnedOffset(page);
    expect(pinned, 'the drawer must pin the body scroll').toBe(before);

    // Into the modal from inside the drawer: two overlays, one lock.
    await drawer.getByRole('button', { name: 'Login', exact: true }).click();
    await expect(page.locator('.weeb-modal-card')).toBeVisible({ timeout: 15000 });

    // THE assertion. A second owner that pinned for itself would read
    // `window.scrollY` as 0 through the already-fixed body and overwrite this.
    expect(
      await pinnedOffset(page),
      'opening the modal must not overwrite the offset the drawer saved'
    ).toBe(pinned);

    await page.keyboard.press('Escape');
    await expect(page.getByRole('dialog')).toHaveCount(0, { timeout: 15000 });

    // Everything unwound: the body is released...
    await expect.poll(() => pinnedOffset(page), { timeout: 10000 }).toBeNull();
    // ...and the reader is put back exactly where they were, not at the top.
    await expect.poll(() => page.evaluate(() => window.scrollY), { timeout: 10000 }).toBe(pinned);
  });

  test('closing the drawer on its own also restores the offset', async ({ page }) => {
    // The single-owner case, so a fix that only ever works with two overlays
    // stacked would still be caught.
    await page.goto('/', { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.locator('a[href^="/anime/"]').first().waitFor({ state: 'visible', timeout: 20000 });
    const before = await scrollDownAndSettle(page);

    const drawer = await openDrawer(page);

    const pinned = await pinnedOffset(page);
    expect(pinned).toBe(before);

    await drawer.getByRole('button', { name: 'Close menu' }).click();
    await expect(page.getByRole('dialog')).toHaveCount(0, { timeout: 15000 });

    await expect.poll(() => page.evaluate(() => window.scrollY), { timeout: 10000 }).toBe(pinned);
  });
});
