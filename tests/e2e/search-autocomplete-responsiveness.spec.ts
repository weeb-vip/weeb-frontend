import { test, expect } from '@playwright/test';
import { waitForHomepage } from './helpers';

/**
 * Guards the responsiveness of the header search dropdown.
 *
 * The regression: results were revealed with a fixed per-item stagger of 0.05s
 * from opacity 0, and the selector matched the mobile *and* desktop panels — so
 * twenty results meant forty elements and roughly two seconds before the list
 * finished appearing. Worse, the animation re-ran on every keystroke, resetting
 * already-rendered items back to opacity 0, so refining a query made results
 * blink out and fade in again. Algolia itself answers in well under 100ms, so
 * all of that delay was ours.
 */

const DESKTOP_INPUT = 'input.ac-input--desktop';
const OPTIONS = '#ac-listbox-desktop [role="option"]';

// Generous next to the ~200ms this now takes, but far under the ~2s the
// staggered reveal used to need, so a reintroduced per-item delay still trips it.
const VISIBLE_BUDGET_MS = 1200;

test.describe('Search autocomplete responsiveness', () => {
  test.setTimeout(60000);

  test.beforeEach(async ({ page }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded', timeout: 60000 });
    await waitForHomepage(page);

    const desktopInput = page.locator(DESKTOP_INPUT);
    const visible = await desktopInput
      .waitFor({ state: 'visible', timeout: 15000 })
      .then(() => true)
      .catch(() => false);
    test.skip(!visible, 'desktop search input is not visible on this viewport');
  });

  test('every result reaches full opacity promptly', async ({ page }) => {
    const search = page.locator(DESKTOP_INPUT);
    await search.click();

    const started = Date.now();
    await search.fill('naruto');

    await expect(page.locator(OPTIONS).first()).toBeVisible({ timeout: 15000 });

    // Wait for the LAST option too — a per-item stagger delays the tail, not the head.
    await page.waitForFunction(
      (sel) => {
        const items = [...document.querySelectorAll(sel)];
        return items.length > 0 && items.every((i) => parseFloat(getComputedStyle(i).opacity) > 0.95);
      },
      OPTIONS,
      { timeout: 15000 }
    );

    const elapsed = Date.now() - started;
    expect(elapsed).toBeLessThan(VISIBLE_BUDGET_MS);
  });

  test('refining a query does not blink the visible results back to transparent', async ({ page }) => {
    const search = page.locator(DESKTOP_INPUT);
    await search.click();
    await search.fill('naruto');
    await expect(page.locator(OPTIONS).first()).toBeVisible({ timeout: 15000 });

    // Let the opening animation finish first. Playwright's visibility check
    // ignores opacity, so without this the poll below would sample the panel's
    // own entrance fade and report a 0 that has nothing to do with refining.
    await page.waitForFunction(
      (sel) => {
        const items = [...document.querySelectorAll(sel)];
        return items.length > 0 && items.every((i) => parseFloat(getComputedStyle(i).opacity) > 0.95);
      },
      OPTIONS,
      { timeout: 15000 }
    );

    // Sample opacity continuously while more characters are typed. Re-running the
    // entrance animation per keystroke drove these to 0; swapping contents in
    // place does not.
    await page.evaluate((sel) => {
      (window as any).__minOpacity = 1;
      (window as any).__opacityPoll = setInterval(() => {
        for (const i of document.querySelectorAll(sel)) {
          const o = parseFloat(getComputedStyle(i).opacity);
          if (o < (window as any).__minOpacity) (window as any).__minOpacity = o;
        }
      }, 16);
    }, OPTIONS);

    await search.type(' shippuden', { delay: 60 });
    await page.waitForTimeout(400);

    const minOpacity = await page.evaluate(() => {
      clearInterval((window as any).__opacityPoll);
      return (window as any).__minOpacity as number;
    });

    // Allow a little slack for a subtle cross-fade, but nothing like a reset to 0.
    expect(minOpacity).toBeGreaterThan(0.5);
  });
});
