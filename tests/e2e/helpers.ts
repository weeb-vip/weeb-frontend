import type { Page } from '@playwright/test';

/**
 * Wait for page to be ready with explicit element checks instead of networkidle.
 * networkidle waits for ALL network requests which is unreliable with external APIs.
 */
export async function waitForPageReady(page: Page, options?: {
  selector?: string;
  timeout?: number;
}) {
  const { selector = 'body', timeout = 15000 } = options || {};

  // Wait for DOM content loaded first
  await page.waitForLoadState('domcontentloaded');

  // Then wait for the specific element to be visible
  await page.locator(selector).first().waitFor({ state: 'visible', timeout });
}

/**
 * Wait for homepage to be ready - checks for nav/header
 */
export async function waitForHomepage(page: Page) {
  await page.waitForLoadState('domcontentloaded');
  // Wait for navigation to be visible (indicates hydration complete)
  await page.locator('nav, header').first().waitFor({ state: 'visible', timeout: 15000 });
}

/**
 * Wait for season page to be ready - checks for season heading
 */
export async function waitForSeasonPage(page: Page) {
  await page.waitForLoadState('domcontentloaded');
  // Wait for the season heading to appear
  await page.getByRole('heading', { level: 1 }).waitFor({ state: 'visible', timeout: 15000 });
}

/**
 * Wait for auth page form to be ready
 */
export async function waitForAuthForm(page: Page) {
  await page.waitForLoadState('domcontentloaded');
  // Wait for form to be visible (indicates hydration complete)
  await page.locator('form').first().waitFor({ state: 'visible', timeout: 15000 });
}

/**
 * Wait for show detail page - handles both success and 404 cases
 */
export async function waitForShowPage(page: Page) {
  await page.waitForLoadState('domcontentloaded');
  // Wait for main content area
  await page.locator('main, body').first().waitFor({ state: 'visible', timeout: 15000 });
}
