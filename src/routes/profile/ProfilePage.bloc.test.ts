import { describe, it, expect, vi } from 'vitest';
import { QueryClient } from '@tanstack/svelte-query';
import {
  ProfilePageBloc,
  realProfileConfig,
  realProfileData,
  type ProfileDataPort,
} from './ProfilePage.bloc.svelte';
import { Status, WorkStatus } from '../../gql/graphql';

/**
 * The dashboard at /profile.
 *
 * Six queries feed one page, and the rules worth pinning are the ones where a
 * wrong answer looks like a right one. The counts are Int64 scalars that arrive
 * as JSON strings, so the TOTAL tile concatenates unless every one is coerced.
 * The three shelves are derived from the airing payload rather than from the
 * watchlist, so what lands on which shelf is arithmetic, not markup. And the
 * page has four distinct states -- loading, populated, empty, failed -- which it
 * must not collapse into "pulse forever": a settled query that returned nothing
 * is an answer.
 *
 * Every query port hands back options that cannot fetch (`enabled: false`), so
 * the only data in these tests is the data a test put there -- through the SSR
 * payload, which is what `initialData` is built from, or through the cache.
 */

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;
const WEEK = 7 * DAY;

function inertClient(overrides: Record<string, unknown> = {}) {
  return new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: Infinity, staleTime: Infinity, ...overrides } },
  });
}

/** A promise that never settles, so nothing resolves behind a test's back. */
const NEVER = () => new Promise<any>(() => {});

/** Options that can never fetch: whatever a test seeds is the whole truth. */
const idle = (key: string) => ({ queryKey: [key], queryFn: NEVER, enabled: false, retry: false });

function idlePort(): ProfileDataPort {
  return {
    user: () => idle('user'),
    watching: () => idle('watching'),
    reading: () => idle('reading'),
    animeCounts: () => idle('animeCounts'),
    workCounts: () => idle('workCounts'),
    airing: () => idle('airing'),
  };
}

interface Opts {
  ssr?: any;
  data?: Partial<ProfileDataPort>;
  cdn?: string;
  titleLanguage?: () => 'english' | 'japanese';
  queryClient?: QueryClient;
  config?: { cdnUserUrl(): string; init(): Promise<void> };
}

function makeBloc(opts: Opts = {}) {
  return new ProfilePageBloc({
    source: () => ({ ssr: opts.ssr ?? null }),
    data: { ...idlePort(), ...opts.data },
    config: opts.config ?? { cdnUserUrl: () => opts.cdn ?? 'https://cdn.example', init: async () => {} },
    titleLanguage: opts.titleLanguage ?? (() => 'english'),
    queryClient: opts.queryClient ?? inertClient(),
  });
}

/** The loader's payload, with only the fields a test cares about filled in. */
function ssr(over: Record<string, any> = {}) {
  return {
    user: null,
    watching: null,
    reading: null,
    animeCounts: null,
    workCounts: null,
    currentlyAiring: null,
    ...over,
  };
}

const iso = (offset: number) => new Date(Date.now() + offset).toISOString();

/**
 * One currently-airing show.
 *
 * `broadcast` deliberately carries no clock time: parseAirTime only rewrites the
 * hours when the string contains one, so with "Wednesdays" every episode airs at
 * exactly the instant its `airDate` names and these fixtures mean what they say.
 */
function show(id: string, episodeOffsets: number[], over: Record<string, any> = {}) {
  return {
    id,
    slug: `slug-${id}`,
    titleEn: `Show ${id}`,
    titleJp: `Shou ${id}`,
    broadcast: 'Wednesdays',
    duration: '24 min',
    episodeCount: 12,
    tags: ['Action'],
    description: `about ${id}`,
    rating: '8.5',
    status: 'FINISHED',
    userAnime: { id: `ua-${id}`, status: 'WATCHING' },
    episodes: episodeOffsets.map((offset, i) => ({
      id: `${id}-ep${i}`,
      episodeNumber: i + 1,
      airDate: iso(offset),
    })),
    ...over,
  };
}

/** A bloc whose airing shelf is built from exactly these shows. */
const withAiring = (shows: any[], watching: any[] = []) =>
  makeBloc({ ssr: ssr({ currentlyAiring: { currentlyAiring: shows }, watching: { animes: watching } }) });

// ── the queries it opens ──────────────────────────────────────

describe('the queries the dashboard opens', () => {
  it('asks each port exactly once, so hydration does not double the requests', () => {
    const data = {
      user: vi.fn(() => idle('user')),
      watching: vi.fn(() => idle('watching')),
      reading: vi.fn(() => idle('reading')),
      animeCounts: vi.fn(() => idle('animeCounts')),
      workCounts: vi.fn(() => idle('workCounts')),
      airing: vi.fn(() => idle('airing')),
    };
    makeBloc({ data });

    for (const port of Object.values(data)) expect(port).toHaveBeenCalledTimes(1);
  });

  it('rebuilds the server\'s airing window exactly, so the query key matches', () => {
    // The bounds ride the payload for this reason alone: a window off by a
    // millisecond is a different key, and the prefetched rows are wasted.
    const airing = vi.fn((_start: Date, _end: Date) => idle('airing'));
    const startDate = new Date(Date.now() - WEEK).toISOString();
    const endDate = new Date(Date.now() + WEEK).toISOString();
    makeBloc({ ssr: ssr({ startDate, endDate }), data: { airing } });

    expect(airing.mock.calls[0][0].toISOString()).toBe(startDate);
    expect(airing.mock.calls[0][1].toISOString()).toBe(endDate);
  });

  it('falls back to a week either side when there is no payload', () => {
    const airing = vi.fn((_start: Date, _end: Date) => idle('airing'));
    makeBloc({ data: { airing } });

    const [start, end] = airing.mock.calls[0];
    expect(Math.abs(start.getTime() - (Date.now() - WEEK))).toBeLessThan(2000);
    expect(Math.abs(end.getTime() - (Date.now() + WEEK))).toBeLessThan(2000);
  });

  it('survives a payload whose window bounds are missing', () => {
    const airing = vi.fn((_start: Date, _end: Date) => idle('airing'));
    makeBloc({ ssr: ssr({ startDate: null, endDate: undefined }), data: { airing } });

    const [start, end] = airing.mock.calls[0];
    expect(Number.isNaN(start.getTime())).toBe(false);
    expect(Number.isNaN(end.getTime())).toBe(false);
  });
});

describe('the real ports, which name what the server prefetched', () => {
  it('asks for the six watching entries the shelf actually renders', () => {
    // Six, not a thousand: every entry carries its anime and every episode of
    // it, synopses included.
    expect(realProfileData.watching().queryKey).toEqual([
      'user-animes',
      { input: { status: Status.Watching, limit: 6, page: 1 } },
    ]);
  });

  it('asks for the twelve reading entries the row renders', () => {
    expect(realProfileData.reading().queryKey).toEqual([
      'user-works',
      { input: { status: WorkStatus.Reading, limit: 12, page: 1 } },
    ]);
  });

  it('takes every status count in one request per medium', () => {
    expect(realProfileData.animeCounts().queryKey).toEqual(['user-anime-status-counts']);
    expect(realProfileData.workCounts().queryKey).toEqual(['user-work-status-counts']);
  });

  it('keys the identity query the way the header does, so the two share a cache entry', () => {
    expect(realProfileData.user().queryKey).toEqual(['user']);
  });

  it('keys the airing query on the window it was given', () => {
    const start = new Date('2025-03-01T00:00:00.000Z');
    const end = new Date('2025-03-15T00:00:00.000Z');

    expect(realProfileData.airing(start, end).queryKey).toEqual([
      'currentlyAiringWithEpisodes',
      { startDate: start.toISOString(), endDate: end.toISOString(), days: undefined, limit: undefined },
    ]);
  });

  it('falls back to the staging CDN before the config store is populated', () => {
    expect(realProfileConfig.cdnUserUrl()).toBe('https://cdn.weeb.vip/weeb-user-staging');
  });
});

// ── identity ──────────────────────────────────────────────────

describe('identity', () => {
  const user = {
    username: 'ada',
    firstname: 'Ada',
    lastname: 'Lovelace',
    profileImageUrl: 'ada.png',
    bannerImageUrl: 'ada-banner.jpg',
  };

  it('paints the header from the payload with no fetch at all', () => {
    const bloc = makeBloc({ ssr: ssr({ user }) });

    expect(bloc.user).toEqual(user);
    expect(bloc.username).toBe('ada');
    expect(bloc.fullName).toBe('Ada Lovelace');
  });

  it('is null rather than undefined when nothing has arrived', () => {
    expect(makeBloc().user).toBeNull();
    expect(makeBloc().username).toBe('');
    expect(makeBloc().fullName).toBe('');
  });

  it('uses whichever half of the name exists', () => {
    expect(makeBloc({ ssr: ssr({ user: { firstname: 'Ada' } }) }).fullName).toBe('Ada');
    expect(makeBloc({ ssr: ssr({ user: { lastname: 'Lovelace' } }) }).fullName).toBe('Lovelace');
  });

  it('builds both image URLs off the injected CDN base', () => {
    const bloc = makeBloc({ ssr: ssr({ user }), cdn: 'https://cdn.example/users' });

    expect(bloc.avatarUrl).toBe('https://cdn.example/users/ada.png');
    expect(bloc.bannerUrl).toBe('https://cdn.example/users/ada-banner.jpg');
  });

  it('is null, not a dangling slash, when nothing was uploaded', () => {
    const bloc = makeBloc({ ssr: ssr({ user: { username: 'ada' } }) });

    expect(bloc.avatarUrl).toBeNull();
    expect(bloc.bannerUrl).toBeNull();
  });

  it('re-reads the CDN base on every access, so hydration is picked up', () => {
    let base = 'https://cdn.weeb.vip/weeb-user-staging';
    const bloc = makeBloc({
      ssr: ssr({ user }),
      config: { cdnUserUrl: () => base, init: async () => {} },
    });
    expect(bloc.avatarUrl).toBe('https://cdn.weeb.vip/weeb-user-staging/ada.png');

    base = 'https://cdn.weeb.vip/weeb-user';

    expect(bloc.avatarUrl).toBe('https://cdn.weeb.vip/weeb-user/ada.png');
  });

  it('is loading only while the identity query is in flight with nothing to show', () => {
    const bloc = makeBloc({
      data: { user: () => ({ queryKey: ['user'], queryFn: NEVER, retry: false }) },
    });

    expect(bloc.isUserLoading).toBe(true);
  });

  it('is not loading once the payload has already painted the header', () => {
    // The query may still be revalidating; the header is not a skeleton.
    const bloc = makeBloc({
      ssr: ssr({ user }),
      data: { user: () => ({ queryKey: ['user'], queryFn: NEVER, retry: false }) },
    });

    expect(bloc.isUserLoading).toBe(false);
  });

  it('is not loading when the query settled with nothing at all', () => {
    // The state that must not pulse forever: signed out, nothing is coming.
    const bloc = makeBloc();

    expect(bloc.isUserLoading).toBe(false);
    expect(bloc.user).toBeNull();
  });
});

// ── the two modals ────────────────────────────────────────────

describe('the upload and banner modals', () => {
  it('starts with both closed', () => {
    const bloc = makeBloc();

    expect(bloc.isUploadOpen).toBe(false);
    expect(bloc.isBannerOpen).toBe(false);
  });

  it('opens and closes the avatar upload independently of the banner', () => {
    const bloc = makeBloc();

    bloc.openUpload();
    expect(bloc.isUploadOpen).toBe(true);
    expect(bloc.isBannerOpen).toBe(false);

    bloc.closeUpload();
    expect(bloc.isUploadOpen).toBe(false);
  });

  it('opens and closes the banner upload independently of the avatar', () => {
    const bloc = makeBloc();

    bloc.openBanner();
    expect(bloc.isBannerOpen).toBe(true);
    expect(bloc.isUploadOpen).toBe(false);

    bloc.closeBanner();
    expect(bloc.isBannerOpen).toBe(false);
  });

  it('is idempotent, so a double click does not toggle anything shut', () => {
    const bloc = makeBloc();

    bloc.openUpload();
    bloc.openUpload();
    expect(bloc.isUploadOpen).toBe(true);

    bloc.closeUpload();
    bloc.closeUpload();
    expect(bloc.isUploadOpen).toBe(false);
  });
});

describe('a banner image that will not load', () => {
  const user = { username: 'ada', bannerImageUrl: 'ada-banner.jpg' };

  it('drops the URL so the gradient behind it stands alone', () => {
    const bloc = makeBloc({ ssr: ssr({ user }) });
    expect(bloc.bannerUrl).not.toBeNull();

    bloc.bannerFailed();

    expect(bloc.bannerUrl).toBeNull();
  });

  it('re-arms on opening the uploader, because a fresh upload deserves a try', () => {
    const bloc = makeBloc({ ssr: ssr({ user }) });
    bloc.bannerFailed();

    bloc.openBanner();

    expect(bloc.bannerUrl).toBe('https://cdn.example/ada-banner.jpg');
  });

  it('is not re-armed by closing the uploader', () => {
    const bloc = makeBloc({ ssr: ssr({ user }) });
    bloc.bannerFailed();

    bloc.closeBanner();

    expect(bloc.bannerUrl).toBeNull();
  });

  it('does not touch the avatar, which failed for its own reasons or not at all', () => {
    const bloc = makeBloc({ ssr: ssr({ user: { ...user, profileImageUrl: 'ada.png' } }) });

    bloc.bannerFailed();

    expect(bloc.avatarUrl).toBe('https://cdn.example/ada.png');
  });
});

describe('init', () => {
  it('asks the config port to load, and waits for it', async () => {
    const init = vi.fn(async () => {});
    const bloc = makeBloc({ config: { cdnUserUrl: () => 'https://cdn.example', init } });

    await bloc.init();

    expect(init).toHaveBeenCalledTimes(1);
  });

  it('lets a config failure surface rather than swallowing it into a wedged page', () => {
    const bloc = makeBloc({
      config: {
        cdnUserUrl: () => 'https://cdn.example',
        init: async () => {
          throw new Error('no config');
        },
      },
    });

    return expect(bloc.init()).rejects.toThrow('no config');
  });
});

// ── the numbers ───────────────────────────────────────────────

describe('the stats strip', () => {
  const counts = { watching: 6, planToWatch: 53, completed: 294, dropped: 1, onHold: 1 };
  const labelled = (bloc: ProfilePageBloc) =>
    Object.fromEntries(bloc.stats.map((stat) => [stat.label, stat.value]));

  it('shows every status and a total that is their sum', () => {
    expect(labelled(makeBloc({ ssr: ssr({ animeCounts: counts }) }))).toMatchObject({
      Total: 355,
      Watching: 6,
      Completed: 294,
      'Plan to Watch': 53,
      'On Hold': 1,
      Dropped: 1,
    });
  });

  it('adds Int64 counts that arrive as strings instead of concatenating them', () => {
    // gqlgen marshals Int64 to a JSON string to stay clear of the 53-bit limit,
    // and codegen types it as `any`, so nothing but this catches it: the tile
    // rendered "65329411" instead of 355.
    const stringly = { watching: '6', planToWatch: '53', completed: '294', dropped: '1', onHold: '1' };

    expect(labelled(makeBloc({ ssr: ssr({ animeCounts: stringly }) })).Total).toBe(355);
  });

  it('falls back to the length of the watching shelf when the counts are missing', () => {
    // Better a number that matches what is on screen than a zero beside six cards.
    const bloc = makeBloc({
      ssr: ssr({ watching: { animes: [{ id: '1' }, { id: '2' }, { id: '3' }] } }),
    });

    expect(labelled(bloc).Watching).toBe(3);
  });

  it('prefers the count query over the shelf length once it has answered', () => {
    const bloc = makeBloc({
      ssr: ssr({ animeCounts: { watching: 412 }, watching: { animes: [{ id: '1' }] } }),
    });

    expect(labelled(bloc).Watching).toBe(412);
  });

  it('is all zeroes, not NaN, for a brand new account', () => {
    expect(Object.values(labelled(makeBloc()))).toEqual([0, 0, 0, 0, 0, 0, 0]);
  });

  it('keeps a genuine zero rather than falling through it', () => {
    const bloc = makeBloc({
      ssr: ssr({ animeCounts: { watching: 0 }, watching: { animes: [{ id: '1' }] } }),
    });

    expect(labelled(bloc).Watching).toBe(0);
  });

  it('links every tile at the shelf it counts', () => {
    expect(makeBloc().stats.map((stat) => [stat.label, stat.href])).toEqual([
      ['Total', '/profile/anime'],
      ['Watching', '/profile/anime?status=WATCHING'],
      ['Completed', '/profile/anime?status=COMPLETED'],
      ['Reading', '/profile/anime?medium=manga&status=READING'],
      ['Plan to Watch', '/profile/anime?status=PLANTOWATCH'],
      ['On Hold', '/profile/anime?status=ONHOLD'],
      ['Dropped', '/profile/anime?status=DROPPED'],
    ]);
  });

  it('sends the Reading tile to the manga list, not the anime one', () => {
    // The tile is the only manga entry point on this page; without the medium
    // it lands on the anime shelf asking for a status it has no tab for.
    const reading = makeBloc().stats.find((stat) => stat.label === 'Reading')!;

    expect(reading.href).toContain('medium=manga');
  });

  it('marks only the total as the current page, and leaves it uncoloured', () => {
    const [total, ...rest] = makeBloc().stats;

    expect(total.active).toBe(true);
    expect(total.color).toBeUndefined();
    expect(total.dotColor).toBeUndefined();
    expect(rest.every((stat) => stat.active === undefined)).toBe(true);
    expect(rest.every((stat) => typeof stat.color === 'string')).toBe(true);
  });

  it('leaves reading out of the anime total, which is an anime total', () => {
    const bloc = makeBloc({
      ssr: ssr({ animeCounts: { watching: 2 }, workCounts: { reading: 40 } }),
    });

    expect(labelled(bloc).Total).toBe(2);
    expect(labelled(bloc).Reading).toBe(40);
  });
});

describe('the reading total', () => {
  const total = (over: Record<string, any>) => makeBloc({ ssr: ssr(over) }).readingTotal;
  const work = (id: string) => ({ id, status: 'READING', work: { id: `w-${id}`, urlSlug: `s-${id}` } });

  it('prefers the count query, which knows about entries this page never fetched', () => {
    expect(total({ workCounts: { reading: 40 }, reading: { total: 12, works: [work('1')] } })).toBe(40);
  });

  it('falls back to the list total when there are no counts', () => {
    expect(total({ reading: { total: 12, works: [work('1')] } })).toBe(12);
  });

  it('falls back to the rows it can actually link, last of all', () => {
    expect(total({ reading: { works: [work('1'), work('2')] } })).toBe(2);
  });

  it('coerces an Int64 string rather than rendering it as one', () => {
    expect(total({ workCounts: { reading: '40' } })).toBe(40);
  });

  it('keeps a real zero instead of falling through to the next source', () => {
    // Nothing being read is an answer; falling through would show the list total.
    expect(total({ workCounts: { reading: 0 }, reading: { total: 12, works: [] } })).toBe(0);
  });

  it('is zero for an account with no reading list at all', () => {
    expect(total({})).toBe(0);
  });
});

describe('the reading row', () => {
  const entry = (id: string, over: Record<string, any> = {}) => ({
    id,
    status: 'READING',
    work: {
      id: `w-${id}`,
      titleEn: `Work ${id}`,
      titleJp: `Waaku ${id}`,
      score: 8.1,
      type: 'MANGA',
      publishedFrom: '2005-04-13T00:00:00Z',
      urlSlug: `slug-${id}`,
      ...over,
    },
  });
  const cards = (works: any[]) => makeBloc({ ssr: ssr({ reading: { works } }) }).readingCards;

  it('maps a work onto its card, its subtitle and its manga link', () => {
    expect(cards([entry('1')])[0]).toEqual({
      key: '1',
      id: 'w-1',
      title: 'Work 1',
      image: 'w-1',
      imagePath: 'works',
      score: 8.1,
      sub: 'Manga · 2005',
      href: '/manga/slug-1',
      onList: 'READING',
    });
  });

  it('drops a work with no slug rather than rendering an unlinkable card', () => {
    // A shorter row beats a card that goes nowhere.
    expect(cards([entry('1'), entry('2', { urlSlug: null })]).map((card) => card.key)).toEqual(['1']);
  });

  it('does not count the dropped rows towards the row being non-empty', () => {
    expect(makeBloc({ ssr: ssr({ reading: { works: [entry('1', { urlSlug: null })] } }) }).hasReading).toBe(
      false,
    );
    expect(makeBloc({ ssr: ssr({ reading: { works: [entry('1')] } }) }).hasReading).toBe(true);
  });

  it('caps the row at twelve, which is what it renders', () => {
    const many = Array.from({ length: 30 }, (_, i) => entry(String(i)));

    expect(cards(many)).toHaveLength(12);
    expect(cards(many)[11].key).toBe('11');
  });

  it('falls back through the Japanese title to Untitled', () => {
    expect(cards([entry('1', { titleEn: null })])[0].title).toBe('Waaku 1');
    expect(cards([entry('1', { titleEn: null, titleJp: null })])[0].title).toBe('Untitled');
  });

  it('has a null score rather than an undefined one', () => {
    expect(cards([entry('1', { score: undefined })])[0].score).toBeNull();
  });

  it('is empty, and says so, for an account reading nothing', () => {
    expect(cards([])).toEqual([]);
    expect(makeBloc().readingCards).toEqual([]);
    expect(makeBloc().hasReading).toBe(false);
    expect(makeBloc({ ssr: ssr({ reading: { works: null } }) }).readingCards).toEqual([]);
  });
});

// ── the three shelves ─────────────────────────────────────────

describe('currently watching', () => {
  const entry = (id: string, over: Record<string, any> = {}) => ({
    id,
    status: 'WATCHING',
    anime: {
      id: `a-${id}`,
      slug: `slug-${id}`,
      titleEn: `Show ${id}`,
      titleJp: `Shou ${id}`,
      status: 'FINISHED',
      rating: '8.5',
      episodeCount: 12,
      tags: ['Action'],
      description: `about ${id}`,
      ...over,
    },
  });
  const cards = (rows: any[]) => makeBloc({ ssr: ssr({ watching: { animes: rows } }) }).currentlyWatching;

  it('comes straight off the watchlist, not off the airing window', () => {
    expect(cards([entry('1')])[0]).toEqual({
      key: '1',
      id: 'a-1',
      slug: 'slug-1',
      title: 'Show 1',
      image: 'a-1',
      score: 8.5,
      status: 'FINISHED',
      sub: '12 episodes',
      genres: ['Action'],
      description: 'about 1',
      episodeCount: 12,
      onList: 'WATCHING',
    });
  });

  it('keys on the list-entry id, which is what is unique', () => {
    expect(cards([entry('1'), entry('2')]).map((card) => card.key)).toEqual(['1', '2']);
  });

  it('keys on the anime when the entry has no id of its own', () => {
    expect(cards([{ status: 'WATCHING', anime: { id: 'a-9' } }])[0].key).toBe('a-9');
  });

  it('caps the shelf at six, which is what it renders', () => {
    const many = Array.from({ length: 20 }, (_, i) => entry(String(i)));

    expect(cards(many)).toHaveLength(6);
  });

  it('reads "N/A" as no score rather than as NaN', () => {
    expect(cards([entry('1', { rating: 'N/A' })])[0].score).toBeNull();
    expect(cards([entry('1', { rating: null })])[0].score).toBeNull();
  });

  it('keeps a zero rating, which is a rating', () => {
    expect(cards([entry('1', { rating: '0' })])[0].score).toBe(0);
  });

  it('leaves the sub-line empty rather than printing "0 episodes"', () => {
    expect(cards([entry('1', { episodeCount: 0 })])[0].sub).toBe('');
    expect(cards([entry('1', { episodeCount: null })])[0].sub).toBe('');
  });

  it('falls back to the placeholder image for an entry with no anime id', () => {
    expect(cards([{ id: '1', status: 'WATCHING', anime: { titleEn: 'Ghost' } }])[0].image).toBe(
      'not found.png',
    );
  });

  it('calls an entry with no status watching, since that is the shelf', () => {
    expect(cards([{ id: '1', anime: { id: 'a-1' } }])[0].onList).toBe('watching');
  });

  it('is empty for an account watching nothing', () => {
    expect(cards([])).toEqual([]);
    expect(makeBloc().currentlyWatching).toEqual([]);
  });
});

describe('what goes on the airing shelves', () => {
  it('puts an episode due inside the week on the airing-soon shelf', () => {
    const bloc = withAiring([show('A', [2 * DAY])]);

    expect(bloc.airingSoon.map((card) => card.id)).toEqual(['A']);
    expect(bloc.recentlyAired).toEqual([]);
  });

  it('leaves out an episode further off than a week', () => {
    // The shelf answers "what is on this week", not "what exists".
    expect(withAiring([show('A', [10 * DAY])]).airingSoon).toEqual([]);
  });

  it('puts an episode from the last fortnight on the recently-aired shelf', () => {
    const bloc = withAiring([show('A', [-3 * DAY])]);

    expect(bloc.recentlyAired.map((card) => card.id)).toEqual(['A']);
    expect(bloc.airingSoon).toEqual([]);
  });

  it('leaves out an episode older than a fortnight', () => {
    expect(withAiring([show('A', [-20 * DAY])]).recentlyAired).toEqual([]);
  });

  it('ignores a show that is not on the viewer\'s list', () => {
    // The dashboard is a library, not a schedule; /airing is the schedule.
    expect(withAiring([show('A', [2 * DAY], { userAnime: null })]).airingSoon).toEqual([]);
  });

  it('ignores a show the viewer completed or dropped', () => {
    // A completed show airing this week is not something the dashboard wants.
    const done = show('A', [2 * DAY], { userAnime: { id: 'ua-A', status: 'COMPLETED' } });
    const gone = show('B', [2 * DAY], { userAnime: { id: 'ua-B', status: 'DROPPED' } });

    expect(withAiring([done, gone]).airingSoon).toEqual([]);
  });

  it('includes plan-to-watch alongside watching', () => {
    const planned = show('A', [2 * DAY], { userAnime: { id: 'ua-A', status: 'PLANTOWATCH' } });

    expect(withAiring([planned]).airingSoon.map((card) => card.id)).toEqual(['A']);
  });

  it('matches the status whatever case it arrives in', () => {
    const lower = show('A', [2 * DAY], { userAnime: { id: 'ua-A', status: 'watching' } });

    expect(withAiring([lower]).airingSoon.map((card) => card.id)).toEqual(['A']);
  });

  it('ignores a show with no episodes listed', () => {
    expect(withAiring([show('A', [])]).airingSoon).toEqual([]);
    expect(withAiring([show('A', [], { episodes: null })]).airingSoon).toEqual([]);
  });

  it('ignores a show with no broadcast, because its air times cannot be placed', () => {
    // parseAirTime needs a broadcast to convert into; without one there is no
    // instant to compare against the window.
    const noBroadcast = show('A', [2 * DAY], { broadcast: null });

    expect(withAiring([noBroadcast]).airingSoon).toEqual([]);
    expect(withAiring([show('B', [-3 * DAY], { broadcast: null })]).recentlyAired).toEqual([]);
  });

  it('ignores episodes with no air date', () => {
    const undated = show('A', [2 * DAY], { episodes: [{ id: 'x', episodeNumber: 1, airDate: null }] });

    expect(withAiring([undated]).airingSoon).toEqual([]);
  });

  it('picks the soonest future episode when a show lists several', () => {
    const bloc = withAiring([show('A', [6 * DAY, 1 * DAY, 3 * DAY])]);

    expect(bloc.airingSoon.map((card) => card.id)).toEqual(['A']);
  });

  it('orders the airing-soon shelf soonest first', () => {
    const bloc = withAiring([show('A', [5 * DAY]), show('B', [1 * DAY]), show('C', [3 * DAY])]);

    expect(bloc.airingSoon.map((card) => card.id)).toEqual(['B', 'C', 'A']);
  });

  it('orders the recently-aired shelf most recent first', () => {
    const bloc = withAiring([show('A', [-6 * DAY]), show('B', [-1 * DAY]), show('C', [-3 * DAY])]);

    expect(bloc.recentlyAired.map((card) => card.id)).toEqual(['B', 'C', 'A']);
  });

  it('takes the latest aired episode of a show, not the first it finds', () => {
    const bloc = withAiring([show('A', [-10 * DAY, -2 * DAY, -6 * DAY]), show('B', [-4 * DAY])]);

    expect(bloc.recentlyAired.map((card) => card.id)).toEqual(['A', 'B']);
  });

  it('caps airing soon at twelve', () => {
    const many = Array.from({ length: 20 }, (_, i) => show(`S${i}`, [(i % 6) * HOUR + HOUR]));

    expect(withAiring(many).airingSoon).toHaveLength(12);
  });

  it('caps recently aired at six', () => {
    const many = Array.from({ length: 20 }, (_, i) => show(`S${i}`, [-(i + 1) * DAY]));

    expect(withAiring(many).recentlyAired).toHaveLength(6);
  });

  it('shows both shelves for a show with a past and a future episode', () => {
    const bloc = withAiring([show('A', [-3 * DAY, 2 * DAY])]);

    expect(bloc.airingSoon.map((card) => card.id)).toEqual(['A']);
    expect(bloc.recentlyAired.map((card) => card.id)).toEqual(['A']);
  });

  it('builds its cards from the airing show, keyed on the anime id', () => {
    const card = withAiring([show('A', [2 * DAY])]).airingSoon[0];

    expect(card).toEqual({
      key: 'A',
      id: 'A',
      slug: 'slug-A',
      title: 'Show A',
      image: 'A',
      score: 8.5,
      status: 'FINISHED',
      sub: '12 episodes',
      genres: ['Action'],
      description: 'about A',
      episodeCount: 12,
      onList: 'WATCHING',
    });
  });

  it('carries the viewer\'s own status onto the card, not the airing status', () => {
    const planned = show('A', [2 * DAY], { userAnime: { id: 'ua-A', status: 'PLANTOWATCH' } });

    expect(withAiring([planned]).airingSoon[0].onList).toBe('PLANTOWATCH');
  });

  it('is empty rather than undefined when nothing is airing', () => {
    expect(withAiring([]).airingSoon).toEqual([]);
    expect(withAiring([]).recentlyAired).toEqual([]);
    expect(makeBloc().airingSoon).toEqual([]);
    expect(makeBloc().recentlyAired).toEqual([]);
  });

  it('survives a null entry in the airing payload', () => {
    expect(withAiring([null, show('A', [2 * DAY])] as any).airingSoon.map((c) => c.id)).toEqual(['A']);
  });

  it('reads a duration in minutes off the show rather than assuming one', () => {
    // The just-aired grace period is the episode's own runtime.
    const long = show('A', [-45 * MINUTE], { duration: '90 min per episode' });

    expect(withAiring([long]).recentlyAired.map((card) => card.id)).toContain('A');
  });
});

describe('a show whose episode aired minutes ago', () => {
  /*
    The analysis walks the airing shows once to place the next episode, then
    walks the viewer's list again to find recently aired ones. An episode that
    aired within the show's runtime satisfies both passes, so the same show
    used to be pushed onto `recentlyAired` twice -- and both entries keyed on
    the same anime id, which is `each_key_duplicate` in the shelf's keyed
    each-block (a dev crash, and silent DOM reuse in production). The second
    pass now fills the slot the first one took rather than adding another.
  */
  it('appears on the recently-aired shelf exactly once', () => {
    const bloc = withAiring([show('A', [-5 * MINUTE])]);

    expect(bloc.recentlyAired.map((card) => card.id)).toEqual(['A']);
  });

  it('gives every card on the shelf a distinct key', () => {
    const bloc = withAiring([
      show('A', [-5 * MINUTE]),
      show('B', [-2 * DAY]),
      show('C', [-10 * MINUTE]),
    ]);

    const keys = bloc.recentlyAired.map((card) => card.key);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it('keeps the just-aired show in its proper place in the ordering', () => {
    // The surviving entry is the one that names the episode it is about, which
    // is what the most-recent-first sort reads; keeping the other would sink a
    // show that aired minutes ago below one that aired days ago.
    const bloc = withAiring([show('A', [-5 * MINUTE]), show('B', [-2 * DAY])]);

    expect(bloc.recentlyAired.map((card) => card.id)).toEqual(['A', 'B']);
  });

  it('does not double a show whose episode aired longer ago than its runtime', () => {
    const bloc = withAiring([show('A', [-3 * HOUR])]);

    expect(bloc.recentlyAired.map((card) => card.id)).toEqual(['A']);
  });

  it('still lets the same show hold a slot on each shelf', () => {
    // Airing-soon and recently-aired are different shelves with their own
    // each-blocks, so a show with a past and a future episode belongs on both.
    const bloc = withAiring([show('A', [-5 * MINUTE, 2 * DAY])]);

    expect(bloc.airingSoon.map((card) => card.id)).toEqual(['A']);
    expect(bloc.recentlyAired.map((card) => card.id)).toEqual(['A']);
  });
});

describe('the empty library', () => {
  it('is empty only when all three shelves are', () => {
    expect(makeBloc().isLibraryEmpty).toBe(true);
    expect(withAiring([]).isLibraryEmpty).toBe(true);
  });

  it('is not empty when something is on the watchlist, even with nothing airing', () => {
    expect(withAiring([], [{ id: '1', anime: { id: 'a-1' } }]).isLibraryEmpty).toBe(false);
  });

  it('is not empty when something airs this week', () => {
    expect(withAiring([show('A', [2 * DAY])]).isLibraryEmpty).toBe(false);
  });

  it('is not empty when something aired lately', () => {
    expect(withAiring([show('A', [-3 * DAY])]).isLibraryEmpty).toBe(false);
  });

  it('stays empty when the only airing shows are not on the list', () => {
    const stranger = show('A', [2 * DAY], { userAnime: null });

    expect(withAiring([stranger]).isLibraryEmpty).toBe(true);
  });

  it('does not count the reading row, which has its own empty state', () => {
    const bloc = makeBloc({
      ssr: ssr({ reading: { works: [{ id: 'w1', work: { id: 'w-1', urlSlug: 's' } }] } }),
    });

    expect(bloc.isLibraryEmpty).toBe(true);
    expect(bloc.hasReading).toBe(true);
  });
});

// ── the four states ───────────────────────────────────────────

describe('loading, populated, empty and failed are four different things', () => {
  const inFlight = (key: string) => ({ queryKey: [key], queryFn: NEVER, retry: false });
  const rejecting = (key: string) => ({
    queryKey: [key],
    queryFn: async () => {
      throw new Error(`${key} blew up`);
    },
    retry: false,
    retryOnMount: false,
  });

  it('reports the shelves loading while either query they need is in flight', () => {
    expect(makeBloc({ data: { watching: () => inFlight('watching') } }).isShelvesLoading).toBe(true);
    expect(makeBloc({ data: { airing: () => inFlight('airing') } }).isShelvesLoading).toBe(true);
  });

  it('stops reporting them loading once the payload has painted them', () => {
    const bloc = makeBloc({
      ssr: ssr({ currentlyAiring: { currentlyAiring: [show('A', [2 * DAY])] }, watching: { animes: [] } }),
      data: { watching: () => idle('watching'), airing: () => idle('airing') },
    });

    expect(bloc.isShelvesLoading).toBe(false);
    expect(bloc.isLibraryEmpty).toBe(false);
  });

  it('does not leave a skeleton up for a query that settled with nothing', () => {
    // Empty is an answer. A page that keeps pulsing here never stops.
    const bloc = withAiring([], []);

    expect(bloc.isShelvesLoading).toBe(false);
    expect(bloc.isUserLoading).toBe(false);
    expect(bloc.isLibraryEmpty).toBe(true);
  });

  it('reads an empty library as empty rather than as failed', () => {
    const bloc = withAiring([], []);

    expect(bloc.currentlyWatching).toEqual([]);
    expect(bloc.stats.every((stat) => stat.value === 0)).toBe(true);
  });

  it('reads a failed shelf query as empty rather than as a permanent skeleton', async () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    const bloc = makeBloc({
      data: { watching: () => rejecting('watching'), airing: () => rejecting('airing') },
    });

    await vi.waitFor(() => expect(bloc.isShelvesLoading).toBe(false));
    expect(bloc.currentlyWatching).toEqual([]);
    expect(bloc.airingSoon).toEqual([]);
    expect(bloc.isLibraryEmpty).toBe(true);
    error.mockRestore();
  });

  it('keeps the header readable when the identity query fails', async () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    const bloc = makeBloc({ data: { user: () => rejecting('user') } });

    await vi.waitFor(() => expect(bloc.isUserLoading).toBe(false));
    expect(bloc.user).toBeNull();
    expect(bloc.username).toBe('');
    expect(bloc.avatarUrl).toBeNull();
    error.mockRestore();
  });

  it('still shows the stats strip when the count query fails', async () => {
    // Zeroes beat a missing strip: the tiles are also the navigation.
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    const bloc = makeBloc({ data: { animeCounts: () => rejecting('animeCounts') } });

    await vi.waitFor(() => expect(bloc.stats).toHaveLength(7));
    expect(bloc.stats[0].value).toBe(0);
    error.mockRestore();
  });

  it('keeps the shelves when only the reading row fails', async () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    const bloc = makeBloc({
      ssr: ssr({ currentlyAiring: { currentlyAiring: [show('A', [2 * DAY])] } }),
      data: { reading: () => rejecting('reading') },
    });

    await vi.waitFor(() => expect(bloc.hasReading).toBe(false));
    expect(bloc.readingCards).toEqual([]);
    expect(bloc.airingSoon).toHaveLength(1);
    error.mockRestore();
  });
});

describe('the payload paints the first frame and the query supersedes it', () => {
  it('renders the server\'s user before any client fetch has happened', () => {
    const bloc = makeBloc({ ssr: ssr({ user: { username: 'from-server' } }) });

    expect(bloc.username).toBe('from-server');
  });

  it('hands over to the client query once it answers', async () => {
    const client = inertClient();
    const bloc = makeBloc({ ssr: ssr({ user: { username: 'from-server' } }), queryClient: client });
    expect(bloc.username).toBe('from-server');

    client.setQueryData(['user'], { username: 'from-client' });

    await vi.waitFor(() => expect(bloc.username).toBe('from-client'));
  });

  it('rebuilds the shelves from the newer airing response, dropping the old rows', async () => {
    const client = inertClient();
    const bloc = makeBloc({
      ssr: ssr({ currentlyAiring: { currentlyAiring: [show('A', [2 * DAY])] } }),
      queryClient: client,
    });
    expect(bloc.airingSoon.map((card) => card.id)).toEqual(['A']);

    client.setQueryData(['airing'], { currentlyAiring: [show('B', [1 * DAY])] });

    await vi.waitFor(() => expect(bloc.airingSoon.map((card) => card.id)).toEqual(['B']));
  });

  it('fills the page in from a fetch when there was no payload to start from', async () => {
    const bloc = makeBloc({
      data: {
        user: () => ({
          queryKey: ['user'],
          queryFn: async () => ({ username: 'fetched' }),
          retry: false,
        }),
      },
    });
    expect(bloc.isUserLoading).toBe(true);

    await vi.waitFor(() => expect(bloc.username).toBe('fetched'));
    expect(bloc.isUserLoading).toBe(false);
  });

  it('recounts the stats when the count query supersedes the payload', async () => {
    const client = inertClient();
    const bloc = makeBloc({ ssr: ssr({ animeCounts: { watching: 1 } }), queryClient: client });
    expect(bloc.stats[1].value).toBe(1);

    client.setQueryData(['animeCounts'], { watching: 9, completed: 1 });

    await vi.waitFor(() => expect(bloc.stats[1].value).toBe(9));
    expect(bloc.stats[0].value).toBe(10);
  });
});

// ── titles ────────────────────────────────────────────────────

describe('the title language preference', () => {
  const watching = { animes: [{ id: '1', anime: { id: 'a-1', titleEn: 'Frieren', titleJp: 'Sousou' } }] };

  it('titles cards in English by preference', () => {
    const bloc = makeBloc({ ssr: ssr({ watching }), titleLanguage: () => 'english' });

    expect(bloc.currentlyWatching[0].title).toBe('Frieren');
  });

  it('titles them in Japanese when that is the preference', () => {
    const bloc = makeBloc({ ssr: ssr({ watching }), titleLanguage: () => 'japanese' });

    expect(bloc.currentlyWatching[0].title).toBe('Sousou');
  });

  it('is read on every card build, so toggling it retitles the shelf', () => {
    let language: 'english' | 'japanese' = 'english';
    const bloc = makeBloc({ ssr: ssr({ watching }), titleLanguage: () => language });
    expect(bloc.currentlyWatching[0].title).toBe('Frieren');

    language = 'japanese';

    expect(bloc.currentlyWatching[0].title).toBe('Sousou');
  });

  it('falls back to the other language rather than showing nothing', () => {
    const onlyJp = { animes: [{ id: '1', anime: { id: 'a-1', titleJp: 'Sousou' } }] };
    const bloc = makeBloc({ ssr: ssr({ watching: onlyJp }), titleLanguage: () => 'english' });

    expect(bloc.currentlyWatching[0].title).toBe('Sousou');
  });

  it('says Unknown for an entry with no anime at all', () => {
    const bloc = makeBloc({ ssr: ssr({ watching: { animes: [{ id: '1', anime: null }] } }) });

    expect(bloc.currentlyWatching[0].title).toBe('Unknown');
  });

  it('does not retitle the reading row, whose works have their own titles', () => {
    const bloc = makeBloc({
      ssr: ssr({
        reading: { works: [{ id: 'w1', work: { id: 'w-1', titleEn: 'Vinland', titleJp: 'Vinrando', urlSlug: 'v' } }] },
      }),
      titleLanguage: () => 'japanese',
    });

    expect(bloc.readingCards[0].title).toBe('Vinland');
  });
});
