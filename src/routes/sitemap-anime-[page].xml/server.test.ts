import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

/**
 * One chunk of the show-page sitemap. The builders are pinned in
 * `src/lib/server/sitemap.test.ts`; what this endpoint adds is the chunk
 * number -- which is 1-based, must reject anything that is not a whole number
 * in range, and must 404 rather than serve an empty urlset for a chunk past
 * the end, so a stale index entry surfaces in Search Console.
 */

const request = vi.fn(async (_query: string, _vars?: any) => ({}) as any);
const createSSRGraphQLClient = vi.fn(() => ({ request }));

vi.mock('$lib/server/ssr-graphql', () => ({
  createSSRGraphQLClient: (...args: unknown[]) => (createSSRGraphQLClient as any)(...args)
}));

const { GET } = await import('./+server');
const { ANIME_PER_SITEMAP, _clearSitemapCache } = await import('$lib/server/sitemap');

const SITE = 'https://weeb.vip';
const STAGING = 'https://staging.weeb.vip';

function event(page: string, origin = SITE) {
  return {
    params: { page },
    locals: { config: { graphql_host: 'https://api.test/graphql' } },
    url: new URL(`${origin}/sitemap-anime-${page}.xml`)
  } as any;
}

/** `count` catalogue rows, slugged so they all survive into the urlset. */
function catalogue(count: number, offset = 0) {
  return Array.from({ length: count }, (_, i) => ({
    id: `a${offset + i}`,
    slug: `anime-${offset + i}`,
    updatedAt: null
  }));
}

function parseXml(body: string): Document {
  const doc = new DOMParser().parseFromString(body, 'application/xml');
  expect(doc.getElementsByTagName('parsererror')).toHaveLength(0);
  return doc;
}

function locs(doc: Document): string[] {
  return [...doc.getElementsByTagName('loc')].map((el) => el.textContent ?? '');
}

/** Cheaper than parsing a 10,000-entry document just to count it. */
function countUrls(body: string): number {
  return body.split('<url>').length - 1;
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

describe('the response a crawler gets for a valid chunk', () => {
  it('is a 200 declaring XML with the shared cache policy', async () => {
    const res = await GET(event('1'));

    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toBe('application/xml; charset=utf-8');
    expect(res.headers.get('cache-control')).toBe('public, max-age=3600, s-maxage=21600');
  });

  it('is a well-formed urlset of show pages', async () => {
    const doc = parseXml(await (await GET(event('1'))).text());

    expect(doc.documentElement.tagName).toBe('urlset');
    expect(locs(doc)).toEqual([
      `${SITE}/anime/anime-0`,
      `${SITE}/anime/anime-1`,
      `${SITE}/anime/anime-2`
    ]);
  });

  it('addresses the shows on the origin that asked', async () => {
    const doc = parseXml(await (await GET(event('1', STAGING))).text());

    expect(locs(doc)).toContain(`${STAGING}/anime/anime-0`);
  });

  it('queries anonymously', async () => {
    await GET(event('1'));

    expect(createSSRGraphQLClient).toHaveBeenCalledWith('https://api.test/graphql', null);
  });

  it('drops a show whose slug has not landed yet', async () => {
    request.mockResolvedValue({
      newestAnime: [{ id: 'a1', slug: null, updatedAt: null }, ...catalogue(1)]
    });

    expect(locs(parseXml(await (await GET(event('1'))).text()))).toEqual([`${SITE}/anime/anime-0`]);
  });
});

describe('which slice of the catalogue a chunk number selects', () => {
  it('starts chunk 1 at the top of the catalogue', async () => {
    request.mockResolvedValue({ newestAnime: catalogue(ANIME_PER_SITEMAP + 2) });

    const body = await (await GET(event('1'))).text();

    expect(countUrls(body)).toBe(ANIME_PER_SITEMAP);
    expect(body).toContain(`${SITE}/anime/anime-0<`);
    expect(body).not.toContain(`${SITE}/anime/anime-${ANIME_PER_SITEMAP}<`);
  });

  it('starts chunk 2 exactly where chunk 1 ended -- no overlap, no gap', async () => {
    request.mockResolvedValue({ newestAnime: catalogue(ANIME_PER_SITEMAP + 2) });

    const body = await (await GET(event('2'))).text();

    expect(countUrls(body)).toBe(2);
    expect(body).toContain(`${SITE}/anime/anime-${ANIME_PER_SITEMAP}<`);
    expect(body).toContain(`${SITE}/anime/anime-${ANIME_PER_SITEMAP + 1}<`);
  });

  it('serves the one chunk of an empty catalogue as an empty urlset, not a 404', async () => {
    // chunkCount never reports zero, so the index always lists chunk 1 and it
    // has to resolve.
    request.mockResolvedValue({ newestAnime: [] });

    const res = await GET(event('1'));

    expect(res.status).toBe(200);
    expect(countUrls(await res.text())).toBe(0);
  });
});

describe('a chunk number that is not one', () => {
  it.each(['0', '-1', 'abc', '', '1.5', 'NaN', 'Infinity', '1e3', ' '])(
    '404s on %o rather than serving something',
    async (page) => {
      await expect(GET(event(page))).rejects.toMatchObject({ status: 404 });
    }
  );

  it('404s before it even builds a client, for a page number it can reject outright', async () => {
    await expect(GET(event('0'))).rejects.toMatchObject({ status: 404 });

    expect(createSSRGraphQLClient).not.toHaveBeenCalled();
  });

  it('404s past the end of the catalogue, so a stale index entry is visible', async () => {
    // An empty urlset here would be reported as a chunk with zero URLs, which
    // reads as "nothing to index" rather than "this file should not exist".
    request.mockResolvedValue({ newestAnime: catalogue(3) });

    await expect(GET(event('2'))).rejects.toMatchObject({ status: 404 });
  });

  it('accepts the last chunk that does exist', async () => {
    request.mockResolvedValue({ newestAnime: catalogue(ANIME_PER_SITEMAP + 1) });

    expect((await GET(event('2'))).status).toBe(200);
  });
});

describe('when the catalogue query fails', () => {
  it('rejects rather than serving a chunk with nothing in it', async () => {
    request.mockRejectedValue(new Error('gateway 502'));

    await expect(GET(event('1'))).rejects.toThrow('gateway 502');
  });
});
