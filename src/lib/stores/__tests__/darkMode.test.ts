/**
 * The dark-mode store owns three pieces of state that must agree: the svelte
 * store value, the `dark` class on `<html>` (what Tailwind reads), and the
 * `theme-color` meta tag (what the PWA status bar reads). Every test here
 * asserts all three together, because the bug this store can actually have is
 * one of them drifting from the others.
 *
 * The store is a module-level singleton that reads `localStorage` at import
 * time, so each test loads a fresh copy of the module — otherwise the first
 * test's persisted preference decides the second test's initial value.
 *
 * STUB: `window.matchMedia`, which jsdom does not implement at all (the store
 * throws on import without it). The stand-in is a real listener registry whose
 * `change` event this file fires by hand — which is what makes the
 * system-preference paths testable. What it cannot show is that the browser
 * actually re-evaluates the query when the OS theme changes, or that the
 * status bar recolours; those are platform facts for the e2e/device layer.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { get } from 'svelte/store';

type ChangeListener = (event: MediaQueryListEvent) => void;

interface MatchMediaStub {
  /** Flip the OS preference and notify every registered listener. */
  emit(matches: boolean): void;
  /** Listeners currently attached — a non-empty list after teardown is a leak. */
  listeners(): ChangeListener[];
  queries: string[];
}

function stubMatchMedia(initialMatches: boolean): MatchMediaStub {
  const listeners: ChangeListener[] = [];
  const queries: string[] = [];
  let matches = initialMatches;

  const list = {
    get matches() {
      return matches;
    },
    media: '(prefers-color-scheme: dark)',
    addEventListener: (type: string, listener: ChangeListener) => {
      if (type === 'change') listeners.push(listener);
    },
    removeEventListener: (type: string, listener: ChangeListener) => {
      if (type !== 'change') return;
      const index = listeners.indexOf(listener);
      if (index >= 0) listeners.splice(index, 1);
    },
    // The deprecated pair, present so the store could use either.
    addListener: () => {},
    removeListener: () => {},
    dispatchEvent: () => true,
    onchange: null
  };

  (window as unknown as { matchMedia: unknown }).matchMedia = (query: string) => {
    queries.push(query);
    return list;
  };

  return {
    emit(next: boolean) {
      matches = next;
      for (const listener of [...listeners]) {
        listener({ matches: next } as MediaQueryListEvent);
      }
    },
    listeners: () => listeners,
    queries
  };
}

/** A fresh copy of the singleton, so module-load-time state is per test. */
async function loadStore() {
  vi.resetModules();
  return (await import('$lib/stores/darkMode')).darkModeStore;
}

const themeColor = () =>
  document.querySelector('meta[name="theme-color"]:not([media])')?.getAttribute('content');

const isDarkClassOn = () => document.documentElement.classList.contains('dark');

const DARK = '#111827';
const LIGHT = '#ffffff';

beforeEach(() => {
  localStorage.clear();
  document.documentElement.classList.remove('dark');
  document.head.querySelectorAll('meta[name="theme-color"]').forEach((el) => el.remove());
});

afterEach(() => {
  delete (window as unknown as { matchMedia?: unknown }).matchMedia;
  localStorage.clear();
  document.documentElement.classList.remove('dark');
  document.head.querySelectorAll('meta[name="theme-color"]').forEach((el) => el.remove());
});

describe('initial value', () => {
  it('honours a saved "true" over the system preference', async () => {
    stubMatchMedia(false);
    localStorage.setItem('darkMode', 'true');
    const store = await loadStore();
    expect(get(store).isDarkMode).toBe(true);
  });

  it('honours a saved "false" over a dark system preference', async () => {
    stubMatchMedia(true);
    localStorage.setItem('darkMode', 'false');
    const store = await loadStore();
    expect(get(store).isDarkMode).toBe(false);
  });

  it('falls back to the system preference when nothing was saved', async () => {
    const media = stubMatchMedia(true);
    const store = await loadStore();
    expect(get(store).isDarkMode).toBe(true);
    expect(media.queries).toContain('(prefers-color-scheme: dark)');
  });

  it('treats any other saved value as light, not as truthy', async () => {
    stubMatchMedia(true);
    localStorage.setItem('darkMode', 'yes');
    const store = await loadStore();
    expect(get(store).isDarkMode).toBe(false);
  });
});

describe('initializeTheme', () => {
  it('applies a saved dark preference to the store, the html class and the meta tag', async () => {
    stubMatchMedia(false);
    localStorage.setItem('darkMode', 'true');
    const store = await loadStore();

    store.initializeTheme();

    expect(get(store).isDarkMode).toBe(true);
    expect(isDarkClassOn()).toBe(true);
    expect(themeColor()).toBe(DARK);
  });

  it('removes a stale dark class when the saved preference is light', async () => {
    stubMatchMedia(true);
    localStorage.setItem('darkMode', 'false');
    document.documentElement.classList.add('dark');
    const store = await loadStore();

    store.initializeTheme();

    expect(isDarkClassOn()).toBe(false);
    expect(themeColor()).toBe(LIGHT);
  });

  it('creates the theme-color meta tag when the document has none', async () => {
    stubMatchMedia(true);
    const store = await loadStore();

    expect(document.querySelector('meta[name="theme-color"]')).toBeNull();
    store.initializeTheme();
    expect(document.querySelectorAll('meta[name="theme-color"]')).toHaveLength(1);
    expect(themeColor()).toBe(DARK);
  });

  it('updates the existing tag instead of adding a second one', async () => {
    stubMatchMedia(true);
    const existing = document.createElement('meta');
    existing.name = 'theme-color';
    existing.content = LIGHT;
    document.head.appendChild(existing);

    const store = await loadStore();
    store.initializeTheme();

    expect(document.querySelectorAll('meta[name="theme-color"]')).toHaveLength(1);
    expect(existing.getAttribute('content')).toBe(DARK);
  });

  it('ignores a media-scoped theme-color tag, which belongs to the browser UI', async () => {
    stubMatchMedia(false);
    const scoped = document.createElement('meta');
    scoped.name = 'theme-color';
    scoped.setAttribute('media', '(prefers-color-scheme: dark)');
    scoped.content = DARK;
    document.head.appendChild(scoped);

    const store = await loadStore();
    store.initializeTheme();

    // The scoped tag is untouched; an unscoped one is created alongside it.
    expect(scoped.getAttribute('content')).toBe(DARK);
    expect(themeColor()).toBe(LIGHT);
  });

  it('follows the system when there is no saved preference', async () => {
    const media = stubMatchMedia(false);
    const store = await loadStore();
    store.initializeTheme();
    expect(get(store).isDarkMode).toBe(false);

    media.emit(true);

    expect(get(store).isDarkMode).toBe(true);
    expect(isDarkClassOn()).toBe(true);
    expect(themeColor()).toBe(DARK);

    media.emit(false);
    expect(get(store).isDarkMode).toBe(false);
    expect(isDarkClassOn()).toBe(false);
    expect(themeColor()).toBe(LIGHT);
  });

  it('does not follow the system once a preference has been saved', async () => {
    const media = stubMatchMedia(false);
    localStorage.setItem('darkMode', 'false');
    const store = await loadStore();
    store.initializeTheme();

    expect(media.listeners()).toHaveLength(0);
    media.emit(true);
    expect(get(store).isDarkMode).toBe(false);
  });
});

describe('toggleDarkMode', () => {
  it('flips the value and persists the new one', async () => {
    stubMatchMedia(false);
    const store = await loadStore();

    store.toggleDarkMode();
    expect(get(store).isDarkMode).toBe(true);
    expect(localStorage.getItem('darkMode')).toBe('true');
    expect(isDarkClassOn()).toBe(true);
    expect(themeColor()).toBe(DARK);

    store.toggleDarkMode();
    expect(get(store).isDarkMode).toBe(false);
    expect(localStorage.getItem('darkMode')).toBe('false');
    expect(isDarkClassOn()).toBe(false);
    expect(themeColor()).toBe(LIGHT);
  });

  it('notifies subscribers exactly once per toggle', async () => {
    stubMatchMedia(false);
    const store = await loadStore();
    const seen: boolean[] = [];
    const unsubscribe = store.subscribe((state) => seen.push(state.isDarkMode));

    store.toggleDarkMode();
    store.toggleDarkMode();
    unsubscribe();

    // The first entry is the subscribe-time value.
    expect(seen).toEqual([false, true, false]);
  });
});

describe('setDarkMode', () => {
  it('sets, persists and applies an explicit choice', async () => {
    stubMatchMedia(false);
    const store = await loadStore();

    store.setDarkMode(true);
    expect(get(store).isDarkMode).toBe(true);
    expect(localStorage.getItem('darkMode')).toBe('true');
    expect(isDarkClassOn()).toBe(true);

    store.setDarkMode(false);
    expect(localStorage.getItem('darkMode')).toBe('false');
    expect(isDarkClassOn()).toBe(false);
    expect(themeColor()).toBe(LIGHT);
  });

  it('is idempotent', async () => {
    stubMatchMedia(false);
    const store = await loadStore();
    store.setDarkMode(true);
    store.setDarkMode(true);
    expect(get(store).isDarkMode).toBe(true);
    expect(document.querySelectorAll('meta[name="theme-color"]')).toHaveLength(1);
  });
});

describe('useSystemTheme', () => {
  it('drops the saved preference and adopts the current system value', async () => {
    const media = stubMatchMedia(true);
    localStorage.setItem('darkMode', 'false');
    const store = await loadStore();
    store.initializeTheme();
    expect(get(store).isDarkMode).toBe(false);

    store.useSystemTheme();

    expect(localStorage.getItem('darkMode')).toBeNull();
    expect(get(store).isDarkMode).toBe(true);
    expect(isDarkClassOn()).toBe(true);
    expect(themeColor()).toBe(DARK);
  });

  it('keeps following the system afterwards', async () => {
    const media = stubMatchMedia(false);
    localStorage.setItem('darkMode', 'true');
    const store = await loadStore();
    store.useSystemTheme();

    media.emit(true);
    expect(get(store).isDarkMode).toBe(true);
    expect(isDarkClassOn()).toBe(true);

    media.emit(false);
    expect(get(store).isDarkMode).toBe(false);
    expect(isDarkClassOn()).toBe(false);
    expect(themeColor()).toBe(LIGHT);
  });

  it('replaces its listener rather than stacking one per call', async () => {
    // Teardown, such as it is: the store removes the previous change listener
    // before adding the next, so repeatedly opening the theme menu cannot leave
    // N handlers each writing the same class.
    const media = stubMatchMedia(false);
    const store = await loadStore();

    store.useSystemTheme();
    store.useSystemTheme();
    store.useSystemTheme();

    expect(media.listeners()).toHaveLength(1);
  });

  /*
   * The listener `initializeTheme()` registers when no preference is saved
   * used to outlive the choice that replaced it: nothing removed it, so the
   * next OS change wrote the `dark` class back over whatever the user had
   * explicitly picked. Every explicit choice now detaches it — and going back
   * to "system" reattaches it.
   */
  it('stops following the system once the user picks a theme explicitly', async () => {
    const media = stubMatchMedia(false);
    const store = await loadStore();
    store.initializeTheme();

    store.setDarkMode(false);
    media.emit(true);

    expect(get(store).isDarkMode).toBe(false);
  });

  it('detaches the system listener on an explicit choice', async () => {
    const media = stubMatchMedia(false);
    const store = await loadStore();
    store.initializeTheme();
    expect(media.listeners()).toHaveLength(1);

    store.setDarkMode(false);

    expect(media.listeners()).toHaveLength(0);
    // The class and the meta tag stay where the choice put them.
    expect(isDarkClassOn()).toBe(false);
    expect(themeColor()).toBe(LIGHT);
  });

  it('detaches it for a toggle too, not just setDarkMode', async () => {
    const media = stubMatchMedia(false);
    const store = await loadStore();
    store.initializeTheme();

    store.toggleDarkMode();

    expect(get(store).isDarkMode).toBe(true);
    expect(media.listeners()).toHaveLength(0);

    media.emit(false);
    expect(get(store).isDarkMode).toBe(true);
    expect(isDarkClassOn()).toBe(true);
  });

  it('follows the system again when the user goes back to system', async () => {
    const media = stubMatchMedia(false);
    const store = await loadStore();
    store.initializeTheme();

    store.setDarkMode(true);
    expect(media.listeners()).toHaveLength(0);

    store.useSystemTheme();

    expect(media.listeners()).toHaveLength(1);
    expect(get(store).isDarkMode).toBe(false);

    media.emit(true);
    expect(get(store).isDarkMode).toBe(true);
    expect(isDarkClassOn()).toBe(true);
    expect(themeColor()).toBe(DARK);
  });

  it('attaches no listener at all when initialising over a saved preference', async () => {
    const media = stubMatchMedia(true);
    localStorage.setItem('darkMode', 'false');
    const store = await loadStore();

    store.initializeTheme();

    expect(media.listeners()).toHaveLength(0);
    media.emit(true);
    expect(get(store).isDarkMode).toBe(false);
  });

  it('exposes a teardown that detaches the system listener', async () => {
    const media = stubMatchMedia(false);
    const store = await loadStore();
    store.initializeTheme();
    expect(media.listeners()).toHaveLength(1);

    store.dispose();

    expect(media.listeners()).toHaveLength(0);
  });
});

describe('the raw store contract', () => {
  it('exposes set and update for callers that bypass the helpers', async () => {
    stubMatchMedia(false);
    const store = await loadStore();

    store.set({ isDarkMode: true });
    expect(get(store).isDarkMode).toBe(true);
    // A bare `set` deliberately does not persist — only the helpers do.
    expect(localStorage.getItem('darkMode')).toBeNull();

    store.update((state) => ({ isDarkMode: !state.isDarkMode }));
    expect(get(store).isDarkMode).toBe(false);
  });
});
