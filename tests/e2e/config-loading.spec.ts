import { test, expect } from '@playwright/test';
import { waitForHomepage } from './helpers';

// Config is loaded once at build time and handed to the client via the root
// layout's load data. The client consumers (config store, config-loader data
// layer, profile context) read that instead of re-fetching /config.json. This
// test locks in "no redundant client config fetch" while proving config still
// actually resolves (search needs config.algolia_index to return results).
test.describe('Config loading', () => {
  test.setTimeout(60000);

  test('client uses layout-provided config without re-fetching /config.json', async ({ page }) => {
    const configRequests: string[] = [];
    page.on('request', (r) => {
      if (r.url().includes('/config.json')) configRequests.push(r.url());
    });

    await page.goto('/', { waitUntil: 'domcontentloaded', timeout: 60000 });
    await waitForHomepage(page);

    // Prove config actually resolved: the search index name comes from config,
    // so getting results means the hydrated config reached the store.
    const search = page.locator('input.ac-input--desktop');
    const desktop = await search
      .waitFor({ state: 'visible', timeout: 15000 })
      .then(() => true)
      .catch(() => false);

    if (desktop) {
      await search.click();
      await search.fill('Naruto');
      await expect(
        page.locator('#ac-listbox-desktop [role="option"]').first()
      ).toBeVisible({ timeout: 15000 });
    }

    // The point of the consolidation: zero redundant /config.json round-trips.
    expect(
      configRequests,
      `unexpected /config.json fetches: ${configRequests.join(', ')}`
    ).toHaveLength(0);
  });
});
