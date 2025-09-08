import { test, expect } from '@playwright/test';

test('homepage loads correctly', async ({ page }) => {
  await page.goto('/');
  
  // Check if the page title is correct
  await expect(page).toHaveTitle(/weeb/i);
  
  // Check if main content is visible
  await expect(page.locator('body')).toBeVisible();
});

test('navigation works', async ({ page }) => {
  await page.goto('/');
  
  // Wait for the page to load
  await page.waitForLoadState('networkidle');
  
  // Check if navigation elements are present
  const navigation = page.locator('nav, header');
  await expect(navigation).toBeVisible();
});

test('responsive design on mobile', async ({ page }) => {
  // Set mobile viewport
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto('/');
  
  // Check if page is responsive
  await expect(page.locator('body')).toBeVisible();
});