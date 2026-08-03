import {
  ANIME_PER_SITEMAP,
  chunkCount,
  escapeXml,
  getAnimeEntries,
  getNewsEntries,
  getSeasonEntries,
  renderIndex,
  renderUrlset,
  toLastmod,
  _clearSitemapCache
} from './sitemap';

beforeEach(() => _clearSitemapCache());

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

    const entries = await getAnimeEntries(client);

    expect(entries).toEqual([
      { loc: 'https://weeb.vip/show/a1', lastmod: '2026-08-03' },
      { loc: 'https://weeb.vip/show/a2', lastmod: null }
    ]);
  });

  it('drops entries with no id rather than emitting /show/undefined', async () => {
    const { client } = fakeClient(() => ({
      newestAnime: [{ id: 'a1', updatedAt: null }, { id: null }, {}]
    }));

    expect(await getAnimeEntries(client)).toHaveLength(1);
  });

  it('caches: listing 32k anime is far too expensive to repeat per request', async () => {
    const { client, calls } = fakeClient(() => ({ newestAnime: [{ id: 'a1' }] }));

    await getAnimeEntries(client);
    await getAnimeEntries(client);

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

    const entries = await getNewsEntries(client);

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

    const entries = await getNewsEntries(client);

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

    expect(await getNewsEntries(client)).toEqual([]);
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

    const entries = await getSeasonEntries(client, new Date('2026-08-03T00:00:00Z'));

    expect(entries).toEqual([{ loc: 'https://weeb.vip/season/SUMMER_2026' }]);
  });

  it('treats a failing season lookup as absent rather than throwing', async () => {
    const { client } = fakeClient((_q, vars) => {
      if (vars.season === 'WINTER_2026') throw new Error('boom');
      return { animeBySeasons: [] };
    });

    await expect(
      getSeasonEntries(client, new Date('2026-08-03T00:00:00Z'))
    ).resolves.toEqual([]);
  });
});
