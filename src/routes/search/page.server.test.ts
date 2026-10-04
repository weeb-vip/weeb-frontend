// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest';

/**
 * The loader builds the first render from one Algolia round trip. The client
 * module is mocked at the import boundary: what matters here is which requests
 * go out for which URL and what the page is handed back, including when
 * Algolia is slow or down.
 */
const search = vi.fn();
// Both spellings, because the loader resolves whichever the installed major provides.
const factory = () => ({ search });
vi.mock('algoliasearch/lite', () => ({ default: factory, liteClient: factory }));

const CONFIG = { algolia_index: 'anime', algolia_works_index: 'works' };

async function run(path: string) {
  const { load } = await import('./+page.server');
  return load({ url: new URL(`http://localhost${path}`), locals: { config: CONFIG } } as any) as Promise<any>;
}

beforeEach(() => {
  search.mockReset();
});

describe('the /search loader', () => {
  it('asks for the genre strip and the page of results in one round trip', async () => {
    search.mockResolvedValue({
      results: [
        { facets: { tags: { Action: 3 } } },
        { hits: [{ id: 'a1' }], nbHits: 12 },
        { hits: [{ id: 'w1' }], nbHits: 2 },
      ],
    });

    const data = await run('/search?query=naruto&page=2');

    expect(search).toHaveBeenCalledTimes(1);
    const { requests } = search.mock.calls[0][0];
    expect(requests[0]).toMatchObject({ indexName: 'anime', hitsPerPage: 0, facets: ['tags'] });
    expect(requests[1]).toMatchObject({ indexName: 'anime', query: 'naruto', page: 1, hitsPerPage: 24 });
    expect(requests[2]).toMatchObject({ indexName: 'works', query: 'naruto', page: 0 });
    expect(data.search).toMatchObject({
      key: '?query=naruto&page=2',
      params: { query: 'naruto', genre: null, hitsPage: 1 },
      results: { hits: [{ id: 'a1' }], totalHits: 12, works: [{ id: 'w1' }], totalWorks: 2, total: 14 },
      genres: [{ name: 'Action', count: 3 }],
    });
  });

  it('searches the whole catalogue for a URL that names nothing, so the page is never blank', async () => {
    search.mockResolvedValue({ results: [{ facets: { tags: { Drama: 1 } } }, { hits: [{ id: 'a1' }], nbHits: 30000 }] });

    const data = await run('/search');

    const { requests } = search.mock.calls[0][0];
    expect(requests).toHaveLength(2);
    expect(requests[1]).toMatchObject({ indexName: 'anime', query: '', page: 0, hitsPerPage: 24 });
    expect(requests[1].filters).toBeUndefined();
    expect(data.search.results).toMatchObject({ hits: [{ id: 'a1' }], totalHits: 30000, works: [] });
    expect(data.search.genres).toEqual([{ name: 'Drama', count: 1 }]);
  });

  it('narrows both the results and the genre counts to the status and year in the URL', async () => {
    search.mockResolvedValue({ results: [{}, { hits: [], nbHits: 0 }] });

    await run('/search?status=FINISHED_AIRING&year=1998&page=2');

    const { requests } = search.mock.calls[0][0];
    expect(requests).toHaveLength(2);
    expect(requests[0].filters).toBe('status:"Finished Airing" AND year:1998');
    expect(requests[1]).toMatchObject({ page: 1, filters: 'status:"Finished Airing" AND year:1998' });
  });

  it('skips the works index for a genre filter', async () => {
    search.mockResolvedValue({ results: [{}, { hits: [], nbHits: 0 }] });

    const data = await run('/search?query=naruto&genre=Action');

    expect(search.mock.calls[0][0].requests).toHaveLength(2);
    expect(data.search.results).toMatchObject({ works: [], totalWorks: 0 });
  });

  it('ships the page without results when Algolia fails, rather than an error', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    search.mockRejectedValue(new Error('down'));

    const data = await run('/search?query=naruto');

    expect(data.search).toMatchObject({ key: '?query=naruto', results: null, genres: null });
  });
});
