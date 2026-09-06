/**
 * The anime-notification manager: the once-per-session bootstrap that wires the
 * notification service to the toast layer, feeds it the currently-airing list,
 * and hands the result to the store the UI reads.
 *
 * This one stays in jsdom rather than declaring the node environment its
 * neighbours in this scope do: the guard it is built around is a set of flags
 * on `window`, and its de-duplication is backed by `localStorage`. Without a
 * browser global there is nothing here to test.
 *
 * The notification service and the toast layer are stubbed — the first owns a
 * real `Worker`, the second renders sonner toasts — but the store is the real
 * `animeNotificationStore`, so "the store reflects what was scheduled" is an
 * assertion about the shipped store rather than about a double. Nothing reaches
 * the network: `authenticatedRequest` is stubbed and hands the caller a fake
 * client, so the query the manager builds is still exercised and inspectable.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { get } from 'svelte/store';
import { getCurrentlyAiringWithDates } from '$lib/services/api/graphql/queries';

const mocks = vi.hoisted(() => ({
  service: {
    setNotificationCallback: vi.fn(),
    setCountdownCallback: vi.fn(),
    setTimingCallback: vi.fn(),
    startWatching: vi.fn(async (_animeList: any[]) => {}),
    triggerImmediateUpdate: vi.fn(),
    isReady: vi.fn(() => true),
    stop: vi.fn()
  },
  animeToast: {
    warning: vi.fn(),
    airingSoon: vi.fn(),
    nowAiring: vi.fn(),
    finished: vi.fn()
  },
  authenticatedRequest: vi.fn()
}));

vi.mock('$lib/services/animeNotifications', () => ({
  animeNotificationService: mocks.service
}));
vi.mock('$lib/utils/animeToast', () => ({ animeToast: mocks.animeToast }));
vi.mock('$lib/services/query-options', () => ({
  authenticatedRequest: mocks.authenticatedRequest
}));

const STORAGE_KEY = 'anime_notifications_sent';
const WINDOW_FLAGS = [
  '__animeNotificationsInitialized',
  '__animeCallbackSet',
  '__animeWatching'
] as const;

// ---------------------------------------------------------------------- fixtures

const airing = (overrides: Record<string, any> = {}) => ({
  id: 'a1',
  slug: 'frieren',
  titleEn: 'Frieren',
  titleJp: '葬送のフリーレン',
  imageUrl: 'frieren.jpg',
  duration: '24 min per episode',
  broadcast: 'Fridays at 23:00 (JST)',
  nextEpisode: {
    id: 'e5',
    episodeNumber: 5,
    titleEn: 'Episode Five',
    airDate: '2024-01-15T00:00:00Z',
    airTime: '2024-01-15T14:00:00Z'
  },
  ...overrides
});

/** The client the stubbed `authenticatedRequest` hands to the manager's closure. */
let request: ReturnType<typeof vi.fn>;

function respondWith(currentlyAiring: unknown) {
  request.mockResolvedValue({ currentlyAiring });
}

// ----------------------------------------------------------------------- harness

/**
 * The manager is a module singleton holding its own `isInitialized` flag, so
 * every test gets a fresh module graph — including a fresh store — rather than
 * inheriting the previous test's session.
 */
async function loadProvider() {
  vi.resetModules();
  const provider = await import('./animeNotificationProvider');
  const { animeNotificationStore } = await import('./animeNotifications');
  return { ...provider, animeNotificationStore };
}

/** The callback the manager registered with the service, as the service sees it. */
function notificationCallback() {
  const calls = mocks.service.setNotificationCallback.mock.calls;
  expect(calls.length).toBeGreaterThan(0);
  return calls[calls.length - 1][0] as (type: string, anime: any, episode?: any) => void;
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2024-01-15T12:00:00Z'));
  // The manager narrates itself through `debug`, which is on in dev mode.
  for (const level of ['log', 'info', 'warn', 'error'] as const) {
    vi.spyOn(console, level).mockImplementation(() => {});
  }
  localStorage.clear();
  for (const flag of WINDOW_FLAGS) delete (window as any)[flag];

  for (const spy of Object.values(mocks.service)) spy.mockClear();
  for (const spy of Object.values(mocks.animeToast)) spy.mockClear();
  mocks.service.isReady.mockReturnValue(true);
  mocks.service.startWatching.mockResolvedValue(undefined);

  request = vi.fn().mockResolvedValue({ currentlyAiring: [airing()] });
  mocks.authenticatedRequest.mockReset();
  mocks.authenticatedRequest.mockImplementation(async (fn: any) => fn({ request }));
});

afterEach(() => {
  vi.clearAllTimers();
  vi.useRealTimers();
  vi.restoreAllMocks();
  localStorage.clear();
  for (const flag of WINDOW_FLAGS) delete (window as any)[flag];
});

// ------------------------------------------------------------------ first launch

describe('initialising', () => {
  it('registers the toast callback, asks for the airing list and starts watching', async () => {
    const { initializeAnimeNotifications } = await loadProvider();

    await initializeAnimeNotifications();

    expect(mocks.service.setNotificationCallback).toHaveBeenCalledOnce();
    expect(mocks.authenticatedRequest).toHaveBeenCalledOnce();
    expect(mocks.service.startWatching).toHaveBeenCalledOnce();
  });

  it('asks for the week ahead, from a day back, through the shared query', async () => {
    const { initializeAnimeNotifications } = await loadProvider();

    await initializeAnimeNotifications();

    const [document, variables] = request.mock.calls[0];
    expect(document).toStrictEqual(getCurrentlyAiringWithDates);
    expect(variables).toEqual({
      // A day of slack behind "now" so an episode that aired overnight is still
      // in the window the worker can report on.
      input: { startDate: new Date('2024-01-14T12:00:00Z'), daysInFuture: 7 },
      limit: 25
    });
  });

  it('marks the session on window so a second entry point can see it', async () => {
    const { initializeAnimeNotifications } = await loadProvider();

    await initializeAnimeNotifications();

    for (const flag of WINDOW_FLAGS) {
      expect((window as any)[flag], flag).toBe(true);
    }
  });

  it('triggers one immediate update shortly after it starts watching', async () => {
    const { initializeAnimeNotifications } = await loadProvider();

    await initializeAnimeNotifications();
    expect(mocks.service.triggerImmediateUpdate).not.toHaveBeenCalled();

    vi.advanceTimersByTime(50);

    expect(mocks.service.triggerImmediateUpdate).toHaveBeenCalledOnce();
  });

  it('hands the store the service’s readiness once it is watching', async () => {
    const { initializeAnimeNotifications, animeNotificationStore } = await loadProvider();

    await initializeAnimeNotifications();

    expect(get(animeNotificationStore).isReady).toBe(true);
  });

  it('leaves the store not-ready when the service never becomes ready', async () => {
    mocks.service.isReady.mockReturnValue(false);
    const { initializeAnimeNotifications, animeNotificationStore } = await loadProvider();

    await initializeAnimeNotifications();

    expect(get(animeNotificationStore).isReady).toBe(false);
  });
});

describe('the list it schedules', () => {
  const scheduled = () => mocks.service.startWatching.mock.calls[0][0] as any[];

  it('forwards the fields the toast and the countdown need', async () => {
    const { initializeAnimeNotifications } = await loadProvider();

    await initializeAnimeNotifications();

    expect(scheduled()).toEqual([
      {
        id: 'a1',
        slug: 'frieren',
        titleEn: 'Frieren',
        titleJp: '葬送のフリーレン',
        imageUrl: 'frieren.jpg',
        duration: '24 min per episode',
        broadcast: 'Fridays at 23:00 (JST)',
        nextEpisode: airing().nextEpisode
      }
    ]);
  });

  it.each([
    ['no next episode', { id: 'x', nextEpisode: null }],
    ['a next episode with no air date or time', { id: 'x', nextEpisode: { id: 'e1' } }],
    ['a next episode whose dates are both null', {
      id: 'x',
      nextEpisode: { id: 'e1', airDate: null, airTime: null }
    }]
  ])('drops an anime with %s — there is nothing to count down to', async (_label, bad) => {
    respondWith([airing(), bad]);
    const { initializeAnimeNotifications } = await loadProvider();

    await initializeAnimeNotifications();

    expect(scheduled().map((a) => a.id)).toEqual(['a1']);
  });

  it('keeps an anime that has only an air date', async () => {
    respondWith([airing({ nextEpisode: { id: 'e1', episodeNumber: 1, airDate: '2024-01-16' } })]);
    const { initializeAnimeNotifications } = await loadProvider();

    await initializeAnimeNotifications();

    expect(scheduled()).toHaveLength(1);
  });

  it('does not start watching when the query comes back empty-handed', async () => {
    respondWith(null);
    const { initializeAnimeNotifications } = await loadProvider();

    await initializeAnimeNotifications();

    expect(mocks.service.startWatching).not.toHaveBeenCalled();
    // Still a completed initialisation: there was simply nothing airing.
    expect((window as any).__animeNotificationsInitialized).toBe(true);
    expect((window as any).__animeWatching).toBeUndefined();
  });
});

// ------------------------------------------------------------------- the once guard

describe('the once guard', () => {
  it('does no work at all on a second call', async () => {
    const { initializeAnimeNotifications } = await loadProvider();
    await initializeAnimeNotifications();

    await initializeAnimeNotifications();
    await initializeAnimeNotifications();

    expect(mocks.service.setNotificationCallback).toHaveBeenCalledOnce();
    expect(mocks.authenticatedRequest).toHaveBeenCalledOnce();
    expect(mocks.service.startWatching).toHaveBeenCalledOnce();
  });

  it('skips a fresh module instance that finds the window flag already set', async () => {
    // What a second script tag, or a re-import after hydration, actually sees.
    (window as any).__animeNotificationsInitialized = true;
    const { initializeAnimeNotifications } = await loadProvider();

    await initializeAnimeNotifications();

    expect(mocks.authenticatedRequest).not.toHaveBeenCalled();
  });

  it('does not re-register the callback for a session that already has one', async () => {
    (window as any).__animeCallbackSet = true;
    const { initializeAnimeNotifications } = await loadProvider();

    await initializeAnimeNotifications();

    expect(mocks.service.setNotificationCallback).not.toHaveBeenCalled();
    // ...but the rest of the bootstrap still runs.
    expect(mocks.service.startWatching).toHaveBeenCalledOnce();
  });

  it('does not re-schedule the list for a session that is already watching', async () => {
    (window as any).__animeWatching = true;
    const { initializeAnimeNotifications } = await loadProvider();

    await initializeAnimeNotifications();

    expect(mocks.authenticatedRequest).not.toHaveBeenCalled();
    expect(mocks.service.startWatching).not.toHaveBeenCalled();
    expect((window as any).__animeNotificationsInitialized).toBe(true);
  });

  it('lets a failed initialisation be retried', async () => {
    request.mockRejectedValueOnce(new Error('gateway down'));
    const { initializeAnimeNotifications } = await loadProvider();

    await initializeAnimeNotifications();
    expect((window as any).__animeNotificationsInitialized).toBeUndefined();

    await initializeAnimeNotifications();

    expect(mocks.service.startWatching).toHaveBeenCalledOnce();
    expect((window as any).__animeNotificationsInitialized).toBe(true);
  });
});

// ------------------------------------------------------------------ toasting

describe('the notification callback', () => {
  const episode = { episodeNumber: 5, titleEn: 'Episode Five' };

  async function initialised() {
    const provider = await loadProvider();
    await provider.initializeAnimeNotifications();
    return provider;
  }

  it.each([
    ['warning', 'warning'],
    ['airing-soon', 'airingSoon'],
    ['airing', 'nowAiring'],
    ['finished-airing', 'finished']
  ])('shows the %s toast', async (type, toast) => {
    await initialised();

    notificationCallback()(type, airing(), episode);

    expect(mocks.animeToast[toast as keyof typeof mocks.animeToast]).toHaveBeenCalledOnce();
    const [anime, ep] = (mocks.animeToast as any)[toast].mock.calls[0];
    expect(anime.id).toBe('a1');
    expect(ep).toBe(episode);
  });

  it('tells the airing-soon toast how many minutes are left', async () => {
    await initialised();

    notificationCallback()('airing-soon', airing(), episode);

    expect(mocks.animeToast.airingSoon).toHaveBeenCalledWith(expect.anything(), episode, 30);
  });

  it('shows nothing for a type it does not know', async () => {
    await initialised();

    notificationCallback()('cancelled', airing(), episode);

    for (const toast of Object.values(mocks.animeToast)) expect(toast).not.toHaveBeenCalled();
  });

  it('shows the same notification once, and remembers it across a reload', async () => {
    await initialised();

    notificationCallback()('airing', airing(), episode);
    notificationCallback()('airing', airing(), episode);

    expect(mocks.animeToast.nowAiring).toHaveBeenCalledOnce();
    expect(JSON.parse(localStorage.getItem(STORAGE_KEY)!)).toEqual([
      { timestamp: Date.parse('2024-01-15T12:00:00Z'), type: 'airing', animeId: 'a1', episodeNumber: 5 }
    ]);
  });

  it('separates the notifications of one episode from another', async () => {
    await initialised();
    const callback = notificationCallback();

    callback('airing', airing(), episode);
    callback('airing', airing(), { episodeNumber: 6 });
    callback('warning', airing(), episode);
    callback('airing', airing({ id: 'a2' }), episode);

    expect(mocks.animeToast.nowAiring).toHaveBeenCalledTimes(3);
    expect(mocks.animeToast.warning).toHaveBeenCalledOnce();
  });

  it('handles an episodeless notification', async () => {
    await initialised();

    notificationCallback()('airing', airing(), undefined);
    notificationCallback()('airing', airing(), undefined);

    expect(mocks.animeToast.nowAiring).toHaveBeenCalledOnce();
  });

  it('lets a notification through again once its record has expired', async () => {
    await initialised();
    notificationCallback()('airing', airing(), episode);

    // The record's TTL is an hour.
    vi.setSystemTime(new Date('2024-01-15T13:00:01Z'));
    notificationCallback()('airing', airing(), episode);

    expect(mocks.animeToast.nowAiring).toHaveBeenCalledTimes(2);
    // The expired record is pruned rather than accumulating forever.
    const records = JSON.parse(localStorage.getItem(STORAGE_KEY)!);
    expect(records).toHaveLength(1);
    expect(records[0].timestamp).toBe(Date.parse('2024-01-15T13:00:01Z'));
  });

  it('recovers from a corrupt record store rather than going silent', async () => {
    await initialised();
    localStorage.setItem(STORAGE_KEY, 'not json');

    notificationCallback()('airing', airing(), episode);

    expect(mocks.animeToast.nowAiring).toHaveBeenCalledOnce();
  });

  it('still shows the toast when the record cannot be written', async () => {
    await initialised();
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('QuotaExceededError');
    });

    notificationCallback()('airing', airing(), episode);

    expect(mocks.animeToast.nowAiring).toHaveBeenCalledOnce();
  });
});

// -------------------------------------------------------------------- teardown

describe('cleanup', () => {
  it('stops the service, empties the store and forgets the session', async () => {
    const { initializeAnimeNotifications, cleanupAnimeNotifications, animeNotificationStore } =
      await loadProvider();
    await initializeAnimeNotifications();
    notificationCallback()('airing', airing(), { episodeNumber: 5 });

    cleanupAnimeNotifications();

    expect(mocks.service.stop).toHaveBeenCalledOnce();
    expect(get(animeNotificationStore)).toEqual({ timingData: {}, countdowns: {}, isReady: false });
    expect(localStorage.getItem(STORAGE_KEY)).toBeNull();
    for (const flag of WINDOW_FLAGS) expect((window as any)[flag]).toBe(false);
  });

  it('does nothing when there was never a session to clean up', async () => {
    const { cleanupAnimeNotifications } = await loadProvider();

    cleanupAnimeNotifications();

    expect(mocks.service.stop).not.toHaveBeenCalled();
  });

  it('lets notifications be initialised again afterwards', async () => {
    const { initializeAnimeNotifications, cleanupAnimeNotifications } = await loadProvider();
    await initializeAnimeNotifications();
    vi.advanceTimersByTime(50);

    cleanupAnimeNotifications();
    await initializeAnimeNotifications();

    expect(mocks.service.startWatching).toHaveBeenCalledTimes(2);
  });
});

// --------------------------------------------------- the global bootstrap script

describe('window.__initAnimeNotifications', () => {
  it('is published for the inline script to call', async () => {
    await loadProvider();

    expect(typeof (window as any).__initAnimeNotifications).toBe('function');
  });

  it('initialises and arms a page-unload cleanup, exactly once', async () => {
    await loadProvider();
    const listeners: Array<[string, any]> = [];
    const addEventListener = vi
      .spyOn(window, 'addEventListener')
      .mockImplementation((type: any, listener: any) => {
        listeners.push([type, listener]);
      });

    (window as any).__initAnimeNotifications();
    await vi.advanceTimersByTimeAsync(50);

    expect(mocks.authenticatedRequest).toHaveBeenCalledOnce();
    expect(listeners.map(([type]) => type)).toEqual(['beforeunload']);

    // Calling it again is a no-op: the flag it just set is the guard.
    (window as any).__initAnimeNotifications();
    expect(mocks.authenticatedRequest).toHaveBeenCalledOnce();

    addEventListener.mockRestore();
  });

  it('cleans the session up when the page goes away', async () => {
    await loadProvider();
    let unload: (() => void) | undefined;
    vi.spyOn(window, 'addEventListener').mockImplementation((type: any, listener: any) => {
      if (type === 'beforeunload') unload = listener;
    });

    (window as any).__initAnimeNotifications();
    await vi.advanceTimersByTimeAsync(50);
    unload!();

    expect(mocks.service.stop).toHaveBeenCalledOnce();
  });

  it('does not initialise when the session flag is already set', async () => {
    await loadProvider();
    (window as any).__animeNotificationsInitialized = true;

    (window as any).__initAnimeNotifications();

    expect(mocks.authenticatedRequest).not.toHaveBeenCalled();
  });
});
