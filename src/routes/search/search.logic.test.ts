import { describe, it, expect } from 'vitest';
import {
  buildFilters,
  buildGenreFacetRequest,
  buildSearchRequests,
  filterClock,
  indexesFrom,
  parseGenreFacetResponse,
  parseSearchResponse,
  readSearchParams,
  resolveAlgoliaFactory,
  searchPageHref,
  toCatalogRequest,
  wantsWorks,
  PAGE_SIZE_OPTIONS,
  type CatalogSearchRequest,
} from './search.logic';

const INDEXES = { animeIndex: 'anime', worksIndex: 'works' };
/** 2026-10-04T13:37:01Z. The filters floor it to the hour: 13:00. */
const NOW = Date.UTC(2026, 9, 4, 13, 37, 1);
const CLOCK = Date.UTC(2026, 9, 4, 13) / 1000;
const request = (partial: Partial<CatalogSearchRequest> = {}): CatalogSearchRequest => ({
  query: 'naruto',
  hitsPage: 0,
  worksPage: 0,
  perPage: 24,
  genre: null,
  status: null,
  year: null,
  includeWorks: true,
  ...partial,
});

describe('indexesFrom', () => {
  it('reads the configured names and falls back to the staging anime index', () => {
    expect(indexesFrom({ algolia_index: 'anime', algolia_works_index: 'works' })).toEqual(INDEXES);
    expect(indexesFrom(null)).toEqual({ animeIndex: 'anime-staging', worksIndex: '' });
  });
});

describe('resolveAlgoliaFactory', () => {
  it('finds the factory wherever the module version put it', () => {
    const f = () => 'client';
    expect(resolveAlgoliaFactory({ default: f })).toBe(f);
    expect(resolveAlgoliaFactory(f)).toBe(f);
    expect(resolveAlgoliaFactory({ liteClient: f })).toBe(f);
    expect(resolveAlgoliaFactory({})).toBeNull();
  });
});

describe('buildSearchRequests', () => {
  it('asks the anime index for the page, filtered by genre', () => {
    const [anime] = buildSearchRequests(request({ genre: 'Action', includeWorks: false, hitsPage: 2 }), INDEXES);
    expect(anime).toEqual({ indexName: 'anime', query: 'naruto', hitsPerPage: 24, page: 2, filters: 'tags:"Action"' });
  });

  it('adds the works index only when wanted and configured', () => {
    expect(buildSearchRequests(request(), INDEXES)).toHaveLength(2);
    expect(buildSearchRequests(request(), INDEXES)[1]).toEqual({ indexName: 'works', query: 'naruto', hitsPerPage: 24, page: 0 });
    expect(buildSearchRequests(request({ includeWorks: false }), INDEXES)).toHaveLength(1);
    expect(buildSearchRequests(request(), { ...INDEXES, worksIndex: '' })).toHaveLength(1);
    expect(wantsWorks(request(), { ...INDEXES, worksIndex: '' })).toBe(false);
  });
});

describe('parseSearchResponse', () => {
  it('reads a v5 answer, works included', () => {
    const response = { results: [{ hits: [{ id: 'a' }], nbHits: 40 }, { hits: [{ id: 'w' }], nbHits: 3 }] };
    expect(parseSearchResponse(response, true)).toEqual({ hits: [{ id: 'a' }], totalHits: 40, works: [{ id: 'w' }], totalWorks: 3, total: 43 });
  });

  it('ignores a works answer that was not asked for, and reads a flat legacy shape', () => {
    expect(parseSearchResponse({ results: [{ hits: [{ id: 'a' }], nbHits: 1 }, { hits: [{ id: 'w' }], nbHits: 9 }] }, false)).toMatchObject({ works: [], totalWorks: 0, total: 1 });
    expect(parseSearchResponse({ hits: [{ id: 'a' }, { id: 'b' }] }, false)).toMatchObject({ totalHits: 2 });
  });
});

describe('buildFilters', () => {
  it('decides airing and upcoming by the start date, not the label', () => {
    // MyAnimeList's label is copied at scrape time and goes stale: the index
    // held "Not yet aired" shows that had started months before, and they
    // vanished from Airing and Upcoming both. The start date is what the
    // catalogue actually knows.
    expect(buildFilters({ status: 'NOT_YET_AIRED' }, NOW)).toBe(`date_rank > ${CLOCK}`);
    expect(buildFilters({ status: 'CURRENTLY_AIRING' }, NOW)).toBe(`date_rank <= ${CLOCK} AND NOT status:"Finished Airing"`);
  });

  it('has only the label to go on for finished', () => {
    // The end date is indexed as text and most records lack one.
    expect(buildFilters({ status: 'FINISHED_AIRING' }, NOW)).toBe('status:"Finished Airing"');
  });

  it('floors the clock to the hour so the filter string is cacheable', () => {
    expect(filterClock(NOW)).toBe(CLOCK);
    expect(filterClock(Date.UTC(2026, 9, 4, 13, 59, 59))).toBe(CLOCK);
    expect(filterClock(Date.UTC(2026, 9, 4, 14))).toBe(CLOCK + 3600);
  });

  it('joins the genre, the status and the year with AND', () => {
    expect(buildFilters({}, NOW)).toBeUndefined();
    expect(buildFilters({ genre: 'Action' }, NOW)).toBe('tags:"Action"');
    expect(buildFilters({ status: 'NOT_YET_AIRED', year: 2026 }, NOW)).toBe(`date_rank > ${CLOCK} AND year:2026`);
    expect(buildFilters({ genre: 'Drama', status: 'FINISHED_AIRING', year: 1998 }, NOW)).toBe('tags:"Drama" AND status:"Finished Airing" AND year:1998');
  });

  it('ignores a status the page does not know', () => {
    expect(buildFilters({ status: 'BOGUS' }, NOW)).toBeUndefined();
  });

  it('reaches the anime request, never the works one', () => {
    const [anime, works] = buildSearchRequests(request({ status: 'FINISHED_AIRING', year: 2026 }), INDEXES, NOW);
    expect(anime.filters).toBe('status:"Finished Airing" AND year:2026');
    expect(works.filters).toBeUndefined();
  });
});

describe('genre facets', () => {
  it('narrows the counts to the status and year in play, but never to the genre', () => {
    expect(buildGenreFacetRequest(INDEXES, { status: 'FINISHED_AIRING', year: 2026 }, NOW)).toEqual({
      indexName: 'anime', query: '', hitsPerPage: 0, facets: ['tags'], filters: 'status:"Finished Airing" AND year:2026'
    });
    expect(buildGenreFacetRequest(INDEXES, { status: null, year: null })).toEqual({ indexName: 'anime', query: '', hitsPerPage: 0, facets: ['tags'] });
  });

  it('asks for counts only, and turns the answer into the strip', () => {
    expect(buildGenreFacetRequest(INDEXES)).toEqual({ indexName: 'anime', query: '', hitsPerPage: 0, facets: ['tags'] });
    const facets = parseGenreFacetResponse({ results: [{ facets: { tags: { Action: 10, Drama: 4 } } }] });
    expect(facets.map((f) => f.name)).toEqual(['Action', 'Drama']);
    expect(parseGenreFacetResponse({ results: [{}] })).toEqual([]);
  });
});

describe('readSearchParams', () => {
  it('reads everything the URL says, pages into zero-based ones', () => {
    expect(readSearchParams('?query=naruto&genre=Action&status=CURRENTLY_AIRING&year=2019&sort=score&view=list&page=3&wpage=2&perPage=48')).toEqual({
      query: 'naruto', genre: 'Action', status: 'CURRENTLY_AIRING', year: 2019, sort: 'score', view: 'list', hitsPage: 2, worksPage: 1, perPage: 48,
    });
  });

  it('defaults a missing or nonsense page and size', () => {
    expect(readSearchParams('?q=naruto&page=0&perPage=7')).toMatchObject({ query: 'naruto', genre: null, hitsPage: 0, worksPage: 0, perPage: PAGE_SIZE_OPTIONS[0] });
    expect(readSearchParams('?page=x')).toMatchObject({ hitsPage: 0 });
  });
});

describe('searchPageHref', () => {
  const current = readSearchParams('?query=one%20piece&genre=Action');

  it('links to another page of the same search, in the page\'s own spelling', () => {
    expect(searchPageHref(current, { hitsPage: 1 })).toBe('/search?query=one+piece&genre=Action&page=2');
    expect(searchPageHref(current, { worksPage: 2, perPage: 48 })).toBe('/search?query=one+piece&genre=Action&wpage=3&perPage=48');
  });

  it('carries the filters and the layout along', () => {
    const narrowed = readSearchParams('?status=FINISHED_AIRING&year=1998&sort=title&view=list');
    expect(searchPageHref(narrowed, { hitsPage: 1 })).toBe('/search?status=FINISHED_AIRING&year=1998&sort=title&view=list&page=2');
  });

  it('keeps the first page and the default size out of the URL', () => {
    expect(searchPageHref(current)).toBe('/search?query=one+piece&genre=Action');
    expect(searchPageHref(readSearchParams(''))).toBe('/search');
  });
});

describe('toCatalogRequest', () => {
  it('trims the query and carries works only for a plain text search', () => {
    expect(toCatalogRequest(readSearchParams('?query=%20naruto%20'))).toMatchObject({ query: 'naruto', includeWorks: true });
    expect(toCatalogRequest(readSearchParams('?query=naruto&genre=Action'))).toMatchObject({ includeWorks: false });
    expect(toCatalogRequest(readSearchParams('?genre=Action'))).toMatchObject({ query: '', includeWorks: false });
  });

  it('asks for the whole catalogue when the URL names nothing', () => {
    expect(toCatalogRequest(readSearchParams(''))).toMatchObject({ query: '', genre: null, status: null, year: null, hitsPage: 0, includeWorks: false });
  });

  it('carries the status and year, and leaves the works out under them', () => {
    // The works index has none of the anime facets: filtered anime beside
    // unfiltered manga reads as a bug.
    expect(toCatalogRequest(readSearchParams('?query=naruto&status=CURRENTLY_AIRING'))).toMatchObject({ status: 'CURRENTLY_AIRING', year: null, includeWorks: false });
    expect(toCatalogRequest(readSearchParams('?query=naruto&year=2019'))).toMatchObject({ status: null, year: 2019, includeWorks: false });
  });
});
