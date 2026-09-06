import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

/**
 * The /anime/[slug]/news server load. It accepts an id as well as a slug for
 * the same reason the detail route does — an anime without a slug yet must
 * still be reachable from its own links — and it issues its redirect and its
 * 404 from INSIDE the try, so the catch has to re-throw anything already
 * carrying a status rather than reporting it as a load failure.
 *
 * `$lib/server/ssr-graphql` is mocked at the module seam so nothing is fetched.
 * `isNotFoundError` is kept real, so the not-found fixture has to be the shape
 * the federation router actually produces.
 */

type RequestFn = (document: unknown, variables?: Record<string, unknown>) => Promise<unknown>;

const request = vi.fn<RequestFn>();
const createSSRGraphQLClient = vi.fn<(host: string, cookieHeader: string | null) => unknown>(
  () => ({ request })
);

vi.mock('$lib/server/ssr-graphql', async (importOriginal) => {
  const actual = await importOriginal<typeof import('$lib/server/ssr-graphql')>();
  return {
    ...actual,
    createSSRGraphQLClient: (host: string, cookieHeader: string | null) =>
      createSSRGraphQLClient(host, cookieHeader),
    cookieHeaderFrom: () => 'cookie-header'
  };
});

const { load } = await import('./+page.server');
const { getAnimeNewsByID, getAnimeNewsBySlug } = await import(
  '$lib/services/api/graphql/queries'
);

const ID = '11111111-2222-4333-8444-555555555555';

function args(slug: string, search = '') {
  return {
    params: { slug },
    url: new URL(`https://weeb.vip/anime/${slug}/news${search}`),
    locals: { config: { graphql_host: 'https://api.test/graphql' } },
    cookies: {}
  };
}

/**
 * The payload a successful load returns. `PageServerLoad` also admits `void`,
 * for the paths that redirect instead of returning; those are asserted with
 * `.rejects` here, so the successful shape is what the reads below want.
 */
type Loaded = Exclude<Awaited<ReturnType<typeof load>>, void>;

/** `load` is a PageServerLoad; the event above is only the slice it reads. */
function run(slug: string, search = ''): Promise<Loaded> {
  return load(args(slug, search) as never) as Promise<Loaded>;
}

function anime(overrides: Record<string, unknown> = {}) {
  return {
    id: 'anime-id-1',
    slug: 'frieren',
    titleEn: 'Frieren',
    titleJp: 'ソウソウノフリーレン',
    imageUrl: 'https://cdn.myanimelist.net/images/anime/x.jpg',
    news: [{ id: 'n1', title: 'Season 2 announced' }],
    ...overrides
  };
}

/** A missing record as the router reports it: thrown, not a null field. */
function notFoundError() {
  return {
    message: "Failed to fetch from Subgraph 'anime-api'.",
    response: {
      errors: [
        {
          message: "Failed to fetch from Subgraph 'anime-api'.",
          extensions: { errors: [{ message: 'record not found' }] }
        }
      ]
    }
  };
}

beforeEach(() => {
  request.mockReset();
  createSSRGraphQLClient.mockClear();
  createSSRGraphQLClient.mockReturnValue({ request });
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('which document resolves the slot', () => {
  it('resolves a uuid by id', async () => {
    request.mockResolvedValueOnce({ anime: anime({ slug: null }) });

    await run(ID);

    expect(request.mock.calls[0][0]).toBe(getAnimeNewsByID);
    expect(request.mock.calls[0][1]).toEqual({ id: ID });
  });

  it('resolves anything else by slug', async () => {
    request.mockResolvedValueOnce({ animeBySlug: anime() });

    await run('frieren');

    expect(request.mock.calls[0][0]).toBe(getAnimeNewsBySlug);
    expect(request.mock.calls[0][1]).toEqual({ slug: 'frieren' });
  });

  it('asks once and only once', async () => {
    request.mockResolvedValueOnce({ animeBySlug: anime() });

    await run('frieren');

    expect(request).toHaveBeenCalledTimes(1);
  });

  it('builds the client against the configured host and the request cookies', async () => {
    request.mockResolvedValueOnce({ animeBySlug: anime() });

    await run('frieren');

    expect(createSSRGraphQLClient).toHaveBeenCalledWith(
      'https://api.test/graphql',
      'cookie-header'
    );
  });
});

describe('the id form redirects to the canonical slug', () => {
  it('is a permanent redirect to the news URL under the slug', async () => {
    request.mockResolvedValueOnce({ anime: anime() });

    await expect(run(ID)).rejects.toMatchObject({
      status: 301,
      location: '/anime/frieren/news'
    });
  });

  it('carries the query string over', async () => {
    request.mockResolvedValueOnce({ anime: anime() });

    await expect(run(ID, '?page=2')).rejects.toMatchObject({
      status: 301,
      location: '/anime/frieren/news?page=2'
    });
  });

  it('survives the catch, which re-throws anything carrying a status', async () => {
    // redirect() throws; the catch below would otherwise report it as a load
    // failure and render the news page with an ssrError instead of moving.
    request.mockResolvedValueOnce({ anime: anime() });

    await expect(run(ID)).rejects.not.toHaveProperty('ssrError');
  });

  it('does NOT redirect while the record has no slug yet', async () => {
    request.mockResolvedValueOnce({ anime: anime({ slug: null }) });

    const result = await run(ID);

    expect(result.animeId).toBe('anime-id-1');
    expect(result.animeSlug).toBe(ID);
    expect(result.ssrError).toBeNull();
  });
});

describe('a genuine 404 versus a gateway blip', () => {
  it('404s when the query succeeded and there is no such slug', async () => {
    request.mockResolvedValueOnce({ animeBySlug: null });

    await expect(run('no-such-anime')).rejects.toMatchObject({ status: 404 });
  });

  it('404s when the query succeeded and there is no such id', async () => {
    request.mockResolvedValueOnce({ anime: null });

    await expect(run(ID)).rejects.toMatchObject({ status: 404 });
  });

  it('404s when the gateway THREW a record-not-found', async () => {
    // The `!anime` check above never fires for a bogus id: the router reports a
    // missing record by throwing. Without this branch the page answered 200 —
    // a soft 404.
    request.mockRejectedValueOnce(notFoundError());

    await expect(run('nope')).rejects.toMatchObject({ status: 404 });
  });

  it('does NOT 404 a gateway failure — it renders with ssrError instead', async () => {
    request.mockRejectedValueOnce(new Error('ECONNREFUSED'));

    const result = await run('frieren');

    expect(result.ssrError).toBe('ECONNREFUSED');
    expect(result.anime).toBeNull();
  });

  it('renders the placeholder payload on a gateway failure', async () => {
    request.mockRejectedValueOnce(new Error('ECONNREFUSED'));

    expect(await run('frieren')).toEqual({
      animeId: '',
      animeSlug: 'frieren',
      animeTitle: 'Anime',
      animeTitleJp: null,
      anime: null,
      animeImage: '/assets/og-image.jpg',
      news: [],
      ssrError: 'ECONNREFUSED'
    });
  });

  it('names the failure even when the thrown value carried no message', async () => {
    request.mockRejectedValueOnce({});

    expect((await run('frieren')).ssrError).toBe('Failed to load news');
  });

  it('treats any thrown value carrying a numeric status as an HttpError', async () => {
    // Current behaviour, pinned deliberately: the `if (e?.status) throw e` that
    // lets the 301 and the 404 out also lets any gateway error that happens to
    // carry a `status` field escape as a page error rather than an ssrError.
    request.mockRejectedValueOnce({ status: 500, message: 'upstream exploded' });

    await expect(run('frieren')).rejects.toMatchObject({ status: 500 });
  });
});

describe('the payload the news page renders from', () => {
  it('carries the anime, its id and the slug the reader used', async () => {
    request.mockResolvedValueOnce({ animeBySlug: anime() });

    const result = await run('frieren');

    expect(result.animeId).toBe('anime-id-1');
    expect(result.animeSlug).toBe('frieren');
    expect(result.anime).toEqual(anime());
  });

  it('passes the whole anime through, not just an image URL', async () => {
    // The page builds poster/banner URLs via GetImageFromAnime, which wants a
    // CDN slug. Handing it anime.imageUrl — a MyAnimeList address — was the bug.
    request.mockResolvedValueOnce({ animeBySlug: anime() });

    expect((await run('frieren')).anime).toHaveProperty('imageUrl');
  });

  it('prefers the English title', async () => {
    request.mockResolvedValueOnce({ animeBySlug: anime() });

    expect((await run('frieren')).animeTitle).toBe('Frieren');
  });

  it('falls back to the Japanese title', async () => {
    request.mockResolvedValueOnce({ animeBySlug: anime({ titleEn: null }) });

    expect((await run('frieren')).animeTitle).toBe('ソウソウノフリーレン');
  });

  it('falls back to the placeholder when there is no title at all', async () => {
    request.mockResolvedValueOnce({ animeBySlug: anime({ titleEn: null, titleJp: null }) });

    expect((await run('frieren')).animeTitle).toBe('Anime');
  });

  it('shows the Japanese title under the main one when it differs', async () => {
    request.mockResolvedValueOnce({ animeBySlug: anime() });

    expect((await run('frieren')).animeTitleJp).toBe('ソウソウノフリーレン');
  });

  it('does not repeat the Japanese title when it IS the main title', async () => {
    request.mockResolvedValueOnce({ animeBySlug: anime({ titleEn: null }) });

    expect((await run('frieren')).animeTitleJp).toBeNull();
  });

  it('has no Japanese subtitle when the record carries none', async () => {
    request.mockResolvedValueOnce({ animeBySlug: anime({ titleJp: null }) });

    expect((await run('frieren')).animeTitleJp).toBeNull();
  });

  it('is /og/<id> for the social card, with no query string', async () => {
    request.mockResolvedValueOnce({ animeBySlug: anime() });

    const result = await run('frieren');

    expect(result.animeImage).toBe('/og/anime-id-1');
    expect(result.animeImage).not.toContain('?');
  });

  it('encodes an id that would otherwise break the image path', async () => {
    request.mockResolvedValueOnce({ animeBySlug: anime({ id: 'a b/c' }) });

    expect((await run('frieren')).animeImage).toBe('/og/a%20b%2Fc');
  });

  it('hands the news items through in order', async () => {
    request.mockResolvedValueOnce({
      animeBySlug: anime({ news: [{ id: 'n1' }, { id: 'n2' }] })
    });

    expect((await run('frieren')).news).toEqual([{ id: 'n1' }, { id: 'n2' }]);
  });

  it('renders an anime with no news as an empty list, not a null', async () => {
    request.mockResolvedValueOnce({ animeBySlug: anime({ news: null }) });

    const result = await run('frieren');

    expect(result.news).toEqual([]);
    expect(result.ssrError).toBeNull();
  });

  it('keeps a genuinely empty news list empty', async () => {
    request.mockResolvedValueOnce({ animeBySlug: anime({ news: [] }) });

    expect((await run('frieren')).news).toEqual([]);
  });
});

describe('an empty slot', () => {
  it('sends an empty slug home rather than querying for it', async () => {
    await expect(load(args('') as never)).rejects.toMatchObject({ status: 302, location: '/' });
    expect(request).not.toHaveBeenCalled();
  });
});
