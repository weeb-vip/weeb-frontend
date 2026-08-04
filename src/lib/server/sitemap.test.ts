import {
  ANIME_PER_SITEMAP,
  chunkCount,
  escapeXml,
  animeEntries,
  getAiringRecords,
  getAnimeRecords,
  getNewsRecords,
  newsEntries,
  getSeasonEntries,
  renderIndex,
  renderUrlset,
  toLastmod,
  _clearSitemapCache
} from './sitemap';

const SITE = 'https://weeb.vip';
const STAGING = 'https://staging.weeb.vip';

beforeEach(() => _clearSitemapCache());

describe('per-origin URLs', () => {
  it('builds show URLs on whichever origin asked', () => {
    const records = [{ id: 'a1', lastmod: '2026-08-03' }];

    expect(animeEntries(records, SITE)[0].loc).toBe('https://weeb.vip/show/a1');
    // A sitemap served from staging must not send crawlers to production.
    expect(animeEntries(records, STAGING)[0].loc).toBe('https://staging.weeb.vip/show/a1');
  });

  it('builds news URLs on whichever origin asked', () => {
    const records = [{ id: 'a1', lastmod: null }];

    expect(newsEntries(records, STAGING)[0].loc).toBe('https://staging.weeb.vip/show/a1/news');
  });

  it('carries lastmod through unchanged', () => {
    const records = [{ id: 'a1', lastmod: '2026-08-03' }];

    expect(animeEntries(records, SITE)[0].lastmod).toBe('2026-08-03');
    expect(newsEntries(records, SITE)[0].lastmod).toBe('2026-08-03');
  });

  it('caches records, not URLs, so a staging request cannot poison production', async () => {
    const { client, calls } = fakeClient(() => ({
      newestAnime: [{ id: 'a1', updatedAt: null }]
    }));

    const first = animeEntries(await getAnimeRecords(client), STAGING);
    const second = animeEntries(await getAnimeRecords(client), SITE);

    expect(calls).toHaveLength(1); // second call served from cache
    expect(first[0].loc).toBe('https://staging.weeb.vip/show/a1');
    expect(second[0].loc).toBe('https://weeb.vip/show/a1');
  });
});

/** Minimal stand-in for the graphql-request client. */
function fakeClient(handler: (query: string, vars: any) => any) {
  const calls: { query: string; vars: any }[] = [];
  const client = {
    request: jest.fn(async (query: string, vars: any) => {
      calls.push({ query, vars });
      return handler(query, vars);
    })
  };
  return { client: client as any, calls };
}

describe('toLastmod', () => {
  it('keeps the date from the API format, which is not ISO', () => {
    expect(toLastmod('2026-08-03 04:25:32')).toBe('2026-08-03');
  });

  it('accepts an already-ISO value', () => {
    expect(toLastmod('2026-08-03T04:25:32Z')).toBe('2026-08-03');
  });

  it('returns null for junk rather than emitting an invalid lastmod', () => {
    expect(toLastmod('')).toBeNull();
    expect(toLastmod(null)).toBeNull();
    expect(toLastmod('not a date')).toBeNull();
  });
});

describe('escapeXml', () => {
  it('escapes the characters that would break a urlset', () => {
    expect(escapeXml(`a&b<c>d"e'f`)).toBe('a&amp;b&lt;c&gt;d&quot;e&apos;f');
  });
});

describe('chunkCount', () => {
  it('never reports zero chunks, so the index always lists one', () => {
    expect(chunkCount(0)).toBe(1);
  });

  it('splits on the page size boundary', () => {
    expect(chunkCount(ANIME_PER_SITEMAP)).toBe(1);
    expect(chunkCount(ANIME_PER_SITEMAP + 1)).toBe(2);
    expect(chunkCount(31983)).toBe(4);
  });
});

describe('renderUrlset', () => {
  it('emits valid XML with lastmod only where known', () => {
    const xml = renderUrlset([
      { loc: 'https://weeb.vip/show/a', lastmod: '2026-08-03' },
      { loc: 'https://weeb.vip/show/b', lastmod: null }
    ]);
    expect(xml).toContain('<?xml version="1.0" encoding="UTF-8"?>');
    expect(xml).toContain('<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">');
    expect(xml).toContain('<loc>https://weeb.vip/show/a</loc>');
    expect(xml).toContain('<lastmod>2026-08-03</lastmod>');
    // Exactly one lastmod: the entry without a date must not emit an empty tag.
    expect(xml.match(/<lastmod>/g)).toHaveLength(1);
  });
});

describe('renderIndex', () => {
  it('emits a sitemapindex, not a urlset', () => {
    const xml = renderIndex([{ loc: 'https://weeb.vip/sitemap-anime-1.xml' }]);
    expect(xml).toContain('<sitemapindex');
    expect(xml).toContain('<sitemap>');
    expect(xml).not.toContain('<urlset');
  });
});

describe('getAnimeEntries', () => {
  it('maps the catalogue onto show URLs with lastmod', async () => {
    const { client } = fakeClient(() => ({
      newestAnime: [
        { id: 'a1', updatedAt: '2026-08-03 04:25:32' },
        { id: 'a2', updatedAt: null }
      ]
    }));

    const records = await getAnimeRecords(client);

    // Records are host-independent; the URL is built later, per request origin.
    expect(records).toEqual([
      { id: 'a1', lastmod: '2026-08-03' },
      { id: 'a2', lastmod: null }
    ]);
  });

  it('drops entries with no id rather than emitting /show/undefined', async () => {
    const { client } = fakeClient(() => ({
      newestAnime: [{ id: 'a1', updatedAt: null }, { id: null }, {}]
    }));

    expect(await getAnimeRecords(client)).toHaveLength(1);
  });

  it('caches: listing 32k anime is far too expensive to repeat per request', async () => {
    const { client, calls } = fakeClient(() => ({ newestAnime: [{ id: 'a1' }] }));

    await getAnimeRecords(client);
    await getAnimeRecords(client);

    expect(calls).toHaveLength(1);
  });
});

describe('getNewsEntries', () => {
  it('pages through the feed, which caps at 100 per call', async () => {
    const total = 250;
    const { client, calls } = fakeClient((_q, vars) => {
      const offset = vars.offset as number;
      const count = Math.min(100, total - offset);
      return {
        latestNews: {
          total,
          items: Array.from({ length: count }, (_, i) => ({
            animeId: `anime-${offset + i}`,
            publishedDate: '2026-08-03'
          }))
        }
      };
    });

    const entries = await getNewsRecords(client);

    expect(calls).toHaveLength(3);
    expect(entries).toHaveLength(total);
  });

  it('lists each anime once, not once per story', async () => {
    const { client } = fakeClient(() => ({
      latestNews: {
        total: 3,
        items: [
          { animeId: 'same', publishedDate: '2026-08-03' },
          { animeId: 'same', publishedDate: '2026-07-01' },
          { animeId: 'other', publishedDate: '2026-06-01' }
        ]
      }
    }));

    const entries = newsEntries(await getNewsRecords(client), SITE);

    expect(entries).toHaveLength(2);
    expect(entries.map((e) => e.loc)).toEqual([
      'https://weeb.vip/show/same/news',
      'https://weeb.vip/show/other/news'
    ]);
    // Newest story wins as the page's lastmod.
    expect(entries[0].lastmod).toBe('2026-08-03');
  });

  it('stops when a page comes back empty, even if total disagrees', async () => {
    const { client, calls } = fakeClient(() => ({
      latestNews: { total: 9999, items: [] }
    }));

    expect(await getNewsRecords(client)).toEqual([]);
    expect(calls).toHaveLength(1);
  });
});

describe('getAiringRecords', () => {
  it('unions currentlyAiring with the current season, without duplicates', async () => {
    const { client, calls } = fakeClient(() => ({
      currentlyAiring: [
        { id: 'a', updatedAt: '2026-08-03 04:25:32' },
        { id: 'b', updatedAt: null }
      ],
      // 'b' airs and is in the season; 'c' is in the season but between episodes.
      animeBySeasons: [
        { id: 'b', updatedAt: '2026-07-01 00:00:00' },
        { id: 'c', updatedAt: '2026-07-02 00:00:00' }
      ]
    }));

    const records = await getAiringRecords(client, 'SUMMER_2026');

    expect(records.map((r) => r.id)).toEqual(['a', 'b', 'c']);
    // One round trip: both sets come from a single query.
    expect(calls).toHaveLength(1);
  });

  it('keeps the first lastmod seen, so airing data wins over season data', async () => {
    const { client } = fakeClient(() => ({
      currentlyAiring: [{ id: 'b', updatedAt: '2026-08-03 04:25:32' }],
      animeBySeasons: [{ id: 'b', updatedAt: '2026-07-01 00:00:00' }]
    }));

    const records = await getAiringRecords(client, 'SUMMER_2026');

    expect(records).toEqual([{ id: 'b', lastmod: '2026-08-03' }]);
  });

  it('passes the season through as a variable', async () => {
    const { client, calls } = fakeClient(() => ({ currentlyAiring: [], animeBySeasons: [] }));

    await getAiringRecords(client, 'FALL_2026');

    expect(calls[0].vars).toEqual({ season: 'FALL_2026' });
  });

  it('caches, like the other sitemap sources', async () => {
    const { client, calls } = fakeClient(() => ({
      currentlyAiring: [{ id: 'a' }],
      animeBySeasons: []
    }));

    await getAiringRecords(client, 'SUMMER_2026');
    await getAiringRecords(client, 'SUMMER_2026');

    expect(calls).toHaveLength(1);
  });
});

describe('getSeasonEntries', () => {
  it('lists only seasons that actually have anime', async () => {
    const { client } = fakeClient((_q, vars) =>
      vars.season === 'SUMMER_2026'
        ? { animeBySeasons: [{ id: 'a' }] }
        : { animeBySeasons: [] }
    );

    const entries = await getSeasonEntries(client, new Date('2026-08-03T00:00:00Z'), SITE);

    expect(entries).toEqual([{ loc: 'https://weeb.vip/season/SUMMER_2026' }]);
  });

  it('treats a failing season lookup as absent rather than throwing', async () => {
    const { client } = fakeClient((_q, vars) => {
      if (vars.season === 'WINTER_2026') throw new Error('boom');
      return { animeBySeasons: [] };
    });

    await expect(
      getSeasonEntries(client, new Date('2026-08-03T00:00:00Z'), SITE)
    ).resolves.toEqual([]);
  });
});
