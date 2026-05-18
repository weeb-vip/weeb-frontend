import { test, expect } from '@playwright/test';

test.describe('Season page', () => {
  test('loads season page with heading and navigation', async ({ page }) => {
    await page.goto('/season/SPRING_2026');
    await page.waitForLoadState('networkidle');

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
    await page.waitForLoadState('networkidle');

    await expect(page.getByRole('heading', { name: 'Spring 2026', level: 1 })).toBeVisible();

    // Click the "Next season" arrow (Spring -> Summer)
    await page.getByRole('button', { name: 'Next season' }).click();
    await page.waitForURL('**/season/SUMMER_2026', { timeout: 10000 });

    // Heading should update
    await expect(page.getByRole('heading', { name: 'Summer 2026', level: 1 })).toBeVisible({ timeout: 10000 });
  });

  test('clicking previous season navigates and updates page', async ({ page }) => {
    await page.goto('/season/SPRING_2026');
    await page.waitForLoadState('networkidle');

    await expect(page.getByRole('heading', { name: 'Spring 2026', level: 1 })).toBeVisible();

    // Click the "Previous season" arrow (Spring -> Winter)
    await page.getByRole('button', { name: 'Previous season' }).click();
    await page.waitForURL('**/season/WINTER_2026', { timeout: 10000 });

    await expect(page.getByRole('heading', { name: 'Winter 2026', level: 1 })).toBeVisible({ timeout: 10000 });
  });
});
