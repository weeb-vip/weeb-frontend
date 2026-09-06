/**
 * @vitest-environment node
 *
 * The dark-mode store is imported by components that SvelteKit renders on the
 * server, where there is no `localStorage` to read a preference from and no
 * `matchMedia` to ask about the system theme. Its initial value on the server
 * therefore has to be a definite light — the same answer the server-rendered
 * HTML is built from — and every mutator has to be inert rather than throwing.
 *
 * jsdom would supply a window (and this file's sibling suite has to stub
 * `matchMedia` because of it), so the no-window branch is only reachable here.
 */
import { describe, expect, it } from 'vitest';
import { get } from 'svelte/store';
import { darkModeStore } from '$lib/stores/darkMode';

describe('darkModeStore without a DOM', () => {
  it('starts light, because there is nothing to ask', () => {
    expect(typeof window).toBe('undefined');
    expect(get(darkModeStore).isDarkMode).toBe(false);
  });

  it('initializeTheme is a no-op instead of touching document.documentElement', () => {
    expect(() => darkModeStore.initializeTheme()).not.toThrow();
    expect(get(darkModeStore).isDarkMode).toBe(false);
  });

  it('useSystemTheme is a no-op with no media query to consult', () => {
    expect(() => darkModeStore.useSystemTheme()).not.toThrow();
    expect(get(darkModeStore).isDarkMode).toBe(false);
  });

  it('toggling still moves the store value, it just persists nothing', () => {
    // Worth pinning: the value has to keep working so a component rendering on
    // the server reads a coherent state, even though nothing is written.
    darkModeStore.toggleDarkMode();
    expect(get(darkModeStore).isDarkMode).toBe(true);

    darkModeStore.setDarkMode(false);
    expect(get(darkModeStore).isDarkMode).toBe(false);
  });
});
