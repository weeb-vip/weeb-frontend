import { describe, it, expect, vi, afterEach, type Mock } from 'vitest';
import { flushSync } from 'svelte';
import { readable } from 'svelte/store';
import { SvelteMap } from 'svelte/reactivity';
import { QueryClient } from '@tanstack/svelte-query';
import {
  NEWS_FLAG,
  ShowContentBloc,
  trackingNotify,
  type ShowSourceAccessor,
  type ViewportPort,
} from './ShowContent.bloc.svelte';

/**
 * The show page's bloc — its wiring, not its arithmetic.
 *
 * `ShowContent.rules.test.ts` already pins `resolveShow`, `sectionTabs`,
 * `activeSection` and the clamps as pure functions. What is unproven, and what
 * broke before, is everything between those functions and the world: which
 * record actually reaches `resolveShow` when SSR and the client query disagree,
 * whether the heaviest document in the app is refetched on a page that was
 * already server-rendered, whether the viewer's tracking row survives a cold
 * client fetch, whether the scroll listener and the sticky custom property are
 * really removed on teardown, and whether a mutation's rejection reaches a
 * toast rather than the console.
 *
 * Every port is stubbed, so nothing here touches the network, `window.scroll`
 * or PostHog. The query client is inert: it never refetches on mount and never
 * retries, so a seeded cache entry is a stable state to read against.
 */

const { toastError } = vi.hoisted(() => ({ toastError: vi.fn() }));
vi.mock('svelte-sonner', () => ({ toast: { error: toastError } }));

const NOW = new Date('2025-03-01T12:00:00Z');

/* ── Harness ─────────────────────────────────────────────────────────────── */

type SourcePayload = ReturnType<ShowSourceAccessor>;

/**
 * A source accessor over a mutable payload. It reads through `SvelteMap` rather
 * than a plain `let` because the bloc memoises the resolved record in a
 * `$derived` — in the component the payload is a prop, i.e. a signal, and only a
 * signal invalidates that memo. This is the closest a plain `.ts` file gets to
 * the prop the view actually passes.
 */
function livePayload(initial: Partial<SourcePayload> = {}) {
  const box = new SvelteMap<string, SourcePayload>([
    [
      'payload',
      {
        animeId: 'abc',
        ssrAnimeData: null,
        ssrCharactersData: null,
        ssrError: null,
        ...initial,
      },
    ],
  ]);
  return {
    source: (() => box.get('payload')!) as ShowSourceAccessor,
    set(next: Partial<SourcePayload>) {
      box.set('payload', { ...box.get('payload')!, ...next });
    },
  };
}

/**
 * The viewport seam, every method a spy. Typed as mocks rather than as
 * `ViewportPort` so an override still exposes `.mock` and `.mockReturnValue`
 * to the test that supplied it.
 */
type StubViewport = {
  scrollY: Mock<() => number>;
  innerWidth: Mock<() => number>;
  sectionTop: Mock<(id: string) => number | null>;
  scrollTo: Mock<(top: number) => void>;
  cssLength: Mock<(name: string, fallback: number) => number>;
  setStickyOffset: Mock<(px: number | null) => void>;
  onScroll: Mock<(listener: () => void) => () => void>;
};

function stubViewport(overrides: Partial<StubViewport> = {}): StubViewport {
  return {
    scrollY: vi.fn(() => 0),
    innerWidth: vi.fn(() => 1280),
    sectionTop: vi.fn((_id: string) => null as number | null),
    scrollTo: vi.fn((_top: number) => {}),
    cssLength: vi.fn((_name: string, fallback: number) => fallback),
    setStickyOffset: vi.fn((_px: number | null) => {}),
    onScroll: vi.fn((_listener: () => void) => vi.fn()),
    ...overrides,
  };
}

/** Never fetches on mount, never retries: a seeded cache entry stays put. */
function inertClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        retryOnMount: false,
        refetchOnMount: false,
        refetchOnWindowFocus: false,
        gcTime: Infinity,
        staleTime: Infinity,
      },
      mutations: { retry: false },
    },
  });
}

interface Options {
  source?: ShowSourceAccessor;
  client?: QueryClient;
  detailsFn?: () => Promise<unknown>;
  watchedFn?: () => Promise<unknown>;
  tracking?: { save: any; markEpisode: any };
  notify?: { error: any };
  flags?: { isEnabled: any };
  viewport?: ReturnType<typeof stubViewport>;
  /** Returns a promise for the tests that care about the scroll's ordering against it. */
  navigate?: Mock<(href: string) => unknown>;
  notifications?: any;
  titleLanguage?: 'english' | 'japanese';
  flagPollMs?: number;
  flagMaxTries?: number;
}

function build(options: Options = {}) {
  const client = options.client ?? inertClient();
  const detailsFn = vi.fn(options.detailsFn ?? (async () => ({ anime: null })));
  const watchedFn = vi.fn(options.watchedFn ?? (async () => []));
  const detailsPort = vi.fn((id: string) => ({ queryKey: ['details', id], queryFn: detailsFn }));
  const watchedPort = vi.fn((id: string) => ({ queryKey: ['watched', id], queryFn: watchedFn }));
  const tracking = options.tracking ?? {
    save: vi.fn(async () => ({})),
    markEpisode: vi.fn(async () => ({})),
  };
  const notify = options.notify ?? { error: vi.fn() };
  const viewport = options.viewport ?? stubViewport();
  const navigate = options.navigate ?? vi.fn();
  const configInit = vi.fn(async () => ({}));

  const bloc = new ShowContentBloc({
    source: options.source ?? livePayload().source,
    details: detailsPort as any,
    watched: watchedPort as any,
    tracking: tracking as any,
    preferences: readable({ titleLanguage: options.titleLanguage ?? 'english' }) as any,
    notifications: options.notifications ?? readable({ timingData: {}, countdowns: {} }),
    config: { init: configInit },
    flags: options.flags ?? { isEnabled: () => false },
    viewport,
    navigate,
    notify: notify as any,
    clock: () => NOW,
    imageUrl: (id: string, path?: string) => (path ? `cdn/${path}/${id}` : `cdn/${id}`),
    queryClient: client,
    flagPollMs: options.flagPollMs ?? 250,
    flagMaxTries: options.flagMaxTries ?? 25,
  });

  return {
    bloc,
    client,
    detailsFn,
    watchedFn,
    detailsPort,
    watchedPort,
    tracking,
    notify,
    viewport,
    navigate,
    configInit,
  };
}

/** A query that has answered with this record, without any fetch happening. */
function seedDetails(client: QueryClient, anime: unknown, id = 'abc') {
  client.setQueryData(['details', id], { anime });
}

/** A query that answered with an error, as a cold mount would find it. */
async function seedDetailsError(client: QueryClient, message: string, id = 'abc') {
  await client
    .fetchQuery({
      queryKey: ['details', id],
      queryFn: async () => {
        throw new Error(message);
      },
    })
    .catch(() => {});
}

afterEach(() => {
  vi.useRealTimers();
  toastError.mockReset();
});

/* ── SSR vs the query ────────────────────────────────────────────────────── */

describe('which record the page renders', () => {
  it('paints the loader payload on the first frame, before any query answers', () => {
    const { bloc } = build({
      source: livePayload({ ssrAnimeData: { anime: { id: 'abc', titleEn: 'From the server' } } })
        .source,
    });

    expect(bloc.status).toBe('ready');
    expect(bloc.title).toBe('From the server');
  });

  it('lets a successful query supersede the loader payload', () => {
    const client = inertClient();
    seedDetails(client, { id: 'abc', titleEn: 'From the client' });

    const { bloc } = build({
      client,
      source: livePayload({ ssrAnimeData: { anime: { id: 'abc', titleEn: 'From the server' } } })
        .source,
    });

    expect(bloc.title).toBe('From the client');
  });

  it('recovers from a loader error once the query answers', () => {
    const client = inertClient();
    seedDetails(client, { id: 'abc', titleEn: 'Recovered' });

    const { bloc } = build({
      client,
      source: livePayload({ ssrError: new Error('the loader blew up') }).source,
    });

    // A failed server render is not a dead page: the client fetch still runs.
    expect(bloc.status).toBe('ready');
    expect(bloc.title).toBe('Recovered');
  });

  it('is loading while the query is still in flight and nothing was server-rendered', () => {
    const { bloc } = build({ detailsFn: () => new Promise(() => {}) });

    expect(bloc.status).toBe('loading');
    expect(bloc.anime).toBeNull();
  });

  it('is an error when the query failed and there is nothing to show', async () => {
    const client = inertClient();
    await seedDetailsError(client, 'gateway timeout');

    const { bloc } = build({ client });

    expect(bloc.status).toBe('error');
    expect(bloc.anime).toBeNull();
  });

  it('treats a 200 carrying nothing as an error rather than a permanent skeleton', () => {
    const client = inertClient();
    // Settled: not loading, not an error, and no anime in the body.
    client.setQueryData(['details', 'abc'], {});

    const { bloc } = build({ client });

    expect(bloc.status).toBe('error');
  });

  it('reads the payload live, so a later prop still decides the record', () => {
    const payload = livePayload({ ssrCharactersData: 'first' });
    const { bloc } = build({ source: payload.source, detailsFn: () => new Promise(() => {}) });

    expect(bloc.status).toBe('loading');
    expect(bloc.ssrCharactersData).toBe('first');

    payload.set({
      ssrAnimeData: { anime: { id: 'abc', titleEn: 'Arrived late' } },
      ssrCharactersData: 'second',
    });

    expect(bloc.status).toBe('ready');
    expect(bloc.title).toBe('Arrived late');
    expect(bloc.ssrCharactersData).toBe('second');
  });
});

describe('the error banner detail', () => {
  it('prefers the query error, which is the more recent attempt', async () => {
    const client = inertClient();
    await seedDetailsError(client, 'gateway timeout');

    const { bloc } = build({
      client,
      source: livePayload({ ssrError: new Error('stale loader error') }).source,
    });

    expect(bloc.errorDetail).toBe('gateway timeout');
  });

  it('falls back to the loader error when the query has not failed', () => {
    const { bloc } = build({
      source: livePayload({ ssrError: new Error('the loader blew up') }).source,
      detailsFn: () => new Promise(() => {}),
    });

    expect(bloc.errorDetail).toBe('the loader blew up');
  });

  it('reads a bare string loader error as the message itself', () => {
    const { bloc } = build({
      source: livePayload({ ssrError: 'Anime not found' }).source,
      detailsFn: () => new Promise(() => {}),
    });

    expect(bloc.errorDetail).toBe('Anime not found');
  });

  it('says nothing when there is nothing useful to say', () => {
    const { bloc } = build({ source: livePayload({ ssrError: { code: 500 } }).source });

    expect(bloc.errorDetail).toBe('');
  });
});

/* ── The fetch that must not happen ──────────────────────────────────────── */

describe('the details query', () => {
  it('is skipped entirely when the loader already supplied the record', async () => {
    const { bloc, detailsFn } = build({
      source: livePayload({ ssrAnimeData: { anime: { id: 'abc', titleEn: 'Server' } } }).source,
      detailsFn: async () => ({ anime: { id: 'abc', titleEn: 'Client' } }),
    });

    // Reading is what mounts the observer; the record still has to be there.
    expect(bloc.title).toBe('Server');
    await new Promise((resolve) => setTimeout(resolve, 10));

    // Refetching the heaviest document in the app on every show view is the
    // whole reason `enabled` exists here.
    expect(detailsFn).not.toHaveBeenCalled();
  });

  it('does run when the loader supplied nothing', async () => {
    const { bloc, detailsFn } = build({ detailsFn: () => new Promise(() => {}) });

    expect(bloc.status).toBe('loading');
    expect(detailsFn).toHaveBeenCalled();
  });

  it('is keyed by the id the loader named', () => {
    const { detailsPort } = build({ source: livePayload({ animeId: 'xyz' }).source });

    expect(detailsPort).toHaveBeenCalledWith('xyz');
  });

  it('asks the server again on retry', async () => {
    const client = inertClient();
    seedDetails(client, { id: 'abc', titleEn: 'Stale' });
    const { bloc, detailsFn } = build({ client, detailsFn: () => new Promise(() => {}) });

    expect(bloc.title).toBe('Stale');
    // Read before the refetch as well as after: svelte-query only reports a
    // field it has seen someone read, so a getter asked for the first time
    // mid-flight answers from the state it was last built with.
    expect(bloc.isRetrying).toBe(false);

    bloc.retry();

    await vi.waitFor(() => expect(detailsFn).toHaveBeenCalledTimes(1));
    await vi.waitFor(() => expect(bloc.isRetrying).toBe(true));
  });
});

/* ── The viewer's row ────────────────────────────────────────────────────── */

describe('the viewer tracking row', () => {
  it('does not let a client refetch blank the row the server render had', () => {
    const client = inertClient();
    // The field is authenticated, so a cold client fetch loses it for a beat.
    seedDetails(client, { id: 'abc', titleEn: 'Show' });

    const { bloc } = build({
      client,
      source: livePayload({
        ssrAnimeData: {
          anime: { id: 'abc', titleEn: 'Show', userAnime: { id: 'u1', score: 7, episodes: 3 } },
        },
      }).source,
    });

    expect(bloc.canTrack).toBe(true);
    expect(bloc.score).toBe(7);
    expect(bloc.watchedCount).toBe(3);
  });

  it("keeps the query's own row when it has one", () => {
    const client = inertClient();
    seedDetails(client, { id: 'abc', userAnime: { id: 'u1', score: 9, episodes: 12 } });

    const { bloc } = build({
      client,
      source: livePayload({
        ssrAnimeData: { anime: { id: 'abc', userAnime: { id: 'u1', score: 7, episodes: 3 } } },
      }).source,
    });

    expect(bloc.score).toBe(9);
    expect(bloc.watchedCount).toBe(12);
  });

  it('does not ask for per-episode rows when the viewer is not tracking the show', async () => {
    const client = inertClient();
    seedDetails(client, { id: 'abc', titleEn: 'Show' });
    const { bloc, watchedFn } = build({ client });

    expect(bloc.watchedNumbers).toBeNull();
    await new Promise((resolve) => setTimeout(resolve, 10));
    // The field is authenticated; asking without a row is a guaranteed failure.
    expect(watchedFn).not.toHaveBeenCalled();
  });

  it('keys the per-episode query off the resolved record, not the route parameter', () => {
    const client = inertClient();
    // The loader is keyed by slug; the record carries the real id.
    seedDetails(client, { id: 'real-id', userAnime: { id: 'u1' } }, 'slug-like-thing');
    const { bloc, watchedPort } = build({
      client,
      source: livePayload({ animeId: 'slug-like-thing' }).source,
    });

    void bloc.watchedNumbers;
    flushSync();

    expect(watchedPort).toHaveBeenCalledWith('real-id');
  });

  it('reports the ticked episodes once the rows have answered', () => {
    const client = inertClient();
    seedDetails(client, { id: 'abc', userAnime: { id: 'u1' } });
    client.setQueryData(['watched', 'abc'], [{ episodeNumber: 1 }, { episodeNumber: 4 }]);

    const { bloc } = build({ client });

    expect(bloc.watchedNumbers).toEqual(new Set([1, 4]));
  });
});

/* ── Section nav ─────────────────────────────────────────────────────────── */

describe('the section nav', () => {
  const record = {
    id: 'abc',
    news: [{ title: 'a' }, { title: 'b' }],
    episodes: [{ episodeNumber: 1 }, { episodeNumber: 2 }, { episodeNumber: 3 }],
  };

  it('offers synopsis and characters for a show with neither news nor episodes', () => {
    const client = inertClient();
    seedDetails(client, { id: 'abc' });
    const { bloc } = build({ client });

    expect(bloc.sections.map((tab) => tab.value)).toEqual(['synopsis', 'characters']);
    expect(bloc.showsNews).toBe(false);
    expect(bloc.showsEpisodes).toBe(false);
  });

  it('adds an episodes tab carrying the count', () => {
    const client = inertClient();
    seedDetails(client, record);
    const { bloc } = build({ client });

    expect(bloc.showsEpisodes).toBe(true);
    expect(bloc.sections.find((tab) => tab.value === 'episodes')?.count).toBe(3);
  });

  it('hides the news tab while the flag is off, even for a show that has news', () => {
    const client = inertClient();
    seedDetails(client, record);
    const { bloc } = build({ client, flags: { isEnabled: () => false } });

    expect(bloc.showsNews).toBe(false);
    // And the section itself renders nothing, so the flag cannot be worked
    // around by scrolling to a heading that is still in the DOM.
    expect(bloc.news).toEqual([]);
  });

  it('shows the news tab once the flag is on and there is something to read', () => {
    const client = inertClient();
    seedDetails(client, record);
    const { bloc } = build({ client, flags: { isEnabled: (flag: string) => flag === NEWS_FLAG } });

    expect(bloc.showsNews).toBe(true);
    expect(bloc.news).toHaveLength(2);
  });

  it('keeps the news tab hidden when the flag is on but the show has no news', () => {
    const client = inertClient();
    seedDetails(client, { id: 'abc', news: [] });
    const { bloc } = build({ client, flags: { isEnabled: () => true } });

    expect(bloc.showsNews).toBe(false);
  });

  it('starts on the synopsis', () => {
    const { bloc } = build();

    expect(bloc.activeSection).toBe('synopsis');
  });

  it('scrolls to a chosen section and leaves the hash behind so it can be shared', () => {
    const client = inertClient();
    seedDetails(client, record);
    const viewport = stubViewport({
      scrollY: vi.fn(() => 1000),
      sectionTop: vi.fn(() => 500),
      cssLength: vi.fn(() => 60),
    });
    const { bloc, navigate } = build({ client, viewport });

    bloc.measureChrome(72, 48);
    bloc.selectSection('episodes');

    expect(bloc.activeSection).toBe('episodes');
    expect(viewport.sectionTop).toHaveBeenCalledWith('show-section-episodes');
    // 500 + 1000 - 60 nav - 48 tab bar - 8 breathing room
    expect(viewport.scrollTo).toHaveBeenCalledWith(1384);
    expect(navigate).toHaveBeenCalledWith('#show-section-episodes');
  });

  it('scrolls only after the router has finished putting the scroll position back', async () => {
    // `goto(..., { noScroll: true })` restores the scroll position it recorded
    // as the navigation began -- a `window.scrollTo(x, y)` that cancels a smooth
    // scroll already in flight. Scrolling first therefore did nothing: the page
    // stopped short, the spy found nothing had crossed its threshold, and the
    // marker snapped back to the first section. The scroll has to be last.
    const client = inertClient();
    seedDetails(client, record);
    const viewport = stubViewport({
      scrollY: vi.fn(() => 0),
      sectionTop: vi.fn(() => 1254),
      cssLength: vi.fn(() => 60),
    });
    let settle: () => void = () => {};
    const navigate = vi.fn(() => new Promise<void>((resolve) => (settle = resolve)));
    const { bloc } = build({ client, viewport, navigate });

    bloc.measureChrome(0, 41);
    bloc.selectSection('episodes');

    // Navigation in flight: nothing has been scrolled yet.
    expect(navigate).toHaveBeenCalledWith('#show-section-episodes');
    expect(viewport.scrollTo).not.toHaveBeenCalled();
    expect(bloc.activeSection).toBe('episodes');

    settle();
    await vi.waitFor(() => expect(viewport.scrollTo).toHaveBeenCalledTimes(1));
    // 1254 + 0 - 60 nav - 41 tab bar - 8 breathing room
    expect(viewport.scrollTo).toHaveBeenCalledWith(1145);
  });

  it('still scrolls when the navigation rejects, rather than leaving the reader put', async () => {
    const client = inertClient();
    seedDetails(client, record);
    const viewport = stubViewport({ sectionTop: vi.fn(() => 500), cssLength: vi.fn(() => 60) });
    const navigate = vi.fn(() => Promise.reject(new Error('router said no')));
    const { bloc } = build({ client, viewport, navigate });

    bloc.selectSection('episodes');

    await vi.waitFor(() => expect(viewport.scrollTo).toHaveBeenCalledTimes(1));
  });

  it('measures the section at the moment it scrolls, not before it navigates', async () => {
    // The sticky header can appear between the two, and the offset it adds is
    // part of where the section has to land.
    const client = inertClient();
    seedDetails(client, record);
    const viewport = stubViewport({ sectionTop: vi.fn(() => 900), cssLength: vi.fn(() => 60) });
    const navigate = vi.fn(async () => {
      viewport.sectionTop.mockReturnValue(300);
    });
    const { bloc } = build({ client, viewport, navigate });

    bloc.selectSection('episodes');

    await vi.waitFor(() => expect(viewport.scrollTo).toHaveBeenCalledTimes(1));
    // 300, the position after the navigation -- not the 900 it was before it.
    expect(viewport.scrollTo).toHaveBeenCalledWith(300 - 60 - 8);
  });

  it('still navigates when the section element is not in the document', () => {
    const viewport = stubViewport({ sectionTop: vi.fn(() => null) });
    const { bloc, navigate } = build({ viewport });

    bloc.selectSection('characters');

    expect(viewport.scrollTo).not.toHaveBeenCalled();
    expect(navigate).toHaveBeenCalledWith('#show-section-characters');
    expect(bloc.activeSection).toBe('characters');
  });

  it('names the element a section renders under', () => {
    const { bloc } = build();

    expect(bloc.elementIdFor('synopsis')).toBe('show-section-synopsis');
  });
});

describe('the scroll spy', () => {
  it('shows the compact header only past 350px', () => {
    const viewport = stubViewport({ scrollY: vi.fn(() => 350) });
    const { bloc } = build({ viewport });

    bloc.syncScroll();
    expect(bloc.stickyVisible).toBe(false);

    viewport.scrollY.mockReturnValue(351);
    bloc.syncScroll();
    expect(bloc.stickyVisible).toBe(true);
  });

  it('picks the lowest section that has crossed the line', () => {
    const client = inertClient();
    seedDetails(client, { id: 'abc', episodes: [{ episodeNumber: 1 }] });
    const tops: Record<string, number> = {
      'show-section-synopsis': -600,
      'show-section-episodes': 100,
      'show-section-characters': 900,
    };
    const viewport = stubViewport({
      scrollY: vi.fn(() => 800),
      sectionTop: vi.fn((id: string) => tops[id] ?? null),
      cssLength: vi.fn(() => 60),
    });
    const { bloc } = build({ client, viewport });

    bloc.syncScroll();

    // Threshold is nav (60) + 160; characters at 900 has not reached it.
    expect(bloc.activeSection).toBe('episodes');
  });

  it('skips sections this show does not render', () => {
    const client = inertClient();
    seedDetails(client, { id: 'abc' });
    const viewport = stubViewport({
      sectionTop: vi.fn((id: string) => (id === 'show-section-synopsis' ? 10 : null)),
    });
    const { bloc } = build({ client, viewport });

    bloc.syncScroll();

    expect(bloc.activeSection).toBe('synopsis');
  });
});

describe('the pinned bars', () => {
  it('counts only the tab bar while the compact header is hidden', () => {
    const { bloc } = build();

    bloc.measureChrome(72, 48);

    expect(bloc.stickyVisible).toBe(false);
    expect(bloc.stickyOffset).toBe(48);
    expect(bloc.tabBarTop).toBe('calc(var(--weeb-nav-height, 60px) + 0px)');
  });

  it('counts both once the compact header is up', () => {
    const viewport = stubViewport({ scrollY: vi.fn(() => 400) });
    const { bloc } = build({ viewport });

    bloc.measureChrome(72, 48);
    bloc.syncScroll();

    expect(bloc.stickyOffset).toBe(120);
    // One pixel back so the two borders land on each other.
    expect(bloc.tabBarTop).toBe('calc(var(--weeb-nav-height, 60px) + 71px)');
  });

  it('publishes the measured stack and clears it again on teardown', () => {
    const { bloc, viewport } = build();

    bloc.measureChrome(72, 48);
    const stop = bloc.publishStickyOffset();

    expect(viewport.setStickyOffset).toHaveBeenCalledWith(48);

    stop();
    // Left set, every other route would scroll as though it had this page's bars.
    expect(viewport.setStickyOffset).toHaveBeenLastCalledWith(null);
  });
});

/* ── Lifecycle ───────────────────────────────────────────────────────────── */

describe('init', () => {
  it('loads config, syncs the scroll position once and subscribes', () => {
    const { bloc, viewport, configInit } = build();

    bloc.init();

    expect(configInit).toHaveBeenCalled();
    expect(viewport.scrollY).toHaveBeenCalled();
    expect(viewport.onScroll).toHaveBeenCalled();
  });

  it('re-syncs whenever the viewport reports a scroll or a resize', () => {
    const viewport = stubViewport({ scrollY: vi.fn(() => 900) });
    const { bloc } = build({ viewport });

    bloc.init();
    const listener = viewport.onScroll.mock.calls[0][0] as () => void;
    viewport.scrollY.mockReturnValue(0);
    listener();

    expect(bloc.stickyVisible).toBe(false);
  });

  it('removes the listener and clears the sticky offset on teardown', () => {
    const stopScroll = vi.fn();
    const viewport = stubViewport({ onScroll: vi.fn(() => stopScroll) });
    const { bloc } = build({ viewport });

    const teardown = bloc.init();
    teardown();

    // The old `scrollListenerAttached` latch let these outlive the page.
    expect(stopScroll).toHaveBeenCalledTimes(1);
    expect(viewport.setStickyOffset).toHaveBeenCalledWith(null);
  });
});

describe('the news feature flag', () => {
  it('takes the flag at face value when it is already on, and never polls', () => {
    vi.useFakeTimers();
    const isEnabled = vi.fn(() => true);
    const { bloc } = build({ flags: { isEnabled }, flagPollMs: 10, flagMaxTries: 3 });

    expect(bloc.newsEnabled).toBe(true);
    bloc.init();
    vi.advanceTimersByTime(1000);

    expect(isEnabled).toHaveBeenCalledTimes(1);
  });

  it('re-asks until the flag resolves, then stops', () => {
    vi.useFakeTimers();
    // PostHog's `onFeatureFlags` can fire once while the flag still reads
    // false and then never fire again, which is what this poll is for.
    const isEnabled = vi
      .fn()
      .mockReturnValueOnce(false)
      .mockReturnValueOnce(false)
      .mockReturnValue(true);
    const { bloc } = build({ flags: { isEnabled }, flagPollMs: 10, flagMaxTries: 25 });

    expect(bloc.newsEnabled).toBe(false);
    bloc.init();

    vi.advanceTimersByTime(10);
    expect(bloc.newsEnabled).toBe(false);

    vi.advanceTimersByTime(10);
    expect(bloc.newsEnabled).toBe(true);

    const settled = isEnabled.mock.calls.length;
    vi.advanceTimersByTime(1000);
    expect(isEnabled).toHaveBeenCalledTimes(settled);
  });

  it('gives up after the try limit rather than polling forever', () => {
    vi.useFakeTimers();
    const isEnabled = vi.fn(() => false);
    const { bloc } = build({ flags: { isEnabled }, flagPollMs: 10, flagMaxTries: 3 });

    bloc.init();
    vi.advanceTimersByTime(1000);

    expect(isEnabled).toHaveBeenCalledTimes(4); // once up front, then three tries
    expect(bloc.newsEnabled).toBe(false);
  });

  it('stops polling when the page is torn down', () => {
    vi.useFakeTimers();
    const isEnabled = vi.fn(() => false);
    const { bloc } = build({ flags: { isEnabled }, flagPollMs: 10, flagMaxTries: 25 });

    const teardown = bloc.init();
    vi.advanceTimersByTime(10);
    const before = isEnabled.mock.calls.length;
    teardown();
    vi.advanceTimersByTime(1000);

    expect(isEnabled).toHaveBeenCalledTimes(before);
  });

  it('turns the news section on as soon as the flag resolves', () => {
    vi.useFakeTimers();
    const client = inertClient();
    seedDetails(client, { id: 'abc', news: [{ title: 'a' }] });
    const isEnabled = vi.fn().mockReturnValueOnce(false).mockReturnValue(true);
    const { bloc } = build({ client, flags: { isEnabled }, flagPollMs: 10, flagMaxTries: 25 });

    expect(bloc.news).toEqual([]);
    bloc.init();
    vi.advanceTimersByTime(10);

    expect(bloc.news).toHaveLength(1);
    expect(bloc.showsNews).toBe(true);
  });
});

/* ── Tracking intents ────────────────────────────────────────────────────── */

describe('setScore', () => {
  const tracked = {
    id: 'abc',
    episodeCount: 12,
    userAnime: { id: 'u1', status: 'WATCHING', score: 5, episodes: 3 },
  };

  it('sends the whole row, so a score write cannot blank the status', async () => {
    const client = inertClient();
    seedDetails(client, tracked);
    const { bloc, tracking } = build({ client });

    bloc.setScore('8');

    await vi.waitFor(() => expect(tracking.save).toHaveBeenCalled());
    expect(tracking.save).toHaveBeenCalledWith({
      animeID: 'abc',
      status: 'WATCHING',
      score: 8,
      episodes: 3,
    });
  });

  it('does nothing for a viewer who is not tracking the show', () => {
    const client = inertClient();
    seedDetails(client, { id: 'abc' });
    const { bloc, tracking } = build({ client });

    bloc.setScore('8');

    expect(tracking.save).not.toHaveBeenCalled();
  });

  it('does nothing for the empty option, which is "no score" rather than zero', () => {
    const client = inertClient();
    seedDetails(client, tracked);
    const { bloc, tracking } = build({ client });

    bloc.setScore('');

    expect(tracking.save).not.toHaveBeenCalled();
  });
});

describe('stepEpisodes', () => {
  function trackedAt(episodes: number) {
    return { id: 'abc', episodeCount: 12, userAnime: { id: 'u1', status: 'WATCHING', episodes } };
  }

  it('sends the next count up', async () => {
    const client = inertClient();
    seedDetails(client, trackedAt(3));
    const { bloc, tracking } = build({ client });

    bloc.stepEpisodes(1);

    await vi.waitFor(() => expect(tracking.save).toHaveBeenCalled());
    expect(tracking.save.mock.calls[0][0].episodes).toBe(4);
  });

  it('does not write when the value would not move at the bottom', () => {
    const client = inertClient();
    seedDetails(client, trackedAt(0));
    const { bloc, tracking } = build({ client });

    bloc.stepEpisodes(-1);

    // The stepper is held down; a no-op step must not be a mutation.
    expect(tracking.save).not.toHaveBeenCalled();
  });

  it('does not write when the value would not move at the top', () => {
    const client = inertClient();
    seedDetails(client, trackedAt(12));
    const { bloc, tracking } = build({ client });

    expect(bloc.episodeTotal).toBe(12);
    bloc.stepEpisodes(1);

    expect(tracking.save).not.toHaveBeenCalled();
  });

  it('still refuses to go negative when the show length is unknown', () => {
    const client = inertClient();
    // No episodeCount and no episode list: the length is genuinely unknown.
    seedDetails(client, { id: 'abc', userAnime: { id: 'u1', status: 'WATCHING', episodes: 0 } });
    const { bloc, tracking } = build({ client });

    expect(bloc.episodeTotal).toBeNull();
    bloc.stepEpisodes(-1);

    expect(tracking.save).not.toHaveBeenCalled();
  });

  it('does nothing for a viewer who is not tracking the show', () => {
    const client = inertClient();
    seedDetails(client, { id: 'abc', episodeCount: 12 });
    const { bloc, tracking } = build({ client });

    bloc.stepEpisodes(1);

    expect(tracking.save).not.toHaveBeenCalled();
  });
});

describe('markEpisode', () => {
  it('forwards the intent against the resolved record', async () => {
    const client = inertClient();
    seedDetails(client, { id: 'real-id', userAnime: { id: 'u1' } }, 'slug-like-thing');
    const { bloc, tracking } = build({
      client,
      source: livePayload({ animeId: 'slug-like-thing' }).source,
    });

    bloc.markEpisode({ episodeNumber: 5, watched: true });

    await vi.waitFor(() => expect(tracking.markEpisode).toHaveBeenCalledWith('real-id', 5, true));
  });

  it('forwards an unwatch too', async () => {
    const client = inertClient();
    seedDetails(client, { id: 'abc', userAnime: { id: 'u1' } });
    const { bloc, tracking } = build({ client });

    bloc.markEpisode({ episodeNumber: 2, watched: false });

    await vi.waitFor(() => expect(tracking.markEpisode).toHaveBeenCalledWith('abc', 2, false));
  });
});

describe('a write that fails', () => {
  it("reaches the notifier with the server's own message", async () => {
    const client = inertClient();
    seedDetails(client, { id: 'abc', userAnime: { id: 'u1', episodes: 1 } });
    const tracking = {
      save: vi.fn(async () => {
        throw new Error('Access denied');
      }),
      markEpisode: vi.fn(async () => ({})),
    };
    const { bloc, notify } = build({ client, tracking });

    bloc.setScore('8');

    await vi.waitFor(() => expect(notify.error).toHaveBeenCalledWith('Access denied'));
  });

  it('falls back to a sentence when the rejection carries no message', async () => {
    const client = inertClient();
    seedDetails(client, { id: 'abc', userAnime: { id: 'u1' } });
    const tracking = {
      save: vi.fn(async () => ({})),
      markEpisode: vi.fn(() => Promise.reject({})),
    };
    const { bloc, notify } = build({ client, tracking });

    bloc.markEpisode({ episodeNumber: 1, watched: true });

    await vi.waitFor(() =>
      expect(notify.error).toHaveBeenCalledWith('Failed to mark that episode'),
    );
  });

  it('is not left pending after it settles', async () => {
    const client = inertClient();
    seedDetails(client, { id: 'abc', userAnime: { id: 'u1', episodes: 1 } });
    const { bloc, tracking } = build({ client });

    bloc.setScore('8');
    await vi.waitFor(() => expect(tracking.save).toHaveBeenCalled());
    await vi.waitFor(() => expect(bloc.pending).toBe(false));
  });
});

/* ── The failure toast ───────────────────────────────────────────────────── */

describe('trackingNotify', () => {
  afterEach(() => {
    delete (window as any).loggedInStoreValue;
    delete (window as any).loginModalStore;
  });

  it('shows a short message as it arrived', () => {
    trackingNotify.error('Episode 5 is not in this season');

    expect(toastError).toHaveBeenCalledWith('Episode 5 is not in this season');
  });

  it('replaces a message too long to read in a toast', () => {
    const long = 'x'.repeat(80);

    trackingNotify.error(long);

    expect(toastError).toHaveBeenCalledWith('Could not save your progress');
  });

  it('keeps a message one character under the limit', () => {
    const borderline = 'y'.repeat(79);

    trackingNotify.error(borderline);

    expect(toastError).toHaveBeenCalledWith(borderline);
  });

  it('offers a signed-out viewer a login button rather than a message they cannot act on', () => {
    const openLogin = vi.fn();
    (window as any).loggedInStoreValue = { isLoggedIn: false };
    (window as any).loginModalStore = { openLogin };

    trackingNotify.error('GraphQL error: Unauthorized');

    expect(toastError).toHaveBeenCalledWith(
      'Please log in to track this anime',
      expect.objectContaining({ duration: 8000 }),
    );
    toastError.mock.calls[0][1].action.onClick();
    expect(openLogin).toHaveBeenCalled();
  });

  it('tells a signed-in viewer their session is the problem', () => {
    (window as any).loggedInStoreValue = { isLoggedIn: true };

    trackingNotify.error('access denied');

    expect(toastError).toHaveBeenCalledWith('Authentication error. Please try again.');
  });

  it.each([
    'Forbidden',
    'Access denied',
    'authentication failed',
    'not authenticated',
    'not logged in',
    'login required',
  ])('classifies %s as an auth failure whatever its casing', (message) => {
    (window as any).loggedInStoreValue = { isLoggedIn: true };

    trackingNotify.error(message);

    expect(toastError).toHaveBeenCalledWith('Authentication error. Please try again.');
  });

  it('does not truncate an auth message, because it is replaced anyway', () => {
    (window as any).loggedInStoreValue = { isLoggedIn: true };

    trackingNotify.error(`Unauthorized: ${'z'.repeat(200)}`);

    expect(toastError).toHaveBeenCalledWith('Authentication error. Please try again.');
  });
});

/* ── Schedule ────────────────────────────────────────────────────────────── */

describe('the schedule', () => {
  const upcoming = {
    id: 'abc',
    duration: '24 min',
    broadcast: 'Saturdays at 23:00 (JST)',
    episodes: [
      { episodeNumber: 8, airDate: '2025-03-01T13:00:00Z', airTime: '2025-03-01T13:00:00Z' },
    ],
  };

  it('resolves the next episode from the record itself', () => {
    const client = inertClient();
    seedDetails(client, upcoming);
    const { bloc } = build({ client });

    expect(bloc.hasSchedule).toBe(true);
    expect(bloc.timing?.exact).toBe(true);
    expect(bloc.countdown).toBe('1h');
    expect(bloc.episodeNumber).toBe('8');
    expect(bloc.nextChip).toBe('Next in 1h');
    expect(bloc.scheduleLabel).toBe('Next episode');
    expect(bloc.live).toBe(false);
    expect(bloc.aired).toBe(false);
    expect(bloc.broadcastSlot).toBe('Saturdays at 23:00 (JST)');
    expect(bloc.localZone).not.toBe('');
  });

  it('is live while the episode is on air', () => {
    const client = inertClient();
    seedDetails(client, {
      ...upcoming,
      episodes: [
        { episodeNumber: 9, airDate: '2025-03-01T11:50:00Z', airTime: '2025-03-01T11:50:00Z' },
      ],
    });
    const { bloc } = build({ client });

    expect(bloc.live).toBe(true);
    expect(bloc.nextChip).toBe('NOW');
    expect(bloc.scheduleLabel).toBe('Airing now');
  });

  it('falls back to the notification store when the record carries no episodes', () => {
    const client = inertClient();
    seedDetails(client, { id: 'abc' });
    const { bloc } = build({
      client,
      notifications: readable({
        timingData: { abc: { countdown: '2h', episode: { episodeNumber: 7 } } },
        countdowns: {},
      }),
    });

    expect(bloc.timing).toBeNull();
    expect(bloc.hasSchedule).toBe(true);
    expect(bloc.countdown).toBe('2h');
    expect(bloc.episodeNumber).toBe('7');
    expect(bloc.nextChip).toBe('Next in 2h');
  });

  it('falls back again to the worker countdowns when the store has nothing', () => {
    const client = inertClient();
    seedDetails(client, { id: 'abc' });
    const { bloc } = build({
      client,
      notifications: readable({
        timingData: {},
        countdowns: { abc: { countdown: '45m', isAiring: false, hasAired: false } },
      }),
    });

    expect(bloc.hasSchedule).toBe(true);
    expect(bloc.countdown).toBe('45m');
    expect(bloc.nextChip).toBe('Next in 45m');
  });

  it('reads live and aired off the worker when there is no resolved timing', () => {
    const client = inertClient();
    seedDetails(client, { id: 'abc' });
    const { bloc } = build({
      client,
      notifications: readable({
        timingData: {},
        countdowns: { abc: { isAiring: true, countdown: 'AIRING NOW' } },
      }),
    });

    expect(bloc.live).toBe(true);
    expect(bloc.scheduleLabel).toBe('Airing now');
  });

  it('says nothing at all for a show with no schedule anywhere', () => {
    const client = inertClient();
    seedDetails(client, { id: 'abc', endDate: '2020-01-01T00:00:00Z' });
    const { bloc } = build({ client });

    expect(bloc.hasSchedule).toBe(false);
    expect(bloc.nextChip).toBeNull();
    expect(bloc.countdown).toBe('');
    expect(bloc.episodeNumber).toBe('');
    expect(bloc.localTime).toBe('');
    expect(bloc.broadcastSlot).toBeNull();
  });

  it('holds the JST panel open and shut', () => {
    const { bloc } = build();

    expect(bloc.jstOpen).toBe(false);
    bloc.toggleJst();
    expect(bloc.jstOpen).toBe(true);
    bloc.closeJst();
    expect(bloc.jstOpen).toBe(false);
  });
});

/* ── Identity and boundaries ─────────────────────────────────────────────── */

describe('identity', () => {
  it("titles the page in the reader's language", () => {
    const client = inertClient();
    seedDetails(client, { id: 'abc', titleEn: 'Frieren', titleJp: 'ソウソウノフリーレン' });

    expect(build({ client }).bloc.title).toBe('Frieren');
    expect(build({ client, titleLanguage: 'japanese' }).bloc.title).toBe('ソウソウノフリーレン');
  });

  it('labels a season, and calls TheTVDB season 0 a special', () => {
    const client = inertClient();
    seedDetails(client, { id: 'abc', seasonNumber: 2 });
    expect(build({ client }).bloc.seasonText).toBe('Season 2');

    const zero = inertClient();
    seedDetails(zero, { id: 'abc', seasonNumber: 0 });
    expect(build({ client: zero }).bloc.seasonText).toBe('Special');
  });

  it('points the news link at the slug when there is one', () => {
    const client = inertClient();
    seedDetails(client, { id: 'abc', slug: 'frieren' });

    expect(build({ client }).bloc.newsHref).toBe('/anime/frieren/news');
  });

  it('builds both artwork candidates through the image port', () => {
    const client = inertClient();
    seedDetails(client, { id: 'abc' });
    const { bloc } = build({ client });

    expect(bloc.imageSources).toEqual(['cdn/banners/abc', 'cdn/abc']);
    expect(bloc.stickyBackground).toBe('cdn/banners/abc');
  });

  it('hands the same array back on every read, so the image loader is not restarted', () => {
    const client = inertClient();
    seedDetails(client, { id: 'abc' });
    const { bloc } = build({ client });

    expect(bloc.imageSources).toBe(bloc.imageSources);
    expect(bloc.anime).toBe(bloc.anime);
  });

  it('records that the hero art settled', () => {
    const { bloc } = build();

    expect(bloc.artLoaded).toBe(false);
    bloc.artChosen();
    expect(bloc.artLoaded).toBe(true);
  });

  it('joins studios that arrive as a list, and accepts a bare string', () => {
    const list = inertClient();
    seedDetails(list, { id: 'abc', studios: ['Madhouse', 'Bones'] });
    expect(build({ client: list }).bloc.studio).toBe('Madhouse');
    expect(build({ client: list }).bloc.studios).toBe('Madhouse, Bones');

    const bare = inertClient();
    seedDetails(bare, { id: 'abc', studios: 'Madhouse' });
    expect(build({ client: bare }).bloc.studios).toBe('Madhouse');
  });
});

describe('a page with nothing on it', () => {
  it('reads as empty rather than throwing when there is no record at all', () => {
    const { bloc } = build({ detailsFn: () => new Promise(() => {}) });

    expect(bloc.anime).toBeNull();
    expect(bloc.title).toBe('');
    expect(bloc.seasonText).toBe('');
    expect(bloc.seriesLink).toBe('');
    expect(bloc.newsHref).toBe('/');
    expect(bloc.imageSources).toEqual([]);
    expect(bloc.stickyBackground).toBe('');
    expect(bloc.studio).toBeNull();
    expect(bloc.studios).toBeNull();
    expect(bloc.news).toEqual([]);
    expect(bloc.episodes).toEqual([]);
    expect(bloc.relatedAnime).toEqual([]);
    expect(bloc.canTrack).toBe(false);
    expect(bloc.score).toBe('');
    expect(bloc.watchedCount).toBe(0);
    expect(bloc.episodeTotal).toBeNull();
    expect(bloc.watchedNumbers).toBeNull();
    expect(bloc.pending).toBe(false);
    expect(bloc.hasSchedule).toBe(false);
  });

  it('has no artwork candidates for a record with no id', () => {
    const client = inertClient();
    seedDetails(client, { titleEn: 'A show with no id' });
    const { bloc } = build({ client });

    expect(bloc.status).toBe('ready');
    expect(bloc.imageSources).toEqual([]);
  });

  it('reads a show with empty collections as empty, not as broken', () => {
    const client = inertClient();
    seedDetails(client, { id: 'abc', episodes: [], studios: [], news: [], relatedAnime: [] });
    const { bloc } = build({ client, flags: { isEnabled: () => true } });

    expect(bloc.episodes).toEqual([]);
    expect(bloc.studio).toBeNull();
    expect(bloc.showsEpisodes).toBe(false);
    expect(bloc.showsNews).toBe(false);
    expect(bloc.sections.map((tab) => tab.value)).toEqual(['synopsis', 'characters']);
  });

  it('calls a record with no end date "Airing", which is all the API tells us', () => {
    const client = inertClient();
    seedDetails(client, { id: 'abc' });
    expect(build({ client }).bloc.airing).toEqual({ label: 'Airing', airing: true });

    const finished = inertClient();
    seedDetails(finished, { id: 'abc', endDate: '2024-03-22T00:00:00Z' });
    expect(build({ client: finished }).bloc.airing).toEqual({ label: 'Finished', airing: false });
  });
});
