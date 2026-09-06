/**
 * `global-ui` is the app's browser glue: the navigation progress bar, the
 * last-resort error toast (including the DOM one it hand-builds when the toast
 * library has not loaded yet), and the PostHog bootstrap. It is all side
 * effects on `window` and `document`, so the guarantees worth testing are the
 * ones a user would notice breaking:
 *
 *   1. every timer and every listener it starts is stopped again;
 *   2. an error that mentions being logged out offers a way to log in, and an
 *      error that does not, does not;
 *   3. a message is inserted as *text*, never as markup;
 *   4. PostHog is only ever bootstrapped once config exists, and the polling
 *      that waits for it gives up.
 *
 * What jsdom cannot show, and is therefore not asserted:
 *   - The progress bar's appearance. jsdom does no layout and runs no CSS
 *     transitions, so `width: 60%` is a string on a style object, not a bar
 *     that moved. Whether the animation reads as progress belongs to the
 *     Playwright/visual layer.
 *   - Real navigation. `showInstantFeedback`/`hideNavigationFeedback` are
 *     called from SvelteKit's beforeNavigate/afterNavigate; here they are
 *     called directly.
 *   - PostHog actually loading. `svelte-sonner` is mocked and the injected
 *     `array.js` script is never fetched (jsdom loads no external resources),
 *     so what is asserted is the bootstrap contract — the queued `_i` entry,
 *     the registered super-property — not that any event reached PostHog.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  hideNavigationFeedback,
  initGlobalErrorHandlers,
  initPostHogWhenConfigured,
  showInstantFeedback
} from '$lib/client/global-ui';

vi.mock('svelte-sonner', () => ({
  toast: { error: vi.fn(), info: vi.fn(), success: vi.fn() }
}));

/**
 * Everything this module touches, it touches through `window`, and several of
 * those globals are declared elsewhere with narrower app types (`posthog`,
 * `loginModalStore`). The tests deliberately supply partial stand-ins, so the
 * window is addressed as a plain bag here rather than through those types.
 */
const w = window as unknown as Record<string, any>;

/** Keys the module writes onto `window`; wiped between tests. */
const WINDOW_KEYS = [
  'globalToast',
  'toast',
  'sonner',
  'loggedInStoreValue',
  'loginModalStore',
  'showErrorToast',
  'testErrorToast',
  'testAuthErrorToast',
  'config',
  'posthog',
  'disablePostHogToolbar'
];

/**
 * `initGlobalErrorHandlers` attaches window listeners and offers no way to
 * remove them (see the note at the foot of this file). Capturing them through a
 * spy is what lets each test start from a clean window instead of accumulating
 * a handler per test — and doubles as the assertion that it registers exactly
 * what it claims to.
 */
function initHandlers(): { detach: () => void; registered: string[] } {
  const captured: Array<[string, EventListenerOrEventListenerObject, unknown]> = [];
  const spy = vi.spyOn(window, 'addEventListener');
  initGlobalErrorHandlers();
  for (const call of spy.mock.calls) {
    captured.push([call[0] as string, call[1] as EventListenerOrEventListenerObject, call[2]]);
  }
  spy.mockRestore();

  return {
    registered: captured.map(([type]) => type),
    detach: () => {
      for (const [type, handler, options] of captured) {
        window.removeEventListener(type, handler, options as boolean | EventListenerOptions);
      }
    }
  };
}

function rejectionEvent(reason: unknown): Event {
  const event = new Event('unhandledrejection');
  Object.defineProperty(event, 'reason', { value: reason });
  return event;
}

let detachHandlers: (() => void) | null = null;
let consoleSpies: ReturnType<typeof vi.spyOn>[] = [];

beforeEach(() => {
  vi.useFakeTimers();
  document.body.innerHTML = '';
  document.documentElement.style.scrollBehavior = '';
  document.body.style.cursor = '';
  localStorage.clear();
  for (const key of WINDOW_KEYS) delete w[key];
  consoleSpies = [
    vi.spyOn(console, 'log').mockImplementation(() => {}),
    vi.spyOn(console, 'warn').mockImplementation(() => {}),
    vi.spyOn(console, 'error').mockImplementation(() => {})
  ];
});

afterEach(() => {
  hideNavigationFeedback();
  detachHandlers?.();
  detachHandlers = null;
  vi.clearAllTimers();
  vi.useRealTimers();
  for (const spy of consoleSpies) spy.mockRestore();
  for (const key of WINDOW_KEYS) delete w[key];
  document.body.innerHTML = '';
  localStorage.clear();
});

function progressBar(): HTMLElement {
  const bar = document.createElement('div');
  bar.id = 'navigation-progress';
  document.body.appendChild(bar);
  return bar;
}

describe('navigation feedback', () => {
  it('shows a wait cursor immediately and the bar only after 100ms', () => {
    const bar = progressBar();

    showInstantFeedback();
    expect(document.body.style.cursor).toBe('wait');
    expect(bar.style.opacity).toBe('');

    vi.advanceTimersByTime(100);
    expect(bar.style.opacity).toBe('1');
    expect(bar.style.transform).toBe('translateY(0)');
    expect(bar.style.width).toBe('0%');
  });

  it('creeps forward but never claims to be finished', () => {
    const bar = progressBar();
    const random = vi.spyOn(Math, 'random').mockReturnValue(0.5); // +7.5% per tick

    try {
      showInstantFeedback();
      vi.advanceTimersByTime(100);
      vi.advanceTimersByTime(100);
      expect(bar.style.width).toBe('7.5%');

      vi.advanceTimersByTime(100 * 20);
      expect(parseFloat(bar.style.width)).toBe(90);
    } finally {
      random.mockRestore();
    }
  });

  it('completes the bar, then hides it, and leaves no timer running', () => {
    const bar = progressBar();

    showInstantFeedback();
    vi.advanceTimersByTime(300);
    hideNavigationFeedback();

    expect(document.body.style.cursor).toBe('');
    expect(bar.style.width).toBe('100%');

    vi.advanceTimersByTime(200);
    expect(bar.style.opacity).toBe('0');
    expect(bar.style.transform).toBe('translateY(-100%)');
    expect(vi.getTimerCount()).toBe(0);
  });

  it('cancels the pending show when navigation finishes inside 100ms', () => {
    // The common case: a cached route resolves instantly, and the bar must not
    // flash on screen at all.
    const bar = progressBar();

    showInstantFeedback();
    hideNavigationFeedback();
    vi.advanceTimersByTime(1000);

    expect(bar.style.opacity).toBe('0');
    expect(vi.getTimerCount()).toBe(0);
  });

  it('starts no interval when the page has no progress bar', () => {
    showInstantFeedback();
    vi.advanceTimersByTime(500);
    expect(() => hideNavigationFeedback()).not.toThrow();
    expect(vi.getTimerCount()).toBe(0);
  });

  it('is safe to hide when nothing was ever shown', () => {
    expect(() => hideNavigationFeedback()).not.toThrow();
    expect(vi.getTimerCount()).toBe(0);
  });

  /*
   * BUG (reported, not worked around): `showInstantFeedback` overwrites
   * `progressTimer`/`progressTimeout` without clearing what is already there.
   * Two navigations that overlap — a user clicking a second link while the
   * first is still loading, which is the ordinary case on a slow connection —
   * leave the first `setInterval` running with nothing holding its handle, so
   * it keeps writing widths to the progress bar forever and no later
   * `hideNavigationFeedback` can stop it. Un-skip once `showInstantFeedback`
   * clears the previous timers first (calling `hideNavigationFeedback()` at the
   * top would do it).
   */
  it.skip('does not stack intervals when navigation is retriggered', () => {
    progressBar();
    showInstantFeedback();
    vi.advanceTimersByTime(150);
    showInstantFeedback();
    vi.advanceTimersByTime(150);

    hideNavigationFeedback();
    vi.advanceTimersByTime(500);
    expect(vi.getTimerCount()).toBe(0);
  });

  it('currently orphans the first interval on a retrigger (documents the bug above)', () => {
    progressBar();
    showInstantFeedback();
    vi.advanceTimersByTime(150);
    showInstantFeedback();
    vi.advanceTimersByTime(150);

    hideNavigationFeedback();
    vi.advanceTimersByTime(500);
    expect(vi.getTimerCount()).toBe(1);
  });
});

describe('initGlobalErrorHandlers', () => {
  it('registers exactly the two window-level error listeners', () => {
    const handlers = initHandlers();
    detachHandlers = handlers.detach;
    expect(handlers.registered).toEqual(['unhandledrejection', 'error']);
  });

  it('exposes the toast helpers and turns on smooth scrolling', () => {
    detachHandlers = initHandlers().detach;
    expect(typeof w.showErrorToast).toBe('function');
    expect(typeof w.testErrorToast).toBe('function');
    expect(typeof w.testAuthErrorToast).toBe('function');
    expect(document.documentElement.style.scrollBehavior).toBe('smooth');
  });

  it('adopts svelte-sonner as the toast api one second in', async () => {
    detachHandlers = initHandlers().detach;
    expect(w.globalToast).toBeUndefined();

    await vi.advanceTimersByTimeAsync(1000);

    expect(w.globalToast).toBeDefined();
    expect(typeof w.globalToast.error).toBe('function');
  });
});

describe('the error toast, when a toast library is present', () => {
  function toastApi() {
    return { error: vi.fn(), info: vi.fn() };
  }

  it('shows a plain error for an ordinary failure', () => {
    const toast = toastApi();
    w.globalToast = toast;
    detachHandlers = initHandlers().detach;

    w.showErrorToast('Something went wrong. Please try again.');

    expect(toast.error).toHaveBeenCalledWith('Something went wrong. Please try again.');
  });

  it('offers Login and then Register for an auth error while logged out', () => {
    const toast = toastApi();
    w.globalToast = toast;
    w.loginModalStore = { openLogin: vi.fn(), openRegister: vi.fn() };
    detachHandlers = initHandlers().detach;

    w.showErrorToast('Please log in to continue.', true);

    expect(toast.error).toHaveBeenCalledWith('Please log in to continue.', {
      action: { label: 'Login', onClick: expect.any(Function) },
      duration: 8000
    });

    // The Register follow-up is deliberately delayed so the two do not stack.
    expect(toast.info).not.toHaveBeenCalled();
    vi.advanceTimersByTime(500);
    expect(toast.info).toHaveBeenCalledWith('Or create a new account', {
      action: { label: 'Register', onClick: expect.any(Function) },
      duration: 8000
    });

    toast.error.mock.calls[0][1].action.onClick();
    toast.info.mock.calls[0][1].action.onClick();
    expect(w.loginModalStore.openLogin).toHaveBeenCalled();
    expect(w.loginModalStore.openRegister).toHaveBeenCalled();
  });

  it('treats a message mentioning "log in" as an auth error even when not flagged', () => {
    const toast = toastApi();
    w.globalToast = toast;
    detachHandlers = initHandlers().detach;

    w.showErrorToast('You need to log in to add anime to your list');

    expect(toast.error.mock.calls[0][1]).toMatchObject({ duration: 8000 });
  });

  it('does not offer Login to someone who is already logged in', () => {
    const toast = toastApi();
    w.globalToast = toast;
    w.loggedInStoreValue = { isLoggedIn: true };
    detachHandlers = initHandlers().detach;

    w.showErrorToast('Please log in to continue.', true);

    expect(toast.error).toHaveBeenCalledWith('Please log in to continue.');
    vi.advanceTimersByTime(500);
    expect(toast.info).not.toHaveBeenCalled();
  });

  it('falls back through window.toast and window.sonner.toast in order', () => {
    const globalToast = toastApi();
    const bare = toastApi();
    const sonner = { toast: toastApi() };

    w.toast = bare;
    w.sonner = sonner;
    detachHandlers = initHandlers().detach;
    w.showErrorToast('via window.toast');
    expect(bare.error).toHaveBeenCalledWith('via window.toast');

    delete w.toast;
    w.showErrorToast('via sonner');
    expect(sonner.toast.error).toHaveBeenCalledWith('via sonner');

    w.globalToast = globalToast;
    w.toast = bare;
    w.showErrorToast('globalToast wins');
    expect(globalToast.error).toHaveBeenCalledWith('globalToast wins');
    expect(bare.error).toHaveBeenCalledTimes(1);
  });

  it('does not build a DOM toast when a library handled it', () => {
    w.globalToast = toastApi();
    detachHandlers = initHandlers().detach;
    w.showErrorToast('handled');
    expect(document.body.children).toHaveLength(0);
  });
});

describe('the error toast, when no toast library has loaded', () => {
  it('builds a notification carrying the message as text, not markup', () => {
    detachHandlers = initHandlers().detach;

    w.showErrorToast('<img src=x onerror="alert(1)"> broke');

    const div = document.body.firstElementChild as HTMLElement;
    expect(div.textContent).toContain('<img src=x onerror="alert(1)"> broke');
    // The message goes through textContent, so no element is ever created from it.
    expect(div.querySelector('img')).toBeNull();
  });

  it('dismisses itself after six seconds', () => {
    detachHandlers = initHandlers().detach;
    w.showErrorToast('gone shortly');

    const div = document.body.firstElementChild as HTMLElement;
    vi.advanceTimersByTime(6000);
    expect(div.style.opacity).toBe('0');

    vi.advanceTimersByTime(300);
    expect(document.body.contains(div)).toBe(false);
    expect(vi.getTimerCount()).toBe(0);
  });

  it('gives the auth variant Login and Register buttons and ten seconds', () => {
    w.loginModalStore = { openLogin: vi.fn(), openRegister: vi.fn() };
    detachHandlers = initHandlers().detach;

    w.showErrorToast('Please log in to continue.', true);
    const div = document.body.firstElementChild as HTMLElement;

    const login = div.querySelector('.fallback-login-btn') as HTMLButtonElement;
    const register = div.querySelector('.fallback-register-btn') as HTMLButtonElement;
    expect(login).not.toBeNull();
    expect(register).not.toBeNull();

    vi.advanceTimersByTime(6000);
    expect(document.body.contains(div)).toBe(true);

    login.click();
    expect(w.loginModalStore.openLogin).toHaveBeenCalled();
    // Clicking a button removes the notification straight away.
    expect(document.body.contains(div)).toBe(false);
  });

  it('the Register button opens the register modal and dismisses', () => {
    w.loginModalStore = { openLogin: vi.fn(), openRegister: vi.fn() };
    detachHandlers = initHandlers().detach;

    w.showErrorToast('Please log in to continue.', true);
    const div = document.body.firstElementChild as HTMLElement;
    (div.querySelector('.fallback-register-btn') as HTMLButtonElement).click();

    expect(w.loginModalStore.openRegister).toHaveBeenCalled();
    expect(document.body.contains(div)).toBe(false);
  });

  it('survives a click when no login modal store is bound', () => {
    detachHandlers = initHandlers().detach;
    w.showErrorToast('Please log in to continue.', true);
    const div = document.body.firstElementChild as HTMLElement;

    expect(() => (div.querySelector('.fallback-login-btn') as HTMLButtonElement).click()).not.toThrow();
  });

  it('does not throw when the notification was already removed by hand', () => {
    detachHandlers = initHandlers().detach;
    w.showErrorToast('removed early');
    document.body.firstElementChild!.remove();

    expect(() => vi.advanceTimersByTime(10000)).not.toThrow();
  });

  it('the built-in test helpers produce the two shapes', () => {
    detachHandlers = initHandlers().detach;

    w.testErrorToast();
    expect(document.body.firstElementChild!.querySelector('.fallback-login-btn')).toBeNull();
    document.body.innerHTML = '';

    w.testAuthErrorToast();
    expect(document.body.firstElementChild!.querySelector('.fallback-login-btn')).not.toBeNull();
  });
});

describe('unhandled promise rejections', () => {
  function toastFor(reason: unknown): { message: string; options?: Record<string, unknown> } {
    const toast = { error: vi.fn(), info: vi.fn() };
    w.globalToast = toast;
    const handlers = initHandlers();
    try {
      window.dispatchEvent(rejectionEvent(reason));
    } finally {
      handlers.detach();
      vi.clearAllTimers();
    }
    return { message: toast.error.mock.calls[0][0], options: toast.error.mock.calls[0][1] };
  }

  it('turns a network failure into connection advice', () => {
    expect(toastFor(new Error('Failed to fetch')).message).toBe(
      'Network error. Please check your connection.'
    );
    expect(toastFor(new Error('NetworkError when attempting to fetch')).message).toBe(
      'Network error. Please check your connection.'
    );
  });

  it('turns every flavour of auth failure into a login prompt', () => {
    for (const reason of [
      'unauthorized',
      'Forbidden',
      'access denied',
      'authentication required',
      'not authenticated',
      'User is not logged in',
      'login required'
    ]) {
      const { message, options } = toastFor(new Error(reason));
      expect(message).toBe('Please log in to continue.');
      expect(options).toMatchObject({ duration: 8000 });
    }
  });

  it('names a missing resource', () => {
    expect(toastFor(new Error('Anime not found')).message).toBe(
      'The requested item was not found.'
    );
  });

  it('passes a short message straight through', () => {
    expect(toastFor(new Error('Rating must be between 1 and 10')).message).toBe(
      'Rating must be between 1 and 10'
    );
  });

  it('replaces a long message with the generic one', () => {
    const long = 'x'.repeat(120);
    expect(toastFor(new Error(long)).message).toBe('Something went wrong. Please try again.');
  });

  it('handles a rejection with a plain string reason', () => {
    expect(toastFor('Session expired').message).toBe('Session expired');
    expect(toastFor('unauthorized request').options).toMatchObject({ duration: 8000 });
    expect(toastFor('y'.repeat(120)).message).toBe('Something went wrong. Please try again.');
  });

  it('handles a rejection with no usable reason at all', () => {
    expect(toastFor(undefined).message).toBe('Something went wrong. Please try again.');
    expect(toastFor({}).message).toBe('Something went wrong. Please try again.');
    expect(toastFor(42).message).toBe('Something went wrong. Please try again.');
  });
});

describe('global error events', () => {
  function errorToastCount(init: ErrorEventInit): number {
    const toast = { error: vi.fn(), info: vi.fn() };
    w.globalToast = toast;
    const handlers = initHandlers();
    try {
      window.dispatchEvent(new ErrorEvent('error', init));
    } finally {
      handlers.detach();
      vi.clearAllTimers();
    }
    return toast.error.mock.calls.length;
  }

  it('stays quiet for the noise a SPA generates constantly', () => {
    // Chunk loading, hydration mismatches and ResizeObserver loops are all
    // things the user can do nothing about.
    expect(errorToastCount({ message: 'Loading chunk 12 failed', filename: '' })).toBe(0);
    expect(errorToastCount({ message: 'ChunkLoadError', filename: '' })).toBe(0);
    expect(errorToastCount({ message: 'Loading CSS chunk 3 failed', filename: '' })).toBe(0);
    expect(
      errorToastCount({ message: 'Failed to fetch dynamically imported module', filename: '' })
    ).toBe(0);
    expect(errorToastCount({ message: 'error while hydrating', filename: '' })).toBe(0);
    expect(
      errorToastCount({ message: 'ResizeObserver loop completed', filename: '' })
    ).toBe(0);
    expect(
      errorToastCount({ message: 'Cannot read properties of null', filename: '' })
    ).toBe(0);
    expect(errorToastCount({ message: 'Network Error', filename: '' })).toBe(0);
  });

  it('stays quiet for anything raised from an app script file', () => {
    expect(errorToastCount({ message: 'boom', filename: 'https://weeb.vip/app.js' })).toBe(0);
    expect(errorToastCount({ message: 'boom', filename: '/src/main.ts' })).toBe(0);
  });

  it('shows one generic toast for an error it cannot classify', () => {
    expect(errorToastCount({ message: 'Script error', filename: '' })).toBe(1);
  });

  it('treats an error with no message or filename as unclassifiable', () => {
    expect(errorToastCount({})).toBe(1);
  });
});

describe('initPostHogWhenConfigured', () => {
  /** The snippet inserts its script before the first one on the page. */
  function seedScriptTag(): HTMLScriptElement {
    const script = document.createElement('script');
    document.head.appendChild(script);
    return script;
  }

  function injectedScript(): HTMLScriptElement | null {
    return document.head.querySelector('script[src*="array.js"]');
  }

  afterEach(() => {
    document.head.querySelectorAll('script').forEach((el) => el.remove());
  });

  it('does nothing while there is no config, and gives up after five seconds', () => {
    initPostHogWhenConfigured();
    vi.advanceTimersByTime(5100);

    expect(w.posthog).toBeUndefined();
    expect(vi.getTimerCount()).toBe(0);
  });

  it('bootstraps as soon as polling sees the config appear', () => {
    seedScriptTag();
    initPostHogWhenConfigured();
    vi.advanceTimersByTime(300);
    expect(w.posthog).toBeUndefined();

    w.config = { posthog_api_key: 'phc_test' };
    vi.advanceTimersByTime(100);

    expect(w.posthog).toBeDefined();
    expect(injectedScript()).not.toBeNull();
  });

  it('bootstraps on the config-loaded event without waiting for the next poll', () => {
    seedScriptTag();
    initPostHogWhenConfigured();

    w.config = { posthog_api_key: 'phc_test' };
    document.dispatchEvent(new Event('config-loaded'));

    expect(w.posthog).toBeDefined();
    vi.clearAllTimers();
  });

  it('bootstraps immediately when config is already there', () => {
    seedScriptTag();
    w.config = { posthog_api_key: 'phc_test', environment: 'staging' };

    initPostHogWhenConfigured();

    const script = injectedScript()!;
    expect(script.src).toBe('https://n.weeb.vip/static/array.js');
    expect(script.async).toBe(true);
    expect(script.crossOrigin).toBe('anonymous');

    // The stub queues init() rather than performing it.
    expect(w.posthog._i[0][0]).toBe('phc_test');
    expect(w.posthog._i[0][1]).toMatchObject({
      api_host: 'https://n.weeb.vip',
      ui_host: 'https://us.posthog.com',
      capture_pageview: true,
      person_profiles: 'identified_only'
    });

    // Every event is tagged with the environment for dashboard filtering.
    expect(w.posthog).toContainEqual(['register', { environment: 'staging' }]);
  });

  it('defaults the environment to production when config omits it', () => {
    seedScriptTag();
    w.config = { posthog_api_key: 'phc_test' };

    initPostHogWhenConfigured();

    expect(w.posthog).toContainEqual(['register', { environment: 'production' }]);
  });

  it('applies the environment as a person property once the real library loads', () => {
    seedScriptTag();
    w.config = { posthog_api_key: 'phc_test', environment: 'staging' };
    initPostHogWhenConfigured();

    // `loaded` is the callback the real array.js invokes; nothing loads here, so
    // it is called by hand against a stand-in library.
    const loaded = w.posthog._i[0][1].loaded;
    const library = { setPersonPropertiesForFlags: vi.fn() };
    loaded(library);

    expect(library.setPersonPropertiesForFlags).toHaveBeenCalledWith({ environment: 'staging' });
  });

  it('does nothing when the config carries no api key', () => {
    seedScriptTag();
    w.config = { environment: 'staging' };

    initPostHogWhenConfigured();

    expect(w.posthog).toBeUndefined();
    expect(injectedScript()).toBeNull();
    vi.clearAllTimers();
  });

  describe('the toolbar', () => {
    /**
     * The bootstrap stub does not define `loadToolbar` (it is not in the
     * snippet's method list), so these tests stand a library in first — which
     * is also what makes the un-stood-in case a bug, see below.
     */
    function seedLibrary(): ReturnType<typeof vi.fn> {
      seedScriptTag();
      // The snippet pushes its queued calls onto whatever is already at
      // `window.posthog`, so the stand-in has to be array-shaped — an object
      // alone makes `register()` throw. The spy is handed back separately
      // because the module *replaces* `w.posthog.loadToolbar` with its own
      // wrapper. Note this arrangement (a `loadToolbar` that exists before the
      // bootstrap) is one the app never actually reaches; that it does not is
      // the bug documented at the end of this block.
      const loadToolbar = vi.fn();
      w.posthog = Object.assign([], { loadToolbar });
      w.config = { posthog_api_key: 'phc_test' };
      return loadToolbar;
    }

    it('remembers that the toolbar was opened', () => {
      const loadToolbar = seedLibrary();
      initPostHogWhenConfigured();

      w.posthog.loadToolbar({ token: 'abc' });

      expect(localStorage.getItem('posthog_toolbar_enabled')).toBe('true');
      expect(localStorage.getItem('posthog_toolbar_params')).toBe('{"token":"abc"}');
      expect(loadToolbar).toHaveBeenCalledWith({ token: 'abc' });
      vi.clearAllTimers();
    });

    it('stores no params when opened without any', () => {
      seedLibrary();
      initPostHogWhenConfigured();

      w.posthog.loadToolbar();

      expect(localStorage.getItem('posthog_toolbar_enabled')).toBe('true');
      expect(localStorage.getItem('posthog_toolbar_params')).toBeNull();
      vi.clearAllTimers();
    });

    it('reopens it a second later on the next page load', () => {
      localStorage.setItem('posthog_toolbar_enabled', 'true');
      localStorage.setItem('posthog_toolbar_params', '{"token":"abc"}');
      const loadToolbar = seedLibrary();

      initPostHogWhenConfigured();
      vi.advanceTimersByTime(1000);

      expect(loadToolbar).toHaveBeenCalledWith({ token: 'abc' });
    });

    it('reopens it with no params when the saved ones are corrupt', () => {
      localStorage.setItem('posthog_toolbar_enabled', 'true');
      localStorage.setItem('posthog_toolbar_params', '{not json');
      const loadToolbar = seedLibrary();

      initPostHogWhenConfigured();
      vi.advanceTimersByTime(1000);

      // The wrapper always forwards its `params` argument, so an argument-less
      // reopen reaches the library as an explicit `undefined`.
      expect(loadToolbar).toHaveBeenCalledWith(undefined);
    });

    it('reopens it with no params when none were saved', () => {
      localStorage.setItem('posthog_toolbar_enabled', 'true');
      const loadToolbar = seedLibrary();

      initPostHogWhenConfigured();
      vi.advanceTimersByTime(1000);

      // The wrapper always forwards its `params` argument, so an argument-less
      // reopen reaches the library as an explicit `undefined`.
      expect(loadToolbar).toHaveBeenCalledWith(undefined);
    });

    it('leaves it shut when it was never enabled', () => {
      const loadToolbar = seedLibrary();

      initPostHogWhenConfigured();
      vi.advanceTimersByTime(1000);

      expect(loadToolbar).not.toHaveBeenCalled();
      expect(vi.getTimerCount()).toBe(0);
    });

    it('disablePostHogToolbar forgets both keys', () => {
      localStorage.setItem('posthog_toolbar_enabled', 'true');
      localStorage.setItem('posthog_toolbar_params', '{"token":"abc"}');
      seedLibrary();

      initPostHogWhenConfigured();
      w.disablePostHogToolbar();

      expect(localStorage.getItem('posthog_toolbar_enabled')).toBeNull();
      expect(localStorage.getItem('posthog_toolbar_params')).toBeNull();
      vi.clearAllTimers();
    });

    /*
     * BUG (reported, not worked around): the `loadToolbar` wrapper captures
     * `w.posthog.loadToolbar` at bootstrap time and ends with
     * `originalLoadToolbar.call(this, params)`. The bootstrap stub has no
     * `loadToolbar`, so before array.js has loaded that captured value is
     * `undefined` and any call throws `TypeError: originalLoadToolbar.call is
     * not a function` — including the automatic reopen on the 1s timer, which
     * throws out of the timer callback for anyone who has ever used the
     * toolbar. Un-skip once the wrapper guards the original.
     */
    it.skip('reopening the toolbar before array.js has loaded does not throw', () => {
      localStorage.setItem('posthog_toolbar_enabled', 'true');
      seedScriptTag();
      w.config = { posthog_api_key: 'phc_test' };

      initPostHogWhenConfigured();
      expect(() => vi.advanceTimersByTime(1000)).not.toThrow();
    });

    it('currently throws when the toolbar reopens before array.js (documents the bug above)', () => {
      localStorage.setItem('posthog_toolbar_enabled', 'true');
      seedScriptTag();
      w.config = { posthog_api_key: 'phc_test' };

      initPostHogWhenConfigured();
      expect(() => vi.advanceTimersByTime(1000)).toThrow(TypeError);
    });
  });
});

/*
 * LEAK (reported, not worked around): `initGlobalErrorHandlers` attaches
 * `unhandledrejection` and `error` to `window` and returns nothing, so there is
 * no way to detach them; `initPostHogWhenConfigured` likewise leaves a
 * `config-loaded` listener on `document` (it is `{ once: true }`, so it does at
 * least clear itself once config arrives) alongside its polling interval. Both
 * are called once from the root layout and live as long as the document, so
 * these are bounded rather than growing leaks — but it is why this suite has to
 * capture and remove the handlers itself rather than call the initialisers and
 * move on.
 */
