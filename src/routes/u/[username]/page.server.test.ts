import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  getUserByUsername,
  queryPublicUserAnimes,
  queryPublicUserWorks,
  queryPublicUserAnimeStatusCounts,
  queryPublicUserWorkStatusCounts
} from '$lib/services/api/graphql/queries';
import { Status, WorkStatus } from '../../../gql/graphql';

/**
 * /u/<username> is a public page for someone else's profile, so the rule that
 * matters most is the privacy gate: when the viewed user has not opted their
 * lists public, the loader must not fetch them at all -- not fetch-then-hide,
 * which would put the rows in the serialized page data.
 *
 * Also pinned: the canonical-casing redirect happens BEFORE the list fetches
 * (so a redirect never pays for work the canonical request redoes), the five
 * documents and their variables, and the unwrapping of each response alias.
 *
 * `makeSSRFetcher` is mocked at the module seam; `publicAuth` is left real so
 * the test also pins that no token material rides the payload.
 */

const fetchWithFallback =
  vi.fn<(query: unknown, variables: unknown, description: string) => Promise<unknown>>();
const wasTokenExpired = vi.fn<() => boolean>(() => false);
const makeSSRFetcher = vi.fn<(host: string, cookieHeader: string | null) => unknown>();

vi.mock('$lib/server/ssr-graphql', async (importOriginal) => {
  const actual = await importOriginal<typeof import('$lib/server/ssr-graphql')>();
  return {
    ...actual,
    cookieHeaderFrom: () => 'cookie-header',
    makeSSRFetcher: (host: string, cookieHeader: string | null) => {
      makeSSRFetcher(host, cookieHeader);
      return { fetchWithFallback, wasTokenExpired };
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

const TOKEN = `h.${btoa(JSON.stringify({ exp: 1_800_000_000 }))}.s`;

function args(username: string) {
  return {
    params: { username },
    locals: {
      auth: {
        isLoggedIn: true,
        hasAuthToken: true,
        hasRefreshToken: true,
        authToken: TOKEN
      },
      config: { graphql_host: 'https://api.test/graphql' }
    },
    cookies: {}
  } as never;
}

function user(overrides: Record<string, unknown> = {}) {
  return { id: 'user-1', username: 'thatcat', listsPublic: false, ...overrides };
}

/**
 * Answers each of the five documents in turn, so a test only has to say what
 * the user record and (optionally) the four list responses look like.
 */
function respondWith(userRecord: unknown, lists: Record<string, unknown> = {}) {
  // `key in lists` rather than `??`, so a test can hand back an explicit null.
  const pick = (key: string, fallback: unknown) => (key in lists ? lists[key] : fallback);
  fetchWithFallback.mockImplementation(async (query) => {
    if (query === getUserByUsername)
      return userRecord === null ? null : { userByUsername: userRecord };
    if (query === queryPublicUserAnimes)
      return pick('watching', { PublicUserAnimes: { animes: [] } });
    if (query === queryPublicUserWorks) return pick('reading', { PublicUserWorks: { works: [] } });
    if (query === queryPublicUserAnimeStatusCounts)
      return pick('animeCounts', { PublicUserAnimeStatusCounts: [{ status: 'WATCHING', count: 3 }] });
    if (query === queryPublicUserWorkStatusCounts)
      return pick('workCounts', { PublicUserWorkStatusCounts: [{ status: 'READING', count: 1 }] });
    return null;
  });
}

beforeEach(() => {
  fetchWithFallback.mockReset();
  wasTokenExpired.mockReset();
  wasTokenExpired.mockReturnValue(false);
  makeSSRFetcher.mockClear();
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('finding the user', () => {
  it('looks the username up by the URL parameter', async () => {
    respondWith(user());

    await run(args('thatcat'));

    expect(fetchWithFallback).toHaveBeenCalledWith(
      getUserByUsername,
      { username: 'thatcat' },
      'public user'
    );
  });

  it('builds the fetcher against the configured host and the request cookies', async () => {
    respondWith(user());

    await run(args('thatcat'));

    expect(makeSSRFetcher).toHaveBeenCalledWith('https://api.test/graphql', 'cookie-header');
  });

  it('404s when there is no such user', async () => {
    respondWith(null);

    await expect(load(args('nobody'))).rejects.toMatchObject({
      status: 404,
      body: { message: 'No such user' }
    });
  });

  it('404s when the field came back null', async () => {
    fetchWithFallback.mockResolvedValue({ userByUsername: null });

    await expect(load(args('nobody'))).rejects.toMatchObject({ status: 404 });
  });

  it('404s a gateway outage too -- see the note below', async () => {
    // BUG (pinned as current behaviour, not fixed): fetchWithFallback swallows
    // every failure and returns null, so an outage is indistinguishable here
    // from "no such user" and a live profile answers 404 while the gateway is
    // down. /people and /series both split these cases with isNotFoundError;
    // this route does not, so a blip can deindex real profiles.
    fetchWithFallback.mockResolvedValue(null);

    await expect(load(args('thatcat'))).rejects.toMatchObject({
      status: 404,
      body: { message: 'No such user' }
    });
  });

  it('does not fetch any lists once it has decided to 404', async () => {
    respondWith(null);

    await expect(load(args('nobody'))).rejects.toMatchObject({ status: 404 });
    expect(fetchWithFallback).toHaveBeenCalledTimes(1);
  });
});

describe('one profile, one address', () => {
  it('redirects a differently-cased URL to the casing the user chose', async () => {
    respondWith(user({ username: 'ThatCat' }));

    await expect(load(args('THATCAT'))).rejects.toMatchObject({
      status: 308,
      location: '/u/ThatCat'
    });
  });

  it('redirects before paying for the list fetches', async () => {
    // The canonical request will redo them; fetching here is pure waste.
    respondWith(user({ username: 'ThatCat', listsPublic: true }));

    await expect(load(args('thatcat'))).rejects.toMatchObject({ status: 308 });
    expect(fetchWithFallback).toHaveBeenCalledTimes(1);
  });

  it('percent-encodes the canonical username into the location', async () => {
    respondWith(user({ username: 'that cat' }));

    await expect(load(args('THAT%20CAT'))).rejects.toMatchObject({
      location: '/u/that%20cat'
    });
  });

  it('does not redirect when the casing already matches', async () => {
    respondWith(user({ username: 'thatcat' }));

    expect((await run(args('thatcat'))).user.username).toBe('thatcat');
  });

  it('does not redirect when the record carries no username', async () => {
    respondWith(user({ username: null }));

    expect((await run(args('thatcat'))).user.username).toBeNull();
  });
});

describe('the privacy gate', () => {
  it('does not fetch the lists at all for a private profile', async () => {
    // Not fetch-then-hide: SvelteKit serialises whatever load returns into the
    // page HTML, so the gate has to live before the request.
    respondWith(user({ listsPublic: false }));

    const result = await run(args('thatcat'));

    expect(result.lists).toBeNull();
    expect(fetchWithFallback).toHaveBeenCalledTimes(1);
  });

  it('treats a missing listsPublic flag as private', async () => {
    respondWith({ id: 'user-1', username: 'thatcat' });

    expect((await run(args('thatcat'))).lists).toBeNull();
  });

  it('still returns the header data for a private profile', async () => {
    respondWith(user({ listsPublic: false, avatarUrl: 'https://cdn.test/a.png' }));

    const result = await run(args('thatcat'));

    expect(result.user).toMatchObject({ id: 'user-1', avatarUrl: 'https://cdn.test/a.png' });
  });

  it('fetches all four list queries for a public profile', async () => {
    respondWith(user({ listsPublic: true }));

    await run(args('thatcat'));

    expect(fetchWithFallback).toHaveBeenCalledTimes(5);
  });
});

describe('what the four list queries ask for', () => {
  beforeEach(() => {
    respondWith(user({ listsPublic: true }));
  });

  it('asks for the currently watching anime, by user id and not username', async () => {
    await run(args('thatcat'));

    expect(fetchWithFallback).toHaveBeenCalledWith(
      queryPublicUserAnimes,
      { userID: 'user-1', input: { status: Status.Watching, limit: 60, page: 1 } },
      'public watching'
    );
  });

  it('asks for the currently reading works', async () => {
    await run(args('thatcat'));

    expect(fetchWithFallback).toHaveBeenCalledWith(
      queryPublicUserWorks,
      { userID: 'user-1', input: { status: WorkStatus.Reading, limit: 60, page: 1 } },
      'public reading'
    );
  });

  it('asks for the rest of the library as counts, never as rows', async () => {
    // The counts queries take no status and no paging: the numbers are all the
    // page shows, so the entries behind them are never pulled.
    await run(args('thatcat'));

    expect(fetchWithFallback).toHaveBeenCalledWith(
      queryPublicUserAnimeStatusCounts,
      { userID: 'user-1' },
      'public anime counts'
    );
    expect(fetchWithFallback).toHaveBeenCalledWith(
      queryPublicUserWorkStatusCounts,
      { userID: 'user-1' },
      'public work counts'
    );
  });

  it('pages from 1 and caps the rows at 60', async () => {
    await run(args('thatcat'));

    const call = fetchWithFallback.mock.calls.find(
      (c) => c[0] === queryPublicUserAnimes
    ) as [unknown, { input: { limit: number; page: number } }, string];
    expect(call[1].input).toMatchObject({ limit: 60, page: 1 });
  });
});

describe('unwrapping the list responses', () => {
  it('lifts each alias out of its wrapper', async () => {
    respondWith(user({ listsPublic: true }), {
      watching: { PublicUserAnimes: { animes: [{ id: 'a1' }] } },
      reading: { PublicUserWorks: { works: [{ id: 'w1' }] } },
      animeCounts: { PublicUserAnimeStatusCounts: [{ status: 'WATCHING', count: 7 }] },
      workCounts: { PublicUserWorkStatusCounts: [{ status: 'READING', count: 2 }] }
    });

    const result = await run(args('thatcat'));

    expect(result.lists).toEqual({
      watching: { animes: [{ id: 'a1' }] },
      reading: { works: [{ id: 'w1' }] },
      animeCounts: [{ status: 'WATCHING', count: 7 }],
      workCounts: [{ status: 'READING', count: 2 }]
    });
  });

  it('nulls a branch that came back empty rather than dropping the key', async () => {
    // A failed sub-query must not remove `watching` from the shape, or the page
    // would read undefined where it expects null.
    respondWith(user({ listsPublic: true }), { watching: null, animeCounts: null });

    const result = await run(args('thatcat'));

    expect(result.lists?.watching).toBeNull();
    expect(result.lists?.animeCounts).toBeNull();
    expect(result.lists?.reading).not.toBeNull();
  });

  it('nulls a branch whose response lacked the alias', async () => {
    respondWith(user({ listsPublic: true }), { reading: { somethingElse: true } });

    expect((await run(args('thatcat'))).lists?.reading).toBeNull();
  });

  it('keeps all four keys even when every sub-query failed', async () => {
    respondWith(user({ listsPublic: true }), {
      watching: null,
      reading: null,
      animeCounts: null,
      workCounts: null
    });

    expect((await run(args('thatcat'))).lists).toEqual({
      watching: null,
      reading: null,
      animeCounts: null,
      workCounts: null
    });
  });

  it('keeps an empty list as an empty list, not as a failure', async () => {
    respondWith(user({ listsPublic: true }), {
      watching: { PublicUserAnimes: { animes: [] } }
    });

    expect((await run(args('thatcat'))).lists?.watching).toEqual({ animes: [] });
  });
});

describe('the payload', () => {
  it('is the viewer auth, the user record and the lists, and nothing else', async () => {
    respondWith(user());

    const result = await run(args('thatcat'));

    expect(Object.keys(result).sort()).toEqual(['auth', 'lists', 'user']);
  });

  it('carries the public view of the VIEWER auth, not the viewed user', async () => {
    respondWith(user());

    const result = await run(args('thatcat'));

    expect(result.auth).toEqual({
      isLoggedIn: true,
      hasAuthToken: true,
      hasRefreshToken: true,
      authTokenExpiresAt: 1_800_000_000_000
    });
    expect(JSON.stringify(result.auth)).not.toContain(TOKEN);
  });

  it('does not blank the auth out when SSR saw an expired token', async () => {
    // Unlike /season, this route has no isTokenExpired branch: an expired token
    // still renders as logged in and the client refresher sorts it out.
    wasTokenExpired.mockReturnValue(true);
    respondWith(user());

    expect((await run(args('thatcat'))).auth.isLoggedIn).toBe(true);
  });

  it('hands the user record through untouched', async () => {
    const record = user({ bio: 'hello', listsPublic: false });
    respondWith(record);

    expect((await run(args('thatcat'))).user).toEqual(record);
  });
});
