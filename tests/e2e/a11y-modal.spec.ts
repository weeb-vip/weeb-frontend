import { test, expect, type Page, type Locator } from '@playwright/test';
import { waitForHomepage } from './helpers';

// Whether the currently-focused element lives inside the open dialog. The modal
// is portaled to <body>, so we check containment against the [role="dialog"]
// node rather than any component boundary.
const focusInDialog = (page: Page) =>
  page.evaluate(() => {
    const d = document.querySelector('[role="dialog"]');
    return !!d && !!document.activeElement && d.contains(document.activeElement);
  });

// Opens the auth modal via the header (desktop) or drawer (mobile). Mode
// (login vs register) is irrelevant to focus behaviour, so we don't force it.
async function openAuthModal(page: Page): Promise<{ dialog: Locator; isMobile: boolean }> {
  const dialog = page.getByRole('dialog');
  const mobileMenu = page.getByRole('button', { name: 'Open menu' });
  const isMobile = await mobileMenu.isVisible().catch(() => false);

  if (isMobile) {
    await mobileMenu.click();
    const drawerRegister = page.getByRole('button', { name: 'Register', exact: true });
    await drawerRegister.waitFor({ state: 'visible', timeout: 5000 });
    await drawerRegister.click();
  } else {
    await page.locator('nav').getByRole('button', { name: 'Register', exact: true }).click();
  }

  await dialog.waitFor({ state: 'visible', timeout: 10000 });
  return { dialog, isMobile };
}

test.describe('Modal focus trap (a11y)', () => {
  test.setTimeout(60000);

  test.beforeEach(async ({ page }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded', timeout: 60000 });
    await waitForHomepage(page);
  });

  test('moves focus into the dialog on open', async ({ page }) => {
    await openAuthModal(page);
    await expect.poll(() => focusInDialog(page), {
      message: 'focus should move into the dialog when it opens',
    }).toBe(true);
  });

  test('keeps Tab focus inside the dialog (forward and backward)', async ({ page }) => {
    await openAuthModal(page);
    await expect.poll(() => focusInDialog(page)).toBe(true);

    // More presses than the dialog has focusable elements, so a missing trap
    // would tab out into the (inert) page behind the modal and fail here.
    for (let i = 0; i < 12; i++) {
      await page.keyboard.press('Tab');
      expect(await focusInDialog(page), `focus escaped the dialog after ${i + 1} Tab press(es)`).toBe(true);
    }

    for (let i = 0; i < 12; i++) {
      await page.keyboard.press('Shift+Tab');
      expect(await focusInDialog(page), `focus escaped the dialog after ${i + 1} Shift+Tab press(es)`).toBe(true);
    }
  });

  test('closes on Escape and restores focus to the trigger', async ({ page }) => {
    const mobileMenu = page.getByRole('button', { name: 'Open menu' });
    const isMobile = await mobileMenu.isVisible().catch(() => false);
    // The mobile drawer trigger unmounts when the drawer closes, so there is no
    // stable element to restore focus to; the restore contract only applies to
    // a persistent trigger.
    test.skip(isMobile, 'mobile opens via a drawer whose trigger unmounts');

    const trigger = page.locator('nav').getByRole('button', { name: 'Register', exact: true });
    // Drive it by keyboard: clicking a button does not focus it in Firefox/WebKit,
    // which would make "restore to trigger" untestable. This is also the real
    // keyboard-user journey the restore behaviour exists for.
    await trigger.focus();
    await expect(trigger).toBeFocused();
    await trigger.press('Enter');

    const dialog = page.getByRole('dialog');
    await dialog.waitFor({ state: 'visible', timeout: 10000 });
    await expect.poll(() => focusInDialog(page)).toBe(true);

    await page.keyboard.press('Escape');
    await expect(dialog).toBeHidden({ timeout: 5000 });
    await expect(trigger).toBeFocused({ timeout: 5000 });
  });
});
