import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

/**
 * The static-pages sitemap. `getSeasonEntries` itself is pinned in
 * `src/lib/server/sitemap.test.ts`; what this endpoint adds is the static list,
 * the root-path special case, and the guarantee that a season discovery
 * problem still leaves the static pages served rather than 500ing the file.
 */

const request = vi.fn(async (_query: string, _vars?: any) => ({}) as any);
const createSSRGraphQLClient = vi.fn(() => ({ request }));

vi.mock('$lib/server/ssr-graphql', () => ({
  createSSRGraphQLClient: (...args: unknown[]) => (createSSRGraphQLClient as any)(...args)
}));

const { GET } = await import('./+server');
const { STATIC_PATHS, _clearSitemapCache } = await import('$lib/server/sitemap');

const SITE = 'https://weeb.vip';
const STAGING = 'https://staging.weeb.vip';

function event(origin = SITE) {
  return {
    locals: { config: { graphql_host: 'https://api.test/graphql' } },
    url: new URL(`${origin}/sitemap-pages.xml`)
  } as any;
}

/** Answers "this season has anime" only for the listed seasons. */
function seasonsWithAnime(...present: string[]) {
  request.mockImplementation(async (_query: string, vars: any) =>
    present.includes(vars?.season) ? { animeBySeasons: [{ id: 'a1' }] } : { animeBySeasons: [] }
  );
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
  request.mockResolvedValue({ animeBySeasons: [] });
  createSSRGraphQLClient.mockClear();
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
  vi.useRealTimers();
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

describe('the static pages', () => {
  it('lists every indexable path, and no auth or profile page', async () => {
    const doc = parseXml(await (await GET(event())).text());

    expect(locs(doc)).toEqual([
      `${SITE}/`,
      `${SITE}/airing`,
      `${SITE}/airing/calendar`,
      `${SITE}/about`
    ]);
    expect(STATIC_PATHS).not.toContain('/profile');
  });

  it('emits the root as a bare trailing slash rather than an empty path', async () => {
    const doc = parseXml(await (await GET(event())).text());

    expect(locs(doc)[0]).toBe('https://weeb.vip/');
    expect(locs(doc)).not.toContain('https://weeb.vip');
  });

  it('addresses them on the origin that asked', async () => {
    const doc = parseXml(await (await GET(event(STAGING))).text());

    expect(locs(doc)).toContain(`${STAGING}/airing`);
  });
});

describe('the season pages', () => {
  it('lists only the seasons that actually have anime behind them', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-04-01T00:00:00Z'));
    seasonsWithAnime('SPRING_2026', 'WINTER_2026');

    const doc = parseXml(await (await GET(event())).text());

    expect(locs(doc).filter((loc) => loc.includes('/season/'))).toEqual([
      `${SITE}/season/WINTER_2026`,
      `${SITE}/season/SPRING_2026`
    ]);
  });

  it('follows the static pages rather than leading', async () => {
    seasonsWithAnime('FALL_2026');

    const found = locs(parseXml(await (await GET(event())).text()));

    expect(found.findIndex((loc) => loc.includes('/season/'))).toBe(STATIC_PATHS.length);
  });

  it('addresses seasons on the origin that asked', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-04-01T00:00:00Z'));
    seasonsWithAnime('SPRING_2026');

    const doc = parseXml(await (await GET(event(STAGING))).text());

    expect(locs(doc)).toContain(`${STAGING}/season/SPRING_2026`);
  });

  it('lists none when no season has anime, leaving the statics alone', async () => {
    const doc = parseXml(await (await GET(event())).text());

    expect(locs(doc)).toHaveLength(STATIC_PATHS.length);
  });
});

describe('a season lookup that fails', () => {
  it('still serves the static pages rather than the whole file failing', async () => {
    // The static pages are worth serving on their own; losing them because the
    // season probe blipped would drop the homepage out of the sitemap.
    request.mockRejectedValue(new Error('gateway 502'));

    const res = await GET(event());
    const doc = parseXml(await res.text());

    expect(res.status).toBe(200);
    expect(locs(doc)).toEqual([
      `${SITE}/`,
      `${SITE}/airing`,
      `${SITE}/airing/calendar`,
      `${SITE}/about`
    ]);
  });
});
