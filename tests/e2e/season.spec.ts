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

  /*
    The season strip is plain buttons with `aria-current`, not a tablist.

    It was briefly rebuilt as `role="tablist"` + `role="tab"`, which reads well
    until you use it: a tablist owns arrow keys and expects a tabpanel it
    controls, and these chips are links-in-spirit that change the URL. The
    button role came back, and `aria-current="page"` marks where you are. Both
    halves are asserted -- a strip that got its buttons back but lost the
    current marker is just as broken for a screen reader.
  */
  test('the season strip is buttons with a current marker, not a tablist', async ({ page }) => {
    await page.goto('/season/SPRING_2026');
    await waitForSeasonPage(page);
    await waitForSeasonGrid(page);

    // The named buttons the rest of this file clicks must resolve as buttons.
    for (const season of [/Winter$/, /Spring$/, /Summer$/, /Fall$/]) {
      await expect(page.getByRole('button', { name: season })).toBeVisible();
    }

    // Nowhere on the page -- the year strip is the same primitive and must not
    // have quietly become one either.
    await expect(page.locator('[role="tablist"]')).toHaveCount(0);
    await expect(page.locator('[role="tab"]')).toHaveCount(0);

    // The strip is a labelled group, and exactly one member of it is current.
    const strip = page.getByRole('group', { name: 'Season' });
    await expect(strip).toBeVisible();
    await expect(strip.locator('[aria-current="page"]')).toHaveCount(1);
    await expect(strip.getByRole('button', { name: /Spring$/ })).toHaveAttribute(
      'aria-current',
      'page'
    );
    // ...and the others are not.
    await expect(strip.getByRole('button', { name: /Winter$/ })).not.toHaveAttribute(
      'aria-current',
      'page'
    );
  });

  test('the current marker follows the season you navigate to', async ({ page }) => {
    // A marker that is right on first paint and then stops moving is the same
    // bug wearing a different hat.
    await page.goto('/season/SPRING_2026');
    await waitForSeasonPage(page);
    await waitForSeasonGrid(page);

    const strip = page.getByRole('group', { name: 'Season' });
    await page
      .locator('button[aria-label="Next season"]')
      .evaluate((btn) => (btn as HTMLButtonElement).click());

    await expect(page.getByRole('heading', { name: 'Summer 2026', level: 1 })).toBeVisible({
      timeout: 15000
    });
    await expect(strip.getByRole('button', { name: /Summer$/ })).toHaveAttribute(
      'aria-current',
      'page',
      { timeout: 15000 }
    );
    await expect(strip.locator('[aria-current="page"]')).toHaveCount(1);
  });

  /*
    The tag filter is a genuine multi-select: every selected tag has to match,
    so picking a second one narrows rather than replaces. Each chip carries its
    own count, which is what makes the choice informed -- a row of bare labels
    tells a reader nothing about what is behind them.
  */
  test('tags are multi-select with counts, and the reveal goes both ways', async ({ page }) => {
    await page.goto('/season/SPRING_2026');
    await waitForSeasonPage(page);
    await waitForSeasonGrid(page);

    const tags = page.getByRole('group', { name: 'Filter by tag' });
    test.skip((await tags.count()) === 0, 'this season has no tags to filter by');
    const chips = tags.getByRole('button');
    await expect(chips.first()).toBeVisible({ timeout: 15000 });

    // Counts, not bare labels: "Fantasy 26".
    const labels = await chips.allInnerTexts();
    const counted = labels.filter((l) => /\d/.test(l));
    expect(counted.length, 'tag chips must carry their counts').toBeGreaterThan(0);

    // Two tags on at once. Selecting by name, never by index -- a "Clear" chip
    // appears at the head of the row as soon as anything is selected and shifts
    // everything along.
    const names = labels
      .map((l) => l.split(/\s+/)[0])
      .filter((n) => n && n !== 'Clear' && !n.startsWith('+'));
    test.skip(names.length < 2, 'this season has fewer than two tags');

    const first = tags.getByRole('button', { name: new RegExp(`^${names[0]}\\b`) }).first();
    const second = tags.getByRole('button', { name: new RegExp(`^${names[1]}\\b`) }).first();

    await first.click();
    await expect(first).toHaveAttribute('aria-pressed', 'true', { timeout: 10000 });

    await second.click();
    await expect(second).toHaveAttribute('aria-pressed', 'true', { timeout: 10000 });
    // The first must still be on. A single-select masquerading as multi drops it.
    await expect(first).toHaveAttribute('aria-pressed', 'true');

    // And a way back out of the whole selection.
    const clear = tags.getByRole('button', { name: /^Clear/ });
    await expect(clear).toBeVisible();
    await clear.click();
    await expect(tags.locator('[aria-pressed="true"]')).toHaveCount(0, { timeout: 10000 });
  });

  test('the season tag reveal collapses again, unlike /search', async ({ page }) => {
    // Deliberately different from the browse page, where the reveal is one-way.
    // Here the row is a filter you live in, so it has to fold back up.
    await page.goto('/season/SPRING_2026');
    await waitForSeasonPage(page);
    await waitForSeasonGrid(page);

    const tags = page.getByRole('group', { name: 'Filter by tag' });
    test.skip((await tags.count()) === 0, 'this season has no tags to filter by');
    const more = tags.getByRole('button', { name: /^\+\d+ more$/ });
    test.skip((await more.count()) === 0, 'this season has few enough tags to show them all');

    const before = await tags.getByRole('button').count();
    await more.click();

    await expect(tags.getByRole('button', { name: 'Show less' })).toBeVisible({ timeout: 10000 });
    expect(await tags.getByRole('button').count()).toBeGreaterThan(before);

    await tags.getByRole('button', { name: 'Show less' }).click();
    await expect(tags.getByRole('button', { name: /^\+\d+ more$/ })).toBeVisible({ timeout: 10000 });
  });
});
