import { test, expect } from '@playwright/test';

test.describe('Season page', () => {
  test('loads season page with heading and navigation', async ({ page }) => {
    await page.goto('/season/SPRING_2026');
    await page.waitForLoadState('networkidle');

    // Heading renders
    await expect(page.getByRole('heading', { name: 'Spring 2026 Anime' })).toBeVisible();

    // Nav links render
    await expect(page.getByRole('link', { name: /Winter 2026/ })).toBeVisible();
    await expect(page.getByRole('link', { name: /Summer 2026/ })).toBeVisible();

    // Page shows either anime cards or empty state (depends on API availability)
    const animeCards = page.locator('a[href^="/show/"]');
    const emptyState = page.locator('text=No anime found for this season');
    await expect(animeCards.first().or(emptyState)).toBeVisible({ timeout: 10000 });
  });

  test('clicking next season navigates and updates page', async ({ page }) => {
    await page.goto('/season/SPRING_2026');
    await page.waitForLoadState('networkidle');

    await expect(page.getByRole('heading', { name: 'Spring 2026 Anime' })).toBeVisible();

    // Click next season
    await page.getByRole('link', { name: /Summer 2026/ }).click();
    await page.waitForURL('**/season/SUMMER_2026', { timeout: 10000 });

    // Heading should update
    await expect(page.getByRole('heading', { name: 'Summer 2026 Anime' })).toBeVisible({ timeout: 10000 });

    // Nav links should update
    await expect(page.getByRole('link', { name: /Spring 2026/ }).first()).toBeVisible();
    await expect(page.getByRole('link', { name: /Fall 2026/ })).toBeVisible();
  });

  test('clicking previous season navigates and updates page', async ({ page }) => {
    await page.goto('/season/SPRING_2026');
    await page.waitForLoadState('networkidle');

    await expect(page.getByRole('heading', { name: 'Spring 2026 Anime' })).toBeVisible();

    // Click previous season
    await page.getByRole('link', { name: /Winter 2026/ }).click();
    await page.waitForURL('**/season/WINTER_2026', { timeout: 10000 });

    await expect(page.getByRole('heading', { name: 'Winter 2026 Anime' })).toBeVisible({ timeout: 10000 });

    // Nav links should update
    await expect(page.getByRole('link', { name: /Fall 2025/ })).toBeVisible();
    await expect(page.getByRole('link', { name: /Spring 2026/ }).first()).toBeVisible();
  });
});
