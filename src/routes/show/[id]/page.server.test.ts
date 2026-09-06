import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

/**
 * /show/<id> is the old anime URL, and roughly 32,000 of them are in Google's
 * index. This loader exists only to send each one on to /anime/<slug>, so what
 * matters is:
 *
 *  - the redirect is 301, not 302 — a temporary redirect asks Google to KEEP the
 *    old URL indexed, which is the opposite of the point;
 *  - the query string survives it;
 *  - it falls back to the id when the slug has not landed yet, rather than
 *    erroring and making a brand-new anime unreachable from its own links;
 *  - a missing record is 404 but a gateway failure is 503 — answering 404 to an
 *    outage tells Google a real page is gone;
 *  - it fetches ONLY the slug, because this runs for every legacy URL a crawler
 *    still holds.
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
    url: new URL(`https://weeb.vip/show/${id}${search}`),
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
  it('asks the slug-only document, by id', async () => {
    request.mockResolvedValueOnce({ anime: { id: ID, slug: 'frieren' } });

    await expect(run(ID)).rejects.toMatchObject({ status: 301 });

    expect(request).toHaveBeenCalledTimes(1);
    expect(request.mock.calls[0][0]).toBe(getAnimeSlugByID);
    expect(request.mock.calls[0][1]).toEqual({ id: ID });
  });

  it('builds the client against the configured host and the request cookies', async () => {
    request.mockResolvedValueOnce({ anime: { id: ID, slug: 'frieren' } });

    await expect(run(ID)).rejects.toMatchObject({ status: 301 });

    expect(createSSRGraphQLClient).toHaveBeenCalledWith(
      'https://api.test/graphql',
      'cookie-header'
    );
  });

  it('passes a non-uuid id through unchanged rather than rejecting it', async () => {
    request.mockResolvedValueOnce({ anime: { id: 'legacy-42', slug: 'frieren' } });

    await expect(run('legacy-42')).rejects.toMatchObject({ status: 301 });
    expect(request.mock.calls[0][1]).toEqual({ id: 'legacy-42' });
  });
});

describe('the redirect', () => {
  it('is permanent, so the old URL transfers its ranking rather than staying indexed', async () => {
    request.mockResolvedValueOnce({ anime: { id: ID, slug: 'frieren' } });

    await expect(run(ID)).rejects.toMatchObject({
      status: 301,
      location: '/anime/frieren'
    });
  });

  it('carries the query string over', async () => {
    request.mockResolvedValueOnce({ anime: { id: ID, slug: 'frieren' } });

    await expect(run(ID, '?page=2&tab=episodes')).rejects.toMatchObject({
      location: '/anime/frieren?page=2&tab=episodes'
    });
  });

  it('falls back to the id when the slug has not landed yet', async () => {
    // /anime/<id> resolves too and redirects on once MySQL has the slug.
    // Erroring here would make a brand-new anime unreachable from its own links.
    request.mockResolvedValueOnce({ anime: { id: ID, slug: null } });

    await expect(run(ID)).rejects.toMatchObject({
      status: 301,
      location: `/anime/${ID}`
    });
  });

  it('falls back to the id for an EMPTY-STRING slug as well as a null one', async () => {
    // A slug column holding '' rather than NULL is the same "no slug yet"
    // state. Under `??` it sent every legacy URL for that anime to /anime/ —
    // the browse page, not the show. /anime/[slug] guards the case with a
    // truthiness check (`if (found?.slug)`), and this route now agrees.
    request.mockResolvedValueOnce({ anime: { id: ID, slug: '' } });

    await expect(run(ID)).rejects.toMatchObject({
      status: 301,
      location: `/anime/${ID}`
    });
  });

  it('keeps the query string on the empty-slug fallback too', async () => {
    request.mockResolvedValueOnce({ anime: { id: ID, slug: '' } });

    await expect(run(ID, '?page=2')).rejects.toMatchObject({
      location: `/anime/${ID}?page=2`
    });
  });

  it('encodes an id that would otherwise break the path', async () => {
    request.mockResolvedValueOnce({ anime: { id: 'a b/c', slug: null } });

    await expect(run('a b/c')).rejects.toMatchObject({ location: '/anime/a%20b%2Fc' });
  });

  it('keeps the query string on the id fallback too', async () => {
    request.mockResolvedValueOnce({ anime: { id: ID, slug: null } });

    await expect(run(ID, '?page=3')).rejects.toMatchObject({
      location: `/anime/${ID}?page=3`
    });
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
    // A 404 here would tell Google a real page is gone.
    request.mockRejectedValueOnce(new Error('ECONNREFUSED'));

    await expect(run(ID)).rejects.toMatchObject({ status: 503 });
  });

  it('answers 503 for a timeout too', async () => {
    request.mockRejectedValueOnce(new Error('Request timeout'));

    await expect(run(ID)).rejects.toMatchObject({ status: 503 });
  });

  it('answers 503 for a thrown value with no message', async () => {
    request.mockRejectedValueOnce({});

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
