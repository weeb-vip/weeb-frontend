import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { flushSync } from 'svelte';
import { QueryClient } from '@tanstack/svelte-query';
import { readable, writable } from 'svelte/store';
import {
  HomepageBloc,
  type AiringEntry,
  type HomeAccessor,
  type HomeAnime,
  type HomepageDeps,
  type PublishingWork
} from './HomepageSSR.bloc.svelte';

/**
 * The homepage bloc, driven through its ports.
 *
 * The rule the class exists for is the single clock: the hero badge and the
 * rail beside it used to resolve the same episode's timing separately and
 * drifted apart within a minute ("18H" next to "Airing in 19h"). Everything
 * here that touches `airingEntries` is pinning that one resolution reaches
 * both surfaces, and that the rail's window ("just aired", then "upcoming") is
 * the one the reader was promised.
 *
 * Nothing fetches: every query port hands back a promise that never settles,
 * and the data the queries report is either the loader payload (as
 * `initialData`) or a value seeded into the client's cache.
 */

/** A queryFn that must never be awaited — the data always comes from the cache. */
const never = () => new Promise<never>(() => {});

const NOW = new Date('2025-03-01T12:00:00Z');

function inertClient(): QueryClient {
  return new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0, refetchOnWindowFocus: false } }
  });
}

const homePort = () => ({ queryKey: ['homedata'] as const, queryFn: never });
const airingPort = (_from: Date, _to?: Date | null, days?: number, limit?: number) => ({
  queryKey: ['currentlyAiring', days, limit] as const,
  queryFn: never
});
const seasonalPort = (season: string, limit?: number) => ({
  queryKey: ['seasonal-anime', season, limit] as const,
  queryFn: never
});

type Payload = ReturnType<HomeAccessor>;

const EMPTY_PAYLOAD: Payload = {
  homeData: null,
  currentlyAiringData: null,
  seasonalData: null,
  publishingWorksData: null,
  currentSeason: 'WINTER_2025',
  isTokenExpired: false
};

/**
 * A bloc over a mutable payload, so a test can change what the loader "gave"
 * and re-read the getters. Every port is stubbed; nothing real is touched.
 */
function makeBloc(payload: Partial<Payload> = {}, deps: Partial<HomepageDeps> = {}) {
  const state = { ...EMPTY_PAYLOAD, ...payload };
  const queryClient = (deps.queryClient as QueryClient) ?? inertClient();
  const bloc = new HomepageBloc({
    source: () => state,
    home: homePort,
    airing: airingPort,
    seasonal: seasonalPort,
    queryClient,
    preferences: readable({ titleLanguage: 'english' as const }),
    auth: readable({ isLoggedIn: false, isAuthInitialized: true }),
    viewport: { isPhone: readable(false), isTablet: readable(false) },
    session: { getAuthToken: () => null, getRefreshToken: () => null, clearTokens: () => {} },
    notifications: { triggerImmediateUpdate: () => {} },
    clock: () => NOW,
    ...deps
  });
  return { bloc, state, queryClient };
}

/** An airing show whose next episode has an exact timestamp. */
function airingShow(id: string, airTime: string, extra: Partial<HomeAnime> = {}): HomeAnime {
  return {
    id,
    slug: `${id}-slug`,
    titleEn: id.toUpperCase(),
    titleJp: `${id}-jp`,
    duration: '24 min',
    nextEpisode: { episodeNumber: 3, airTime },
    ...extra
  };
}

const idsOf = (entries: AiringEntry[]) => entries.map((entry) => entry.airingInfo.id);

beforeEach(() => {
  vi.spyOn(console, 'error').mockImplementation(() => {});
  vi.spyOn(console, 'warn').mockImplementation(() => {});
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

/* ── Shelves ─────────────────────────────────────────────────────────────── */

describe('the top-rated shelf', () => {
  it('renders the loader payload without waiting for a query', () => {
    const { bloc } = makeBloc({ homeData: { topRatedAnime: [{ id: 'a' }, { id: 'b' }] } });

    expect(bloc.topRated.map((anime) => anime.id)).toEqual(['a', 'b']);
    expect(bloc.hasTopRated).toBe(true);
  });

  it('lets the query supersede the payload once it answers', () => {
    const queryClient = inertClient();
    queryClient.setQueryData(['homedata'], { topRatedAnime: [{ id: 'fresh' }] });

    const { bloc } = makeBloc({ homeData: { topRatedAnime: [{ id: 'stale' }] } }, { queryClient });

    expect(bloc.topRated.map((anime) => anime.id)).toEqual(['fresh']);
  });

  it('is empty, not broken, when nothing was supplied at all', () => {
    const { bloc } = makeBloc();

    expect(bloc.topRated).toEqual([]);
    expect(bloc.hasTopRated).toBe(false);
  });

  it('survives a payload whose list is null', () => {
    const { bloc } = makeBloc({ homeData: { topRatedAnime: null } });

    expect(bloc.topRated).toEqual([]);
  });

  it('is cut to the shelf limit for the breakpoint', () => {
    const many = Array.from({ length: 40 }, (_, i) => ({ id: `a${i}` }));

    expect(makeBloc({ homeData: { topRatedAnime: many } }).bloc.topRated).toHaveLength(20);
    expect(
      makeBloc(
        { homeData: { topRatedAnime: many } },
        { viewport: { isPhone: readable(false), isTablet: readable(true) } }
      ).bloc.topRated
    ).toHaveLength(12);
    expect(
      makeBloc(
        { homeData: { topRatedAnime: many } },
        { viewport: { isPhone: readable(true), isTablet: readable(true) } }
      ).bloc.topRated
    ).toHaveLength(6);
  });
});

describe('the shelf limit', () => {
  it.each([
    [false, false, 20],
    [false, true, 12],
    [true, false, 6],
    [true, true, 6]
  ])('is %o phone / %o tablet -> %i cards', (phone, tablet, expected) => {
    const { bloc } = makeBloc(
      {},
      { viewport: { isPhone: readable(phone), isTablet: readable(tablet) } }
    );

    expect(bloc.shelfLimit).toBe(expected);
  });
});

describe('the publishing-works shelf', () => {
  const works: PublishingWork[] = [
    { id: 'w1', urlSlug: 'one', type: 'MANGA', publishedFrom: '2019-04-01' },
    { id: 'w2', urlSlug: null },
    { id: 'w3', urlSlug: '' },
    { id: 'w4', urlSlug: 'four' }
  ];

  it('drops a work with no slug rather than rendering a dead card', () => {
    const { bloc } = makeBloc({ publishingWorksData: { currentlyPublishingWorks: works } });

    expect(bloc.publishingWorks.map((work) => work.id)).toEqual(['w1', 'w4']);
  });

  it('is empty for a null payload', () => {
    expect(makeBloc().bloc.publishingWorks).toEqual([]);
    expect(
      makeBloc({ publishingWorksData: { currentlyPublishingWorks: null } }).bloc.publishingWorks
    ).toEqual([]);
  });

  it('is cut to the shelf limit', () => {
    const many = Array.from({ length: 30 }, (_, i) => ({ id: `w${i}`, urlSlug: `s${i}` }));

    expect(
      makeBloc(
        { publishingWorksData: { currentlyPublishingWorks: many } },
        { viewport: { isPhone: readable(true), isTablet: readable(false) } }
      ).bloc.publishingWorks
    ).toHaveLength(6);
  });

  it('describes a work by kind and year', () => {
    const { bloc } = makeBloc();

    expect(bloc.workSub({ id: 'w', type: 'LIGHT_NOVEL', publishedFrom: '2012-06-10' })).toBe(
      'Light novel · 2012'
    );
    expect(bloc.workSub({ id: 'w', type: null, publishedFrom: null })).toBe('Work');
  });
});

/* ── The season shelf ────────────────────────────────────────────────────── */

describe('the season shelf', () => {
  it('starts on the season the page was rendered for', () => {
    const { bloc } = makeBloc({ currentSeason: 'SPRING_2025' });

    expect(bloc.selectedSeason).toBe('SPRING_2025');
  });

  it('offers this season and the next two', () => {
    const { bloc } = makeBloc({ currentSeason: 'FALL_2025' });

    expect(bloc.seasonOptions).toEqual(['FALL_2025', 'WINTER_2026', 'SPRING_2026']);
  });

  it('names a season for a human', () => {
    const { bloc } = makeBloc();

    expect(bloc.seasonLabel('SUMMER_2024')).toBe('Summer 2024');
  });

  it('sorts the initial season by rating, best first', () => {
    const { bloc } = makeBloc({
      seasonalData: {
        animeBySeasons: [
          { id: 'mid', rating: '7.5' },
          { id: 'best', rating: '9.1' },
          { id: 'none', rating: 'N/A' },
          { id: 'null', rating: null },
          { id: 'junk', rating: 'not a number' }
        ]
      }
    });

    expect(bloc.seasonalAnime.slice(0, 2).map((anime) => anime.id)).toEqual(['best', 'mid']);
    // "N/A", null and unparseable all sort as zero rather than as NaN, which
    // sorts nowhere and leaves the order to the engine.
    expect(bloc.seasonalAnime).toHaveLength(5);
  });

  it('does not mutate the payload while sorting it', () => {
    const list = [{ id: 'a', rating: '1' }, { id: 'b', rating: '9' }];
    const { bloc } = makeBloc({ seasonalData: { animeBySeasons: list } });

    void bloc.seasonalAnime;

    expect(list.map((anime) => anime.id)).toEqual(['a', 'b']);
  });

  it('shows nothing for a season the page was not rendered with, until it lands', () => {
    const { bloc } = makeBloc({
      currentSeason: 'WINTER_2025',
      seasonalData: { animeBySeasons: [{ id: 'winter' }] }
    });

    bloc.selectSeason('SPRING_2025');
    flushSync();

    // The loader's payload belongs to WINTER only; carrying it over would show
    // winter's titles under a spring heading.
    expect(bloc.seasonalAnime).toEqual([]);
    expect(bloc.selectedSeason).toBe('SPRING_2025');
  });

  it('renders another season once its rows are in the cache', () => {
    const queryClient = inertClient();
    queryClient.setQueryData(['seasonal-anime', 'SPRING_2025', 14], {
      animeBySeasons: [{ id: 'spring' }]
    });
    const { bloc } = makeBloc(
      { currentSeason: 'WINTER_2025', seasonalData: { animeBySeasons: [{ id: 'winter' }] } },
      { queryClient }
    );

    expect(bloc.seasonalAnime.map((anime) => anime.id)).toEqual(['winter']);

    bloc.selectSeason('SPRING_2025');
    flushSync();

    expect(bloc.seasonalAnime.map((anime) => anime.id)).toEqual(['spring']);
  });

  it('goes back to the payload when the initial season is reselected', () => {
    const { bloc } = makeBloc({
      currentSeason: 'WINTER_2025',
      seasonalData: { animeBySeasons: [{ id: 'winter' }] }
    });

    bloc.selectSeason('SPRING_2025');
    flushSync();
    bloc.selectSeason('WINTER_2025');
    flushSync();

    expect(bloc.seasonalAnime.map((anime) => anime.id)).toEqual(['winter']);
  });

  it('is never loading on the season the loader supplied', () => {
    const { bloc } = makeBloc({
      currentSeason: 'WINTER_2025',
      seasonalData: { animeBySeasons: [{ id: 'winter' }] }
    });

    expect(bloc.isSeasonLoading).toBe(false);
  });

  it('is loading once another season is picked and nothing has answered', () => {
    const { bloc } = makeBloc({
      currentSeason: 'WINTER_2025',
      seasonalData: { animeBySeasons: [{ id: 'winter' }] }
    });

    bloc.selectSeason('SUMMER_2025');
    flushSync();

    expect(bloc.isSeasonLoading).toBe(true);
  });

  it('is cut to the shelf limit', () => {
    const many = Array.from({ length: 30 }, (_, i) => ({ id: `a${i}`, rating: String(i) }));
    const { bloc } = makeBloc(
      { seasonalData: { animeBySeasons: many } },
      { viewport: { isPhone: readable(true), isTablet: readable(false) } }
    );

    expect(bloc.seasonalAnime).toHaveLength(6);
  });
});

/* ── The airing rail ─────────────────────────────────────────────────────── */

describe('the airing rail', () => {
  const shows: HomeAnime[] = [
    airingShow('justaired', '2025-03-01T11:50:00Z'),
    airingShow('longago', '2025-03-01T11:00:00Z'),
    airingShow('soon', '2025-03-01T13:00:00Z'),
    airingShow('later', '2025-03-01T18:00:00Z')
  ];

  function rail(list: HomeAnime[] = shows) {
    return makeBloc({ currentlyAiringData: { currentlyAiring: list } }).bloc;
  }

  it('leads with what just aired, then counts up through what is coming', () => {
    expect(idsOf(rail().airingEntries)).toEqual(['justaired', 'soon', 'later']);
  });

  it('drops an episode that aired longer ago than the recently-aired window', () => {
    // An hour back is outside the 30-minute window and is not upcoming either,
    // so it belongs to neither half of the rail.
    expect(idsOf(rail().airingEntries)).not.toContain('longago');
  });

  it('keeps at most two recently-aired entries, most recent first', () => {
    const entries = rail([
      airingShow('a', '2025-03-01T11:55:00Z'),
      airingShow('b', '2025-03-01T11:50:00Z'),
      airingShow('c', '2025-03-01T11:45:00Z'),
      airingShow('d', '2025-03-01T11:40:00Z')
    ]).airingEntries;

    expect(idsOf(entries)).toEqual(['a', 'b']);
  });

  it('includes an episode airing exactly now, and one exactly at the window edge', () => {
    const entries = rail([
      airingShow('exactly-now', '2025-03-01T12:00:00Z'),
      airingShow('edge', '2025-03-01T11:30:00Z')
    ]).airingEntries;

    expect(idsOf(entries).sort()).toEqual(['edge', 'exactly-now']);
  });

  it('skips a show with no next episode, or one with no date and no time', () => {
    const entries = rail([
      { id: 'nonext' },
      { id: 'blank', nextEpisode: { episodeNumber: 1 } },
      airingShow('good', '2025-03-01T13:00:00Z')
    ]).airingEntries;

    expect(idsOf(entries)).toEqual(['good']);
  });

  it('skips an episode whose timestamp cannot be read', () => {
    expect(idsOf(rail([airingShow('junk', 'not-a-date')]).airingEntries)).toEqual([]);
  });

  it('is empty, and says so, when nothing is airing', () => {
    const { bloc } = makeBloc();

    expect(bloc.airingEntries).toEqual([]);
    expect(bloc.hasAiring).toBe(false);
  });

  it('carries the slug through, so the card links where the rest of the page does', () => {
    // Rebuilt field by field: an omitted field is lost even though the query
    // returned it, which is how these cards once linked to /anime/<uuid>.
    const entry = rail().airingEntries[0];

    expect(entry.anime.slug).toBe('justaired-slug');
    expect(entry.id).toBe('homepage-justaired');
  });

  it('resolves the timing once and hands the same object to both surfaces', () => {
    const bloc = rail();
    const entry = bloc.airingEntries[0];

    expect(bloc.bannerTiming).toBe(entry.airingInfo.timing);
    expect(entry.airingInfo.airTimeDisplay).toEqual({
      show: true,
      text: entry.airingInfo.timing.label,
      variant: entry.airingInfo.timing.variant
    });
    expect(entry.airingInfo.nextEpisodeDate).toBe(entry.airingInfo.timing.airDateTime);
    expect(entry.airingInfo.nextEpisode?.airDate).toBe(entry.airingInfo.timing.airDateTime);
  });

  it('defaults the missing halves of a record rather than leaving them undefined', () => {
    const entry = rail([airingShow('bare', '2025-03-01T13:00:00Z')]).airingEntries[0];

    expect(entry.anime.tags).toEqual([]);
    expect(entry.anime.description).toBeNull();
    expect(entry.anime.episodeCount).toBeNull();
    expect(entry.anime.userAnime).toBeNull();
  });
});

describe('"airing from your list"', () => {
  const list = [
    airingShow('watching', '2025-03-01T13:00:00Z', { userAnime: { status: 'WATCHING' } }),
    airingShow('legacy', '2025-03-01T14:00:00Z', { userAnime: { status: 'watching' } }),
    airingShow('planned', '2025-03-01T15:00:00Z', { userAnime: { status: 'PLANTOWATCH' } }),
    airingShow('completed', '2025-03-01T16:00:00Z', { userAnime: { status: 'COMPLETED' } }),
    airingShow('untracked', '2025-03-01T17:00:00Z')
  ];

  it('is WATCHING only — a plan to watch is not something you are waiting on', () => {
    const { bloc } = makeBloc({ currentlyAiringData: { currentlyAiring: list } });

    expect(idsOf(bloc.myAiring)).toEqual(['watching', 'legacy']);
  });

  it('normalises the status rather than comparing it raw', () => {
    const { bloc } = makeBloc({
      currentlyAiringData: {
        currentlyAiring: [
          airingShow('mixed', '2025-03-01T13:00:00Z', { userAnime: { status: 'Watching' } })
        ]
      }
    });

    expect(idsOf(bloc.myAiring)).toEqual(['mixed']);
  });

  it('is empty when the visitor follows nothing that is airing', () => {
    const { bloc } = makeBloc({
      currentlyAiringData: { currentlyAiring: [airingShow('x', '2025-03-01T13:00:00Z')] }
    });

    expect(bloc.myAiring).toEqual([]);
  });
});

describe('the hero', () => {
  const shows = [
    airingShow('first', '2025-03-01T13:00:00Z'),
    airingShow('second', '2025-03-01T14:00:00Z')
  ];

  it('points at the first entry until the rail is used', () => {
    const { bloc } = makeBloc({ currentlyAiringData: { currentlyAiring: shows } });

    expect(bloc.bannerId).toBe('first');
    expect(bloc.bannerAnime).toBe(bloc.airingEntries[0].airingInfo);
  });

  it('follows the rail\'s pick, and keeps it after the pointer leaves', () => {
    const { bloc } = makeBloc({ currentlyAiringData: { currentlyAiring: shows } });

    bloc.select({ id: 'second' });

    expect(bloc.bannerId).toBe('second');
  });

  it('ignores a selection with no id rather than clearing the pin', () => {
    const { bloc } = makeBloc({ currentlyAiringData: { currentlyAiring: shows } });

    bloc.select({ id: 'second' });
    bloc.select(null);
    bloc.select(undefined);
    bloc.select({});

    expect(bloc.bannerId).toBe('second');
  });

  it('falls back to the first entry when the pinned show leaves the rail', () => {
    const { bloc } = makeBloc({ currentlyAiringData: { currentlyAiring: shows } });

    bloc.select({ id: 'gone-from-the-rail' });

    expect(bloc.bannerId).toBe('first');
  });

  it('has nothing to point at when nothing is airing', () => {
    const { bloc } = makeBloc();

    expect(bloc.bannerEntry).toBeNull();
    expect(bloc.bannerAnime).toBeNull();
    expect(bloc.bannerTiming).toBeNull();
    expect(bloc.bannerId).toBeNull();
  });

  it('falls back to the best-rated show only when nothing is airing', () => {
    const home = { topRatedAnime: [{ id: 'best' }, { id: 'next' }] };

    expect(makeBloc({ homeData: home }).bloc.fallbackBannerAnime?.id).toBe('best');
    expect(
      makeBloc({ homeData: home, currentlyAiringData: { currentlyAiring: shows } }).bloc
        .fallbackBannerAnime
    ).toBeNull();
  });

  it('has no fallback either when there is nothing at all', () => {
    expect(makeBloc().bloc.fallbackBannerAnime).toBeNull();
  });
});

describe('nudging the notification worker', () => {
  it('only pokes it once there is airing data to work from', () => {
    const triggerImmediateUpdate = vi.fn();

    makeBloc({}, { notifications: { triggerImmediateUpdate } }).bloc.refreshNotifications();
    expect(triggerImmediateUpdate).not.toHaveBeenCalled();

    makeBloc(
      { currentlyAiringData: { currentlyAiring: [airingShow('a', '2025-03-01T13:00:00Z')] } },
      { notifications: { triggerImmediateUpdate } }
    ).bloc.refreshNotifications();
    expect(triggerImmediateUpdate).toHaveBeenCalledTimes(1);
  });
});

/* ── Per-card reads ──────────────────────────────────────────────────────── */

describe('per-card reads', () => {
  it('titles a card in the language the preferences port reports', () => {
    const anime = { titleEn: 'Frieren', titleJp: '葬送のフリーレン' };

    expect(makeBloc().bloc.titleFor(anime)).toBe('Frieren');
    expect(
      makeBloc({}, { preferences: readable({ titleLanguage: 'japanese' as const }) }).bloc.titleFor(
        anime
      )
    ).toBe('葬送のフリーレン');
  });

  it('drops the half of a poster subtitle that has no value', () => {
    const { bloc } = makeBloc();

    // "0 ep · 2026" was shipping on any show whose episode count had not landed.
    expect(bloc.posterSub({ id: 'a', episodeCount: 0, startDate: '2026-01-05' })).toBe('2026');
    expect(bloc.posterSub({ id: 'a', episodeCount: 12, startDate: '2026-01-05' })).toBe(
      '12 ep · 2026'
    );
  });

  it('counts the episode rows when the count field has not landed', () => {
    const { bloc } = makeBloc();

    expect(
      bloc.posterSub({ id: 'a', episodeCount: null, episodes: [{}, {}, {}], studios: ['Bones'] })
    ).toBe('3 ep · Bones');
  });

  it('prefers the studio over the year', () => {
    const { bloc } = makeBloc();

    expect(bloc.posterSub({ id: 'a', episodeCount: 12, studios: ['MAPPA'], startDate: '2020-01-01' })).toBe(
      '12 ep · MAPPA'
    );
  });

  it('writes the episode and the countdown on a "from your list" card', () => {
    const { bloc } = makeBloc({
      currentlyAiringData: {
        currentlyAiring: [
          airingShow('soon', '2025-03-01T13:00:00Z', { userAnime: { status: 'WATCHING' } })
        ]
      }
    });
    const entry = bloc.myAiring[0];

    expect(bloc.watchingSub(entry)).toBe('EP 3 · in 1h');
  });

  it('says "Airing now" instead of a countdown while the episode is live', () => {
    const { bloc } = makeBloc({
      currentlyAiringData: {
        currentlyAiring: [
          airingShow('live', '2025-03-01T11:50:00Z', { userAnime: { status: 'WATCHING' } })
        ]
      }
    });

    expect(bloc.watchingSub(bloc.myAiring[0])).toContain('Airing now');
  });

  it('omits the episode number when the record does not carry one', () => {
    const { bloc } = makeBloc({
      currentlyAiringData: {
        currentlyAiring: [
          {
            id: 'noep',
            duration: '24 min',
            userAnime: { status: 'WATCHING' },
            nextEpisode: { airTime: '2025-03-01T13:00:00Z' }
          }
        ]
      }
    });

    expect(bloc.watchingSub(bloc.myAiring[0])).toBe('in 1h');
  });
});

/* ── Lifecycle ───────────────────────────────────────────────────────────── */

describe('init', () => {
  it('clears a token the loader already found expired', () => {
    const clearTokens = vi.fn();
    const { bloc } = makeBloc(
      { isTokenExpired: true },
      { session: { getAuthToken: () => 'tok', getRefreshToken: () => null, clearTokens } }
    );

    bloc.init()();

    expect(clearTokens).toHaveBeenCalledTimes(1);
  });

  it('leaves a good token alone', () => {
    const clearTokens = vi.fn();
    const { bloc } = makeBloc(
      { isTokenExpired: false },
      { session: { getAuthToken: () => 'tok', getRefreshToken: () => null, clearTokens } }
    );

    bloc.init()();

    expect(clearTokens).not.toHaveBeenCalled();
  });

  it('refetches every shelf when the visitor signs in', () => {
    const auth = writable({ isLoggedIn: false, isAuthInitialized: true });
    const { bloc, queryClient } = makeBloc({}, { auth });
    const refetch = vi.spyOn(queryClient, 'refetchQueries').mockResolvedValue(undefined);

    const stop = bloc.init();
    // The first emission establishes the baseline; it must not refetch.
    expect(refetch).not.toHaveBeenCalled();

    auth.set({ isLoggedIn: true, isAuthInitialized: true });

    expect(refetch.mock.calls.map(([options]) => (options as any).queryKey)).toEqual([
      ['homedata'],
      ['currentlyAiring'],
      ['seasonal-anime']
    ]);
    stop();
  });

  it('ignores auth state that has not initialised yet', () => {
    const auth = writable({ isLoggedIn: false, isAuthInitialized: false });
    const { bloc, queryClient } = makeBloc({}, { auth });
    const refetch = vi.spyOn(queryClient, 'refetchQueries').mockResolvedValue(undefined);

    const stop = bloc.init();
    auth.set({ isLoggedIn: true, isAuthInitialized: false });

    expect(refetch).not.toHaveBeenCalled();
    stop();
  });

  it('does not refetch when the state re-emits the same answer', () => {
    const auth = writable({ isLoggedIn: true, isAuthInitialized: true });
    const { bloc, queryClient } = makeBloc({}, { auth });
    const refetch = vi.spyOn(queryClient, 'refetchQueries').mockResolvedValue(undefined);

    const stop = bloc.init();
    auth.set({ isLoggedIn: true, isAuthInitialized: true });

    expect(refetch).not.toHaveBeenCalled();
    stop();
  });

  it('picks up a sign-out that happened in another tab, through the cookie poll', () => {
    vi.useFakeTimers();
    let token: string | null = 'tok';
    const { bloc, queryClient } = makeBloc(
      {},
      { session: { getAuthToken: () => token, getRefreshToken: () => null, clearTokens: () => {} } }
    );
    const refetch = vi.spyOn(queryClient, 'refetchQueries').mockResolvedValue(undefined);

    const stop = bloc.init();
    vi.advanceTimersByTime(5_000);
    expect(refetch).not.toHaveBeenCalled();

    token = null;
    vi.advanceTimersByTime(5_000);

    expect(refetch).toHaveBeenCalledTimes(3);
    stop();
  });

  it('refetches on the app\'s own auth events', () => {
    const { bloc, queryClient } = makeBloc();
    const refetch = vi.spyOn(queryClient, 'refetchQueries').mockResolvedValue(undefined);

    const stop = bloc.init();
    window.dispatchEvent(new Event('loginSuccess'));
    expect(refetch).toHaveBeenCalledTimes(3);

    window.dispatchEvent(new Event('authStateChanged'));
    expect(refetch).toHaveBeenCalledTimes(6);
    stop();
  });

  it('warms the seasons the visitor has not asked for yet', () => {
    vi.useFakeTimers();
    const { bloc, queryClient } = makeBloc({ currentSeason: 'WINTER_2025' });
    const prefetch = vi.spyOn(queryClient, 'prefetchQuery').mockResolvedValue(undefined);

    const stop = bloc.init();
    expect(prefetch).not.toHaveBeenCalled();

    vi.advanceTimersByTime(2_000);

    // The season on screen already has its payload; only the next two are warmed.
    expect(prefetch.mock.calls.map(([options]) => (options as any).queryKey)).toEqual([
      ['seasonal-anime', 'SPRING_2025', undefined],
      ['seasonal-anime', 'SUMMER_2025', undefined]
    ]);
    stop();
  });

  it('tears everything down together — this used to be four onMounts, one of which leaked', () => {
    vi.useFakeTimers();
    let token: string | null = 'tok';
    const auth = writable({ isLoggedIn: false, isAuthInitialized: true });
    const { bloc, queryClient } = makeBloc(
      {},
      {
        auth,
        session: { getAuthToken: () => token, getRefreshToken: () => null, clearTokens: () => {} }
      }
    );
    const refetch = vi.spyOn(queryClient, 'refetchQueries').mockResolvedValue(undefined);
    const prefetch = vi.spyOn(queryClient, 'prefetchQuery').mockResolvedValue(undefined);

    bloc.init()();

    token = null;
    auth.set({ isLoggedIn: true, isAuthInitialized: true });
    window.dispatchEvent(new Event('loginSuccess'));
    vi.advanceTimersByTime(60_000);

    expect(refetch).not.toHaveBeenCalled();
    expect(prefetch).not.toHaveBeenCalled();
  });
});

describe('the single clock', () => {
  it('re-reads it on every tick, so the hero and the rail move together', () => {
    vi.useFakeTimers();
    let now = new Date('2025-03-01T12:00:00Z');
    const { bloc } = makeBloc(
      {
        currentlyAiringData: {
          currentlyAiring: [airingShow('soon', '2025-03-01T13:00:00Z')]
        }
      },
      { clock: () => now }
    );

    const stop = bloc.init();
    expect(bloc.airingEntries[0].airingInfo.timing.countdown).toBe('1h');

    now = new Date('2025-03-01T12:40:00Z');
    vi.advanceTimersByTime(30_000);

    expect(bloc.now.toISOString()).toBe('2025-03-01T12:40:00.000Z');
    expect(bloc.airingEntries[0].airingInfo.timing.countdown).toBe('20m');
    stop();
  });

  it('asks the airing query for a window that starts an hour back', () => {
    const airing = vi.fn(airingPort);
    makeBloc({}, { airing });

    // So an episode that aired moments ago is still on the rail.
    expect(airing.mock.calls[0][0].toISOString()).toBe('2025-03-01T11:00:00.000Z');
    expect(airing.mock.calls[0].slice(1)).toEqual([null, 7, 10]);
  });
});
