/**
 * The three lines that wire the swipe-navigation singleton into the app: touch
 * it so its constructor runs, and sweep stale snapshots every ten minutes.
 * Small, but it owns the only recurring timer in the client bundle, so it is
 * worth proving that the sweep actually sweeps and worth recording that the
 * timer is never cleared.
 *
 * Each test loads the module fresh (`vi.resetModules()`), because importing it
 * is the side effect under test.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const T0 = new Date('2026-01-01T00:00:00Z').getTime();
const TEN_MINUTES = 10 * 60 * 1000;

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(T0);
  sessionStorage.clear();
});

afterEach(() => {
  vi.clearAllTimers();
  vi.useRealTimers();
  sessionStorage.clear();
  window.history.replaceState({}, '', '/');
});

describe('init-swipe-navigation', () => {
  it('sweeps snapshots that have gone stale', async () => {
    vi.resetModules();
    const { swipeNavigation } = await import('$lib/utils/swipe-navigation');

    window.history.replaceState({}, '', '/init-script');
    swipeNavigation.saveState();
    expect(sessionStorage.getItem('nav_state_/init-script')).not.toBeNull();

    await import('../init-swipe-navigation');

    // Nothing is swept while the snapshot is fresh.
    vi.advanceTimersByTime(TEN_MINUTES);
    expect(sessionStorage.getItem('nav_state_/init-script')).not.toBeNull();

    // Past the 30-minute default it goes.
    vi.advanceTimersByTime(TEN_MINUTES * 3);
    expect(sessionStorage.getItem('nav_state_/init-script')).toBeNull();
  });

  it('leaves the sweep running for the life of the page', async () => {
    // Recorded rather than complained about: the interval is deliberately
    // permanent (the module is imported once, at startup) and there is no
    // teardown to call. It is the one timer a test importing this module has to
    // clear itself.
    vi.resetModules();
    await import('../init-swipe-navigation');

    expect(vi.getTimerCount()).toBe(1);
    vi.advanceTimersByTime(TEN_MINUTES * 10);
    expect(vi.getTimerCount()).toBe(1);
  });
});
