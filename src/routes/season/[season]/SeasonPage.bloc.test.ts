import { describe, it, expect, vi } from 'vitest';
import { writable } from 'svelte/store';
import { QueryClient } from '@tanstack/svelte-query';
import { SeasonPageBloc, type SeasonalAnime } from './SeasonPage.bloc.svelte';

/**
 * One season's page: the wheel the arrows turn, where the list comes from, how
 * it is ordered, and the tag filter over it.
 *
 * The rules pinned here are the ones that actually broke. The bloc is rebuilt
 * per season, so a tag selection or a seeded query from the season before it
 * must not survive the change. The loader's payload is seeded into the query
 * cache under the key the query itself will use, so a client refetch that fails
 * still has something to render rather than emptying a page that arrived
 * populated. And ratings arrive as strings -- "N/A", null, junk -- which sorted
 * as NaN put the whole grid in arrival order.
 *
 * Nothing here touches the network: the query port is a stub whose queryFn
 * never settles, and the client is configured never to refetch on its own.
 */

/** The key the real `fetchSeasonalAnime` builds, mirrored by the stub port. */
const key = (season: string, limit?: number) => ['seasonal-anime', { season, limit }] as const;

/** How many the page asks for. Not exported by the bloc, but part of the key. */
const SEASON_LIMIT = 500;

/**
 * A client that never fetches or retries by itself, so a query's state is
 * whatever a test put there and nothing arrives late to change it.
 */
function inertClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        retryOnMount: false,
        refetchOnMount: false,
        gcTime: Infinity,
        staleTime: Infinity
      }
    }
  });
}

/** The query port. Its queryFn never settles unless a test supplies one. */
function seasonalPort(queryFn: () => Promise<any> = () => new Promise<any>(() => {})) {
  return (season: string, limit?: number) => ({ queryKey: key(season, limit), queryFn });
}

function anime(id: string, extra: Partial<SeasonalAnime> = {}): SeasonalAnime {
  return { id, titleEn: `${id} EN`, titleJp: `${id} JP`, ...extra };
}

interface Payload {
  season?: string;
  seasonalData?: { animeBySeasons?: SeasonalAnime[] | null } | null;
  ssrError?: string | null;
}

interface BuildOptions extends Payload {
  client?: QueryClient;
  seasonal?: ReturnType<typeof seasonalPort>;
  titleLanguage?: 'english' | 'japanese';
  clock?: () => Date;
  navigate?: (href: string) => void;
}

/** The bloc with every port stubbed; only the ones a test names are its own. */
function build({
  season = 'WINTER_2025',
  seasonalData = null,
  ssrError = null,
  client = inertClient(),
  seasonal = seasonalPort(),
  titleLanguage = 'english',
  clock = () => new Date('2025-02-14T12:00:00Z'),
  navigate = () => {}
}: BuildOptions = {}) {
  return new SeasonPageBloc({
    source: () => ({ season, seasonalData, ssrError }),
    seasonal,
    queryClient: client,
    preferences: writable({ titleLanguage }),
    clock,
    navigate
  });
}

/** A bloc reading a season that can be changed under it, as a param change does. */
function buildOverMutableSeason(initial: string) {
  let season = initial;
  const bloc = new SeasonPageBloc({
    source: () => ({ season, seasonalData: null, ssrError: null }),
    seasonal: seasonalPort(),
    queryClient: inertClient(),
    preferences: writable({ titleLanguage: 'english' as const }),
    clock: () => new Date('2025-02-14T12:00:00Z'),
    navigate: () => {}
  });
  return { bloc, setSeason: (next: string) => (season = next) };
}

describe('the season wheel', () => {
  it('names the season and the year it belongs to', () => {
    const bloc = build({ season: 'SUMMER_2025' });

    expect(bloc.seasonName).toBe('Summer');
    expect(bloc.year).toBe(2025);
    expect(bloc.displayName).toBe('Summer 2025');
  });

  it('rolls the year backwards off the start of it', () => {
    // Winter is the first season of a year, so its predecessor is last year's.
    expect(build({ season: 'WINTER_2025' }).previousSeason).toBe('FALL_2024');
  });

  it('rolls the year forwards off the end of it', () => {
    expect(build({ season: 'FALL_2025' }).nextSeason).toBe('WINTER_2026');
  });

  it('steps within the year everywhere in between', () => {
    const bloc = build({ season: 'SUMMER_2025' });

    expect(bloc.previousSeason).toBe('SPRING_2025');
    expect(bloc.nextSeason).toBe('FALL_2025');
  });

  it('offers all four seasons of the current year, with this one marked', () => {
    const tabs = build({ season: 'FALL_2025' }).seasonTabs;

    expect(tabs.map((tab) => tab.key)).toEqual([
      'WINTER_2025',
      'SPRING_2025',
      'SUMMER_2025',
      'FALL_2025'
    ]);
    expect(tabs.map((tab) => tab.label)).toEqual(['Winter', 'Spring', 'Summer', 'Fall']);
    expect(tabs.filter((tab) => tab.active).map((tab) => tab.season)).toEqual(['FALL']);
    expect(tabs.every((tab) => tab.icon.length > 0)).toBe(true);
  });

  it('offers last year, this one and next, keeping the season fixed', () => {
    const years = build({ season: 'SPRING_2025' }).yearOptions;

    expect(years.map((option) => option.key)).toEqual([
      'SPRING_2024',
      'SPRING_2025',
      'SPRING_2026'
    ]);
    expect(years.filter((option) => option.active).map((option) => option.year)).toEqual([2025]);
  });
});

describe('a season change', () => {
  it('carries every read of the season with it', () => {
    // SvelteKit reuses one +page.svelte across a param change, so the season the
    // bloc reports has to come from the accessor on every read rather than from
    // a value copied in the constructor.
    const { bloc, setSeason } = buildOverMutableSeason('WINTER_2025');

    expect(bloc.season).toBe('WINTER_2025');

    setSeason('FALL_2025');

    expect(bloc.season).toBe('FALL_2025');
    expect(bloc.displayName).toBe('Fall 2025');
    expect(bloc.previousSeason).toBe('SUMMER_2025');
    expect(bloc.nextSeason).toBe('WINTER_2026');
    expect(bloc.seasonTabs.filter((tab) => tab.active).map((tab) => tab.season)).toEqual(['FALL']);
    expect(bloc.yearOptions.map((option) => option.key)).toEqual([
      'FALL_2024',
      'FALL_2025',
      'FALL_2026'
    ]);
  });

  it('does not carry the previous season’s tag filter into the new bloc', () => {
    // The filter belongs to the season being looked at. Stepping to the next one
    // used to leave "Action" selected over a list that had never been filtered.
    const client = inertClient();
    const winter = build({
      client,
      season: 'WINTER_2025',
      seasonalData: { animeBySeasons: [anime('w1', { tags: ['Action'] })] }
    });

    winter.toggleTag('Action');
    expect(winter.selectedTagCount).toBe(1);

    const spring = build({
      client,
      season: 'SPRING_2025',
      seasonalData: { animeBySeasons: [anime('s1', { tags: ['Comedy'] })] }
    });

    expect(spring.selectedTagCount).toBe(0);
    expect(spring.hasTagFilter).toBe(false);
    expect(spring.isTagSelected('Action')).toBe(false);
    expect(spring.allTags).toEqual([{ tag: 'Comedy', count: 1 }]);
  });

  it('does not let the previous season’s cached list stand in for the new one', () => {
    // Both seasons share one query client. The keys differ by season, so the
    // spring page must render spring's payload -- or nothing -- never winter's.
    const client = inertClient();
    build({
      client,
      season: 'WINTER_2025',
      seasonalData: { animeBySeasons: [anime('w1'), anime('w2')] }
    });

    const spring = build({
      client,
      season: 'SPRING_2025',
      seasonalData: { animeBySeasons: [anime('s1')] }
    });

    expect(spring.animeList.map((item) => item.id)).toEqual(['s1']);
    expect(client.getQueryData(key('WINTER_2025', SEASON_LIMIT))).toEqual({
      animeBySeasons: [anime('w1'), anime('w2')]
    });
  });

  it('shows an empty season as empty even with the previous one still cached', () => {
    const client = inertClient();
    build({
      client,
      season: 'WINTER_2025',
      seasonalData: { animeBySeasons: [anime('w1')] }
    });

    const spring = build({ client, season: 'SPRING_2025', seasonalData: null });

    expect(spring.animeList).toEqual([]);
    expect(spring.isEmpty).toBe(true);
  });
});

describe('the loader payload', () => {
  it('is seeded into the cache under the key the query itself uses', () => {
    // Same key, or the client-side query would start empty and the populated
    // page it replaced would blank on hydration.
    const client = inertClient();
    const seasonalData = { animeBySeasons: [anime('a')] };

    build({ client, season: 'WINTER_2025', seasonalData });

    expect(client.getQueryData(key('WINTER_2025', SEASON_LIMIT))).toEqual(seasonalData);
  });

  it('seeds nothing when the loader came back with nothing', () => {
    const client = inertClient();

    build({ client, season: 'WINTER_2025', seasonalData: null });

    expect(client.getQueryData(key('WINTER_2025', SEASON_LIMIT))).toBeUndefined();
  });

  it('still renders the loader’s list when the query holds no data', () => {
    // A failed or evicted client refetch: the query has nothing, so the list
    // falls back to what the server already sent rather than emptying.
    const client = inertClient();
    const bloc = build({
      client,
      seasonalData: { animeBySeasons: [anime('a'), anime('b')] }
    });

    client.removeQueries();

    expect(bloc.animeList.map((item) => item.id)).toEqual(['a', 'b']);
  });

  it('counts as loaded, so a still-running query draws no skeletons', () => {
    const client = inertClient();
    const bloc = build({ client, seasonalData: { animeBySeasons: [anime('a')] } });

    client.removeQueries(); // the query is now pending and fetching

    expect(bloc.isLoading).toBe(false);
    expect(bloc.statsLabel).toBe('Showing 1 titles');
  });

  it('shows skeletons only when there is nothing at all to draw', () => {
    const bloc = build({ seasonalData: null });

    expect(bloc.isLoading).toBe(true);
    expect(bloc.statsLabel).toBe('Loading...');
  });

  it('dims rather than empties a populated grid while it refetches', () => {
    const bloc = build({ seasonalData: { animeBySeasons: [anime('a')] } });

    expect(bloc.isRefreshing).toBe(false);

    bloc.retry();

    expect(bloc.isRefreshing).toBe(true);
    expect(bloc.isRetrying).toBe(true);
    expect(bloc.animeList.map((item) => item.id)).toEqual(['a']);
  });

  it('is not "refreshing" when there is no grid to dim', () => {
    const bloc = build({ seasonalData: null });

    expect(bloc.isRefreshing).toBe(false);
  });
});

describe('error reporting', () => {
  it('reports a failed client query', async () => {
    const client = inertClient();
    await client.prefetchQuery({
      queryKey: key('WINTER_2025', SEASON_LIMIT),
      queryFn: async () => {
        throw new Error('network down');
      }
    });

    const bloc = build({ client });

    expect(bloc.isError).toBe(true);
    expect(bloc.errorDetail).toBe('network down');
  });

  it('reports a failed server load even when the query is merely idle', () => {
    // Either source counts: a page that arrived broken must say so without
    // waiting for a client query to fail as well.
    const bloc = build({ ssrError: 'GraphQL: seasonal lookup failed' });

    expect(bloc.isError).toBe(true);
    expect(bloc.errorDetail).toBe('GraphQL: seasonal lookup failed');
  });

  it('prefers the query’s message when both failed', async () => {
    const client = inertClient();
    await client.prefetchQuery({
      queryKey: key('WINTER_2025', SEASON_LIMIT),
      queryFn: async () => {
        throw new Error('network down');
      }
    });

    const bloc = build({ client, ssrError: 'GraphQL: seasonal lookup failed' });

    expect(bloc.errorDetail).toBe('network down');
  });

  it('is not an error when neither failed', () => {
    const bloc = build({ seasonalData: { animeBySeasons: [anime('a')] } });

    expect(bloc.isError).toBe(false);
    expect(bloc.errorDetail).toBe('');
  });

  it('has no detail to show when nothing failed', () => {
    expect(build({ ssrError: null }).errorDetail).toBe('');
  });
});

describe('ordering', () => {
  it('puts the best-rated first', () => {
    const bloc = build({
      seasonalData: {
        animeBySeasons: [
          anime('low', { rating: '6.10' }),
          anime('high', { rating: '9.05' }),
          anime('mid', { rating: '7.50' })
        ]
      }
    });

    expect(bloc.animeList.map((item) => item.id)).toEqual(['high', 'mid', 'low']);
  });

  it('sorts an unrated title as zero rather than as NaN', () => {
    // NaN comparisons are all false, so an unparseable rating used to freeze the
    // whole comparator and leave the grid in arrival order.
    const bloc = build({
      seasonalData: {
        animeBySeasons: [
          anime('missing', { rating: null }),
          anime('na', { rating: 'N/A' }),
          anime('junk', { rating: 'unknown' }),
          anime('rated', { rating: '8.2' })
        ]
      }
    });

    expect(bloc.animeList[0].id).toBe('rated');
    expect(bloc.animeList.map((item) => item.id)).toHaveLength(4);
  });

  it('does not reorder the array the loader handed over', () => {
    // The same array is seeded into the query cache; sorting it in place would
    // reorder the cached payload as a side effect of reading the list.
    const animeBySeasons = [anime('low', { rating: '1' }), anime('high', { rating: '9' })];
    const bloc = build({ seasonalData: { animeBySeasons } });

    expect(bloc.animeList.map((item) => item.id)).toEqual(['high', 'low']);
    expect(animeBySeasons.map((item) => item.id)).toEqual(['low', 'high']);
  });
});

describe('the top-of-season strip', () => {
  it('is not drawn for a season with almost nothing in it', () => {
    const list = [anime('a', { rating: '9' }), anime('b', { rating: '8' })];

    expect(build({ seasonalData: { animeBySeasons: list } }).topOfSeason).toEqual([]);
  });

  it('appears from three titles up', () => {
    const list = ['a', 'b', 'c'].map((id) => anime(id, { rating: '8' }));

    expect(build({ seasonalData: { animeBySeasons: list } }).topOfSeason).toHaveLength(3);
  });

  it('never shows more than five', () => {
    const list = ['a', 'b', 'c', 'd', 'e', 'f', 'g'].map((id, index) =>
      anime(id, { rating: String(9 - index) })
    );

    const top = build({ seasonalData: { animeBySeasons: list } }).topOfSeason;

    expect(top.map((item) => item.id)).toEqual(['a', 'b', 'c', 'd', 'e']);
  });
});

describe('tag facets', () => {
  it('counts how many titles carry each tag', () => {
    const bloc = build({
      seasonalData: {
        animeBySeasons: [
          anime('a', { tags: ['Action', 'Comedy'] }),
          anime('b', { tags: ['Action'] }),
          anime('c', { tags: ['Action', 'Drama'] })
        ]
      }
    });

    expect(bloc.allTags).toEqual([
      { tag: 'Action', count: 3 },
      { tag: 'Comedy', count: 1 },
      { tag: 'Drama', count: 1 }
    ]);
  });

  it('puts the commonest tags first, not the alphabetically first', () => {
    const bloc = build({
      seasonalData: {
        animeBySeasons: [
          anime('a', { tags: ['Zombie', 'Action'] }),
          anime('b', { tags: ['Zombie'] })
        ]
      }
    });

    expect(bloc.allTags.map((facet) => facet.tag)).toEqual(['Zombie', 'Action']);
  });

  it('ignores a title with no tags at all', () => {
    const bloc = build({
      seasonalData: {
        animeBySeasons: [anime('a', { tags: null }), anime('b', { tags: ['Action'] }), anime('c')]
      }
    });

    expect(bloc.allTags).toEqual([{ tag: 'Action', count: 1 }]);
  });

  it('shows every tag when there are exactly twelve', () => {
    const bloc = build({ seasonalData: { animeBySeasons: [anime('a', { tags: tags(12) })] } });

    expect(bloc.visibleTags).toHaveLength(12);
    expect(bloc.hasHiddenTags).toBe(false);
    expect(bloc.hiddenTagCount).toBe(0);
  });

  it('hides the thirteenth behind a count of one', () => {
    const bloc = build({ seasonalData: { animeBySeasons: [anime('a', { tags: tags(13) })] } });

    expect(bloc.visibleTags).toHaveLength(12);
    expect(bloc.hasHiddenTags).toBe(true);
    expect(bloc.hiddenTagCount).toBe(1);
  });

  it('reveals the rest on demand, and folds them away again', () => {
    const bloc = build({ seasonalData: { animeBySeasons: [anime('a', { tags: tags(20) })] } });

    expect(bloc.showAllTags).toBe(false);

    bloc.toggleShowAllTags();

    expect(bloc.showAllTags).toBe(true);
    expect(bloc.visibleTags).toHaveLength(20);

    bloc.toggleShowAllTags();

    expect(bloc.showAllTags).toBe(false);
    expect(bloc.visibleTags).toHaveLength(12);
  });

  it('never reports a negative hidden count', () => {
    expect(build({ seasonalData: { animeBySeasons: [] } }).hiddenTagCount).toBe(0);
  });
});

/** `n` distinct tags, in the order they will be counted. */
function tags(n: number): string[] {
  return Array.from({ length: n }, (_, index) => `Tag${index}`);
}

describe('the tag filter', () => {
  const season = {
    animeBySeasons: [
      anime('both', { tags: ['Action', 'Comedy'] }),
      anime('action', { tags: ['Action'] }),
      anime('comedy', { tags: ['Comedy'] })
    ]
  };

  it('shows everything until a tag is picked', () => {
    const bloc = build({ seasonalData: season });

    expect(bloc.hasTagFilter).toBe(false);
    expect(bloc.filtered).toHaveLength(3);
  });

  it('narrows to the titles carrying the tag', () => {
    const bloc = build({ seasonalData: season });

    bloc.toggleTag('Action');

    expect(bloc.isTagSelected('Action')).toBe(true);
    expect(bloc.filtered.map((item) => item.id).sort()).toEqual(['action', 'both']);
  });

  it('requires every selected tag, rather than any of them', () => {
    // Two tags is a narrower question, not a wider one. An OR here returned
    // more results with each click, which is the opposite of a filter.
    const bloc = build({ seasonalData: season });

    bloc.toggleTag('Action');
    bloc.toggleTag('Comedy');

    expect(bloc.selectedTagCount).toBe(2);
    expect(bloc.filtered.map((item) => item.id)).toEqual(['both']);
  });

  it('deselects a tag that is clicked twice', () => {
    const bloc = build({ seasonalData: season });

    bloc.toggleTag('Action');
    bloc.toggleTag('Action');

    expect(bloc.isTagSelected('Action')).toBe(false);
    expect(bloc.hasTagFilter).toBe(false);
    expect(bloc.filtered).toHaveLength(3);
  });

  it('drops the whole selection at once', () => {
    const bloc = build({ seasonalData: season });

    bloc.toggleTag('Action');
    bloc.toggleTag('Comedy');
    bloc.clearTags();

    expect(bloc.selectedTagCount).toBe(0);
    expect(bloc.filtered).toHaveLength(3);
  });

  it('reports "filtered out" only when the season has titles the filter hides', () => {
    const bloc = build({ seasonalData: season });

    expect(bloc.isFilteredOut).toBe(false);

    bloc.toggleTag('Action');
    bloc.toggleTag('Nonexistent');

    expect(bloc.filtered).toEqual([]);
    expect(bloc.isFilteredOut).toBe(true);
    expect(bloc.isEmpty).toBe(false);
  });

  it('does not call an empty season "filtered out"', () => {
    // Nothing was filtered; there was never anything there. The two states get
    // different copy, so they must not collapse into one.
    const bloc = build({ seasonalData: { animeBySeasons: [] } });

    bloc.toggleTag('Action');

    expect(bloc.isEmpty).toBe(true);
    expect(bloc.isFilteredOut).toBe(false);
  });

  it('shows a denominator only while a filter is on', () => {
    const bloc = build({ seasonalData: season });

    expect(bloc.countLabel).toBe('3');

    bloc.toggleTag('Action');

    expect(bloc.countLabel).toBe('2 / 3');
  });

  it('says what is on screen, or that there is nothing', () => {
    expect(build({ seasonalData: { animeBySeasons: [] } }).statsLabel).toBe('No titles');

    const bloc = build({ seasonalData: season });
    expect(bloc.statsLabel).toBe('Showing 3 titles');

    bloc.toggleTag('Comedy');
    expect(bloc.statsLabel).toBe('Showing 2 / 3 titles');
  });

  it('blames the filter for an empty screen only when there is one', () => {
    const bloc = build({ season: 'SPRING_2025', seasonalData: season });

    expect(bloc.emptyMessage).toBe('There are no anime listed for Spring 2025 yet.');

    bloc.toggleTag('Action');

    expect(bloc.emptyMessage).toBe('No anime match the selected tags.');
  });
});

describe('moving between seasons', () => {
  it('goes through the router rather than swapping local state', () => {
    // A history.pushState left the params, the loader data and the SEO meta all
    // pointing at the season before it.
    const navigate = vi.fn();
    const bloc = build({ season: 'WINTER_2025', navigate });

    bloc.goToSeason(bloc.nextSeason);

    expect(navigate).toHaveBeenCalledWith('/season/SPRING_2025');
  });

  it('navigates to whatever season it is handed', () => {
    const navigate = vi.fn();

    build({ navigate }).goToSeason('FALL_2030');

    expect(navigate).toHaveBeenCalledWith('/season/FALL_2030');
  });

  it('knows which season today falls in', () => {
    const bloc = build({
      season: 'WINTER_2025',
      clock: () => new Date('2025-05-15T12:00:00Z')
    });

    expect(bloc.currentSeason).toBe('SPRING_2025');
    expect(bloc.isCurrentSeason).toBe(false);
  });

  it('does not offer the shortcut back to the season already on screen', () => {
    const bloc = build({
      season: 'SPRING_2025',
      clock: () => new Date('2025-05-15T12:00:00Z')
    });

    expect(bloc.isCurrentSeason).toBe(true);
  });

  it('warms the seasons either side so the arrows land instantly', async () => {
    const asked: string[] = [];
    const bloc = build({
      season: 'WINTER_2025',
      seasonal: (season: string, limit?: number) => ({
        queryKey: key(season, limit),
        queryFn: async () => {
          asked.push(season);
          return { animeBySeasons: [] };
        }
      })
    });

    const cleanup = bloc.init();

    await vi.waitFor(() => expect(asked).toHaveLength(2));

    expect(asked.sort()).toEqual(['FALL_2024', 'SPRING_2025']);
    expect(typeof cleanup).toBe('function');
  });
});

describe('per-card reads', () => {
  it('prints the title in the language the reader asked for', () => {
    const card = anime('a', { titleEn: 'Frieren', titleJp: '葬送のフリーレン' });

    expect(build({ titleLanguage: 'english' }).titleFor(card)).toBe('Frieren');
    expect(build({ titleLanguage: 'japanese' }).titleFor(card)).toBe(
      '葬送のフリーレン'
    );
  });

  it('follows the preferences store when it changes under the page', () => {
    const preferences = writable({ titleLanguage: 'english' as 'english' | 'japanese' });
    const bloc = new SeasonPageBloc({
      source: () => ({ season: 'WINTER_2025', seasonalData: null, ssrError: null }),
      seasonal: seasonalPort(),
      queryClient: inertClient(),
      preferences,
      clock: () => new Date('2025-02-14T12:00:00Z'),
      navigate: () => {}
    });
    const card = anime('a', { titleEn: 'Frieren', titleJp: 'Sousou no Frieren' });

    expect(bloc.titleFor(card)).toBe('Frieren');

    preferences.set({ titleLanguage: 'japanese' });

    expect(bloc.titleFor(card)).toBe('Sousou no Frieren');
  });

  it('has no score to show for an unrated title', () => {
    const bloc = build();

    expect(bloc.scoreFor(anime('a', { rating: '8.25' }))).toBe(8.25);
    expect(bloc.scoreFor(anime('a', { rating: 'N/A' }))).toBeNull();
    expect(bloc.scoreFor(anime('a', { rating: '0' }))).toBeNull();
    expect(bloc.scoreFor(anime('a', { rating: null }))).toBeNull();
  });

  it('names the studio when there is one', () => {
    const bloc = build();

    expect(bloc.subFor(anime('a', { studios: ['MADHOUSE', 'Bones'] }))).toBe('MADHOUSE');
  });

  it('falls back to the year and the episode count when there is no studio', () => {
    const bloc = build();

    expect(
      bloc.subFor(anime('a', { studios: null, startDate: '2025-01-05T00:00:00Z', episodeCount: 12 }))
    ).toBe('2025 · 12 ep');
  });

  it('admits it does not know the year or the length', () => {
    const bloc = build();

    expect(bloc.subFor(anime('a', { studios: [], startDate: null, episodeCount: null }))).toBe(
      'TBA · ? ep'
    );
  });

  it('joins only the strip parts that exist', () => {
    const bloc = build();

    expect(bloc.stripMetaFor(anime('a', { rating: '8.5', studios: ['MAPPA'] }))).toBe(
      '★ 8.5 · MAPPA'
    );
    expect(bloc.stripMetaFor(anime('a', { rating: '8.5', studios: null }))).toBe('★ 8.5');
    expect(bloc.stripMetaFor(anime('a', { rating: 'N/A', studios: ['MAPPA'] }))).toBe('MAPPA');
    expect(bloc.stripMetaFor(anime('a', { rating: null, studios: [] }))).toBe('');
  });

  it('links by slug, falling back to the id', () => {
    const bloc = build();

    expect(bloc.hrefFor(anime('abc', { slug: 'frieren' }))).toBe('/anime/frieren');
    expect(bloc.hrefFor(anime('abc'))).toBe('/anime/abc');
  });

  it('uses the anime id as the image id, and says so when there is none', () => {
    const bloc = build();

    expect(bloc.imageFor(anime('abc'))).toBe('abc');
    expect(bloc.imageFor({ id: '' } as SeasonalAnime)).toBe('not found.png');
  });
});

describe('empty and missing payloads', () => {
  it('renders an empty page rather than throwing when the loader sent nothing', () => {
    const bloc = build({ seasonalData: null });

    expect(bloc.animeList).toEqual([]);
    expect(bloc.filtered).toEqual([]);
    expect(bloc.allTags).toEqual([]);
    expect(bloc.topOfSeason).toEqual([]);
    expect(bloc.isEmpty).toBe(true);
  });

  it('treats a payload with a null list as an empty season', () => {
    const bloc = build({ seasonalData: { animeBySeasons: null } });

    expect(bloc.animeList).toEqual([]);
    expect(bloc.isEmpty).toBe(true);
    expect(bloc.statsLabel).toBe('No titles');
  });

  it('handles a title with no tags and no studios', () => {
    const bloc = build({
      seasonalData: { animeBySeasons: [anime('a', { tags: null, studios: null })] }
    });

    expect(bloc.allTags).toEqual([]);
    expect(bloc.subFor(bloc.animeList[0])).toBe('TBA · ? ep');
    expect(bloc.stripMetaFor(bloc.animeList[0])).toBe('');
  });

  it('survives a season string it cannot parse', () => {
    // The route param is user input; a malformed one must not throw on the way
    // to the "no anime listed" page.
    const bloc = build({ season: 'not-a-season' });

    expect(bloc.displayName).toBe('not-a-season');
    expect(() => bloc.seasonTabs).not.toThrow();
    expect(bloc.year).toBeNaN();
  });
});
