import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

/**
 * The sitemap index endpoint. The builders it calls are pinned in
 * `src/lib/server/sitemap.test.ts`, so what is left to this file is what the
 * endpoint itself adds: the response headers a crawler sees, the children it
 * lists and their order, and that the children are addressed on the origin
 * that asked -- a sitemap fetched from staging must not send crawlers to
 * production.
 */

const request = vi.fn(async (_query: string, _vars?: unknown) => ({}) as any);
const createSSRGraphQLClient = vi.fn(() => ({ request }));

vi.mock('$lib/server/ssr-graphql', () => ({
  createSSRGraphQLClient: (...args: unknown[]) => (createSSRGraphQLClient as any)(...args)
}));

const { GET } = await import('./+server');
const { _clearSitemapCache, ANIME_PER_SITEMAP } = await import('$lib/server/sitemap');

const SITE = 'https://weeb.vip';
const STAGING = 'https://staging.weeb.vip';

function event(origin = SITE) {
  return {
    locals: { config: { graphql_host: 'https://api.test/graphql' } },
    url: new URL(`${origin}/sitemap.xml`)
  } as any;
}

/** `count` catalogue rows, enough to drive the chunk arithmetic. */
function catalogue(count: number) {
  return Array.from({ length: count }, (_, i) => ({
    id: `a${i}`,
    slug: `anime-${i}`,
    updatedAt: null
  }));
}

/** Parses the body and fails the test if it is not well-formed XML. */
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
  request.mockResolvedValue({ newestAnime: catalogue(3) });
  createSSRGraphQLClient.mockClear();
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('the response a crawler gets', () => {
  it('is a 200', async () => {
    expect((await GET(event())).status).toBe(200);
  });

  it('declares XML, so Search Console does not reject it as HTML', async () => {
    const res = await GET(event());

    expect(res.headers.get('content-type')).toBe('application/xml; charset=utf-8');
  });

  it('lets the CDN absorb the crawl traffic', async () => {
    const res = await GET(event());

    expect(res.headers.get('cache-control')).toBe('public, max-age=3600, s-maxage=21600');
  });

  it('is well-formed XML, and a sitemapindex rather than a urlset', async () => {
    const doc = parseXml(await (await GET(event())).text());

    expect(doc.documentElement.tagName).toBe('sitemapindex');
    expect(doc.documentElement.namespaceURI).toBe('http://www.sitemaps.org/schemas/sitemap/0.9');
    expect(doc.getElementsByTagName('urlset')).toHaveLength(0);
  });

  it('queries anonymously -- a sitemap must never be personalised', async () => {
    await GET(event());

    expect(createSSRGraphQLClient).toHaveBeenCalledWith('https://api.test/graphql', null);
  });
});

describe('the children it lists', () => {
  it('lists the static pages, the airing set, one chunk and the news hub, in that order', async () => {
    const doc = parseXml(await (await GET(event())).text());

    expect(locs(doc)).toEqual([
      `${SITE}/sitemap-pages.xml`,
      // Before the back catalogue: it is what a human should look at first.
      `${SITE}/sitemap-airing.xml`,
      `${SITE}/sitemap-anime-1.xml`,
      `${SITE}/sitemap-news.xml`
    ]);
  });

  it('lists one chunk even for an empty catalogue, so the index is never empty', async () => {
    request.mockResolvedValue({ newestAnime: [] });

    const doc = parseXml(await (await GET(event())).text());

    expect(locs(doc)).toContain(`${SITE}/sitemap-anime-1.xml`);
  });

  it('adds a chunk once the catalogue passes the page size', async () => {
    request.mockResolvedValue({ newestAnime: catalogue(ANIME_PER_SITEMAP + 1) });

    const doc = parseXml(await (await GET(event())).text());

    expect(locs(doc).filter((loc) => loc.includes('sitemap-anime-'))).toEqual([
      `${SITE}/sitemap-anime-1.xml`,
      `${SITE}/sitemap-anime-2.xml`
    ]);
  });

  it('numbers chunks from one, matching the chunk route', async () => {
    const doc = parseXml(await (await GET(event())).text());

    expect(locs(doc)).not.toContain(`${SITE}/sitemap-anime-0.xml`);
  });

  it('addresses every child on the origin that asked', async () => {
    const doc = parseXml(await (await GET(event(STAGING))).text());

    expect(locs(doc).every((loc) => loc.startsWith(STAGING))).toBe(true);
  });

  it('carries no lastmod on the children, which have none to report', async () => {
    const doc = parseXml(await (await GET(event())).text());

    expect(doc.getElementsByTagName('lastmod')).toHaveLength(0);
  });
});

describe('when the catalogue query fails', () => {
  // Pinned as it stands: nothing catches this, so the request 500s rather than
  // serving a partial index. That is arguably right for a sitemap -- a short
  // index would tell Google the canonical set had shrunk.
  it('rejects rather than serving an index with no chunks', async () => {
    request.mockRejectedValue(new Error('gateway 502'));

    await expect(GET(event())).rejects.toThrow('gateway 502');
  });
});
