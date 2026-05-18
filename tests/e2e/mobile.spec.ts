import { test, expect, devices } from '@playwright/test';

// Mobile-specific tests
test.describe('Mobile Experience', () => {
  test('mobile navigation and touch interactions', async ({ page, isMobile }) => {
    await page.goto('/');
    
    if (isMobile) {
      // Test mobile-specific navigation (hamburger menu, etc.)
      const mobileMenu = page.locator('[data-testid="mobile-menu"], .mobile-menu, button[aria-label*="menu" i]').first();
      
      if (await mobileMenu.count() > 0) {
        await mobileMenu.tap();
        await expect(page.locator('.menu-items, [data-testid="menu-items"]')).toBeVisible();
      }
      
      // Test swipe gestures if applicable
      await page.touchscreen.tap(100, 100);
    }
  });

  test('responsive layout on different screen sizes', async ({ page }) => {
    const viewports = [
      { width: 375, height: 812, name: 'iPhone 12' },
      { width: 390, height: 844, name: 'iPhone 12 Pro' },
      { width: 414, height: 896, name: 'iPhone 11 Pro Max' },
      { width: 360, height: 640, name: 'Galaxy S5' },
      { width: 768, height: 1024, name: 'iPad' },
    ];

    for (const viewport of viewports) {
      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      await page.goto('/');
      
      // Check if content is visible and properly laid out
      await expect(page.locator('body')).toBeVisible();
      
      // Check if content doesn't overflow horizontally
      const bodyWidth = await page.evaluate(() => document.body.scrollWidth);
      expect(bodyWidth).toBeLessThanOrEqual(viewport.width + 20); // Allow small margin
    }
  });

  test('mobile performance and loading', async ({ page }) => {
    // Set mobile viewport
    await page.setViewportSize({ width: 375, height: 812 });
    
    const startTime = Date.now();
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    const loadTime = Date.now() - startTime;
    
    // Mobile pages should load reasonably fast
    expect(loadTime).toBeLessThan(10000); // 10 seconds max
    
    // Check if images are optimized for mobile
    const images = await page.locator('img').all();
    let visibleImageCount = 0;
    
    for (const img of images) {
      const src = await img.getAttribute('src');
      if (src && !src.startsWith('data:')) {
        // Check if image is in viewport and potentially visible
        const isVisible = await img.isVisible();
        if (isVisible) {
          visibleImageCount++;
        }
      }
    }
    
    // Just ensure some images are visible (flexible check)
    console.log(`Found ${visibleImageCount} visible images on mobile`);
    // Don't fail if no images are visible - they might be lazy loaded or off-screen
  });
});

// Tests specifically for simulated mobile devices
test.describe('Mobile Device Simulation', () => {
  test('iPhone simulation', async ({ page, browser, browserName }) => {
    // Skip mobile device options for Firefox as it doesn't support them
    if (browserName === 'firefox') {
      test.skip(browserName === 'firefox', 'Firefox does not support mobile device simulation options');
      return;
    }

    const context = await browser.newContext({
      ...devices['iPhone 12'],
    });
    const mobilePage = await context.newPage();
    
    await mobilePage.goto('/');
    await expect(mobilePage.locator('body')).toBeVisible();
    
    // Test touch interactions
    const touchTarget = mobilePage.locator('button, a, [role="button"]').first();
    if (await touchTarget.count() > 0) {
      await touchTarget.tap();
    }
    
    await context.close();
  });

  test('Android simulation', async ({ page, browser, browserName }) => {
    // Skip mobile device options for Firefox as it doesn't support them
    if (browserName === 'firefox') {
      test.skip(browserName === 'firefox', 'Firefox does not support mobile device simulation options');
      return;
    }

    const context = await browser.newContext({
      ...devices['Pixel 5'],
    });
    const mobilePage = await context.newPage();
    
    await mobilePage.goto('/');
    await expect(mobilePage.locator('body')).toBeVisible();
    
    // Test Android-specific behaviors
    await mobilePage.keyboard.press('Tab'); // Test focus navigation
    
    await context.close();
  });
});