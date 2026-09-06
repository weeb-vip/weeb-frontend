import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

/**
 * /show/<id>/news is the legacy news URL. Like its parent it does nothing but
 * resolve one string and redirect permanently — the difference being that the
 * `/news` suffix has to survive the move, or every indexed news URL would land
 * on the show page instead of the article list it promised.
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
const { getAnimeSlugByID } = await import('$lib/services/api/graphql/queries');

const ID = '11111111-2222-4333-8444-555555555555';

function args(id: string, search = '') {
  return {
    params: { id },
    url: new URL(`https://weeb.vip/show/${id}/news${search}`),
    locals: { config: { graphql_host: 'https://api.test/graphql' } },
    cookies: {}
  };
}

/** `load` is a PageServerLoad; the event above is only the slice it reads. */
function run(id: string, search = '') {
  return load(args(id, search) as never);
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

describe('what it asks the gateway for', () => {
  it('asks the slug-only document, by id, once', async () => {
    request.mockResolvedValueOnce({ anime: { id: ID, slug: 'frieren' } });

    await expect(run(ID)).rejects.toMatchObject({ status: 301 });

    expect(request).toHaveBeenCalledTimes(1);
    expect(request.mock.calls[0][0]).toBe(getAnimeSlugByID);
    expect(request.mock.calls[0][1]).toEqual({ id: ID });
  });

  it('does not fetch the news itself — the destination does that', async () => {
    request.mockResolvedValueOnce({ anime: { id: ID, slug: 'frieren' } });

    await expect(run(ID)).rejects.toMatchObject({ status: 301 });

    expect(request.mock.calls).toHaveLength(1);
  });

  it('builds the client against the configured host and the request cookies', async () => {
    request.mockResolvedValueOnce({ anime: { id: ID, slug: 'frieren' } });

    await expect(run(ID)).rejects.toMatchObject({ status: 301 });

    expect(createSSRGraphQLClient).toHaveBeenCalledWith(
      'https://api.test/graphql',
      'cookie-header'
    );
  });
});

describe('the redirect', () => {
  it('is permanent and keeps the /news suffix', async () => {
    request.mockResolvedValueOnce({ anime: { id: ID, slug: 'frieren' } });

    await expect(run(ID)).rejects.toMatchObject({
      status: 301,
      location: '/anime/frieren/news'
    });
  });

  it('carries the query string over, after the suffix', async () => {
    request.mockResolvedValueOnce({ anime: { id: ID, slug: 'frieren' } });

    await expect(run(ID, '?page=2')).rejects.toMatchObject({
      location: '/anime/frieren/news?page=2'
    });
  });

  it('falls back to the id when the slug has not landed yet', async () => {
    request.mockResolvedValueOnce({ anime: { id: ID, slug: null } });

    await expect(run(ID)).rejects.toMatchObject({
      status: 301,
      location: `/anime/${ID}/news`
    });
  });

  it('encodes an id that would otherwise break the path', async () => {
    request.mockResolvedValueOnce({ anime: { id: 'a b/c', slug: null } });

    await expect(run('a b/c')).rejects.toMatchObject({ location: '/anime/a%20b%2Fc/news' });
  });

  it('BUG: does not fall back for an EMPTY-STRING slug — it redirects to /anime//news', async () => {
    // Same `??`-instead-of-truthiness fallback as the parent route: a row whose
    // slug column is '' rather than NULL redirects to /anime//news, which is
    // not a route. Pinned as current behaviour, not fixed.
    request.mockResolvedValueOnce({ anime: { id: ID, slug: '' } });

    await expect(run(ID)).rejects.toMatchObject({ status: 301, location: '/anime//news' });
  });
});

describe('a missing record versus a gateway failure', () => {
  it('404s when the query succeeded and there is no such anime', async () => {
    request.mockResolvedValueOnce({ anime: null });

    await expect(run(ID)).rejects.toMatchObject({ status: 404 });
  });

  it('404s when the response carried no data at all', async () => {
    request.mockResolvedValueOnce(null);

    await expect(run(ID)).rejects.toMatchObject({ status: 404 });
  });

  it('404s when the gateway THREW a record-not-found', async () => {
    request.mockRejectedValueOnce(notFoundError());

    await expect(run(ID)).rejects.toMatchObject({ status: 404 });
  });

  it('answers 503 for a gateway failure, never 404', async () => {
    request.mockRejectedValueOnce(new Error('ECONNREFUSED'));

    await expect(run(ID)).rejects.toMatchObject({ status: 503 });
  });

  it('never redirects when the record could not be resolved', async () => {
    request.mockResolvedValueOnce({ anime: null });

    await expect(run(ID)).rejects.not.toHaveProperty('location');
  });
});

describe('an empty slot', () => {
  it('sends an empty id home rather than querying for it', async () => {
    await expect(load(args('') as never)).rejects.toMatchObject({ status: 302, location: '/' });
    expect(request).not.toHaveBeenCalled();
  });
});
