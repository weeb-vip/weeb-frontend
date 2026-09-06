import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

/**
 * `query-hooks.ts` is the component-facing half of the data layer: it wraps the
 * option factories from `./query-options.ts` in `createQuery`/`createMutation`
 * and adds the cross-cutting behaviour -- cache invalidation, the logged-in
 * store, analytics identification, token-refresh scheduling.
 *
 * The seam, stated plainly: `createQuery`/`createMutation` read the QueryClient
 * out of Svelte's *component* context, so calling `useLogin()` outside a
 * mounted component throws before any of this module's own code runs. They are
 * therefore replaced with recorders that capture the options object each hook
 * builds, and the tests drive that object directly -- `mutationFn`,
 * `onSuccess`, `onError`, `retry` -- against the module's real collaborators
 * (the real exported `queryClient`, spied on).
 *
 * That means these tests cover what this module decides, not TanStack's
 * plumbing. What is NOT covered here, honestly: that `createQuery` is handed
 * the options at the right moment in a component's life, and anything about the
 * resulting store's reactivity. Both need a mounted component, and both belong
 * to the component tests rather than here.
 */

const captured = vi.hoisted(() => ({
  queries: [] as any[],
  mutations: [] as any[],
  infinite: [] as any[]
}));

vi.mock('@tanstack/svelte-query', async (importOriginal) => {
  const actual = await importOriginal<Record<string, unknown>>();
  return {
    ...actual,
    createQuery: vi.fn((options: any) => {
      captured.queries.push(options);
      return { subscribe: () => () => {} };
    }),
    createMutation: vi.fn((options: any) => {
      captured.mutations.push(options);
      return { subscribe: () => () => {} };
    }),
    createInfiniteQuery: vi.fn((options: any) => {
      captured.infinite.push(options);
      return { subscribe: () => () => {} };
    })
  };
});

const mockDebug = vi.hoisted(() => ({
  auth: vi.fn(),
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
  success: vi.fn(),
  anime: vi.fn()
}));

const mockAnalytics = vi.hoisted(() => ({
  analytics: {
    loginSubmitted: vi.fn(),
    loggedIn: vi.fn(),
    loginFailed: vi.fn(),
    signUpSubmitted: vi.fn(),
    signedUp: vi.fn(),
    signUpFailed: vi.fn(),
    emailVerified: vi.fn(),
    emailVerificationFailed: vi.fn(),
    verificationEmailResent: vi.fn()
  },
  identifyUser: vi.fn()
}));

const mockAuthStorage = vi.hoisted(() => ({
  setTokensForLocalhost: vi.fn(),
  setRefreshTokenLocalStorage: vi.fn(),
  getAuthToken: vi.fn(() => null),
  getRefreshToken: vi.fn(() => null),
  clearTokens: vi.fn()
}));

const mockLoggedInStore = vi.hoisted(() => ({
  setLoggedIn: vi.fn(),
  logout: vi.fn()
}));

const mockRefresher = vi.hoisted(() => ({
  start: vi.fn(),
  startWithExpiry: vi.fn(),
  cancel: vi.fn(),
  getInstance: vi.fn()
}));

/** Every option factory the hooks delegate to, as a recorder. */
const mockQueryOptions = vi.hoisted(() => {
  const make = () => vi.fn();
  return {
    mutationFns: {} as Record<string, ReturnType<typeof make>>,
    queryFns: {} as Record<string, ReturnType<typeof make>>
  };
});

vi.mock('$lib/utils/debug', () => ({ __esModule: true, default: mockDebug }));
vi.mock('$lib/utils/analytics', () => mockAnalytics);
vi.mock('$lib/utils/auth-storage', () => ({ AuthStorage: mockAuthStorage }));
vi.mock('$lib/stores/auth', () => ({ loggedInStore: mockLoggedInStore }));
vi.mock('./token_refresher', () => ({
  TokenRefresher: {
    getInstance: (...args: unknown[]) => {
      mockRefresher.getInstance(...args);
      return mockRefresher;
    }
  }
}));

vi.mock('./query-options', () => {
  const mutation = (name: string) => {
    const fn = vi.fn(async () => ({ ok: name }));
    mockQueryOptions.mutationFns[name] = fn;
    return () => ({ mutationFn: fn });
  };
  const query = (name: string) => {
    const fn = vi.fn(async () => ({ ok: name }));
    mockQueryOptions.queryFns[name] = fn;
    return (...args: unknown[]) => {
      (fn as any).lastArgs = args;
      return { queryFn: fn };
    };
  };
  return {
    login: mutation('login'),
    register: mutation('register'),
    requestPasswordReset: mutation('requestPasswordReset'),
    resetPassword: mutation('resetPassword'),
    verifyEmail: vi.fn((token: string) => {
      mockQueryOptions.mutationFns.verifyEmail ??= vi.fn(async () => ({
        success: true,
        userID: 'u1'
      }));
      (mockQueryOptions.mutationFns.verifyEmail as any).token = token;
      return { mutationFn: mockQueryOptions.mutationFns.verifyEmail };
    }),
    resendVerificationEmail: mutation('resendVerificationEmail'),
    updateUserDetails: mutation('updateUserDetails'),
    upsertAnime: mutation('upsertAnime'),
    deleteAnime: mutation('deleteAnime'),
    getUser: query('getUser'),
    fetchHomePageData: query('fetchHomePageData'),
    fetchCurrentlyAiring: query('fetchCurrentlyAiring'),
    fetchDetails: query('fetchDetails'),
    fetchUserAnimes: query('fetchUserAnimes'),
    refreshTokenSimple: vi.fn(async () => ({ Credentials: { token: 'refreshed' } }))
  };
});

import * as hooks from './query-hooks';
import { queryClient, queryKeys } from './query-hooks';

/** The options object the most recent createMutation call received. */
function lastMutation() {
  return captured.mutations[captured.mutations.length - 1];
}

function lastQuery() {
  return captured.queries[captured.queries.length - 1];
}

let invalidateSpy: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  vi.clearAllMocks();
  captured.queries.length = 0;
  captured.mutations.length = 0;
  captured.infinite.length = 0;
  invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries').mockImplementation(() => undefined as never);
  vi.spyOn(console, 'log').mockImplementation(() => {});
  vi.spyOn(console, 'warn').mockImplementation(() => {});
});

afterEach(() => {
  vi.restoreAllMocks();
});

// ---------------------------------------------------------------------------

describe('queryKeys', () => {
  it('nests every key under one root so the whole cache can be cleared', () => {
    expect(queryKeys.all).toEqual(['svelte']);
    expect(queryKeys.users()).toEqual(['svelte', 'users']);
    expect(queryKeys.user()).toEqual(['svelte', 'users', 'user']);
    expect(queryKeys.anime()).toEqual(['svelte', 'anime']);
    expect(queryKeys.animeDetail('a1')).toEqual(['svelte', 'anime', 'detail', 'a1']);
    expect(queryKeys.homePageData()).toEqual(['svelte', 'homePageData']);
    expect(queryKeys.currentlyAiring()).toEqual(['svelte', 'currentlyAiring']);
    expect(queryKeys.userAnimes({ status: 'WATCHING' } as never)).toEqual([
      'svelte',
      'users',
      'animes',
      { status: 'WATCHING' }
    ]);
  });

  it('makes user() a prefix of nothing else but users(), so invalidating users() reaches it', () => {
    // TanStack matches by key prefix; this hierarchy is what makes one
    // invalidateQueries({queryKey: users()}) refresh the user and their lists.
    expect(queryKeys.user().slice(0, 2)).toEqual(queryKeys.users());
    expect(queryKeys.userAnimes({} as never).slice(0, 2)).toEqual(queryKeys.users());
  });

  it('produces structurally stable keys across calls', () => {
    expect(queryKeys.user()).toEqual(queryKeys.user());
    expect(queryKeys.animeDetail('a1')).toEqual(queryKeys.animeDetail('a1'));
    expect(queryKeys.animeDetail('a1')).not.toEqual(queryKeys.animeDetail('a2'));
  });
});

// ---------------------------------------------------------------------------

describe('useLogin', () => {
  const credentials = (over: Record<string, unknown> = {}) => ({
    Credentials: { token: 'access-1', refresh_token: 'refresh-1' },
    ...over
  });

  it('delegates to the login option factory and reports the attempt', async () => {
    hooks.useLogin();

    await lastMutation().mutationFn({ username: 'james', password: 'pw' });

    expect(mockAnalytics.analytics.loginSubmitted).toHaveBeenCalledTimes(1);
    expect(mockQueryOptions.mutationFns.login).toHaveBeenCalledWith({
      input: { username: 'james', password: 'pw' }
    });
  });

  it('persists the tokens the server returned', () => {
    hooks.useLogin();

    lastMutation().onSuccess(credentials());

    expect(mockAuthStorage.setTokensForLocalhost).toHaveBeenCalledWith('access-1', 'refresh-1');
    expect(mockAuthStorage.setRefreshTokenLocalStorage).toHaveBeenCalledWith('refresh-1');
  });

  it('warns when the response carried no refresh token', () => {
    hooks.useLogin();

    lastMutation().onSuccess({ Credentials: { token: 'access-1' } });

    expect(mockAuthStorage.setRefreshTokenLocalStorage).not.toHaveBeenCalled();
    expect(mockDebug.warn).toHaveBeenCalledWith(
      'No refresh token received in Svelte login response'
    );
  });

  it('puts the user on the auth store when the response carried one', () => {
    hooks.useLogin();

    lastMutation().onSuccess(
      credentials({ user: { id: 'u1', username: 'james', email: 'j@example.com' } })
    );

    expect(mockLoggedInStore.setLoggedIn).toHaveBeenCalledWith({
      id: 'u1',
      username: 'james',
      email: 'j@example.com'
    });
  });

  it('still marks the session logged in when no user object came back', () => {
    hooks.useLogin();

    lastMutation().onSuccess(credentials());

    expect(mockLoggedInStore.setLoggedIn).toHaveBeenCalledWith();
  });

  it('schedules the token refresher from the new access token', () => {
    hooks.useLogin();

    lastMutation().onSuccess(credentials());

    expect(mockRefresher.getInstance).toHaveBeenCalledTimes(1);
    expect(mockRefresher.start).toHaveBeenCalledWith('access-1');
  });

  it('wires the refresher to refreshTokenSimple', async () => {
    const { refreshTokenSimple } = await import('./query-options');
    hooks.useLogin();

    lastMutation().onSuccess(credentials());

    // the function the refresher was handed is the one it will call on a timer
    const injected = mockRefresher.getInstance.mock.calls[0][0] as () => Promise<unknown>;
    await expect(injected()).resolves.toEqual({ Credentials: { token: 'refreshed' } });
    expect(refreshTokenSimple).toHaveBeenCalledTimes(1);
  });

  it('invalidates the user and content caches, legacy keys included', () => {
    hooks.useLogin();

    lastMutation().onSuccess(credentials());

    const keys = invalidateSpy.mock.calls.map((call: any) => call[0].queryKey);
    expect(keys).toEqual([
      queryKeys.user(),
      queryKeys.users(),
      queryKeys.currentlyAiring(),
      queryKeys.homePageData(),
      ['user'],
      ['user-animes'],
      ['currently-airing'],
      ['currentlyAiring'],
      ['currentlyAiringWithEpisodes'],
      ['homedata'],
      ['seasonal-anime']
    ]);
  });

  it('does not let a failed invalidation break the login', () => {
    invalidateSpy.mockImplementation(() => {
      throw new Error('cache exploded');
    });
    hooks.useLogin();

    expect(() => lastMutation().onSuccess(credentials())).not.toThrow();
    expect(mockDebug.error).toHaveBeenCalledWith(
      'Failed to invalidate queries after login:',
      expect.any(Error)
    );
    // the analytics event still fires -- the user is logged in either way
    expect(mockAnalytics.analytics.loggedIn).toHaveBeenCalledWith('password');
  });

  it('records the failure reason, truncated, on error', () => {
    hooks.useLogin();

    lastMutation().onError(new Error('x'.repeat(500)));

    const reason = mockAnalytics.analytics.loginFailed.mock.calls[0][0];
    expect(reason).toHaveLength(200);
    expect(mockAnalytics.analytics.loggedIn).not.toHaveBeenCalled();
  });

  it('copes with a thrown non-Error', () => {
    hooks.useLogin();

    lastMutation().onError(undefined);

    expect(mockAnalytics.analytics.loginFailed).toHaveBeenCalledWith('unknown');
  });
});

// ---------------------------------------------------------------------------

describe('useRegister', () => {
  it('delegates and reports the attempt', async () => {
    hooks.useRegister();

    await lastMutation().mutationFn({ username: 'james', password: 'pw' });

    expect(mockAnalytics.analytics.signUpSubmitted).toHaveBeenCalledTimes(1);
    expect(mockQueryOptions.mutationFns.register).toHaveBeenCalledWith({
      input: { username: 'james', password: 'pw' }
    });
  });

  it('links the anonymous session to the new account', () => {
    hooks.useRegister();

    lastMutation().onSuccess({ id: 'u1' });

    expect(mockAnalytics.identifyUser).toHaveBeenCalledWith('u1', { email_verified: false });
    expect(mockAnalytics.analytics.signedUp).toHaveBeenCalledWith('u1');
  });

  it('skips identification when the response carried no id', () => {
    hooks.useRegister();

    lastMutation().onSuccess({});

    expect(mockAnalytics.identifyUser).not.toHaveBeenCalled();
    expect(mockAnalytics.analytics.signedUp).toHaveBeenCalledWith(undefined);
  });

  it('survives a null payload', () => {
    hooks.useRegister();

    expect(() => lastMutation().onSuccess(null)).not.toThrow();
    expect(mockAnalytics.identifyUser).not.toHaveBeenCalled();
  });

  it('records the failure reason on error', () => {
    hooks.useRegister();

    lastMutation().onError(new Error('username taken'));

    expect(mockAnalytics.analytics.signUpFailed).toHaveBeenCalledWith('username taken');
  });
});

// ---------------------------------------------------------------------------

describe('password reset hooks', () => {
  it('usePasswordReset delegates the request', async () => {
    hooks.usePasswordReset();

    await lastMutation().mutationFn({ email: 'j@example.com' });

    expect(mockQueryOptions.mutationFns.requestPasswordReset).toHaveBeenCalledWith({
      input: { email: 'j@example.com' }
    });
  });

  it('usePasswordResetConfirm delegates the confirmation', async () => {
    hooks.usePasswordResetConfirm();

    await lastMutation().mutationFn({ token: 't', password: 'new' });

    expect(mockQueryOptions.mutationFns.resetPassword).toHaveBeenCalledWith({
      input: { token: 't', password: 'new' }
    });
  });
});

// ---------------------------------------------------------------------------

describe('useVerifyEmail', () => {
  it('passes the link token to the option factory', async () => {
    hooks.useVerifyEmail();

    await lastMutation().mutationFn('link-token');

    expect((mockQueryOptions.mutationFns.verifyEmail as any).token).toBe('link-token');
  });

  it('links the verified account and records the success', () => {
    hooks.useVerifyEmail();

    lastMutation().onSuccess({ success: true, userID: 'u1' });

    expect(mockAnalytics.identifyUser).toHaveBeenCalledWith('u1', { email_verified: true });
    expect(mockAnalytics.analytics.emailVerified).toHaveBeenCalledTimes(1);
  });

  it('records the success even when no user id came back', () => {
    hooks.useVerifyEmail();

    lastMutation().onSuccess({ success: true, userID: null });

    expect(mockAnalytics.identifyUser).not.toHaveBeenCalled();
    expect(mockAnalytics.analytics.emailVerified).toHaveBeenCalledTimes(1);
  });

  it('treats success:false as a failure, not a success', () => {
    // The mutation resolves either way; only the flag distinguishes them.
    hooks.useVerifyEmail();

    lastMutation().onSuccess({ success: false, userID: null });

    expect(mockAnalytics.analytics.emailVerified).not.toHaveBeenCalled();
    expect(mockAnalytics.analytics.emailVerificationFailed).toHaveBeenCalledWith(
      'verification_unsuccessful'
    );
  });

  it('treats a null payload as a failure', () => {
    hooks.useVerifyEmail();

    lastMutation().onSuccess(null);

    expect(mockAnalytics.analytics.emailVerificationFailed).toHaveBeenCalledWith(
      'verification_unsuccessful'
    );
  });

  it('records the reason when the mutation itself failed', () => {
    hooks.useVerifyEmail();

    lastMutation().onError(new Error('token expired'));

    expect(mockAnalytics.analytics.emailVerificationFailed).toHaveBeenCalledWith('token expired');
  });
});

describe('useResendVerificationEmail', () => {
  it('delegates the username', async () => {
    hooks.useResendVerificationEmail();

    await lastMutation().mutationFn({ username: 'james' });

    expect(mockQueryOptions.mutationFns.resendVerificationEmail).toHaveBeenCalledWith({
      username: 'james'
    });
  });

  it('records the resend', () => {
    hooks.useResendVerificationEmail();

    lastMutation().onSuccess();

    expect(mockAnalytics.analytics.verificationEmailResent).toHaveBeenCalledTimes(1);
  });
});

// ---------------------------------------------------------------------------

describe('userQueryOptions', () => {
  it('is keyed under the user key and stays fresh for five minutes', () => {
    const options = hooks.userQueryOptions();

    expect(options.queryKey).toEqual(queryKeys.user());
    expect(options.staleTime).toBe(5 * 60 * 1000);
    expect(options.enabled).toBe(true);
  });

  it('can be disabled for a signed-out visitor', () => {
    expect(hooks.userQueryOptions(false).enabled).toBe(false);
  });

  it('delegates to the getUser option factory', async () => {
    await hooks.userQueryOptions().queryFn();

    expect(mockQueryOptions.queryFns.getUser).toHaveBeenCalledTimes(1);
  });

  describe('retry policy', () => {
    const retry = () => hooks.userQueryOptions().retry;

    it('never retries a 401 or a 403', () => {
      expect(retry()(0, { status: 401 })).toBe(false);
      expect(retry()(0, { status: 403 })).toBe(false);
    });

    it('never retries the user-service "Access denied"', () => {
      expect(retry()(0, { message: 'Access denied' })).toBe(false);
    });

    it('retries a transient failure exactly once', () => {
      expect(retry()(0, { message: 'network down' })).toBe(true);
      expect(retry()(1, { message: 'network down' })).toBe(false);
    });

    it('copes with an error carrying neither status nor message', () => {
      expect(retry()(0, {})).toBe(true);
      expect(retry()(0, undefined)).toBe(true);
    });
  });

  it('useUser hands those exact options to createQuery', () => {
    hooks.useUser();

    expect(lastQuery().queryKey).toEqual(queryKeys.user());
    expect(lastQuery().staleTime).toBe(5 * 60 * 1000);
  });
});

// ---------------------------------------------------------------------------

describe('useUpdateUser', () => {
  it('delegates the input', async () => {
    hooks.useUpdateUser();

    await lastMutation().mutationFn({ firstname: 'J' });

    expect(mockQueryOptions.mutationFns.updateUserDetails).toHaveBeenCalledWith({
      firstname: 'J'
    });
  });

  it('invalidates only the user query on success', () => {
    hooks.useUpdateUser();

    lastMutation().onSuccess();

    expect(invalidateSpy).toHaveBeenCalledTimes(1);
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: queryKeys.user() });
  });
});

describe('useUserAnimes', () => {
  it('keys the query by its variables and keeps it fresh for two minutes', () => {
    hooks.useUserAnimes({ status: 'WATCHING' } as never);

    expect(lastQuery().queryKey).toEqual(queryKeys.userAnimes({ status: 'WATCHING' } as never));
    expect(lastQuery().staleTime).toBe(2 * 60 * 1000);
    expect(lastQuery().enabled).toBe(true);
  });

  it('delegates to the option factory', async () => {
    hooks.useUserAnimes({ status: 'WATCHING' } as never);

    await lastQuery().queryFn();

    expect(mockQueryOptions.queryFns.fetchUserAnimes).toHaveBeenCalledTimes(1);
  });

  it('stays disabled without variables', () => {
    hooks.useUserAnimes(undefined as never);

    expect(lastQuery().enabled).toBe(false);
  });
});

// ---------------------------------------------------------------------------

describe('anime queries', () => {
  it('useHomePageData is keyed and stale-timed for a slow-moving page', async () => {
    hooks.useHomePageData();

    expect(lastQuery().queryKey).toEqual(queryKeys.homePageData());
    expect(lastQuery().staleTime).toBe(10 * 60 * 1000);
    await lastQuery().queryFn();
    expect(mockQueryOptions.queryFns.fetchHomePageData).toHaveBeenCalledTimes(1);
  });

  it('useCurrentlyAiring refreshes more often than the home page', async () => {
    hooks.useCurrentlyAiring();

    expect(lastQuery().queryKey).toEqual(queryKeys.currentlyAiring());
    expect(lastQuery().staleTime).toBe(5 * 60 * 1000);
    await lastQuery().queryFn();
    expect(mockQueryOptions.queryFns.fetchCurrentlyAiring).toHaveBeenCalledTimes(1);
  });

  it('useAnimeDetails is keyed per anime and cached longest', async () => {
    hooks.useAnimeDetails('a1');

    expect(lastQuery().queryKey).toEqual(queryKeys.animeDetail('a1'));
    expect(lastQuery().staleTime).toBe(15 * 60 * 1000);
    expect(lastQuery().enabled).toBe(true);
    await lastQuery().queryFn();
    expect(mockQueryOptions.queryFns.fetchDetails).toHaveBeenCalledTimes(1);
  });

  it('useAnimeDetails stays disabled without an id', () => {
    hooks.useAnimeDetails('');

    expect(lastQuery().enabled).toBe(false);
  });
});

describe('anime mutations', () => {
  it('useUpsertAnime wraps the input and refreshes the user lists', async () => {
    hooks.useUpsertAnime();

    await lastMutation().mutationFn({ animeID: 'a1', status: 'WATCHING' });
    lastMutation().onSuccess();

    expect(mockQueryOptions.mutationFns.upsertAnime).toHaveBeenCalledWith({
      input: { animeID: 'a1', status: 'WATCHING' }
    });
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: queryKeys.users() });
  });

  it('useDeleteAnime passes the id straight through and refreshes the user lists', async () => {
    hooks.useDeleteAnime();

    await lastMutation().mutationFn('ua1');
    lastMutation().onSuccess();

    expect(mockQueryOptions.mutationFns.deleteAnime).toHaveBeenCalledWith('ua1');
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: queryKeys.users() });
  });

  it('propagates a failed write rather than swallowing it', async () => {
    mockQueryOptions.mutationFns.deleteAnime.mockRejectedValueOnce(new Error('Access denied'));
    hooks.useDeleteAnime();

    await expect(lastMutation().mutationFn('ua1')).rejects.toThrow('Access denied');
  });
});

// ---------------------------------------------------------------------------

describe('cache utilities', () => {
  it('clearAuthQueries removes the user cache and the auth mutation entries', () => {
    const removeSpy = vi
      .spyOn(queryClient, 'removeQueries')
      .mockImplementation(() => undefined as never);

    hooks.clearAuthQueries();

    expect(removeSpy.mock.calls.map((call: any) => call[0].queryKey)).toEqual([
      queryKeys.users(),
      ['login'],
      ['register']
    ]);
  });

  it('prefetchHomeData warms the same key useHomePageData reads', async () => {
    const prefetchSpy = vi
      .spyOn(queryClient, 'prefetchQuery')
      .mockResolvedValue(undefined as never);

    await hooks.prefetchHomeData();

    const options = prefetchSpy.mock.calls[0][0] as any;
    expect(options.queryKey).toEqual(queryKeys.homePageData());
    expect(options.staleTime).toBe(10 * 60 * 1000);

    await options.queryFn();
    expect(mockQueryOptions.queryFns.fetchHomePageData).toHaveBeenCalledTimes(1);
  });

  it('exports a real QueryClient for callers that need direct access', () => {
    expect(typeof queryClient.invalidateQueries).toBe('function');
    expect(typeof queryClient.getQueryCache).toBe('function');
  });
});
