import { describe, it, expect, vi, afterEach } from 'vitest';
import { writable } from 'svelte/store';
import {
  AnimeNewsPageBloc,
  MIN_ITEMS_FOR_FILTERS,
  NEWS_FLAG,
  PAGE_SIZE,
  categoryCounts,
  type AnimeNewsItem,
  type AnimeNewsPageData,
} from './AnimeNewsPage.bloc.svelte';

/**
 * /anime/<slug>/news — its feature gate, its filtering and its paging.
 *
 * Three things here are worth being sure about. The gate is tri-state, because
 * a boolean makes the page flash "not available" on every load while PostHog is
 * still answering. The filter and the page number live in the URL, so the whole
 * cycle is read-URL -> derive -> write-URL and can be run with a plain store and
 * a spy instead of a router. And the paging is a display cut over a list that
 * arrived whole, so every boundary — a page past the end, a category with
 * nothing in it, a filter that invalidates the page you were on — is arithmetic
 * this file can pin.
 */

/* ── Harness ─────────────────────────────────────────────────────────────── */

function stubRoute(search = '', pathname = '/anime/frieren/news') {
  const url = writable({ pathname, search });
  const replace = vi.fn();
  return {
    port: { url, replace },
    replace,
    /** Pretend the router landed on the URL the page just asked for. */
    navigateTo(next: string) {
      const [path, query = ''] = next.split('?');
      url.set({ pathname: path, search: query ? `?${query}` : '' });
    },
  };
}

function data(overrides: Partial<AnimeNewsPageData> = {}): AnimeNewsPageData {
  return {
    anime: { id: 'abc', startDate: '2023-09-29T00:00:00Z', studios: ['Madhouse'] },
    news: [],
    animeTitle: 'Frieren',
    animeTitleJp: '葬送のフリーレン',
    animeSlug: 'frieren',
    ssrError: null,
    ...overrides,
  };
}

function stories(count: number, category: string | null = 'anime'): AnimeNewsItem[] {
  return Array.from({ length: count }, (_, i) => ({ title: `Story ${i + 1}`, category }));
}

function build(
  options: {
    search?: string;
    pathname?: string;
    enabled?: boolean | (() => boolean);
    pollMs?: number;
    maxTries?: number;
    data?: AnimeNewsPageData;
    bind?: boolean;
  } = {},
) {
  const route = stubRoute(options.search, options.pathname);
  const enabled = options.enabled;
  // Annotated: without the explicit return type the union in `options.enabled`
  // widens the mock to `boolean | (() => boolean)` and it no longer satisfies
  // FeatureFlagPort.
  const isEnabled = vi.fn(
    (_flag: string): boolean => (typeof enabled === 'function' ? enabled() : (enabled ?? true)),
  );
  const bloc = new AnimeNewsPageBloc({
    flags: { isEnabled },
    route: route.port,
    pollMs: options.pollMs ?? 250,
    maxTries: options.maxTries ?? 25,
  });
  const payload = { current: options.data ?? data() };
  if (options.bind !== false) bloc.bindData(() => payload.current);
  return { bloc, route, replace: route.replace, isEnabled, payload };
}

afterEach(() => {
  vi.useRealTimers();
});

/* ── The gate ────────────────────────────────────────────────────────────── */

describe('the feature gate', () => {
  it('asks for the flag by name, once, when the page is constructed', () => {
    const { isEnabled } = build({ enabled: false });

    expect(isEnabled).toHaveBeenCalledTimes(1);
    expect(isEnabled).toHaveBeenCalledWith(NEWS_FLAG);
  });

  it('is resolved immediately when the flag is already on', () => {
    const { bloc } = build({ enabled: true });

    expect(bloc.newsEnabled).toBe(true);
    expect(bloc.flagsResolved).toBe(true);
  });

  it('separates "flags have not loaded" from "flag is off"', () => {
    const { bloc } = build({ enabled: false });

    // Without this the page renders its not-available message on every load.
    expect(bloc.newsEnabled).toBe(false);
    expect(bloc.flagsResolved).toBe(false);
  });

  it('never starts a timer when the answer is already in', () => {
    vi.useFakeTimers();
    const { bloc, isEnabled } = build({ enabled: true, pollMs: 10, maxTries: 5 });

    bloc.watchFlag();
    vi.advanceTimersByTime(1000);

    expect(isEnabled).toHaveBeenCalledTimes(1);
  });

  it('re-asks until the flag resolves, then stops asking', () => {
    vi.useFakeTimers();
    // `onFeatureFlags` can fire once while the flag still reads false and then
    // never fire again, which is the case this poll exists for.
    const answers = [false, false, true];
    let i = 0;
    const { bloc, isEnabled } = build({
      enabled: () => answers[Math.min(i++, answers.length - 1)],
      pollMs: 10,
      maxTries: 25,
    });

    bloc.watchFlag();

    vi.advanceTimersByTime(10);
    expect(bloc.newsEnabled).toBe(false);
    expect(bloc.flagsResolved).toBe(false);

    vi.advanceTimersByTime(10);
    expect(bloc.newsEnabled).toBe(true);
    expect(bloc.flagsResolved).toBe(true);

    const settled = isEnabled.mock.calls.length;
    vi.advanceTimersByTime(1000);
    expect(isEnabled).toHaveBeenCalledTimes(settled);
  });

  it('gives up after the try limit and calls the flag resolved-and-off', () => {
    vi.useFakeTimers();
    const { bloc, isEnabled } = build({ enabled: false, pollMs: 10, maxTries: 3 });

    bloc.watchFlag();
    vi.advanceTimersByTime(1000);

    expect(isEnabled).toHaveBeenCalledTimes(4); // once up front, then three tries
    expect(bloc.newsEnabled).toBe(false);
    // Resolved, so the page finally says the section is unavailable rather
    // than pulsing forever.
    expect(bloc.flagsResolved).toBe(true);
  });

  it('stops polling when the page is left', () => {
    vi.useFakeTimers();
    const { bloc, isEnabled } = build({ enabled: false, pollMs: 10, maxTries: 25 });

    const teardown = bloc.watchFlag();
    vi.advanceTimersByTime(10);
    const before = isEnabled.mock.calls.length;
    teardown();
    vi.advanceTimersByTime(1000);

    expect(isEnabled).toHaveBeenCalledTimes(before);
  });

  it('hands back a teardown even when it never started one', () => {
    const { bloc } = build({ enabled: true });

    expect(() => bloc.watchFlag()()).not.toThrow();
  });
});

/* ── The bound payload ───────────────────────────────────────────────────── */

describe('the bound page data', () => {
  it('reads as empty before anything is bound', () => {
    const { bloc } = build({ bind: false });

    expect(bloc.title).toBe('');
    expect(bloc.news).toEqual([]);
    expect(bloc.total).toBe(0);
    expect(bloc.backHref).toBe('/anime/');
    expect(bloc.bannerSources).toEqual([]);
    expect(bloc.posterSource).toBe('');
    expect(bloc.studio).toBeNull();
    expect(bloc.hasError).toBe(false);
  });

  it('is read through the accessor, so navigating to another show re-reads it', () => {
    // Effects do not run during SSR and this page is entirely server-rendered,
    // so the payload cannot be pushed in from an `$effect`.
    const { bloc, payload } = build({ data: data({ animeTitle: 'Frieren', news: stories(2) }) });

    expect(bloc.title).toBe('Frieren');
    expect(bloc.total).toBe(2);

    payload.current = data({ animeTitle: 'Bleach', animeSlug: 'bleach', news: stories(5) });

    expect(bloc.title).toBe('Bleach');
    expect(bloc.backHref).toBe('/anime/bleach');
    expect(bloc.total).toBe(5);
  });

  it('reports a failed server load', () => {
    const { bloc } = build({ data: data({ ssrError: 'Anime not found' }) });

    expect(bloc.hasError).toBe(true);
  });

  it('does not treat an empty error string as a failure', () => {
    const { bloc } = build({ data: data({ ssrError: '' }) });

    expect(bloc.hasError).toBe(false);
  });
});

describe('the show this page is about', () => {
  it('offers the banner first and the poster as the fallback', () => {
    const { bloc } = build();

    const [banner, poster] = bloc.bannerSources;
    expect(banner).toContain('/banners/abc');
    // A CDN slug, not the MyAnimeList address on the record — handing
    // `anime.imageUrl` to SafeImage is what broke this image.
    expect(poster).toContain('/abc');
    expect(poster).not.toContain('/banners/');
  });

  it('has no banner candidates for a record with no id', () => {
    const { bloc } = build({ data: data({ anime: { startDate: '2023-01-01T00:00:00Z' } }) });

    expect(bloc.bannerSources).toEqual([]);
  });

  it('gives the poster as the CDN slug the image component resolves', () => {
    const { bloc } = build();

    expect(bloc.posterSource).toBe('abc');
  });

  it('names the first studio, whether it arrived as a list or a bare string', () => {
    expect(build({ data: data({ anime: { id: 'a', studios: ['Madhouse', 'Bones'] } }) }).bloc.studio).toBe(
      'Madhouse',
    );
    expect(build({ data: data({ anime: { id: 'a', studios: 'Madhouse' } }) }).bloc.studio).toBe(
      'Madhouse',
    );
  });

  it('has no studio when the list is empty or missing', () => {
    expect(build({ data: data({ anime: { id: 'a', studios: [] } }) }).bloc.studio).toBeNull();
    expect(build({ data: data({ anime: { id: 'a' } }) }).bloc.studio).toBeNull();
  });

  it('says TBA rather than inventing a year', () => {
    expect(build().bloc.year).toBe('2023');
    expect(build({ data: data({ anime: { id: 'a', startDate: null } }) }).bloc.year).toBe('TBA');
    expect(build({ data: data({ anime: null }) }).bloc.year).toBe('TBA');
  });

  it('drops a Japanese title that was never set', () => {
    expect(build().bloc.titleJp).toBe('葬送のフリーレン');
    expect(build({ data: data({ animeTitleJp: null }) }).bloc.titleJp).toBeNull();
  });
});

/* ── Counting and filtering ──────────────────────────────────────────────── */

describe('categoryCounts', () => {
  it('counts by lowercased category', () => {
    expect(
      categoryCounts([{ category: 'Anime' }, { category: 'anime' }, { category: 'STAFF' }]),
    ).toEqual({ anime: 2, staff: 1 });
  });

  it('ignores stories with no category rather than inventing one', () => {
    expect(categoryCounts([{ category: null }, { category: '' }, {}])).toEqual({});
  });

  it('counts nothing for an empty list', () => {
    expect(categoryCounts([])).toEqual({});
  });
});

describe('the story count', () => {
  it('says "story" for one and "stories" for anything else', () => {
    expect(build({ data: data({ news: stories(1) }) }).bloc.storyCount).toBe('1 story');
    expect(build({ data: data({ news: stories(2) }) }).bloc.storyCount).toBe('2 stories');
    expect(build({ data: data({ news: [] }) }).bloc.storyCount).toBe('0 stories');
  });
});

describe('the category chips', () => {
  const mixed = [...stories(5, 'anime'), ...stories(2, 'staff'), ...stories(1, 'people')];

  it('orders categories by how many stories carry them', () => {
    const { bloc } = build({ data: data({ news: mixed }) });

    expect(bloc.categories).toEqual(['anime', 'staff', 'people']);
    expect(bloc.counts).toEqual({ anime: 5, staff: 2, people: 1 });
  });

  it('counts the full set, so a chip does not change its number when pressed', () => {
    const { bloc } = build({ search: '?category=staff', data: data({ news: mixed }) });

    expect(bloc.selected).toBe('staff');
    expect(bloc.filtered).toHaveLength(2);
    expect(bloc.counts).toEqual({ anime: 5, staff: 2, people: 1 });
  });

  it('is not worth showing below the minimum', () => {
    const few = [...stories(4, 'anime'), ...stories(3, 'staff')];

    const { bloc } = build({ data: data({ news: few }) });

    expect(bloc.total).toBeLessThan(MIN_ITEMS_FOR_FILTERS);
    expect(bloc.showFilters).toBe(false);
  });

  it('is shown at the minimum, once there are two things to choose between', () => {
    const enough = [...stories(7, 'anime'), ...stories(1, 'staff')];

    const { bloc } = build({ data: data({ news: enough }) });

    expect(bloc.total).toBe(MIN_ITEMS_FOR_FILTERS);
    expect(bloc.showFilters).toBe(true);
  });

  it('is hidden when every story carries the same category', () => {
    const { bloc } = build({ data: data({ news: stories(20, 'anime') }) });

    // A chip row with one chip filters nothing.
    expect(bloc.showFilters).toBe(false);
  });

  it('is hidden when no story carries a category at all', () => {
    const { bloc } = build({ data: data({ news: stories(20, null) }) });

    expect(bloc.categories).toEqual([]);
    expect(bloc.showFilters).toBe(false);
  });

  it('capitalises a category for display without touching the stored value', () => {
    const { bloc } = build();

    expect(bloc.label('staff')).toBe('Staff');
    expect(bloc.label('')).toBe('');
  });
});

describe('filtering', () => {
  const mixed = [...stories(5, 'anime'), ...stories(2, 'staff')];

  it('shows everything when nothing is selected', () => {
    const { bloc } = build({ data: data({ news: mixed }) });

    expect(bloc.selected).toBeNull();
    expect(bloc.filtered).toHaveLength(7);
  });

  it('matches the stored category case-insensitively', () => {
    const { bloc } = build({
      search: '?category=staff',
      data: data({ news: [...stories(1, 'STAFF'), ...stories(1, 'anime')] }),
    });

    expect(bloc.filtered).toHaveLength(1);
  });

  it('reports a category with nothing in it, which a shared link can still reach', () => {
    const { bloc } = build({ search: '?category=music', data: data({ news: mixed }) });

    expect(bloc.filtered).toEqual([]);
    expect(bloc.isEmptyCategory).toBe(true);
  });

  it('is not an empty category when no filter is applied', () => {
    const { bloc } = build({ data: data({ news: [] }) });

    expect(bloc.isEmptyCategory).toBe(false);
  });

  it('treats an upper-case category parameter as no match at all', () => {
    // Current behaviour: the URL value is compared raw against a lowercased
    // category, so a hand-written `?category=Staff` finds nothing. The page
    // itself only ever writes the lowercase form, so this is only reachable
    // from a typed URL.
    const { bloc } = build({ search: '?category=Staff', data: data({ news: mixed }) });

    expect(bloc.filtered).toEqual([]);
  });
});

/* ── Paging ──────────────────────────────────────────────────────────────── */

describe('paging', () => {
  it('is one page for a list that fits', () => {
    const { bloc } = build({ data: data({ news: stories(PAGE_SIZE) }) });

    expect(bloc.pageCount).toBe(1);
    expect(bloc.pageNumbers).toEqual([1]);
    expect(bloc.visible).toHaveLength(PAGE_SIZE);
  });

  it('is one page for an empty list, rather than none', () => {
    const { bloc } = build({ data: data({ news: [] }) });

    expect(bloc.pageCount).toBe(1);
    expect(bloc.visible).toEqual([]);
    expect(bloc.firstShown).toBe(0);
    expect(bloc.lastShown).toBe(0);
  });

  it('splits a longer list and reports the window it is showing', () => {
    const { bloc } = build({ search: '?page=2', data: data({ news: stories(23) }) });

    expect(bloc.pageCount).toBe(3);
    expect(bloc.pageNumbers).toEqual([1, 2, 3]);
    expect(bloc.current).toBe(2);
    expect(bloc.visible).toHaveLength(10);
    expect((bloc.visible[0] as any).title).toBe('Story 11');
    expect(bloc.firstShown).toBe(11);
    expect(bloc.lastShown).toBe(20);
  });

  it('shows the short last page', () => {
    const { bloc } = build({ search: '?page=3', data: data({ news: stories(23) }) });

    expect(bloc.visible).toHaveLength(3);
    expect(bloc.firstShown).toBe(21);
    expect(bloc.lastShown).toBe(23);
  });

  it('clamps a page past the end onto the last real page', () => {
    const { bloc } = build({ search: '?page=99', data: data({ news: stories(23) }) });

    // Rendering an empty list is worse than landing somewhere real.
    expect(bloc.current).toBe(3);
    expect(bloc.visible).toHaveLength(3);
  });

  it.each(['?page=0', '?page=-4', '?page=abc', '?page='])(
    'reads %s as page one',
    (search) => {
      const { bloc } = build({ search, data: data({ news: stories(23) }) });

      expect(bloc.current).toBe(1);
    },
  );

  it('clamps against the filtered list, not the whole one', () => {
    const mixed = [...stories(23, 'anime'), ...stories(2, 'staff')];
    const { bloc } = build({ search: '?category=staff&page=3', data: data({ news: mixed }) });

    expect(bloc.pageCount).toBe(1);
    expect(bloc.current).toBe(1);
    expect(bloc.visible).toHaveLength(2);
  });
});

/* ── Intents ─────────────────────────────────────────────────────────────── */

describe('choosing a category', () => {
  it('writes the category into the URL and keeps the path', () => {
    const { bloc, replace } = build({ data: data({ news: stories(12) }) });

    bloc.selectCategory('staff');

    expect(replace).toHaveBeenCalledWith('/anime/frieren/news?category=staff');
  });

  it('drops the page number, because page 2 of "all" is not page 2 of a category', () => {
    const { bloc, replace } = build({ search: '?page=3' });

    bloc.selectCategory('staff');

    expect(replace).toHaveBeenCalledWith('/anime/frieren/news?category=staff');
  });

  it('clears the filter back to a bare path', () => {
    const { bloc, replace } = build({ search: '?category=staff&page=2' });

    bloc.selectCategory(null);

    expect(replace).toHaveBeenCalledWith('/anime/frieren/news');
  });

  it('treats an empty category as clearing the filter', () => {
    const { bloc, replace } = build({ search: '?category=staff' });

    bloc.selectCategory('');

    expect(replace).toHaveBeenCalledWith('/anime/frieren/news');
  });

  it('leaves parameters it does not own alone', () => {
    const { bloc, replace } = build({ search: '?ref=twitter' });

    bloc.selectCategory('staff');

    expect(replace).toHaveBeenCalledWith('/anime/frieren/news?ref=twitter&category=staff');
  });
});

describe('choosing a page', () => {
  it('writes the page number and keeps the filter', () => {
    const { bloc, replace } = build({ search: '?category=staff' });

    bloc.goToPage(2);

    expect(replace).toHaveBeenCalledWith('/anime/frieren/news?category=staff&page=2');
  });

  it('leaves page one out of the URL, because it is the default', () => {
    const { bloc, replace } = build({ search: '?category=staff&page=4' });

    bloc.goToPage(1);

    expect(replace).toHaveBeenCalledWith('/anime/frieren/news?category=staff');
  });

  it('reads the URL back through the port after the router moves', () => {
    const { bloc, route } = build({ data: data({ news: stories(23) }) });

    expect(bloc.current).toBe(1);
    bloc.goToPage(2);
    route.navigateTo(route.replace.mock.calls[0][0]);

    expect(bloc.current).toBe(2);
    expect(bloc.firstShown).toBe(11);
  });
});
