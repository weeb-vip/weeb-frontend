import { test, expect } from '@playwright/test';
import { waitForSeasonPage, waitForSeasonGrid } from './helpers';

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
    await waitForSeasonGrid(page);
  });

  test('clicking next season navigates and updates page', async ({ page }) => {
    await page.goto('/season/SPRING_2026');
    await waitForSeasonPage(page);

    await expect(page.getByRole('heading', { name: 'Spring 2026', level: 1 })).toBeVisible();

    // Wait for the grid to render, with or without anime in it. These tests are
    // about navigation, so they must not fail because a season is empty or the
    // seasonal query is unavailable.
    await waitForSeasonGrid(page);

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

    // Wait for the grid to render, with or without anime in it. These tests are
    // about navigation, so they must not fail because a season is empty or the
    // seasonal query is unavailable.
    await waitForSeasonGrid(page);

    // Click using evaluate to ensure event fires
    await page.locator('button[aria-label="Previous season"]').evaluate((btn) => (btn as HTMLButtonElement).click());

    // Wait for heading to change
    await expect(page.getByRole('heading', { name: 'Winter 2026', level: 1 })).toBeVisible({ timeout: 15000 });
    await expect(page).toHaveURL(/\/season\/WINTER_2026/);
  });
});
