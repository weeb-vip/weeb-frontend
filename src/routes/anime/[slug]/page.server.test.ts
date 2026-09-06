import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

/**
 * The /anime/[slug] server load. The rules worth pinning are the ones whose
 * breakage is invisible in a browser but expensive in the index:
 *
 *  - the slot takes an id OR a slug, and each must resolve through its own
 *    document — a freshly added anime has no slug yet and would otherwise have
 *    no reachable page at all;
 *  - the id form redirects 301 to the canonical slug and CARRIES THE QUERY
 *    STRING, because dropping it silently changes the page the reader asked for;
 *  - "no such anime" is a 404 but a gateway blip is NOT — answering 404 to an
 *    outage is how real pages fall out of Google;
 *  - characters are supporting detail and their failure must not take the page
 *    down.
 *
 * `$lib/server/ssr-graphql` is mocked at the module seam so nothing is fetched;
 * `request` is a spy whose calls ARE the assertion about what was asked for.
 * `isNotFoundError` is kept REAL, so the not-found fixtures below have to be the
 * shape the federation router actually produces.
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
const { getAnimeDetailsByID, getAnimeDetailsBySlug, queryCharactersAndStaffByAnimeID } =
  await import('$lib/services/api/graphql/queries');

/** A v4 uuid in the slot, i.e. the legacy id form of this URL. */
const ID = '11111111-2222-4333-8444-555555555555';

/** The loader's event, with only the bits this loader reads. */
function args(slug: string, search = '') {
  return {
    params: { slug },
    url: new URL(`https://weeb.vip/anime/${slug}${search}`),
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

/** What the gateway returns for a record that exists. */
function anime(overrides: Record<string, unknown> = {}) {
  return {
    id: 'anime-id-1',
    slug: 'frieren',
    titleEn: 'Frieren',
    titleJp: 'ソウソウノフリーレン',
    titleRomaji: 'Sousou no Frieren',
    description: 'An elf outlives her party.',
    episodeCount: 28,
    startDate: '2023-09-29',
    endDate: '2024-03-22',
    duration: 'PT24M',
    tags: ['Adventure'],
    studios: ['Madhouse'],
    malId: '52991',
    ...overrides
  };
}

/**
 * A missing record as the federation router actually reports it: a THROWN
 * DOWNSTREAM_SERVICE_ERROR wrapping anime-api's "record not found", not a null
 * field. `isNotFoundError` is the real one, so this shape is load-bearing.
 */
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
    request.mockResolvedValueOnce({ anime: anime({ slug: null }) }).mockResolvedValueOnce(null);

    await run(ID);

    expect(request.mock.calls[0][0]).toBe(getAnimeDetailsByID);
    expect(request.mock.calls[0][1]).toEqual({ id: ID });
  });

  it('resolves anything else by slug', async () => {
    request.mockResolvedValueOnce({ animeBySlug: anime() }).mockResolvedValueOnce(null);

    await run('frieren');

    expect(request.mock.calls[0][0]).toBe(getAnimeDetailsBySlug);
    expect(request.mock.calls[0][1]).toEqual({ slug: 'frieren' });
  });

  it('treats an uppercase uuid as an id too', async () => {
    request.mockResolvedValueOnce({ anime: anime({ slug: null }) }).mockResolvedValueOnce(null);

    await run(ID.toUpperCase());

    expect(request.mock.calls[0][0]).toBe(getAnimeDetailsByID);
  });

  it('treats a slug that merely looks uuid-ish as a slug', async () => {
    // One character short of a uuid: still a slug, and asking the id document
    // for it would 404 a page that resolves perfectly well by slug.
    request.mockResolvedValueOnce({ animeBySlug: anime() }).mockResolvedValueOnce(null);

    await run('11111111-2222-4333-8444-55555555555');

    expect(request.mock.calls[0][0]).toBe(getAnimeDetailsBySlug);
  });

  it('builds the client against the configured host and the request cookies', async () => {
    request.mockResolvedValueOnce({ animeBySlug: anime() }).mockResolvedValueOnce(null);

    await run('frieren');

    expect(createSSRGraphQLClient).toHaveBeenCalledWith(
      'https://api.test/graphql',
      'cookie-header'
    );
  });
});

describe('the id form redirects to the canonical slug', () => {
  it('is a permanent redirect once a slug exists', async () => {
    request.mockResolvedValueOnce({ anime: anime() }).mockResolvedValueOnce(null);

    await expect(run(ID)).rejects.toMatchObject({
      status: 301,
      location: '/anime/frieren'
    });
  });

  it('carries the query string over, so ?page=2 is not silently page 1', async () => {
    request.mockResolvedValueOnce({ anime: anime() }).mockResolvedValueOnce(null);

    await expect(run(ID, '?page=2')).rejects.toMatchObject({
      status: 301,
      location: '/anime/frieren?page=2'
    });
  });

  it('carries a multi-parameter query string over intact', async () => {
    request.mockResolvedValueOnce({ anime: anime() }).mockResolvedValueOnce(null);

    await expect(run(ID, '?page=2&tab=episodes')).rejects.toMatchObject({
      location: '/anime/frieren?page=2&tab=episodes'
    });
  });

  it('does NOT redirect while the record has no slug yet', async () => {
    // CDC has not carried the slug through to MySQL. Redirecting to
    // /anime/null — or erroring — is what would make a freshly added anime
    // unreachable from its own links.
    request.mockResolvedValueOnce({ anime: anime({ slug: null }) }).mockResolvedValueOnce(null);

    const result = await run(ID);

    expect(result.animeId).toBe('anime-id-1');
    expect(result.animeSlug).toBe(ID);
  });

  it('does not redirect for an empty-string slug either', async () => {
    request.mockResolvedValueOnce({ anime: anime({ slug: '' }) }).mockResolvedValueOnce(null);

    await expect(run(ID)).resolves.toMatchObject({ animeId: 'anime-id-1' });
  });

  it('does not redirect when the page was already reached by its slug', async () => {
    request.mockResolvedValueOnce({ animeBySlug: anime() }).mockResolvedValueOnce(null);

    await expect(run('frieren')).resolves.toMatchObject({ animeSlug: 'frieren' });
  });
});

describe('the redirect survives the catch that sits between it and the request', () => {
  // redirect() works by throwing, so issuing it inside the try would have the
  // catch below swallow it and render an error page instead. It is recorded and
  // issued AFTER the try; these two pin that ordering from the outside.

  it('still redirects when a later step in the try block threw', async () => {
    request.mockResolvedValueOnce({ anime: anime() }).mockImplementationOnce(() => {
      throw new Error('gateway blew up after the slug was already known');
    });

    await expect(run(ID, '?page=3')).rejects.toMatchObject({
      status: 301,
      location: '/anime/frieren?page=3'
    });
  });

  it('redirects rather than 404s when the failure was a not-found', async () => {
    // Both a redirect and a 404 are pending; the redirect is checked first.
    request.mockResolvedValueOnce({ anime: anime() }).mockImplementationOnce(() => {
      throw notFoundError();
    });

    await expect(run(ID)).rejects.toMatchObject({ status: 301 });
  });
});

describe('a genuine 404 versus a gateway blip', () => {
  it('404s when the query succeeded and there is no such slug', async () => {
    // A soft 404 here would put every stale slug in the 32,000-URL sitemap into
    // the index as an empty page competing with real ones.
    request.mockResolvedValueOnce({ animeBySlug: null });

    await expect(run('no-such-anime')).rejects.toMatchObject({ status: 404 });
  });

  it('404s when the query succeeded and there is no such id', async () => {
    request.mockResolvedValueOnce({ anime: null });

    await expect(run(ID)).rejects.toMatchObject({ status: 404 });
  });

  it('404s when the response had no data field at all', async () => {
    request.mockResolvedValueOnce(null);

    await expect(run('frieren')).rejects.toMatchObject({ status: 404 });
  });

  it('404s when the gateway THREW a record-not-found', async () => {
    // The router reports a missing record by throwing, so a plain `if (!anime)`
    // never sees this case.
    request.mockRejectedValueOnce(notFoundError());

    await expect(run('frieren')).rejects.toMatchObject({ status: 404 });
  });

  it('does NOT 404 a gateway failure — it renders with ssrError instead', async () => {
    request.mockRejectedValueOnce(new Error('ECONNREFUSED'));

    const result = await run('frieren');

    expect(result.ssrError).toBe('ECONNREFUSED');
    expect(result.ssrAnimeData).toBeNull();
  });

  it('does not 404 a timeout either', async () => {
    request.mockRejectedValueOnce(new Error('Request timeout'));

    await expect(run('frieren')).resolves.toMatchObject({ ssrError: 'Request timeout' });
  });

  it('names the failure even when the thrown value carried no message', async () => {
    request.mockRejectedValueOnce({});

    expect((await run('frieren')).ssrError).toBe('Failed to fetch anime data');
  });

  it('renders the placeholder meta on a gateway failure rather than half a page', async () => {
    request.mockRejectedValueOnce(new Error('ECONNREFUSED'));

    const result = await run('frieren');

    expect(result).toMatchObject({
      animeId: '',
      animeSlug: 'frieren',
      animeTitle: 'Anime Details',
      animeDescription: 'View anime details, episodes, and information',
      animeImage: '/assets/og-image.jpg',
      animeSchemaSource: null,
      ssrCharactersData: null
    });
  });
});

describe('characters are supporting detail', () => {
  it('is not asked for at all when no record resolved', async () => {
    request.mockResolvedValueOnce({ animeBySlug: null });

    await expect(run('nope')).rejects.toMatchObject({ status: 404 });
    expect(request).toHaveBeenCalledTimes(1);
  });

  it('is keyed by the record id, not by the slug in the URL', async () => {
    request
      .mockResolvedValueOnce({ animeBySlug: anime({ id: 'real-id' }) })
      .mockResolvedValueOnce({ charactersAndStaffByAnimeId: [] });

    await run('frieren');

    expect(request.mock.calls[1][0]).toBe(queryCharactersAndStaffByAnimeID);
    expect(request.mock.calls[1][1]).toEqual({ animeId: 'real-id' });
  });

  it('comes back on the payload when it resolved', async () => {
    const characters = { charactersAndStaffByAnimeId: [{ character: { id: 'c1' } }] };
    request.mockResolvedValueOnce({ animeBySlug: anime() }).mockResolvedValueOnce(characters);

    expect((await run('frieren')).ssrCharactersData).toEqual(characters);
  });

  it('does not take the page down when it fails', async () => {
    request
      .mockResolvedValueOnce({ animeBySlug: anime() })
      .mockRejectedValueOnce(new Error('characters service down'));

    const result = await run('frieren');

    expect(result.ssrCharactersData).toBeNull();
    expect(result.ssrError).toBeNull();
    expect(result.animeTitle).toBe('Frieren');
    expect(result.ssrAnimeData).toEqual({ anime: anime() });
  });

  it('does not 404 when the characters query reported a not-found', async () => {
    // The anime exists; only its cast is missing.
    request
      .mockResolvedValueOnce({ animeBySlug: anime() })
      .mockRejectedValueOnce(notFoundError());

    await expect(run('frieren')).resolves.toMatchObject({ ssrCharactersData: null });
  });
});

describe('the meta the crawler reads', () => {
  it('prefers the English title', async () => {
    request.mockResolvedValueOnce({ animeBySlug: anime() }).mockResolvedValueOnce(null);

    expect((await run('frieren')).animeTitle).toBe('Frieren');
  });

  it('falls back to the Japanese title', async () => {
    request
      .mockResolvedValueOnce({ animeBySlug: anime({ titleEn: null }) })
      .mockResolvedValueOnce(null);

    expect((await run('frieren')).animeTitle).toBe('ソウソウノフリーレン');
  });

  it('falls back to the placeholder when the record has no title at all', async () => {
    request
      .mockResolvedValueOnce({ animeBySlug: anime({ titleEn: '', titleJp: '' }) })
      .mockResolvedValueOnce(null);

    expect((await run('frieren')).animeTitle).toBe('Anime Details');
  });

  it('describes the anime from its synopsis', async () => {
    request
      .mockResolvedValueOnce({ animeBySlug: anime({ description: 'Line one.\n\nLine two.' }) })
      .mockResolvedValueOnce(null);

    // Collapsed to one line: raw newlines inside a meta tag were the old bug.
    expect((await run('frieren')).animeDescription).toBe('Line one. Line two.');
  });

  it('falls back to a sentence about the title when there is no synopsis', async () => {
    request
      .mockResolvedValueOnce({ animeBySlug: anime({ description: null }) })
      .mockResolvedValueOnce(null);

    expect((await run('frieren')).animeDescription).toBe(
      'Watch and track Frieren episodes, get notifications, and manage your anime watchlist on WeebVIP.'
    );
  });

  it('falls back when the synopsis was nothing but whitespace', async () => {
    request
      .mockResolvedValueOnce({ animeBySlug: anime({ description: '   \n  ' }) })
      .mockResolvedValueOnce(null);

    expect((await run('frieren')).animeDescription).toContain('Watch and track Frieren');
  });

  it('uses the title fallback inside the description fallback', async () => {
    request
      .mockResolvedValueOnce({
        animeBySlug: anime({ titleEn: null, titleJp: null, description: null })
      })
      .mockResolvedValueOnce(null);

    expect((await run('frieren')).animeDescription).toContain('Watch and track Anime Details');
  });
});

describe('the social card image', () => {
  it('is /og/<id> — our own endpoint, not the MyAnimeList address', async () => {
    request
      .mockResolvedValueOnce({ animeBySlug: anime({ imageUrl: 'https://cdn.myanimelist.net/x.jpg' }) })
      .mockResolvedValueOnce(null);

    expect((await run('frieren')).animeImage).toBe('/og/anime-id-1');
  });

  it('carries no query string, which robots.txt would hide from crawlers', async () => {
    request.mockResolvedValueOnce({ animeBySlug: anime() }).mockResolvedValueOnce(null);

    expect((await run('frieren')).animeImage).not.toContain('?');
  });

  it('encodes an id that would otherwise break the path', async () => {
    request
      .mockResolvedValueOnce({ animeBySlug: anime({ id: 'a b/c?d' }) })
      .mockResolvedValueOnce(null);

    expect((await run('frieren')).animeImage).toBe('/og/a%20b%2Fc%3Fd');
  });
});

describe('the JSON-LD source', () => {
  it('is the explicit subset the schema builder needs, and nothing else', async () => {
    // Passed explicitly rather than reaching into ssrAnimeData, so a change to
    // the query's shape cannot silently empty the structured data.
    request
      .mockResolvedValueOnce({ animeBySlug: { ...anime(), episodes: [{ id: 'e1' }] } })
      .mockResolvedValueOnce(null);

    const result = await run('frieren');

    expect(Object.keys(result.animeSchemaSource ?? {}).sort()).toEqual([
      'description',
      'duration',
      'endDate',
      'episodeCount',
      'malId',
      'startDate',
      'studios',
      'tags',
      'titleEn',
      'titleJp',
      'titleRomaji'
    ]);
    expect(result.animeSchemaSource).not.toHaveProperty('episodes');
  });

  it('copies the values through unchanged', async () => {
    request.mockResolvedValueOnce({ animeBySlug: anime() }).mockResolvedValueOnce(null);

    expect((await run('frieren')).animeSchemaSource).toMatchObject({
      titleEn: 'Frieren',
      titleRomaji: 'Sousou no Frieren',
      episodeCount: 28,
      studios: ['Madhouse'],
      malId: '52991'
    });
  });

  it('is null when no record resolved', async () => {
    request.mockRejectedValueOnce(new Error('down'));

    expect((await run('frieren')).animeSchemaSource).toBeNull();
  });
});

describe('an empty slot', () => {
  it('sends an empty slug home rather than querying for it', async () => {
    await expect(load(args('') as never)).rejects.toMatchObject({ status: 302, location: '/' });
    expect(request).not.toHaveBeenCalled();
  });
});
