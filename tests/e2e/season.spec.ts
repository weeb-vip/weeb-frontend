import { test, expect } from '@playwright/test';

test.describe('Season page', () => {
  test('loads current season with anime list', async ({ page }) => {
    await page.goto('/season/SPRING_2026');
    await page.waitForLoadState('networkidle');

    await expect(page.getByRole('heading', { name: 'Spring 2026 Anime' })).toBeVisible();

    const animeCards = page.locator('a[href^="/show/"]');
    await expect(animeCards.first()).toBeVisible({ timeout: 10000 });

    // Should have more than 10 anime (verifying limit param works)
    const cardCount = await animeCards.count();
    expect(cardCount).toBeGreaterThan(10);
  });

  test('season navigation links are present', async ({ page }) => {
    await page.goto('/season/SPRING_2026');
    await page.waitForLoadState('networkidle');

    await expect(page.getByRole('heading', { name: 'Spring 2026 Anime' })).toBeVisible();

    await expect(page.getByRole('link', { name: /Winter 2026/ })).toBeVisible();
    await expect(page.getByRole('link', { name: /Summer 2026/ })).toBeVisible();
  });

  test('clicking next season navigates and shows anime cards', async ({ page }) => {
    await page.goto('/season/SPRING_2026');
    await page.waitForLoadState('networkidle');

    await expect(page.getByRole('heading', { name: 'Spring 2026 Anime' })).toBeVisible();
    await expect(page.locator('a[href^="/show/"]').first()).toBeVisible({ timeout: 10000 });

    // Click next season
    await page.getByRole('link', { name: /Summer 2026/ }).click();
    await page.waitForURL('**/season/SUMMER_2026', { timeout: 10000 });

    // Heading should update
    await expect(page.getByRole('heading', { name: 'Summer 2026 Anime' })).toBeVisible({ timeout: 10000 });

    // Nav links should update
    await expect(page.getByRole('link', { name: /Spring 2026/ }).first()).toBeVisible();
    await expect(page.getByRole('link', { name: /Fall 2026/ })).toBeVisible();

    // Anime cards should be visible after navigation
    const animeCards = page.locator('a[href^="/show/"]');
    await expect(animeCards.first()).toBeVisible({ timeout: 10000 });
    const cardCount = await animeCards.count();
    expect(cardCount).toBeGreaterThan(0);

    // Wait 3 seconds and verify cards are STILL visible (not wiped by client query)
    await page.waitForTimeout(3000);
    await expect(page.locator('a[href^="/show/"]').first()).toBeVisible();
    const cardCountAfterWait = await page.locator('a[href^="/show/"]').count();
    expect(cardCountAfterWait).toBeGreaterThan(0);
  });

  test('clicking previous season navigates and shows anime cards', async ({ page }) => {
    await page.goto('/season/SPRING_2026');
    await page.waitForLoadState('networkidle');

    await expect(page.getByRole('heading', { name: 'Spring 2026 Anime' })).toBeVisible();
    await expect(page.locator('a[href^="/show/"]').first()).toBeVisible({ timeout: 10000 });

    // Click previous season
    await page.getByRole('link', { name: /Winter 2026/ }).click();
    await page.waitForURL('**/season/WINTER_2026', { timeout: 10000 });

    await expect(page.getByRole('heading', { name: 'Winter 2026 Anime' })).toBeVisible({ timeout: 10000 });

    await expect(page.getByRole('link', { name: /Fall 2025/ })).toBeVisible();
    await expect(page.getByRole('link', { name: /Spring 2026/ }).first()).toBeVisible();

    // Anime cards should be visible
    const animeCards = page.locator('a[href^="/show/"]');
    await expect(animeCards.first()).toBeVisible({ timeout: 10000 });

    // Wait and verify stability
    await page.waitForTimeout(3000);
    await expect(page.locator('a[href^="/show/"]').first()).toBeVisible();
  });
});
