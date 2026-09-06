import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { queryStaffByID, queryStaffBySlug } from '$lib/services/api/graphql/queries';

/**
 * /people/<slug> serves one voice actor, and is reachable by either the slug or
 * the raw id. The rules a reader cannot see going wrong:
 *
 *  - which document is asked for depends on the shape of the parameter,
 *  - a person that exists under an id AND a slug is served at exactly one
 *    address, and the query string survives the move,
 *  - "the gateway said no such person" is a 404 but "the gateway did not
 *    answer" is NOT -- answering 404 for an outage deindexes real pages,
 *  - the meta description is written from the role counts, so every one of
 *    these pages says something even though the scraped summary is empty.
 *
 * `createSSRGraphQLClient` is mocked at the module seam and `request` is a spy;
 * `isNotFoundError` is left real, because classifying the error IS the rule.
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

const UUID = '0f1e2d3c-4b5a-6978-8796-a5b4c3d2e1f0';

function args(slug: string, search = '') {
  return {
    params: { slug },
    url: new URL(`https://weeb.vip/people/${slug}${search}`),
    locals: { auth: {}, config: { graphql_host: 'https://api.test/graphql' } },
    cookies: {}
  } as never;
}

/** What the federation router throws when the subgraph has no such record. */
const NOT_FOUND = {
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

function staff(overrides: Record<string, unknown> = {}) {
  return { id: UUID, givenName: 'Aoi', familyName: 'Yuuki', slug: 'aoi-yuuki', roles: [], ...overrides };
}

beforeEach(() => {
  request.mockReset();
  createClient.mockClear();
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('which document the parameter selects', () => {
  it('asks for the slug document for an ordinary slug', async () => {
    request.mockResolvedValue({ staffBySlug: staff() });

    await run(args('aoi-yuuki'));

    expect(request).toHaveBeenCalledTimes(1);
    expect(request).toHaveBeenCalledWith(queryStaffBySlug, { slug: 'aoi-yuuki' });
  });

  it('asks for the id document when the parameter is a UUID', async () => {
    request.mockResolvedValue({ staff: staff({ slug: null }) });

    await run(args(UUID));

    expect(request).toHaveBeenCalledWith(queryStaffByID, { id: UUID });
  });

  it('recognises an uppercase UUID as an id', async () => {
    request.mockResolvedValue({ staff: staff({ slug: null }) });

    await run(args(UUID.toUpperCase()));

    expect(request).toHaveBeenCalledWith(queryStaffByID, { id: UUID.toUpperCase() });
  });

  it('treats a slug that merely contains hyphens as a slug', async () => {
    request.mockResolvedValue({ staffBySlug: staff() });

    await run(args('0f1e2d3c-4b5a'));

    expect(request).toHaveBeenCalledWith(queryStaffBySlug, { slug: '0f1e2d3c-4b5a' });
  });

  it('reads the answer off the field that document returns, not a shared one', async () => {
    // The two documents put the person under different names; reading the wrong
    // one would 404 every id-addressed page.
    request.mockResolvedValue({ staff: staff({ slug: null }), staffBySlug: null });

    expect((await run(args(UUID))).staff).not.toBeNull();
  });

  it('sends the request to the configured host with the request cookies', async () => {
    request.mockResolvedValue({ staffBySlug: staff() });

    await run(args('aoi-yuuki'));

    expect(createClient).toHaveBeenCalledWith('https://api.test/graphql', 'cookie-header');
  });
});

describe('an empty parameter', () => {
  it('sends the reader home rather than querying for nothing', async () => {
    await expect(load(args(''))).rejects.toMatchObject({ status: 302, location: '/' });
    expect(request).not.toHaveBeenCalled();
  });
});

describe('one person, one address', () => {
  it('redirects an id URL permanently to the slug the person now has', async () => {
    request.mockResolvedValue({ staff: staff({ slug: 'aoi-yuuki' }) });

    await expect(load(args(UUID))).rejects.toMatchObject({
      status: 301,
      location: '/people/aoi-yuuki'
    });
  });

  it('carries the query string across the redirect', async () => {
    // Dropping it silently changes the page the reader asked for.
    request.mockResolvedValue({ staff: staff({ slug: 'aoi-yuuki' }) });

    await expect(load(args(UUID, '?tab=roles&page=3'))).rejects.toMatchObject({
      location: '/people/aoi-yuuki?tab=roles&page=3'
    });
  });

  it('serves the id URL directly when the person has no slug at all', async () => {
    // A name that reduces to nothing a URL can carry has no slug; the id is
    // then the only address, and must render rather than bounce.
    request.mockResolvedValue({ staff: staff({ slug: null }) });

    const result = await run(args(UUID));

    expect(result.staffPath).toBe(UUID);
  });

  it('does not redirect for an empty-string slug on the record', async () => {
    request.mockResolvedValue({ staff: staff({ slug: '' }) });

    expect((await run(args(UUID))).staffPath).toBe(UUID);
  });

  it('never redirects the slug URL back onto itself', async () => {
    request.mockResolvedValue({ staffBySlug: staff() });

    const result = await run(args('aoi-yuuki'));

    expect(result.staffPath).toBe('aoi-yuuki');
  });

  it('prefers the record slug over the requested one for the canonical path', async () => {
    // A stale inbound link like /people/aoi-yuki-old still renders, but the
    // canonical tag and breadcrumb point at the current slug.
    request.mockResolvedValue({ staffBySlug: staff({ slug: 'aoi-yuuki' }) });

    expect((await run(args('aoi-yuki-old'))).staffPath).toBe('aoi-yuuki');
  });
});

describe('missing versus broken', () => {
  it('404s when the query succeeded but there is no such person', async () => {
    request.mockResolvedValue({ staffBySlug: null });

    await expect(load(args('nobody'))).rejects.toMatchObject({
      status: 404,
      body: { message: 'Voice actor not found' }
    });
  });

  it('404s when the response carried no data at all', async () => {
    request.mockResolvedValue(null);

    await expect(load(args('nobody'))).rejects.toMatchObject({ status: 404 });
  });

  it('404s when the gateway reported the record as not found', async () => {
    request.mockRejectedValue(NOT_FOUND);

    await expect(load(args('nobody'))).rejects.toMatchObject({
      status: 404,
      body: { message: 'Voice actor not found' }
    });
  });

  it('does NOT 404 a gateway outage -- it renders with an ssrError', async () => {
    // The whole point of the isNotFoundError split: a transient failure must
    // stay recoverable on the client instead of telling crawlers the page is
    // gone.
    request.mockRejectedValue(new Error('connect ECONNREFUSED'));

    const result = await run(args('aoi-yuuki'));

    expect(result.ssrError).toBe('connect ECONNREFUSED');
    expect(result.staff).toBeNull();
  });

  it('does not 404 a timeout either', async () => {
    request.mockRejectedValue(new Error('Request timeout'));

    expect((await run(args('aoi-yuuki'))).ssrError).toBe('Request timeout');
  });

  it('falls back to a generic ssrError when the thrown value has no message', async () => {
    request.mockRejectedValue({ code: 'ECONNRESET' });

    expect((await run(args('aoi-yuuki'))).ssrError).toBe('Failed to fetch voice actor');
  });

  it('leaves ssrError null on a successful render', async () => {
    request.mockResolvedValue({ staffBySlug: staff() });

    expect((await run(args('aoi-yuuki'))).ssrError).toBeNull();
  });

  it('still names the page something on a failed render', async () => {
    request.mockRejectedValue(new Error('boom'));

    const result = await run(args('aoi-yuuki'));

    expect(result.staffName).toBe('Voice actor');
    expect(result.staffPath).toBe('aoi-yuuki');
    expect(result.staffDescription).toBe('Roles and credits for Voice actor on WeebVIP.');
  });
});

describe('the name and description the page is indexed under', () => {
  it('joins the two name parts', async () => {
    request.mockResolvedValue({ staffBySlug: staff() });

    expect((await run(args('aoi-yuuki'))).staffName).toBe('Aoi Yuuki');
  });

  it('trims the dangling space when there is no family name', async () => {
    request.mockResolvedValue({ staffBySlug: staff({ familyName: '' }) });

    expect((await run(args('aoi-yuuki'))).staffName).toBe('Aoi');
  });

  it('describes the person by their role and anime counts', async () => {
    request.mockResolvedValue({
      staffBySlug: staff({
        roles: [
          { anime: { id: 'a1' } },
          { anime: { id: 'a2' } },
          { anime: { id: 'a3' } }
        ]
      })
    });

    expect((await run(args('aoi-yuuki'))).staffDescription).toBe(
      'Aoi Yuuki has voiced 3 characters across 3 anime. See the full list of roles on WeebVIP.'
    );
  });

  it('says "character", singular, for exactly one role', async () => {
    request.mockResolvedValue({ staffBySlug: staff({ roles: [{ anime: { id: 'a1' } }] }) });

    expect((await run(args('aoi-yuuki'))).staffDescription).toBe(
      'Aoi Yuuki has voiced 1 character across 1 anime. See the full list of roles on WeebVIP.'
    );
  });

  it('counts distinct anime, not roles, for the second number', async () => {
    // Two characters in the same show is one anime.
    request.mockResolvedValue({
      staffBySlug: staff({ roles: [{ anime: { id: 'a1' } }, { anime: { id: 'a1' } }] })
    });

    expect((await run(args('aoi-yuuki'))).staffDescription).toContain(
      'voiced 2 characters across 1 anime'
    );
  });

  it('ignores roles whose anime is missing when counting anime, but not when counting roles', async () => {
    request.mockResolvedValue({
      staffBySlug: staff({ roles: [{ anime: { id: 'a1' } }, { anime: null }, {}] })
    });

    expect((await run(args('aoi-yuuki'))).staffDescription).toContain(
      'voiced 3 characters across 1 anime'
    );
  });

  it('falls back to the credits sentence when the person has no roles', async () => {
    request.mockResolvedValue({ staffBySlug: staff({ roles: [] }) });

    expect((await run(args('aoi-yuuki'))).staffDescription).toBe(
      'Roles and credits for Aoi Yuuki on WeebVIP.'
    );
  });

  it('falls back when roles is absent rather than empty', async () => {
    request.mockResolvedValue({ staffBySlug: staff({ roles: null }) });

    expect((await run(args('aoi-yuuki'))).staffDescription).toBe(
      'Roles and credits for Aoi Yuuki on WeebVIP.'
    );
  });
});

describe('the payload', () => {
  it('hands the record through untouched alongside the derived meta', async () => {
    const record = staff({ roles: [{ anime: { id: 'a1' } }] });
    request.mockResolvedValue({ staffBySlug: record });

    const result = await run(args('aoi-yuuki'));

    expect(result.staff).toBe(record);
    expect(Object.keys(result).sort()).toEqual([
      'ssrError',
      'staff',
      'staffDescription',
      'staffName',
      'staffPath'
    ]);
  });
});
