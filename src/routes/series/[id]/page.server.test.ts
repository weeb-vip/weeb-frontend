import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { getAnimeBySeriesId } from '$lib/services/api/graphql/queries';

/**
 * /series/<thetvdbid>-<slug> gathers everything MyAnimeList files separately.
 * The rules worth pinning:
 *
 *  - only the leading digits of the parameter are read, so the borrowed
 *    readable half can change without breaking the URL,
 *  - a series has no name of its own; the "anchor" entry that lends it one is
 *    chosen by a specific rule (earliest TV run, else earliest anything),
 *  - an id nothing claims is a 404, but a gateway outage is NOT.
 *
 * `createSSRGraphQLClient` is mocked at the module seam; `isNotFoundError`
 * stays real because the not-found/outage split is the rule under test.
 */

const request = vi.fn<(document: unknown, variables?: unknown) => Promise<unknown>>();
const createClient = vi.fn<(host: string, cookieHeader: string | null) => unknown>();

vi.mock('$lib/server/ssr-graphql', async (importOriginal) => {
  const actual = await importOriginal<typeof import('$lib/server/ssr-graphql')>();
  return {
    ...actual,
    cookieHeaderFrom: () => 'cookie-header',
    createSSRGraphQLClient: (host: string, cookieHeader: string | null) => {
      createClient(host, cookieHeader);
      return { request };
    }
  };
});

const { load } = await import('./+page.server');

/**
 * `PageServerLoad` is typed as possibly returning void, so every success path
 * goes through this: it calls the real loader and narrows the payload.
 */
const run = async (event: Parameters<typeof load>[0]): Promise<Record<string, any>> =>
  (await load(event)) as Record<string, any>;

function args(id: string) {
  return {
    params: { id },
    locals: { auth: {}, config: { graphql_host: 'https://api.test/graphql' } },
    cookies: {}
  } as never;
}

/** What the federation router throws when the subgraph has no such record. */
const NOT_FOUND = {
  response: { errors: [{ extensions: { errors: [{ message: 'record not found' }] } }] }
};

function entry(overrides: Record<string, unknown> = {}) {
  return {
    id: 'e1',
    type: 'TV',
    titleEn: 'Re:ZERO',
    titleJp: 'Re:ゼロから始める異世界生活',
    slug: 're-zero',
    imageUrl: 'https://cdn.test/rezero.jpg',
    startDate: '2016-04-04',
    ...overrides
  };
}

beforeEach(() => {
  request.mockReset();
  createClient.mockClear();
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('reading the series id out of the URL', () => {
  it('takes only the leading digits and ignores the readable half', async () => {
    request.mockResolvedValue({ animeBySeriesId: [entry()] });

    const result = await run(args('305089-re-zero-kara-hajimeru'));

    expect(result.seriesId).toBe('305089');
    expect(request).toHaveBeenCalledWith(getAnimeBySeriesId, { id: '305089' });
  });

  it('sends the id as a string, since that is what the document declares', async () => {
    request.mockResolvedValue({ animeBySeriesId: [entry()] });

    await run(args('305089'));

    const [, variables] = request.mock.calls[0] as [unknown, { id: unknown }];
    expect(variables.id).toBe('305089');
    expect(typeof variables.id).toBe('string');
  });

  it('never has to match the slug half, however wrong it has gone', async () => {
    request.mockResolvedValue({ animeBySeriesId: [entry()] });

    expect((await run(args('305089-a-title-that-changed-years-ago'))).seriesId).toBe('305089');
  });

  it('keeps a leading zero rather than normalising the id', async () => {
    request.mockResolvedValue({ animeBySeriesId: [entry()] });

    expect((await run(args('007-bond'))).seriesId).toBe('007');
  });

  it.each(['abc', '-305089', 're-zero', ''])(
    '404s for %o, which carries no leading digits',
    async (id) => {
      await expect(load(args(id))).rejects.toMatchObject({
        status: 404,
        body: { message: 'Not found' }
      });
      expect(request).not.toHaveBeenCalled();
    }
  );
});

describe('missing versus broken', () => {
  it('404s an id nothing claims -- there is no such thing as an empty series', async () => {
    request.mockResolvedValue({ animeBySeriesId: [] });

    await expect(load(args('999999'))).rejects.toMatchObject({ status: 404 });
  });

  it('404s a response with no field at all', async () => {
    request.mockResolvedValue(null);

    await expect(load(args('999999'))).rejects.toMatchObject({ status: 404 });
  });

  it('404s when the gateway reported the record as not found', async () => {
    // A not-found is turned into an empty list first, and the emptiness check
    // below is what produces the 404.
    request.mockRejectedValue(NOT_FOUND);

    await expect(load(args('999999'))).rejects.toMatchObject({ status: 404 });
  });

  it('does NOT 404 a gateway outage -- it renders with an ssrError', async () => {
    request.mockRejectedValue(new Error('connect ECONNREFUSED'));

    const result = await run(args('305089'));

    expect(result.ssrError).toBe('connect ECONNREFUSED');
    expect(result.ssrEntries).toEqual([]);
  });

  it('falls back to a generic ssrError when the thrown value has no message', async () => {
    request.mockRejectedValue({ code: 'ECONNRESET' });

    expect((await run(args('305089'))).ssrError).toBe('Failed to fetch series');
  });

  it('still returns a usable shell when the gateway failed', async () => {
    request.mockRejectedValue(new Error('boom'));

    const result = await run(args('305089'));

    expect(result.seriesTitle).toBe('Series');
    expect(result.seriesSlug).toBeNull();
    expect(result.seriesImage).toBe('/assets/og-image.jpg');
    expect(result.seriesId).toBe('305089');
  });

  it('leaves ssrError null on a successful render', async () => {
    request.mockResolvedValue({ animeBySeriesId: [entry()] });

    expect((await run(args('305089'))).ssrError).toBeNull();
  });

  it('sends the request to the configured host with the request cookies', async () => {
    request.mockResolvedValue({ animeBySeriesId: [entry()] });

    await run(args('305089'));

    expect(createClient).toHaveBeenCalledWith('https://api.test/graphql', 'cookie-header');
  });
});

describe('which entry lends the series its name', () => {
  it('is the earliest broadcast run, not the earliest thing of any kind', async () => {
    // A 2015 pilot special is older than the 2016 TV run, but nobody calls the
    // series by the special's name.
    request.mockResolvedValue({
      animeBySeriesId: [
        entry({ id: 'ova', type: 'OVA', titleEn: 'Re:ZERO -Memory Snow-', startDate: '2015-01-01' }),
        entry({ id: 'tv', type: 'TV', titleEn: 'Re:ZERO', startDate: '2016-04-04' })
      ]
    });

    expect((await run(args('305089'))).seriesTitle).toBe('Re:ZERO');
  });

  it('is the earliest TV run when there are several', async () => {
    request.mockResolvedValue({
      animeBySeriesId: [
        entry({ id: 's2', titleEn: 'Re:ZERO Season 2', startDate: '2020-07-08' }),
        entry({ id: 's1', titleEn: 'Re:ZERO', startDate: '2016-04-04' })
      ]
    });

    expect((await run(args('305089'))).seriesTitle).toBe('Re:ZERO');
  });

  it('matches the type case-insensitively', async () => {
    request.mockResolvedValue({
      animeBySeriesId: [
        entry({ id: 'movie', type: 'Movie', titleEn: 'The Movie', startDate: '2014-01-01' }),
        entry({ id: 'tv', type: 'tv', titleEn: 'The Show', startDate: '2016-04-04' })
      ]
    });

    expect((await run(args('305089'))).seriesTitle).toBe('The Show');
  });

  it('falls back to the earliest of anything for an OVA-only series', async () => {
    request.mockResolvedValue({
      animeBySeriesId: [
        entry({ id: 'b', type: 'ONA', titleEn: 'Later', startDate: '2019-01-01' }),
        entry({ id: 'a', type: 'OVA', titleEn: 'Earlier', startDate: '2017-01-01' })
      ]
    });

    expect((await run(args('305089'))).seriesTitle).toBe('Earlier');
  });

  it('sorts entries with no start date last, so a dateless special never anchors', async () => {
    request.mockResolvedValue({
      animeBySeriesId: [
        entry({ id: 'undated', type: 'OVA', titleEn: 'Undated', startDate: null }),
        entry({ id: 'dated', type: 'OVA', titleEn: 'Dated', startDate: '2019-01-01' })
      ]
    });

    expect((await run(args('305089'))).seriesTitle).toBe('Dated');
  });

  it('survives an entry with no type field', async () => {
    request.mockResolvedValue({
      animeBySeriesId: [entry({ type: undefined, titleEn: 'Untyped' })]
    });

    expect((await run(args('305089'))).seriesTitle).toBe('Untyped');
  });

  it('does not reorder the entries it hands the page', async () => {
    // The page does its own ordering; the loader's sort is on a copy.
    const later = entry({ id: 'later', startDate: '2020-01-01' });
    const earlier = entry({ id: 'earlier', startDate: '2016-01-01' });
    request.mockResolvedValue({ animeBySeriesId: [later, earlier] });

    const result = await run(args('305089'));

    expect(result.ssrEntries.map((e: { id: string }) => e.id)).toEqual(['later', 'earlier']);
  });
});

describe('the title, image and description the anchor supplies', () => {
  it('prefers the English title', async () => {
    request.mockResolvedValue({ animeBySeriesId: [entry()] });

    expect((await run(args('305089'))).seriesTitle).toBe('Re:ZERO');
  });

  it('falls back to the Japanese title', async () => {
    request.mockResolvedValue({ animeBySeriesId: [entry({ titleEn: null })] });

    expect((await run(args('305089'))).seriesTitle).toBe('Re:ゼロから始める異世界生活');
  });

  it('falls back to the word "Series" when the anchor is nameless', async () => {
    request.mockResolvedValue({
      animeBySeriesId: [entry({ titleEn: '', titleJp: '' })]
    });

    expect((await run(args('305089'))).seriesTitle).toBe('Series');
  });

  it('writes the description around whatever title it settled on', async () => {
    request.mockResolvedValue({ animeBySeriesId: [entry()] });

    expect((await run(args('305089'))).seriesDescription).toBe(
      'Every entry in Re:ZERO — seasons, specials and films, in order.'
    );
  });

  it('borrows the anchor image for the social card', async () => {
    request.mockResolvedValue({ animeBySeriesId: [entry()] });

    expect((await run(args('305089'))).seriesImage).toBe('https://cdn.test/rezero.jpg');
  });

  it('falls back to the site card when the anchor has no image', async () => {
    request.mockResolvedValue({ animeBySeriesId: [entry({ imageUrl: null })] });

    expect((await run(args('305089'))).seriesImage).toBe('/assets/og-image.jpg');
  });

  it('borrows the anchor slug, and nulls it rather than inventing one', async () => {
    request.mockResolvedValue({ animeBySeriesId: [entry({ slug: undefined })] });

    expect((await run(args('305089'))).seriesSlug).toBeNull();
  });
});

describe('the payload', () => {
  it('hands every entry through under ssrEntries', async () => {
    const entries = [entry({ id: 'a' }), entry({ id: 'b' })];
    request.mockResolvedValue({ animeBySeriesId: entries });

    const result = await run(args('305089'));

    expect(result.ssrEntries).toHaveLength(2);
    expect(Object.keys(result).sort()).toEqual([
      'seriesDescription',
      'seriesId',
      'seriesImage',
      'seriesSlug',
      'seriesTitle',
      'ssrEntries',
      'ssrError'
    ]);
  });
});
