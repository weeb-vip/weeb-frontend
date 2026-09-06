import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

/**
 * The news sitemap. `getNewsRecords` and `newsEntries` are pinned in
 * `src/lib/server/sitemap.test.ts`; what this endpoint adds is the join --
 * latestNews only reports an animeId, so the slugs have to come from the
 * catalogue, and an anime with news but no slug yet must drop out rather than
 * become /anime/undefined/news.
 */

const request = vi.fn(async (_query: string, _vars?: any) => ({}) as any);
const createSSRGraphQLClient = vi.fn(() => ({ request }));

vi.mock('$lib/server/ssr-graphql', () => ({
  createSSRGraphQLClient: (...args: unknown[]) => (createSSRGraphQLClient as any)(...args)
}));

const { GET } = await import('./+server');
const { _clearSitemapCache } = await import('$lib/server/sitemap');

const SITE = 'https://weeb.vip';
const STAGING = 'https://staging.weeb.vip';

function event(origin = SITE) {
  return {
    locals: { config: { graphql_host: 'https://api.test/graphql' } },
    url: new URL(`${origin}/sitemap-news.xml`)
  } as any;
}

/** Routes the two documents this endpoint sends by what they select. */
function api(anime: unknown[], news: unknown[]) {
  request.mockImplementation(async (query: string, vars: any) => {
    if (query.includes('newestAnime')) return { newestAnime: anime };
    if (query.includes('latestNews')) {
      const offset = vars?.offset ?? 0;
      return { latestNews: { total: news.length, items: news.slice(offset, offset + 100) } };
    }
    return {};
  });
}

function parseXml(body: string): Document {
  const doc = new DOMParser().parseFromString(body, 'application/xml');
  expect(doc.getElementsByTagName('parsererror')).toHaveLength(0);
  return doc;
}

function locs(doc: Document): string[] {
  return [...doc.getElementsByTagName('loc')].map((el) => el.textContent ?? '');
}

beforeEach(() => {
  _clearSitemapCache();
  request.mockReset();
  api([{ id: 'a1', slug: 'anime-one', updatedAt: null }], [
    { animeId: 'a1', publishedDate: '2026-08-03 04:25:32' }
  ]);
  createSSRGraphQLClient.mockClear();
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('the response a crawler gets', () => {
  it('is a 200 declaring XML with the shared cache policy', async () => {
    const res = await GET(event());

    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toBe('application/xml; charset=utf-8');
    expect(res.headers.get('cache-control')).toBe('public, max-age=3600, s-maxage=21600');
  });

  it('is a well-formed urlset', async () => {
    const doc = parseXml(await (await GET(event())).text());

    expect(doc.documentElement.tagName).toBe('urlset');
    expect(doc.documentElement.namespaceURI).toBe('http://www.sitemaps.org/schemas/sitemap/0.9');
  });

  it('queries anonymously', async () => {
    await GET(event());

    expect(createSSRGraphQLClient).toHaveBeenCalledWith('https://api.test/graphql', null);
  });
});

describe('the URLs it lists', () => {
  it('lists the news hub page, not a story, since stories have no URL of their own', async () => {
    const doc = parseXml(await (await GET(event())).text());

    expect(locs(doc)).toEqual([`${SITE}/anime/anime-one/news`]);
  });

  it('carries the story date as the hub page lastmod', async () => {
    const doc = parseXml(await (await GET(event())).text());

    expect([...doc.getElementsByTagName('lastmod')].map((el) => el.textContent)).toEqual([
      '2026-08-03'
    ]);
  });

  it('resolves the slug from the catalogue, because latestNews reports only an id', async () => {
    api(
      [
        { id: 'a1', slug: 'anime-one', updatedAt: null },
        { id: 'a2', slug: 'anime-two', updatedAt: null }
      ],
      [{ animeId: 'a2', publishedDate: null }]
    );

    const doc = parseXml(await (await GET(event())).text());

    expect(locs(doc)).toEqual([`${SITE}/anime/anime-two/news`]);
  });

  it('drops an anime whose slug has not landed yet, rather than emitting undefined', async () => {
    api([{ id: 'a1', slug: null, updatedAt: null }], [{ animeId: 'a1', publishedDate: null }]);

    const doc = parseXml(await (await GET(event())).text());

    expect(locs(doc)).toEqual([]);
    expect(await (await GET(event())).text()).not.toContain('undefined');
  });

  it('drops news for an anime the catalogue does not know at all', async () => {
    api([{ id: 'a1', slug: 'anime-one', updatedAt: null }], [
      { animeId: 'ghost', publishedDate: null }
    ]);

    expect(locs(parseXml(await (await GET(event())).text()))).toEqual([]);
  });

  it('lists only anime that have news, not the whole catalogue', async () => {
    api(
      [
        { id: 'a1', slug: 'anime-one', updatedAt: null },
        { id: 'a2', slug: 'anime-two', updatedAt: null }
      ],
      [{ animeId: 'a1', publishedDate: null }]
    );

    expect(locs(parseXml(await (await GET(event())).text()))).toHaveLength(1);
  });

  it('addresses them on the origin that asked', async () => {
    const doc = parseXml(await (await GET(event(STAGING))).text());

    expect(locs(doc)).toEqual([`${STAGING}/anime/anime-one/news`]);
  });

  it('is still a valid, empty urlset when nothing has news', async () => {
    api([{ id: 'a1', slug: 'anime-one', updatedAt: null }], []);

    const res = await GET(event());
    const doc = parseXml(await res.text());

    expect(res.status).toBe(200);
    expect(doc.documentElement.tagName).toBe('urlset');
    expect(locs(doc)).toEqual([]);
  });
});

describe('when a query fails', () => {
  it('rejects rather than serving a news sitemap missing most of its pages', async () => {
    request.mockRejectedValue(new Error('gateway 502'));

    await expect(GET(event())).rejects.toThrow('gateway 502');
  });
});
