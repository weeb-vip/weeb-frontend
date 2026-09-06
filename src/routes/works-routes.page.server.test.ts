import { describe, it, expect, vi, beforeEach } from 'vitest';

/**
 * /manga and /light-novels are two thin wrappers over one loader. The shared
 * loader is pinned in `src/lib/server/works-browse.test.ts`; the only thing
 * these two routes add is the scope, and the two scopes have to be exact
 * complements or a work lands on both shelves or on neither.
 *
 * So this file mocks the shared loader away entirely and asserts what each
 * route hands it.
 */

const loadWorksBrowse = vi.fn(async (_args: any) => ({ loaded: true }) as any);

vi.mock('$lib/server/works-browse', () => ({
  loadWorksBrowse: (args: unknown) => loadWorksBrowse(args)
}));

const manga = await import('./manga/+page.server');
const lightNovels = await import('./light-novels/+page.server');
const { NOVEL_TYPES } = await import('$lib/services/api/graphql/works');

function event(path: string) {
  return {
    url: new URL(`https://weeb.vip${path}?sort=SCORE&page=2`),
    locals: {
      auth: { isLoggedIn: true, hasAuthToken: true, hasRefreshToken: true },
      config: { graphql_host: 'https://api.test/graphql' }
    },
    cookies: { getAll: () => [] }
  } as any;
}

beforeEach(() => {
  loadWorksBrowse.mockClear();
});

describe('/manga', () => {
  it('scopes by exclusion, so a kind MyAnimeList invents next still lands here', async () => {
    await manga.load(event('/manga'));

    expect(loadWorksBrowse.mock.calls[0][0].excludeTypes).toBe(NOVEL_TYPES);
  });

  it('sends no include list at all', async () => {
    await manga.load(event('/manga'));

    expect(loadWorksBrowse.mock.calls[0][0]).not.toHaveProperty('types');
  });
});

describe('/light-novels', () => {
  it('scopes by inclusion, to the three prose kinds', async () => {
    await lightNovels.load(event('/light-novels'));

    expect(loadWorksBrowse.mock.calls[0][0].types).toBe(NOVEL_TYPES);
    expect(NOVEL_TYPES).toEqual(['LIGHT_NOVEL', 'NOVEL', 'WEB_NOVEL']);
  });

  it('sends no exclude list at all', async () => {
    await lightNovels.load(event('/light-novels'));

    expect(loadWorksBrowse.mock.calls[0][0]).not.toHaveProperty('excludeTypes');
  });
});

describe('the two shelves together', () => {
  it('are exact complements: what one excludes is what the other includes', async () => {
    await manga.load(event('/manga'));
    await lightNovels.load(event('/light-novels'));

    const [mangaArgs] = loadWorksBrowse.mock.calls[0];
    const [novelArgs] = loadWorksBrowse.mock.calls[1];
    expect(mangaArgs.excludeTypes).toEqual(novelArgs.types);
  });

  it('each delegate rather than fetching anything themselves', async () => {
    await manga.load(event('/manga'));
    await lightNovels.load(event('/light-novels'));

    expect(loadWorksBrowse).toHaveBeenCalledTimes(2);
  });
});

describe('what each route forwards', () => {
  it.each([
    ['/manga', () => manga.load(event('/manga'))],
    ['/light-novels', () => lightNovels.load(event('/light-novels'))]
  ])('passes %s\'s url, locals and cookies straight through', async (path, run) => {
    await run();

    const args = loadWorksBrowse.mock.calls[0][0];
    expect(args.url.pathname).toBe(path);
    expect(args.url.search).toBe('?sort=SCORE&page=2');
    expect(args.locals.config.graphql_host).toBe('https://api.test/graphql');
    expect(args.cookies).toBeDefined();
  });

  it.each([
    ['/manga', () => manga.load(event('/manga'))],
    ['/light-novels', () => lightNovels.load(event('/light-novels'))]
  ])('returns %s\'s shared-loader payload unchanged', async (_path, run) => {
    loadWorksBrowse.mockResolvedValueOnce({ works: [{ id: 'w1' }], ssrError: null });

    expect(await run()).toEqual({ works: [{ id: 'w1' }], ssrError: null });
  });
});
