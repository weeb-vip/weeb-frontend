import { test, expect } from '@playwright/test';
import { waitForHomepage } from './helpers';

test('homepage loads correctly', async ({ page }) => {
  await page.goto('/');

  // Check if the page title is correct
  await expect(page).toHaveTitle(/weeb/i);

  // Check if main content is visible
  await expect(page.locator('body')).toBeVisible();
});

test('homepage renders its content sections', async ({ page }) => {
  await page.goto('/');
  await waitForHomepage(page);

  // Each section is driven by a GraphQL query. A query document that fails to
  // resolve (e.g. an edited query string that no longer matches the generated
  // codegen document — see PR #70) silently drops its section with no error.
  // These assertions guard the homepage against that class of regression:
  // "Top Rated" and "Newest" are both fed by getHomePageData, which is exactly
  // what broke. "Airing This Week" covers the currently-airing query.
  await expect(page.getByRole('heading', { name: /top rated/i })).toBeVisible();
  await expect(page.getByRole('heading', { name: /newest/i })).toBeVisible();
  // The currently-airing query used to surface as an "Airing This Week" section;
  // it now feeds the hero's Airing Next rail instead. Same guard, new home: if
  // that query stops resolving, the rail disappears with it.
  await expect(page.getByRole('heading', { name: /airing next/i })).toBeVisible();

  // ...and that the sections actually populated with linked anime cards.
  await expect(page.locator('a[href^="/anime/"]').first()).toBeVisible();
});

test('navigation works', async ({ page }) => {
  await page.goto('/');

  // Wait for page hydration
  await waitForHomepage(page);

  // Check if navigation elements are present
  // Use first() to get the main header since there might be multiple headers on the page
  const navigation = page.locator('nav, header').first();
  await expect(navigation).toBeVisible();
});

test('responsive design on mobile', async ({ page }) => {
  // Set mobile viewport
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto('/');
  
  // Check if page is responsive
  await expect(page.locator('body')).toBeVisible();
});