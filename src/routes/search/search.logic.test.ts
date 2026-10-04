import { describe, it, expect } from 'vitest';
import {
  buildGenreFacetRequest,
  buildSearchRequests,
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
const request = (partial: Partial<CatalogSearchRequest> = {}): CatalogSearchRequest => ({
  query: 'naruto',
  hitsPage: 0,
  worksPage: 0,
  perPage: 24,
  genre: null,
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

describe('genre facets', () => {
  it('asks for counts only, and turns the answer into the strip', () => {
    expect(buildGenreFacetRequest(INDEXES)).toEqual({ indexName: 'anime', query: '', hitsPerPage: 0, facets: ['tags'] });
    const facets = parseGenreFacetResponse({ results: [{ facets: { tags: { Action: 10, Drama: 4 } } }] });
    expect(facets.map((f) => f.name)).toEqual(['Action', 'Drama']);
    expect(parseGenreFacetResponse({ results: [{}] })).toEqual([]);
  });
});

describe('readSearchParams', () => {
  it('reads the query, genre and one-based pages into zero-based ones', () => {
    expect(readSearchParams('?query=naruto&genre=Action&page=3&wpage=2&perPage=48')).toEqual({
      query: 'naruto', genre: 'Action', hitsPage: 2, worksPage: 1, perPage: 48,
    });
  });

  it('defaults a missing or nonsense page and size', () => {
    expect(readSearchParams('?q=naruto&page=0&perPage=7')).toEqual({ query: 'naruto', genre: null, hitsPage: 0, worksPage: 0, perPage: PAGE_SIZE_OPTIONS[0] });
    expect(readSearchParams('?page=x')).toMatchObject({ hitsPage: 0 });
  });
});

describe('searchPageHref', () => {
  const current = readSearchParams('?query=one%20piece&genre=Action');

  it('links to another page of the same search, in the page\'s own spelling', () => {
    expect(searchPageHref(current, { hitsPage: 1 })).toBe('/search?query=one+piece&genre=Action&page=2');
    expect(searchPageHref(current, { worksPage: 2, perPage: 48 })).toBe('/search?query=one+piece&genre=Action&wpage=3&perPage=48');
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
});
