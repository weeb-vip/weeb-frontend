import { test, expect } from '@playwright/test';
import { waitForHomepage } from './helpers';

// Countdown/timing values are worker- and time-driven, so the data flow itself
// is covered deterministically by the unit suite (animeNotifications.test.ts).
// This smoke test guards the *consolidation*: HeroBanner (homepage) and the
// currently-airing page both read the single animeNotificationStore now, so it
// verifies those pages still render without a runtime error from the store swap.
test.describe('Anime notification store consumers', () => {
  test.setTimeout(60000);

  test('homepage hero and airing page render without store errors', async ({ page }) => {
    const pageErrors: string[] = [];
    page.on('pageerror', (e) => pageErrors.push(e.message));

    // Homepage renders HeroBanner, which subscribes to animeNotificationStore.
    await page.goto('/', { waitUntil: 'domcontentloaded', timeout: 60000 });
    await waitForHomepage(page);
    await expect(page.locator('.hero').first()).toBeVisible({ timeout: 15000 });

    // The airing page renders CurrentlyAiringCard, another store consumer.
    await page.goto('/airing', { waitUntil: 'domcontentloaded', timeout: 60000 });
    await expect(page.locator('main')).toBeVisible({ timeout: 15000 });

    // A broken store (missing export / wrong shape) would throw during render.
    const storeErrors = pageErrors.filter((e) =>
      /animeNotification|animeCountdown|timingData|countdowns|is not defined|undefined/i.test(e)
    );
    expect(storeErrors, `store-related page errors: ${storeErrors.join(' | ')}`).toHaveLength(0);
  });
});
