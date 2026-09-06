/**
 * @vitest-environment node
 *
 * Analytics helpers are called from code that also renders on the server, so
 * every one of them has to be inert without a `window` rather than throwing a
 * `ReferenceError` mid-render. Under jsdom there is always a window, so this is
 * the only place the guards are actually exercised.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  analytics,
  identifyUser,
  initializeAnalytics,
  isFeatureEnabled,
  onFeatureFlags,
  trackEvent
} from '$lib/utils/analytics';

const consoleSpies = [
  vi.spyOn(console, 'log').mockImplementation(() => {}),
  vi.spyOn(console, 'warn').mockImplementation(() => {})
];

afterEach(() => {
  for (const spy of consoleSpies) spy.mockClear();
});

describe('analytics without a window', () => {
  it('has no window to find PostHog on', () => {
    expect(typeof window).toBe('undefined');
  });

  it('drops events instead of throwing', () => {
    expect(() => trackEvent('anime_viewed', { anime_id: '1' })).not.toThrow();
    expect(() => analytics.pageViewed('show')).not.toThrow();
    expect(() => identifyUser('u-1')).not.toThrow();
  });

  it('reports every feature flag as off, with no dev override to consult', () => {
    // `devFlagOverrides` bails before touching localStorage or location.
    expect(isFeatureEnabled('anime-news')).toBe(false);
  });

  it('runs an onFeatureFlags callback immediately', () => {
    const callback = vi.fn();
    onFeatureFlags(callback);
    expect(callback).toHaveBeenCalledTimes(1);
  });

  it('starts no polling interval', () => {
    vi.useFakeTimers();
    try {
      initializeAnalytics();
      expect(vi.getTimerCount()).toBe(0);
    } finally {
      vi.useRealTimers();
    }
  });
});
