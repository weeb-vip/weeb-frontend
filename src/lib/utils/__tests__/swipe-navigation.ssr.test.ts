/**
 * @vitest-environment node
 *
 * The swipe-navigation singleton is constructed at import time, and the module
 * is reachable from code that SvelteKit renders on the server. Constructing it
 * without a `window` must therefore attach nothing and throw nothing — under
 * the default jsdom environment that guard is invisible, because there is
 * always a window to attach to.
 */
import { describe, expect, it } from 'vitest';
import { swipeNavigation } from '$lib/utils/swipe-navigation';

describe('swipe navigation without a DOM', () => {
  it('imports and constructs the singleton with no window to bind to', () => {
    expect(typeof window).toBe('undefined');
    expect(swipeNavigation).toBeDefined();
  });

  it('saves nothing, because there is no scroll position or sessionStorage', () => {
    expect(() => swipeNavigation.saveState()).not.toThrow();
  });

  it('is not restoring', () => {
    expect(swipeNavigation.isRestoring()).toBe(false);
  });

  it('cleans up an empty state map without reaching for sessionStorage', () => {
    expect(() => swipeNavigation.cleanupOldStates()).not.toThrow();
  });
});
