import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

/**
 * The /manga/[slug] server load — the source work behind a manga, light novel,
 * novel or manhwa page.
 *
 * Slug only, deliberately: unlike /anime/[slug] there is no id form, because a
 * work's slug is assigned by a trigger in the same insert that creates the row,
 * so there is no window where one exists without the other. The rules that
 * matter are the three-way split between "no such work" (404), "the gateway is
 * down" (render with ssrError, never 404) and "the work exists but has no
 * adaptations" (renders normally).
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
const { getWorkBySlug } = await import('$lib/services/api/graphql/queries');

function args(slug: string) {
  return {
    params: { slug },
    url: new URL(`https://weeb.vip/manga/${slug}`),
    locals: { config: { graphql_host: 'https://api.test/graphql' } },
    cookies: {}
  };
}

/**
 * The payload a successful load returns. `PageServerLoad` also admits `void`,
 * for the paths that error instead of returning; those are asserted with
 * `.rejects` here, so the successful shape is what the reads below want.
 */
type Loaded = Exclude<Awaited<ReturnType<typeof load>>, void>;

/** `load` is a PageServerLoad; the event above is only the slice it reads. */
function run(slug: string): Promise<Loaded> {
  return load(args(slug) as never) as Promise<Loaded>;
}

function work(overrides: Record<string, unknown> = {}) {
  return {
    id: 'work-1',
    type: 'MANGA',
    urlSlug: 'berserk',
    titleEn: 'Berserk',
    titleJp: 'ベルセルク',
    synopsis: 'A lone mercenary walks a very long road.',
    imageUrl: 'https://cdn.myanimelist.net/images/manga/berserk.jpg',
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

describe('what it asks the gateway for', () => {
  it('resolves the work by slug, once', async () => {
    request.mockResolvedValueOnce({ workBySlug: work() });

    await run('berserk');

    expect(request).toHaveBeenCalledTimes(1);
    expect(request.mock.calls[0][0]).toBe(getWorkBySlug);
    expect(request.mock.calls[0][1]).toEqual({ slug: 'berserk' });
  });

  it('has no id form: a uuid in the slot is still asked for as a slug', async () => {
    // Deliberate difference from /anime/[slug]. Nothing links to a work by id.
    request.mockResolvedValueOnce({ workBySlug: null });

    await expect(run('11111111-2222-4333-8444-555555555555')).rejects.toMatchObject({
      status: 404
    });
    expect(request.mock.calls[0][0]).toBe(getWorkBySlug);
    expect(request.mock.calls[0][1]).toEqual({
      slug: '11111111-2222-4333-8444-555555555555'
    });
  });

  it('builds the client against the configured host and the request cookies', async () => {
    request.mockResolvedValueOnce({ workBySlug: work() });

    await run('berserk');

    expect(createSSRGraphQLClient).toHaveBeenCalledWith(
      'https://api.test/graphql',
      'cookie-header'
    );
  });

  it('queries an empty slug rather than redirecting home', async () => {
    // Unlike the anime routes there is no `!slug` guard here; pinned so a later
    // change to that is a deliberate one.
    request.mockResolvedValueOnce({ workBySlug: null });

    await expect(load(args('') as never)).rejects.toMatchObject({ status: 404 });
    expect(request.mock.calls[0][1]).toEqual({ slug: '' });
  });
});

describe('a slug nothing claims versus a gateway failure', () => {
  it('404s when the query succeeded and no work has that slug', async () => {
    request.mockResolvedValueOnce({ workBySlug: null });

    await expect(run('no-such-work')).rejects.toMatchObject({ status: 404 });
  });

  it('404s when the response carried no data at all', async () => {
    request.mockResolvedValueOnce(null);

    await expect(run('no-such-work')).rejects.toMatchObject({ status: 404 });
  });

  it('404s when the gateway THREW a record-not-found', async () => {
    request.mockRejectedValueOnce(notFoundError());

    await expect(run('no-such-work')).rejects.toMatchObject({ status: 404 });
  });

  it('does NOT 404 a gateway failure — it renders with ssrError instead', async () => {
    request.mockRejectedValueOnce(new Error('ECONNREFUSED'));

    const result = await run('berserk');

    expect(result.ssrError).toBe('ECONNREFUSED');
    expect(result.ssrWork).toBeNull();
  });

  it('renders the placeholder payload on a gateway failure', async () => {
    request.mockRejectedValueOnce(new Error('ECONNREFUSED'));

    expect(await run('berserk')).toEqual({
      slug: 'berserk',
      workTitle: 'Manga',
      workDescription: 'Manga — details and anime adaptations',
      workImage: '/assets/og-image.jpg',
      ssrWork: null,
      ssrError: 'ECONNREFUSED'
    });
  });

  it('names the failure even when the thrown value carried no message', async () => {
    request.mockRejectedValueOnce({});

    expect((await run('berserk')).ssrError).toBe('Failed to fetch work');
  });

  it('renders a work that exists but has no adaptations, rather than 404ing it', async () => {
    request.mockResolvedValueOnce({ workBySlug: work({ adaptations: [] }) });

    const result = await run('berserk');

    expect(result.ssrError).toBeNull();
    expect(result.ssrWork).toMatchObject({ id: 'work-1' });
  });
});

describe('the payload the page renders from', () => {
  it('echoes the slug the reader used', async () => {
    request.mockResolvedValueOnce({ workBySlug: work() });

    expect((await run('berserk')).slug).toBe('berserk');
  });

  it('hands the whole work through', async () => {
    request.mockResolvedValueOnce({ workBySlug: work() });

    expect((await run('berserk')).ssrWork).toEqual(work());
  });

  it('prefers the English title', async () => {
    request.mockResolvedValueOnce({ workBySlug: work() });

    expect((await run('berserk')).workTitle).toBe('Berserk');
  });

  it('falls back to the Japanese title', async () => {
    request.mockResolvedValueOnce({ workBySlug: work({ titleEn: null }) });

    expect((await run('berserk')).workTitle).toBe('ベルセルク');
  });

  it('falls back to the placeholder when the work has no title at all', async () => {
    request.mockResolvedValueOnce({ workBySlug: work({ titleEn: null, titleJp: null }) });

    expect((await run('berserk')).workTitle).toBe('Manga');
  });
});

describe('the meta a crawler reads', () => {
  it('describes the work from its synopsis, collapsed to one line', async () => {
    request.mockResolvedValueOnce({
      workBySlug: work({ synopsis: 'Line one.\n\nLine two.' })
    });

    expect((await run('berserk')).workDescription).toBe('Line one. Line two.');
  });

  it('falls back to a sentence about the title when there is no synopsis', async () => {
    request.mockResolvedValueOnce({ workBySlug: work({ synopsis: null }) });

    expect((await run('berserk')).workDescription).toBe(
      'Berserk — details and anime adaptations'
    );
  });

  it('falls back when the synopsis was nothing but whitespace', async () => {
    request.mockResolvedValueOnce({ workBySlug: work({ synopsis: '  \n ' }) });

    expect((await run('berserk')).workDescription).toBe(
      'Berserk — details and anime adaptations'
    );
  });

  it('uses the title fallback inside the description fallback', async () => {
    request.mockResolvedValueOnce({
      workBySlug: work({ titleEn: null, titleJp: null, synopsis: null })
    });

    expect((await run('berserk')).workDescription).toBe(
      'Manga — details and anime adaptations'
    );
  });

  it('points the social card at the MyAnimeList URL, which is certainly fetchable', async () => {
    // The page itself renders the CDN copy; a crawler cannot follow our
    // fallback chain, so the card points at the one URL that already resolves.
    request.mockResolvedValueOnce({ workBySlug: work() });

    expect((await run('berserk')).workImage).toBe(
      'https://cdn.myanimelist.net/images/manga/berserk.jpg'
    );
  });

  it('falls back to the site card when the work has no image', async () => {
    request.mockResolvedValueOnce({ workBySlug: work({ imageUrl: null }) });

    expect((await run('berserk')).workImage).toBe('/assets/og-image.jpg');
  });

  it('falls back to the site card for an empty image URL', async () => {
    request.mockResolvedValueOnce({ workBySlug: work({ imageUrl: '' }) });

    expect((await run('berserk')).workImage).toBe('/assets/og-image.jpg');
  });
});
