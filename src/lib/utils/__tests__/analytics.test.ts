/**
 * The analytics layer is a thin shell over `window.posthog`, and the things
 * worth pinning down about a thin shell are: the exact event name and property
 * bag each helper sends (a renamed property silently breaks a funnel that
 * nobody notices for a month), that a missing or throwing PostHog can never
 * take a user action down with it, and that no raw credential is ever a
 * property.
 *
 * PostHog itself is a hand-written stub on `window` — there is no library to
 * load here and nothing may reach the network. That makes what PostHog does
 * with an event un-assertable (batching, person-profile merging, flag
 * evaluation); those are properties of the real SDK and belong to a staging
 * project, not to jsdom.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  analytics,
  identifyUser,
  initializeAnalytics,
  isFeatureEnabled,
  onFeatureFlags,
  trackEvent
} from '$lib/utils/analytics';

type PostHogStub = {
  capture: ReturnType<typeof vi.fn>;
  identify: ReturnType<typeof vi.fn>;
  isFeatureEnabled: ReturnType<typeof vi.fn>;
  onFeatureFlags: ReturnType<typeof vi.fn>;
  reset: ReturnType<typeof vi.fn>;
  get_distinct_id: ReturnType<typeof vi.fn>;
};

function stubPostHog(overrides: Partial<PostHogStub> = {}): PostHogStub {
  const stub: PostHogStub = {
    capture: vi.fn(),
    identify: vi.fn(),
    isFeatureEnabled: vi.fn(() => false),
    onFeatureFlags: vi.fn(),
    reset: vi.fn(),
    get_distinct_id: vi.fn(() => 'distinct-1'),
    ...overrides
  } as PostHogStub;
  (window as unknown as { posthog?: unknown }).posthog = stub;
  return stub;
}

let consoleSpies: ReturnType<typeof vi.spyOn>[] = [];

beforeEach(() => {
  delete (window as unknown as { posthog?: unknown }).posthog;
  localStorage.clear();
  window.history.replaceState({}, '', '/');
  consoleSpies = [
    vi.spyOn(console, 'log').mockImplementation(() => {}),
    vi.spyOn(console, 'warn').mockImplementation(() => {}),
    vi.spyOn(console, 'error').mockImplementation(() => {})
  ];
});

afterEach(() => {
  for (const spy of consoleSpies) spy.mockRestore();
  delete (window as unknown as { posthog?: unknown }).posthog;
  localStorage.clear();
  window.history.replaceState({}, '', '/');
  vi.useRealTimers();
});

describe('trackEvent', () => {
  it('forwards the name and the property bag verbatim', () => {
    const posthog = stubPostHog();
    trackEvent('anime_added', { anime_id: '123', title: 'Attack on Titan' });
    expect(posthog.capture).toHaveBeenCalledWith('anime_added', {
      anime_id: '123',
      title: 'Attack on Titan'
    });
  });

  it('sends an event with no properties as undefined, not as {}', () => {
    const posthog = stubPostHog();
    trackEvent('sign_up_submitted');
    expect(posthog.capture).toHaveBeenCalledWith('sign_up_submitted', undefined);
  });

  it('is a no-op — not a throw — when PostHog was never loaded', () => {
    expect(() => trackEvent('anime_viewed', { anime_id: '1' })).not.toThrow();
  });

  it('swallows a capture that throws, so a tracked click still completes', () => {
    const posthog = stubPostHog({
      capture: vi.fn(() => {
        throw new Error('network down');
      })
    });
    expect(() => trackEvent('anime_viewed')).not.toThrow();
    expect(posthog.capture).toHaveBeenCalled();
  });
});

describe('the named event helpers', () => {
  it('send the documented name and properties for anime interactions', () => {
    const posthog = stubPostHog();

    analytics.animeViewed('1', 'Frieren');
    analytics.animeAddedToList('1', 'Frieren', 'watching');
    analytics.animeRemovedFromList('1', 'Frieren', 'completed');
    analytics.animeRated('1', 'Frieren', 9);

    expect(posthog.capture.mock.calls).toEqual([
      ['anime_viewed', { anime_id: '1', title: 'Frieren' }],
      ['anime_added_to_list', { anime_id: '1', title: 'Frieren', list_type: 'watching' }],
      ['anime_removed_from_list', { anime_id: '1', title: 'Frieren', list_type: 'completed' }],
      ['anime_rated', { anime_id: '1', title: 'Frieren', rating: 9 }]
    ]);
  });

  it('send the documented name and properties for discovery and navigation', () => {
    const posthog = stubPostHog();

    analytics.searchPerformed('frieren', 12);
    analytics.seasonalAnimeViewed('fall', 2025);
    analytics.listShared('watching', 40);
    analytics.pageViewed('show', { show_id: '7' });
    analytics.errorOccurred('graphql', 'boom');

    expect(posthog.capture.mock.calls).toEqual([
      ['search_performed', { query: 'frieren', results_count: 12 }],
      ['seasonal_anime_viewed', { season: 'fall', year: 2025 }],
      ['list_shared', { list_type: 'watching', anime_count: 40 }],
      ['page_viewed', { page_name: 'show', show_id: '7' }],
      ['error_occurred', { error_type: 'graphql', error_message: 'boom' }]
    ]);
  });

  it('omit the user id property entirely rather than sending an undefined one', () => {
    const posthog = stubPostHog();

    analytics.profileViewed();
    analytics.signedUp();
    analytics.profileViewed('u-1');
    analytics.signedUp('u-1');

    expect(posthog.capture.mock.calls).toEqual([
      ['profile_viewed', undefined],
      ['sign_up_succeeded', undefined],
      ['profile_viewed', { user_id: 'u-1' }],
      ['sign_up_succeeded', { user_id: 'u-1' }]
    ]);
  });

  it('carry no credential through the signup and login funnel', () => {
    const posthog = stubPostHog();

    analytics.signUpSubmitted();
    analytics.signUpFailed('email already registered');
    analytics.loginSubmitted();
    analytics.loggedIn();
    analytics.loggedIn('oauth');
    analytics.loginFailed('bad credentials');

    expect(posthog.capture.mock.calls).toEqual([
      ['sign_up_submitted', undefined],
      ['sign_up_failed', { reason: 'email already registered' }],
      ['login_submitted', undefined],
      ['logged_in', { method: 'password' }],
      ['logged_in', { method: 'oauth' }],
      ['login_failed', { reason: 'bad credentials' }]
    ]);

    // The property bags are the whole payload, so this is a real check that no
    // email, username or password rides along with the funnel events.
    const serialised = JSON.stringify(posthog.capture.mock.calls);
    expect(serialised).not.toMatch(/password"\s*:/);
    expect(serialised).not.toMatch(/@/);
  });

  it('writes email_verified onto the person profile via $set', () => {
    const posthog = stubPostHog();

    analytics.emailVerified();
    analytics.emailVerificationFailed('token expired');
    analytics.verificationEmailResent();

    expect(posthog.capture.mock.calls).toEqual([
      ['email_verified', { $set: { email_verified: true } }],
      ['email_verification_failed', { reason: 'token expired' }],
      ['verification_email_resent', undefined]
    ]);
  });
});

describe('identifyUser', () => {
  it('forwards the id and any person properties', () => {
    const posthog = stubPostHog();
    identifyUser('u-1', { plan: 'free' });
    expect(posthog.identify).toHaveBeenCalledWith('u-1', { plan: 'free' });
  });

  it('does nothing when PostHog is absent', () => {
    expect(() => identifyUser('u-1')).not.toThrow();
  });

  it('swallows an identify that throws', () => {
    const posthog = stubPostHog({
      identify: vi.fn(() => {
        throw new Error('nope');
      })
    });
    expect(() => identifyUser('u-1')).not.toThrow();
    expect(posthog.identify).toHaveBeenCalled();
  });

  /*
   * BUG (reported, not worked around): `identifyUser` has no guard on `userId`,
   * so an empty string — which is what a caller reading `user?.id` off a
   * half-loaded profile hands it — is forwarded to PostHog and creates an
   * anonymous person profile keyed on "". Un-skip when a falsy id returns early.
   */
  it.skip('does not identify without an id', () => {
    const posthog = stubPostHog();
    identifyUser('');
    expect(posthog.identify).not.toHaveBeenCalled();
  });

  it('currently forwards an empty id (documents the bug above)', () => {
    const posthog = stubPostHog();
    identifyUser('');
    expect(posthog.identify).toHaveBeenCalledWith('', undefined);
  });
});

describe('isFeatureEnabled', () => {
  it('asks PostHog and returns its answer', () => {
    const posthog = stubPostHog({ isFeatureEnabled: vi.fn((flag: string) => flag === 'on-flag') });
    expect(isFeatureEnabled('on-flag')).toBe(true);
    expect(isFeatureEnabled('off-flag')).toBe(false);
    expect(posthog.isFeatureEnabled).toHaveBeenCalledWith('on-flag');
  });

  it('is false, not undefined, when PostHog never loaded', () => {
    expect(isFeatureEnabled('anime-news')).toBe(false);
  });

  it('is false when the flag check throws', () => {
    stubPostHog({
      isFeatureEnabled: vi.fn(() => {
        throw new Error('flags not ready');
      })
    });
    expect(isFeatureEnabled('anime-news')).toBe(false);
  });

  // The dev override exists because PostHog is not initialised on localhost.
  // `import.meta.env.DEV` is true under vitest, so this branch is live here.
  it('?ff= turns a flag on and persists it to localStorage', () => {
    window.history.replaceState({}, '', '/?ff=anime-news');
    expect(isFeatureEnabled('anime-news')).toBe(true);
    expect(JSON.parse(localStorage.getItem('ff_overrides')!)).toEqual(['anime-news']);
  });

  it('?ff= accepts several flags and trims them', () => {
    window.history.replaceState({}, '', '/?ff=anime-news,%20other-flag');
    expect(isFeatureEnabled('anime-news')).toBe(true);
    expect(isFeatureEnabled('other-flag')).toBe(true);
    expect(isFeatureEnabled('third-flag')).toBe(false);
  });

  it('a stored override survives a navigation with no ?ff=', () => {
    localStorage.setItem('ff_overrides', JSON.stringify(['anime-news']));
    expect(isFeatureEnabled('anime-news')).toBe(true);
  });

  it('an empty ?ff= is a reset, not an override of the empty string', () => {
    localStorage.setItem('ff_overrides', JSON.stringify(['anime-news']));
    window.history.replaceState({}, '', '/?ff=');
    expect(isFeatureEnabled('anime-news')).toBe(false);
    expect(JSON.parse(localStorage.getItem('ff_overrides')!)).toEqual([]);
  });

  it('ignores a hand-mangled override value rather than throwing', () => {
    localStorage.setItem('ff_overrides', '{not json');
    expect(isFeatureEnabled('anime-news')).toBe(false);
  });

  it('can only turn a flag on, never off — a real rollout still wins', () => {
    stubPostHog({ isFeatureEnabled: vi.fn(() => true) });
    localStorage.setItem('ff_overrides', JSON.stringify(['some-other-flag']));
    expect(isFeatureEnabled('rolled-out')).toBe(true);
  });
});

describe('onFeatureFlags', () => {
  it('hands the callback to PostHog when it is there', () => {
    const posthog = stubPostHog();
    const callback = vi.fn();
    onFeatureFlags(callback);
    expect(posthog.onFeatureFlags).toHaveBeenCalledWith(callback);
    expect(callback).not.toHaveBeenCalled();
  });

  it('runs the callback immediately when PostHog is absent', () => {
    const callback = vi.fn();
    onFeatureFlags(callback);
    expect(callback).toHaveBeenCalledTimes(1);
  });

  it('runs the callback anyway when registration throws', () => {
    stubPostHog({
      onFeatureFlags: vi.fn(() => {
        throw new Error('nope');
      })
    });
    const callback = vi.fn();
    onFeatureFlags(callback);
    expect(callback).toHaveBeenCalledTimes(1);
  });
});

describe('initializeAnalytics', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  it('starts no polling interval when PostHog is already there', () => {
    stubPostHog();
    const setInterval = vi.spyOn(globalThis, 'setInterval');
    try {
      initializeAnalytics();
      expect(setInterval).not.toHaveBeenCalled();
    } finally {
      setInterval.mockRestore();
    }
  });

  it('polls until PostHog appears, then stops', () => {
    const clearInterval = vi.spyOn(globalThis, 'clearInterval');
    try {
      initializeAnalytics();
      vi.advanceTimersByTime(300);
      expect(clearInterval).not.toHaveBeenCalled();

      stubPostHog();
      vi.advanceTimersByTime(100);
      expect(clearInterval).toHaveBeenCalledTimes(1);

      // Nothing is left ticking.
      expect(vi.getTimerCount()).toBe(0);
    } finally {
      clearInterval.mockRestore();
    }
  });

  it('gives up after 5 seconds instead of polling forever', () => {
    const warn = console.warn as unknown as ReturnType<typeof vi.fn>;
    initializeAnalytics();
    vi.advanceTimersByTime(5000);
    expect(vi.getTimerCount()).toBe(0);
    expect(warn).toHaveBeenCalledWith(
      expect.stringContaining('failed to initialize')
    );
  });
});
