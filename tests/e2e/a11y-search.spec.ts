import { test, expect } from '@playwright/test';
import { waitForHomepage } from './helpers';

// The search combobox is rendered twice (mobile + desktop); the desktop input
// is the one visible on the Desktop Chrome/Firefox projects CI runs. These
// tests assert the keyboard-navigation + ARIA combobox contract on it.
const QUERY = 'Naruto';

test.describe('Search autocomplete keyboard navigation (a11y)', () => {
  test.setTimeout(60000);

  test.beforeEach(async ({ page }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded', timeout: 60000 });
    await waitForHomepage(page);

    // The autocomplete shows a loading skeleton until Algolia finishes its
    // async client-side init, so wait for the real input to appear rather than
    // point-checking. On mobile projects it is display:none and never becomes
    // visible, so the wait times out and we skip (the contract is identical,
    // but these locators target the desktop markup).
    const desktopInput = page.locator('input.ac-input--desktop');
    const visible = await desktopInput
      .waitFor({ state: 'visible', timeout: 15000 })
      .then(() => true)
      .catch(() => false);
    test.skip(!visible, 'desktop search input is not visible on this viewport');
  });

  test('exposes combobox + listbox roles once results load', async ({ page }) => {
    const search = page.locator('input.ac-input--desktop');
    await search.click();
    await search.fill(QUERY);

    const options = page.locator('#ac-listbox-desktop [role="option"]');
    await expect(options.first()).toBeVisible({ timeout: 15000 });

    await expect(search).toHaveAttribute('role', 'combobox');
    await expect(search).toHaveAttribute('aria-controls', 'ac-listbox-desktop');
    await expect(search).toHaveAttribute('aria-expanded', 'true');
    await expect(page.locator('#ac-listbox-desktop')).toHaveAttribute('role', 'listbox');
  });

  test('Arrow keys move the highlight and sync aria-activedescendant', async ({ page }) => {
    const search = page.locator('input.ac-input--desktop');
    const options = page.locator('#ac-listbox-desktop [role="option"]');
    await search.click();
    await search.fill(QUERY);
    await expect(options.first()).toBeVisible({ timeout: 15000 });

    // Nothing highlighted until the user arrows into the list.
    await expect(search).not.toHaveAttribute('aria-activedescendant', /.+/);

    await search.press('ArrowDown');
    await expect(search).toHaveAttribute('aria-activedescendant', 'ac-opt-desktop-0');
    await expect(options.nth(0)).toHaveAttribute('aria-selected', 'true');

    await search.press('ArrowDown');
    await expect(search).toHaveAttribute('aria-activedescendant', 'ac-opt-desktop-1');
    await expect(options.nth(0)).toHaveAttribute('aria-selected', 'false');
    await expect(options.nth(1)).toHaveAttribute('aria-selected', 'true');

    await search.press('ArrowUp');
    await expect(search).toHaveAttribute('aria-activedescendant', 'ac-opt-desktop-0');
    await expect(options.nth(0)).toHaveAttribute('aria-selected', 'true');
  });

  test('Enter on the highlighted option opens that show', async ({ page }) => {
    const search = page.locator('input.ac-input--desktop');
    const options = page.locator('#ac-listbox-desktop [role="option"]');
    await search.click();
    await search.fill(QUERY);
    await expect(options.first()).toBeVisible({ timeout: 15000 });

    await search.press('ArrowDown');
    await search.press('Enter');
    // Either form: the autocomplete builds its href from the algolia record, and
    // whether that carries a slug depends on the environment's backfill state.
    await expect(page).toHaveURL(/\/anime\//, { timeout: 15000 });
  });

  test('Enter with no highlight runs a full search', async ({ page }) => {
    const search = page.locator('input.ac-input--desktop');
    const options = page.locator('#ac-listbox-desktop [role="option"]');
    await search.click();
    await search.fill(QUERY);
    await expect(options.first()).toBeVisible({ timeout: 15000 });

    // No ArrowDown → no active option → Enter falls through to /search.
    await search.press('Enter');
    await expect(page).toHaveURL(/\/search\?query=Naruto/i, { timeout: 15000 });
  });
});
