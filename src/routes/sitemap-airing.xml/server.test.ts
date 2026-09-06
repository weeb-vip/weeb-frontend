import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

/**
 * The airing sitemap -- the ~180 pages that matter this season, kept in their
 * own file so Search Console reports their coverage separately.
 *
 * `getAiringRecords` and `animeEntries` are pinned in
 * `src/lib/server/sitemap.test.ts`. What this endpoint adds is the season it
 * asks for (which comes from getCurrentSeason, not a hardcoded string), the
 * headers, and the fact that it deliberately emits no priority or changefreq.
 */

const request = vi.fn(async (_query: string, _vars?: any) => ({}) as any);
const createSSRGraphQLClient = vi.fn(() => ({ request }));
const getCurrentSeason = vi.fn(() => 'SPRING_2026');

vi.mock('$lib/server/ssr-graphql', () => ({
  createSSRGraphQLClient: (...args: unknown[]) => (createSSRGraphQLClient as any)(...args),
  getCurrentSeason: () => getCurrentSeason()
}));

const { GET } = await import('./+server');
const { _clearSitemapCache } = await import('$lib/server/sitemap');

const SITE = 'https://weeb.vip';
const STAGING = 'https://staging.weeb.vip';

function event(origin = SITE) {
  return {
    locals: { config: { graphql_host: 'https://api.test/graphql' } },
    url: new URL(`${origin}/sitemap-airing.xml`)
  } as any;
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
  request.mockResolvedValue({
    currentlyAiring: [{ id: 'a1', slug: 'airing-one', updatedAt: '2026-08-03 04:25:32' }],
    animeBySeasons: [{ id: 'a2', slug: 'season-two', updatedAt: null }]
  });
  createSSRGraphQLClient.mockClear();
  getCurrentSeason.mockClear();
  getCurrentSeason.mockReturnValue('SPRING_2026');
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

describe('the season it asks for', () => {
  it('comes from getCurrentSeason rather than being hardcoded', async () => {
    await GET(event());

    expect(getCurrentSeason).toHaveBeenCalled();
    expect(request.mock.calls[0][1]).toEqual({ season: 'SPRING_2026' });
  });

  it('follows the clock into the next season without a code change', async () => {
    getCurrentSeason.mockReturnValue('FALL_2026');

    await GET(event());

    expect(request.mock.calls[0][1]).toEqual({ season: 'FALL_2026' });
  });
});

describe('the URLs it lists', () => {
  it('lists show pages for both what is airing and what is in season', async () => {
    const doc = parseXml(await (await GET(event())).text());

    expect(locs(doc)).toEqual([`${SITE}/anime/airing-one`, `${SITE}/anime/season-two`]);
  });

  it('carries the lastmod it has, and omits it where it has none', async () => {
    const doc = parseXml(await (await GET(event())).text());

    expect([...doc.getElementsByTagName('lastmod')].map((el) => el.textContent)).toEqual([
      '2026-08-03'
    ]);
  });

  it('emits neither priority nor changefreq, which Google ignores anyway', async () => {
    const body = await (await GET(event())).text();

    expect(body).not.toContain('<priority>');
    expect(body).not.toContain('<changefreq>');
  });

  it('drops a show whose slug has not landed yet', async () => {
    request.mockResolvedValue({
      currentlyAiring: [{ id: 'a1', slug: null, updatedAt: null }],
      animeBySeasons: []
    });

    const body = await (await GET(event())).text();

    expect(locs(parseXml(body))).toEqual([]);
    expect(body).not.toContain('undefined');
  });

  it('addresses them on the origin that asked', async () => {
    const doc = parseXml(await (await GET(event(STAGING))).text());

    expect(locs(doc)).toContain(`${STAGING}/anime/airing-one`);
  });

  it('is still a valid, empty urlset between seasons', async () => {
    request.mockResolvedValue({ currentlyAiring: [], animeBySeasons: [] });

    const res = await GET(event());
    const doc = parseXml(await res.text());

    expect(res.status).toBe(200);
    expect(doc.documentElement.tagName).toBe('urlset');
    expect(locs(doc)).toEqual([]);
  });
});

describe('when the query fails', () => {
  it('rejects rather than serving an empty airing sitemap', async () => {
    // An empty file here would tell Search Console this season stopped existing.
    request.mockRejectedValue(new Error('gateway 502'));

    await expect(GET(event())).rejects.toThrow('gateway 502');
  });
});
