import { test, expect } from '@playwright/test';
import { waitForSeasonPage } from './helpers';

test.describe('Season page', () => {
  test('loads season page with heading and navigation', async ({ page }) => {
    await page.goto('/season/SPRING_2026');
    await waitForSeasonPage(page);

    // Heading renders
    await expect(page.getByRole('heading', { name: 'Spring 2026', level: 1 })).toBeVisible();

    // Season tabs render (now icon + season name, no year)
    await expect(page.getByRole('button', { name: /Winter$/ })).toBeVisible();
    await expect(page.getByRole('button', { name: /Summer$/ })).toBeVisible();

    // Page shows either anime cards or empty state (depends on API availability)
    const animeCards = page.locator('a[href^="/show/"]');
    const emptyState = page.locator('text=No anime found');
    await expect(animeCards.first().or(emptyState)).toBeVisible({ timeout: 10000 });
  });

  test('clicking next season navigates and updates page', async ({ page }) => {
    await page.goto('/season/SPRING_2026');
    await waitForSeasonPage(page);

    await expect(page.getByRole('heading', { name: 'Spring 2026', level: 1 })).toBeVisible();

    // Wait for anime content to load (indicates hydration complete)
    await page.locator('a[href^="/show/"]').first().waitFor({ state: 'visible', timeout: 10000 });

    // Click using evaluate to ensure event fires
    await page.locator('button[aria-label="Next season"]').evaluate((btn) => (btn as HTMLButtonElement).click());

    // Wait for heading to change
    await expect(page.getByRole('heading', { name: 'Summer 2026', level: 1 })).toBeVisible({ timeout: 15000 });
    await expect(page).toHaveURL(/\/season\/SUMMER_2026/);
  });

  test('clicking previous season navigates and updates page', async ({ page }) => {
    await page.goto('/season/SPRING_2026');
    await waitForSeasonPage(page);

    await expect(page.getByRole('heading', { name: 'Spring 2026', level: 1 })).toBeVisible();

    // Wait for anime content to load (indicates hydration complete)
    await page.locator('a[href^="/show/"]').first().waitFor({ state: 'visible', timeout: 10000 });

    // Click using evaluate to ensure event fires
    await page.locator('button[aria-label="Previous season"]').evaluate((btn) => (btn as HTMLButtonElement).click());

    // Wait for heading to change
    await expect(page.getByRole('heading', { name: 'Winter 2026', level: 1 })).toBeVisible({ timeout: 15000 });
    await expect(page).toHaveURL(/\/season\/WINTER_2026/);
  });
});
