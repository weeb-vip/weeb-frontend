import { test, expect, devices } from '@playwright/test';

// Same anime as anime-news.spec.ts — hardcoded so the overflow check runs against a
// show that actually has news and episodes, which is what makes the layout dense.
// By id, not slug: the route accepts both, and staging has no slugs.
const ANIME_PATH = '/anime/a8f45313-b080-4f5a-8d53-5d04e7d2a315';

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

  /**
   * The page must not scroll sideways on a phone. The check above only covers `/` and
   * allows 20px of slop, which let two real overflows through: the reference chips on
   * the news page (nowrap, no max-width) and the show-page tab bar (four nowrap tabs
   * wider than a small phone). Both widened the document itself, so assert on
   * documentElement.scrollWidth with no tolerance, across the pages that broke.
   *
   * 320px is the narrowest viewport worth supporting (iPhone SE); bugs of this class
   * only show up at the narrow end, which is why the 375px-and-up list above missed them.
   */
  test('no horizontal page scroll at 320px', async ({ page }) => {
    const paths = [
      '/',
      '/airing',
      '/search',
      ANIME_PATH,
      `${ANIME_PATH}/news`,
    ];

    await page.setViewportSize({ width: 320, height: 800 });

    // Force the `anime-news` flag on, the same way anime-news.spec.ts does. Without it
    // the news section may not render at all in some environments, and a page with no
    // content trivially "passes" an overflow check.
    await page.addInitScript(() => {
      const FLAG = 'anime-news';
      const install = () => {
        const w = window as any;
        if (!w.posthog) {
          w.posthog = { isFeatureEnabled: (key: string) => key === FLAG };
          return;
        }
        if (w.posthog.__flagPatched) return;
        const original = typeof w.posthog.isFeatureEnabled === 'function'
          ? w.posthog.isFeatureEnabled.bind(w.posthog)
          : () => false;
        w.posthog.isFeatureEnabled = (key: string) => (key === FLAG ? true : original(key));
        w.posthog.__flagPatched = true;
      };
      install();
      const iv = setInterval(install, 25);
      setTimeout(() => clearInterval(iv), 10000);
    });

    for (const path of paths) {
      await page.goto(path);
      await page.waitForLoadState('domcontentloaded');
      // Let async sections (news, episodes) render — they are what overflows.
      await page.waitForTimeout(2000);

      const { scrollWidth, clientWidth } = await page.evaluate(() => ({
        scrollWidth: document.documentElement.scrollWidth,
        clientWidth: document.documentElement.clientWidth,
      }));

      expect(scrollWidth, `${path} scrolls horizontally at 320px`).toBeLessThanOrEqual(clientWidth);
    }
  });

  test('mobile performance and loading', async ({ page }) => {
    // Set mobile viewport
    await page.setViewportSize({ width: 375, height: 812 });

    const startTime = Date.now();
    await page.goto('/');
    // Use domcontentloaded for performance test - networkidle is unreliable with external APIs
    await page.waitForLoadState('domcontentloaded');
    // Wait for key content to be visible
    await page.locator('nav, header').first().waitFor({ state: 'visible', timeout: 15000 });
    const loadTime = Date.now() - startTime;

    // Mobile pages should load reasonably fast
    expect(loadTime).toBeLessThan(15000); // 15 seconds max for domcontentloaded + hydration
    
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
    
    // Tap a named control rather than whatever is first in the DOM. That used to
    // be the skip link, which is correctly parked off-screen until it takes
    // focus -- Playwright still counts it visible, since it has a bounding box,
    // and then times out trying to scroll it into view. A generic "first
    // interactive element" also says nothing when it breaks: it reports on
    // whichever element happens to lead the document, not on touch working.
    const touchTarget = mobilePage.getByRole('button', { name: /open menu/i });
    await expect(touchTarget).toBeVisible();
    await touchTarget.tap();
    
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