/**
 * The swipe-back handler exists to make iOS' edge-swipe and the browser back
 * button land on a page that looks the way the user left it: same scroll
 * offset, same half-filled form. It does that by snapshotting state on the way
 * out (pagehide / scroll / visibilitychange) and replaying it on the way back
 * in (pageshow / popstate).
 *
 * What jsdom can and cannot show:
 *   - It can show the whole state machine, because every input is a DOM event
 *     this file can dispatch and every output is a `sessionStorage` write, a
 *     `scrollTo` call or a `CustomEvent`.
 *   - It cannot show a bfcache restore. jsdom has no back/forward cache and no
 *     real navigation, so `pageshow.persisted` is only ever what a test sets.
 *     Whether Safari actually persists the page — the thing this module was
 *     written for — is a device fact and belongs in the Playwright mobile
 *     suite.
 *
 * STUBS: `window.scrollTo` (jsdom's throws "Not implemented" into the console
 * and scrolls nothing) and `window.scrollY` (jsdom performs no layout, so it is
 * permanently 0). Between them, the scroll *position* is fiction here — what is
 * asserted is that the recorded number is the number handed back to the
 * browser, not that anything moved.
 *
 * The module is a singleton that attaches its listeners at import time and
 * never detaches them (see the leak noted at the bottom), so it is imported
 * once for the whole file; isolation comes from giving each test its own
 * pathname instead of its own module instance.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { swipeNavigation, useSwipeNavigation } from '$lib/utils/swipe-navigation';

let scrollTo: ReturnType<typeof vi.fn>;
let originalScrollTo: typeof window.scrollTo;
let warnSpy: ReturnType<typeof vi.spyOn>;

/** Give the test its own pathname, so the handler's per-path state cannot bleed. */
let pathCounter = 0;
function ownPath(search = ''): string {
  const path = `/test-${++pathCounter}`;
  window.history.replaceState({}, '', path + search);
  return path;
}

function setScrollY(value: number): void {
  Object.defineProperty(window, 'scrollY', { configurable: true, value });
}

function pageEvent(type: 'pagehide' | 'pageshow', persisted: boolean): Event {
  const event = new Event(type);
  Object.defineProperty(event, 'persisted', { value: persisted });
  return event;
}

function storedState(path: string): Record<string, unknown> | null {
  const raw = sessionStorage.getItem(`nav_state_${path}`);
  return raw ? JSON.parse(raw) : null;
}

beforeEach(() => {
  vi.useFakeTimers();
  sessionStorage.clear();
  document.body.innerHTML = '';
  setScrollY(0);
  originalScrollTo = window.scrollTo;
  scrollTo = vi.fn();
  window.scrollTo = scrollTo as unknown as typeof window.scrollTo;
  warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
});

afterEach(() => {
  vi.runOnlyPendingTimers();
  vi.useRealTimers();
  window.scrollTo = originalScrollTo;
  warnSpy.mockRestore();
  sessionStorage.clear();
  document.body.innerHTML = '';
  window.history.replaceState({}, '', '/');
});

describe('saving state', () => {
  it('snapshots the scroll offset, the url and a timestamp', () => {
    const path = ownPath();
    setScrollY(420);
    vi.setSystemTime(new Date('2026-01-01T00:00:00Z'));

    swipeNavigation.saveState();

    expect(storedState(path)).toEqual({
      scrollPosition: 420,
      timestamp: Date.parse('2026-01-01T00:00:00Z'),
      url: window.location.href
    });
  });

  it('keys the snapshot by pathname, not by full url', () => {
    const path = ownPath('?page=2');
    swipeNavigation.saveState();

    expect(sessionStorage.getItem(`nav_state_${path}`)).not.toBeNull();
    expect(storedState(path)!.url).toContain('?page=2');
  });

  it('captures what the user had typed into a form', () => {
    const path = ownPath();
    document.body.innerHTML = `
      <form><input name="query" value="frieren" /><input name="year" value="2025" /></form>
    `;

    swipeNavigation.saveState();

    expect(storedState(path)!.formData).toEqual({
      form_0: { query: 'frieren', year: '2025' }
    });
  });

  it('records nothing for a form with no named, filled fields', () => {
    const path = ownPath();
    document.body.innerHTML = '<form><button type="submit">Go</button></form>';

    swipeNavigation.saveState();

    expect(storedState(path)).not.toHaveProperty('formData');
  });

  it('numbers several forms so they can be matched back up on restore', () => {
    const path = ownPath();
    document.body.innerHTML = `
      <form><input name="a" value="1" /></form>
      <form><input name="b" value="2" /></form>
    `;

    swipeNavigation.saveState();

    expect(storedState(path)!.formData).toEqual({
      form_0: { a: '1' },
      form_1: { b: '2' }
    });
  });

  it('survives a sessionStorage that refuses to write', () => {
    ownPath();
    const setItem = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('QuotaExceededError');
    });

    try {
      expect(() => swipeNavigation.saveState()).not.toThrow();
    } finally {
      setItem.mockRestore();
    }
  });
});

describe('the listeners it attaches', () => {
  it('debounces scroll into a single save 100ms after the last one', () => {
    const path = ownPath();
    setScrollY(100);

    window.dispatchEvent(new Event('scroll'));
    vi.advanceTimersByTime(90);
    expect(storedState(path)).toBeNull();

    setScrollY(300);
    window.dispatchEvent(new Event('scroll'));
    vi.advanceTimersByTime(90);
    expect(storedState(path)).toBeNull();

    vi.advanceTimersByTime(10);
    expect(storedState(path)!.scrollPosition).toBe(300);
  });

  it('saves when the tab is hidden, and not when it is shown', () => {
    const path = ownPath();
    const hidden = vi.spyOn(document, 'hidden', 'get').mockReturnValue(false);

    try {
      document.dispatchEvent(new Event('visibilitychange'));
      expect(storedState(path)).toBeNull();

      hidden.mockReturnValue(true);
      setScrollY(88);
      document.dispatchEvent(new Event('visibilitychange'));
      expect(storedState(path)!.scrollPosition).toBe(88);
    } finally {
      hidden.mockRestore();
    }
  });

  it('saves on pagehide and marks the page when the browser persisted it', () => {
    const path = ownPath();
    setScrollY(64);

    window.dispatchEvent(pageEvent('pagehide', true));

    expect(storedState(path)!.scrollPosition).toBe(64);
    expect(sessionStorage.getItem('bfcache-persisted')).toBe('true');
  });

  it('saves on pagehide without the marker when the page was discarded', () => {
    const path = ownPath();

    window.dispatchEvent(pageEvent('pagehide', false));

    expect(storedState(path)).not.toBeNull();
    expect(sessionStorage.getItem('bfcache-persisted')).toBeNull();
  });
});

describe('restoring state', () => {
  it('scrolls back and announces the restore after a pageshow from cache', () => {
    const path = ownPath();
    setScrollY(540);
    swipeNavigation.saveState();
    setScrollY(0);

    const restored = vi.fn();
    window.addEventListener('swipe-navigation-restored', restored);

    try {
      window.dispatchEvent(pageEvent('pageshow', true));
      // The restore is deferred so the DOM is ready first.
      expect(scrollTo).not.toHaveBeenCalled();
      expect(swipeNavigation.isRestoring()).toBe(true);

      vi.runAllTimers();

      expect(scrollTo).toHaveBeenCalledWith({ top: 540, behavior: 'instant' });
      expect(swipeNavigation.isRestoring()).toBe(false);
      expect((restored.mock.calls[0][0] as CustomEvent).detail).toEqual({ fromCache: true });
      expect(sessionStorage.getItem('bfcache-persisted')).toBeNull();
    } finally {
      window.removeEventListener('swipe-navigation-restored', restored);
    }
  });

  it('also restores when only the sessionStorage marker says it was persisted', () => {
    const path = ownPath();
    setScrollY(210);
    swipeNavigation.saveState();
    sessionStorage.setItem('bfcache-persisted', 'true');

    window.dispatchEvent(pageEvent('pageshow', false));
    vi.runAllTimers();

    expect(scrollTo).toHaveBeenCalledWith({ top: 210, behavior: 'instant' });
    expect(sessionStorage.getItem(`nav_state_${path}`)).not.toBeNull();
  });

  it('does nothing on an ordinary first load', () => {
    ownPath();
    const restored = vi.fn();
    window.addEventListener('swipe-navigation-restored', restored);

    try {
      window.dispatchEvent(pageEvent('pageshow', false));
      vi.runAllTimers();
      expect(scrollTo).not.toHaveBeenCalled();
      expect(restored).not.toHaveBeenCalled();
    } finally {
      window.removeEventListener('swipe-navigation-restored', restored);
    }
  });

  it('restores on popstate and passes the history state along', () => {
    const path = ownPath();
    setScrollY(75);
    swipeNavigation.saveState();

    const restored = vi.fn();
    window.addEventListener('swipe-navigation-restored', restored);

    try {
      window.dispatchEvent(new PopStateEvent('popstate', { state: { page: 3 } }));
      vi.runAllTimers();

      expect(scrollTo).toHaveBeenCalledWith({ top: 75, behavior: 'instant' });
      expect((restored.mock.calls[0][0] as CustomEvent).detail).toEqual({
        fromPopstate: true,
        state: { page: 3 }
      });
    } finally {
      window.removeEventListener('swipe-navigation-restored', restored);
    }
  });

  it('falls back to sessionStorage for a path this instance never saved', () => {
    // The real case: a full reload wiped the in-memory Map but not the tab's
    // sessionStorage.
    const path = ownPath();
    sessionStorage.setItem(
      `nav_state_${path}`,
      JSON.stringify({ scrollPosition: 999, timestamp: Date.now(), url: window.location.href })
    );

    window.dispatchEvent(new PopStateEvent('popstate', { state: null }));
    vi.runAllTimers();

    expect(scrollTo).toHaveBeenCalledWith({ top: 999, behavior: 'instant' });
  });

  it('ignores a corrupted sessionStorage entry instead of throwing', () => {
    const path = ownPath();
    sessionStorage.setItem(`nav_state_${path}`, '{not json');

    expect(() => {
      window.dispatchEvent(new PopStateEvent('popstate', { state: null }));
      vi.runAllTimers();
    }).not.toThrow();
    expect(scrollTo).not.toHaveBeenCalled();
    expect(warnSpy).toHaveBeenCalled();
  });

  it('does not scroll for a snapshot with no scroll position', () => {
    const path = ownPath();
    sessionStorage.setItem(
      `nav_state_${path}`,
      JSON.stringify({ timestamp: Date.now(), url: window.location.href })
    );

    window.dispatchEvent(new PopStateEvent('popstate', { state: null }));
    vi.runAllTimers();

    expect(scrollTo).not.toHaveBeenCalled();
  });

  it('puts the typed form values back', () => {
    const path = ownPath();
    document.body.innerHTML = `
      <form><input name="query" value="frieren" /></form>
      <form><input name="note" value="kept" /></form>
    `;
    swipeNavigation.saveState();

    (document.forms[0].querySelector('[name="query"]') as HTMLInputElement).value = '';
    (document.forms[1].querySelector('[name="note"]') as HTMLInputElement).value = '';

    window.dispatchEvent(new PopStateEvent('popstate', { state: null }));
    vi.runAllTimers();

    expect((document.forms[0].querySelector('[name="query"]') as HTMLInputElement).value).toBe(
      'frieren'
    );
    expect((document.forms[1].querySelector('[name="note"]') as HTMLInputElement).value).toBe(
      'kept'
    );
  });

  it('skips form data whose form or field is no longer on the page', () => {
    const path = ownPath();
    sessionStorage.setItem(
      `nav_state_${path}`,
      JSON.stringify({
        scrollPosition: 0,
        timestamp: Date.now(),
        url: window.location.href,
        formData: { form_0: { gone: 'x' }, form_5: { alsoGone: 'y' } }
      })
    );
    document.body.innerHTML = '<form><input name="present" value="" /></form>';

    expect(() => {
      window.dispatchEvent(new PopStateEvent('popstate', { state: null }));
      vi.runAllTimers();
    }).not.toThrow();
    expect((document.forms[0].querySelector('[name="present"]') as HTMLInputElement).value).toBe('');
  });
});

describe('cleanupOldStates', () => {
  it('drops snapshots older than the max age, from memory and from sessionStorage', () => {
    const path = ownPath();
    vi.setSystemTime(new Date('2026-01-01T00:00:00Z'));
    swipeNavigation.saveState();
    expect(sessionStorage.getItem(`nav_state_${path}`)).not.toBeNull();

    vi.setSystemTime(new Date('2026-01-01T01:00:00Z'));
    swipeNavigation.cleanupOldStates();

    expect(sessionStorage.getItem(`nav_state_${path}`)).toBeNull();
  });

  it('keeps snapshots inside the window', () => {
    const path = ownPath();
    vi.setSystemTime(new Date('2026-01-01T00:00:00Z'));
    swipeNavigation.saveState();

    vi.setSystemTime(new Date('2026-01-01T00:05:00Z'));
    swipeNavigation.cleanupOldStates();

    expect(sessionStorage.getItem(`nav_state_${path}`)).not.toBeNull();
  });

  it('honours a custom max age', () => {
    const path = ownPath();
    vi.setSystemTime(new Date('2026-01-01T00:00:00Z'));
    swipeNavigation.saveState();

    vi.setSystemTime(new Date('2026-01-01T00:00:10Z'));
    swipeNavigation.cleanupOldStates(5_000);

    expect(sessionStorage.getItem(`nav_state_${path}`)).toBeNull();
  });
});

describe('useSwipeNavigation', () => {
  it('exposes the singleton’s state and save hook', () => {
    const path = ownPath();
    const api = useSwipeNavigation();

    expect(api.isRestoring()).toBe(false);
    api.saveState();
    expect(sessionStorage.getItem(`nav_state_${path}`)).not.toBeNull();
  });

  it('hands back an unsubscribe that really removes the listener', () => {
    // The teardown that matters: a component that mounts and unmounts on every
    // route change must not leave a handler behind per visit.
    ownPath();
    const callback = vi.fn();
    const off = useSwipeNavigation().onRestored(callback);

    window.dispatchEvent(
      new CustomEvent('swipe-navigation-restored', { detail: { fromCache: true } })
    );
    expect(callback).toHaveBeenCalledWith({ fromCache: true });

    off();
    window.dispatchEvent(
      new CustomEvent('swipe-navigation-restored', { detail: { fromCache: true } })
    );
    expect(callback).toHaveBeenCalledTimes(1);
  });
});

/*
 * LEAK (reported, not worked around): `SwipeNavigationHandler` attaches five
 * listeners in its constructor — pagehide, pageshow, popstate and scroll on
 * `window`, visibilitychange on `document` — and exposes no way to remove any
 * of them. The `scroll` handler in particular also owns a `setTimeout` that is
 * only ever cleared by the next scroll. In the app the singleton is created
 * once and lives as long as the document, so this is a bounded leak rather than
 * a growing one; it is called out because "the module removes what it adds" is
 * otherwise the rule in this codebase, and because it is why this suite imports
 * the module exactly once instead of resetting it per test.
 */
