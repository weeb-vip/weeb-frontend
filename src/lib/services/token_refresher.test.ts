import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import type { SigninResult } from '../../gql/graphql';

/**
 * TokenRefresher is the client-side scheduler that keeps the access token
 * alive: it decodes the JWT's `exp`, sets a timer for `refreshWindow` before
 * it, and calls the injected refresh function when the timer fires.
 *
 * The real module is imported (never a copy), but three collaborators are
 * stubbed because they are the process boundary: cookie/localStorage reads
 * (AuthStorage), the auth store, and the debug logger. The refresh function
 * itself is the class's own injected port, so nothing here can reach the
 * network.
 *
 * The class is a singleton keyed on a module-level static, so every test
 * re-imports through `vi.resetModules()` to get a fresh one.
 */

const mockDebug = vi.hoisted(() => ({
  auth: vi.fn(),
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
  success: vi.fn(),
  anime: vi.fn()
}));

const mockAuthStorage = vi.hoisted(() => ({
  getAuthToken: vi.fn<() => string | null>(() => null),
  getRefreshToken: vi.fn<() => string | null>(() => null)
}));

const mockLoggedInStore = vi.hoisted(() => ({
  setLoggedIn: vi.fn(),
  logout: vi.fn()
}));

vi.mock('$lib/utils/debug', () => ({ __esModule: true, default: mockDebug }));
vi.mock('$lib/utils/auth-storage', () => ({ AuthStorage: mockAuthStorage }));
vi.mock('$lib/stores/auth', () => ({ loggedInStore: mockLoggedInStore }));

/** A structurally valid JWT whose payload carries the given `exp` (seconds). */
function jwt(payload: Record<string, unknown>): string {
  const body = btoa(JSON.stringify(payload));
  return `header.${body}.signature`;
}

function tokenExpiringInMs(ms: number): string {
  return jwt({ exp: Math.floor((Date.now() + ms) / 1000) });
}

function credentials(token: string | null): SigninResult {
  return { Credentials: { token } } as unknown as SigninResult;
}

async function loadTokenRefresher() {
  vi.resetModules();
  const mod = await import('./token_refresher');
  return mod.TokenRefresher;
}

const MINUTE = 60 * 1000;

describe('TokenRefresher', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAuthStorage.getAuthToken.mockReturnValue(null);
    mockAuthStorage.getRefreshToken.mockReturnValue(null);
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('construction', () => {
    it('does not refresh when there is no refresh token in storage', async () => {
      const TokenRefresher = await loadTokenRefresher();
      const refresh = vi.fn(async () => credentials(tokenExpiringInMs(60 * MINUTE)));

      TokenRefresher.getInstance(refresh);
      await vi.advanceTimersByTimeAsync(0);

      expect(refresh).not.toHaveBeenCalled();
    });

    it('refreshes immediately when a refresh token is already stored', async () => {
      mockAuthStorage.getRefreshToken.mockReturnValue('stored-refresh-token');
      const TokenRefresher = await loadTokenRefresher();
      const refresh = vi.fn(async () => credentials(tokenExpiringInMs(60 * MINUTE)));

      TokenRefresher.getInstance(refresh);
      await vi.advanceTimersByTimeAsync(0);

      expect(refresh).toHaveBeenCalledTimes(1);
    });

    it('reports the expiry of a token that is already in storage', async () => {
      mockAuthStorage.getAuthToken.mockReturnValue(tokenExpiringInMs(30 * MINUTE));
      const TokenRefresher = await loadTokenRefresher();

      TokenRefresher.getInstance(vi.fn(async () => credentials('t')));
      await vi.advanceTimersByTimeAsync(0);

      expect(mockDebug.auth).toHaveBeenCalledWith('Current token expires in 30 minutes');
    });

    it('warns rather than throwing when the stored token is not a decodable JWT', async () => {
      mockAuthStorage.getAuthToken.mockReturnValue('not-a-jwt');
      const TokenRefresher = await loadTokenRefresher();

      expect(() => TokenRefresher.getInstance(vi.fn(async () => credentials('t')))).not.toThrow();
      expect(mockDebug.warn).toHaveBeenCalledWith(
        'TokenRefresher started but current token has invalid expiry'
      );
    });

    it('is a singleton: a second getInstance keeps the first refresh function', async () => {
      const TokenRefresher = await loadTokenRefresher();
      const first = vi.fn(async () => credentials(tokenExpiringInMs(60 * MINUTE)));
      const second = vi.fn(async () => credentials(tokenExpiringInMs(60 * MINUTE)));

      const a = TokenRefresher.getInstance(first);
      const b = TokenRefresher.getInstance(second);
      expect(b).toBe(a);

      a.start(tokenExpiringInMs(-1));
      await vi.advanceTimersByTimeAsync(0);

      expect(first).toHaveBeenCalledTimes(1);
      expect(second).not.toHaveBeenCalled();
    });
  });

  describe('start(token)', () => {
    it('rejects a token whose expiry cannot be read', async () => {
      const TokenRefresher = await loadTokenRefresher();
      const refresher = TokenRefresher.getInstance(vi.fn(async () => credentials('t')));

      expect(() => refresher.start('garbage')).toThrow(
        'Invalid token: Unable to determine expiry time.'
      );
    });

    it('rejects a JWT whose payload has no numeric exp', async () => {
      const TokenRefresher = await loadTokenRefresher();
      const refresher = TokenRefresher.getInstance(vi.fn(async () => credentials('t')));

      expect(() => refresher.start(jwt({ sub: 'user-1' }))).toThrow(
        'Invalid token: Unable to determine expiry time.'
      );
    });

    it('schedules the refresh for refreshWindow before expiry rather than running it now', async () => {
      const TokenRefresher = await loadTokenRefresher();
      const refresh = vi.fn(async () => credentials(tokenExpiringInMs(60 * MINUTE)));
      const refresher = TokenRefresher.getInstance(refresh, 5 * MINUTE);

      refresher.start(tokenExpiringInMs(60 * MINUTE));
      await vi.advanceTimersByTimeAsync(0);
      expect(refresh).not.toHaveBeenCalled();

      // just short of (expiry - window); the margin absorbs the second-
      // resolution rounding in the JWT `exp` claim
      await vi.advanceTimersByTimeAsync(55 * MINUTE - 5000);
      expect(refresh).not.toHaveBeenCalled();

      await vi.advanceTimersByTimeAsync(5000);
      expect(refresh).toHaveBeenCalledTimes(1);

      refresher.cancel();
    });

    it('refreshes immediately for a token that is already expired', async () => {
      const TokenRefresher = await loadTokenRefresher();
      const refresh = vi.fn(async () => credentials(tokenExpiringInMs(60 * MINUTE)));
      const refresher = TokenRefresher.getInstance(refresh, 5 * MINUTE);

      refresher.start(tokenExpiringInMs(-10 * MINUTE));
      await vi.advanceTimersByTimeAsync(0);

      expect(refresh).toHaveBeenCalledTimes(1);
      refresher.cancel();
    });

    it('refreshes immediately for a token expiring inside the refresh window', async () => {
      const TokenRefresher = await loadTokenRefresher();
      const refresh = vi.fn(async () => credentials(tokenExpiringInMs(60 * MINUTE)));
      const refresher = TokenRefresher.getInstance(refresh, 5 * MINUTE);

      // 2 minutes left, window is 5 -> refreshTime is negative
      refresher.start(tokenExpiringInMs(2 * MINUTE));
      await vi.advanceTimersByTimeAsync(0);

      expect(refresh).toHaveBeenCalledTimes(1);
      refresher.cancel();
    });

    it('replaces a pending timer instead of stacking a second one', async () => {
      const TokenRefresher = await loadTokenRefresher();
      const refresh = vi.fn(async () => credentials(tokenExpiringInMs(120 * MINUTE)));
      const refresher = TokenRefresher.getInstance(refresh, 5 * MINUTE);

      refresher.start(tokenExpiringInMs(60 * MINUTE));
      refresher.start(tokenExpiringInMs(90 * MINUTE));

      await vi.advanceTimersByTimeAsync(56 * MINUTE);
      expect(refresh).not.toHaveBeenCalled(); // the first timer was cancelled

      await vi.advanceTimersByTimeAsync(30 * MINUTE);
      expect(refresh).toHaveBeenCalledTimes(1);

      refresher.cancel();
    });
  });

  describe('startWithExpiry(timestamp)', () => {
    it('schedules from a bare expiry timestamp, no token needed', async () => {
      const TokenRefresher = await loadTokenRefresher();
      const refresh = vi.fn(async () => credentials(tokenExpiringInMs(120 * MINUTE)));
      const refresher = TokenRefresher.getInstance(refresh, 5 * MINUTE);

      refresher.startWithExpiry(Date.now() + 60 * MINUTE);
      await vi.advanceTimersByTimeAsync(54 * MINUTE);
      expect(refresh).not.toHaveBeenCalled();

      await vi.advanceTimersByTimeAsync(1 * MINUTE);
      expect(refresh).toHaveBeenCalledTimes(1);

      refresher.cancel();
    });

    it('refreshes immediately for an expiry already in the past', async () => {
      const TokenRefresher = await loadTokenRefresher();
      const refresh = vi.fn(async () => credentials(tokenExpiringInMs(120 * MINUTE)));
      const refresher = TokenRefresher.getInstance(refresh, 5 * MINUTE);

      refresher.startWithExpiry(Date.now() - 1);
      await vi.advanceTimersByTimeAsync(0);

      expect(refresh).toHaveBeenCalledTimes(1);
      refresher.cancel();
    });
  });

  describe('cancel()', () => {
    it('stops a scheduled refresh from ever firing', async () => {
      const TokenRefresher = await loadTokenRefresher();
      const refresh = vi.fn(async () => credentials(tokenExpiringInMs(120 * MINUTE)));
      const refresher = TokenRefresher.getInstance(refresh, 5 * MINUTE);

      refresher.start(tokenExpiringInMs(60 * MINUTE));
      refresher.cancel();

      await vi.advanceTimersByTimeAsync(120 * MINUTE);
      expect(refresh).not.toHaveBeenCalled();
    });

    it('is safe to call with nothing scheduled', async () => {
      const TokenRefresher = await loadTokenRefresher();
      const refresher = TokenRefresher.getInstance(vi.fn(async () => credentials('t')));

      expect(() => {
        refresher.cancel();
        refresher.cancel();
      }).not.toThrow();
    });
  });

  describe('refresh outcome', () => {
    it('marks the session logged in and reschedules from the new token on success', async () => {
      const TokenRefresher = await loadTokenRefresher();
      const refresh = vi
        .fn<() => Promise<SigninResult>>()
        .mockResolvedValueOnce(credentials(tokenExpiringInMs(60 * MINUTE)))
        .mockResolvedValue(credentials(tokenExpiringInMs(120 * MINUTE)));
      const refresher = TokenRefresher.getInstance(refresh, 5 * MINUTE);

      refresher.start(tokenExpiringInMs(-1)); // refresh right away
      await vi.advanceTimersByTimeAsync(0);

      expect(refresh).toHaveBeenCalledTimes(1);
      expect(mockLoggedInStore.setLoggedIn).toHaveBeenCalledTimes(1);

      // the new token has 60 minutes on it, so the next refresh is 55 out
      await vi.advanceTimersByTimeAsync(55 * MINUTE);
      expect(refresh).toHaveBeenCalledTimes(2);

      refresher.cancel();
    });

    it('swallows a rejected refresh: no throw, no login state change, no retry', async () => {
      const TokenRefresher = await loadTokenRefresher();
      const refresh = vi.fn(async () => {
        throw new Error('network down');
      });
      const refresher = TokenRefresher.getInstance(refresh as never, 5 * MINUTE);

      refresher.start(tokenExpiringInMs(-1));
      await vi.advanceTimersByTimeAsync(0);

      expect(mockDebug.error).toHaveBeenCalledWith(
        'Failed to refresh token:',
        expect.objectContaining({ message: 'network down' })
      );
      expect(mockLoggedInStore.setLoggedIn).not.toHaveBeenCalled();

      // nothing is rescheduled after a failure
      await vi.advanceTimersByTimeAsync(6 * 60 * MINUTE);
      expect(refresh).toHaveBeenCalledTimes(1);

      refresher.cancel();
    });

    it('treats a 200 that carries no token as a failure', async () => {
      const TokenRefresher = await loadTokenRefresher();
      const refresh = vi.fn(async () => credentials(null));
      const refresher = TokenRefresher.getInstance(refresh, 5 * MINUTE);

      refresher.start(tokenExpiringInMs(-1));
      await vi.advanceTimersByTimeAsync(0);

      expect(mockLoggedInStore.setLoggedIn).not.toHaveBeenCalled();
      expect(mockDebug.error).toHaveBeenCalledWith(
        'Failed to refresh token:',
        expect.objectContaining({ message: 'Token refresh succeeded but no token received' })
      );

      refresher.cancel();
    });

    it('does not fail when the refreshed token itself is undecodable', async () => {
      // start() throws on an invalid token; refreshToken() calls it inside its
      // own try, so the throw is contained and the app keeps running.
      const TokenRefresher = await loadTokenRefresher();
      const refresh = vi.fn(async () => credentials('not-a-jwt'));
      const refresher = TokenRefresher.getInstance(refresh, 5 * MINUTE);

      refresher.start(tokenExpiringInMs(-1));
      await vi.advanceTimersByTimeAsync(0);

      // the store update happens before the reschedule, so it still lands, and
      // the throw from start() is caught by refreshToken()'s own try/catch
      expect(mockLoggedInStore.setLoggedIn).toHaveBeenCalledTimes(1);
      expect(mockDebug.error).toHaveBeenCalledWith(
        'Failed to refresh token:',
        expect.objectContaining({ message: 'Invalid token: Unable to determine expiry time.' })
      );
      refresher.cancel();
    });

    it('reports a missing refresh function instead of throwing past the caller', async () => {
      const TokenRefresher = await loadTokenRefresher();
      const refresher = TokenRefresher.getInstance(undefined as never, 5 * MINUTE);

      refresher.start(tokenExpiringInMs(-1));
      await vi.advanceTimersByTimeAsync(0);

      expect(mockDebug.error).toHaveBeenCalledWith(
        'Failed to refresh token:',
        expect.objectContaining({ message: 'No refresh function provided.' })
      );
      refresher.cancel();
    });

    it('contains a throwing auth store rather than losing the refresh', async () => {
      mockLoggedInStore.setLoggedIn.mockImplementationOnce(() => {
        throw new Error('store blew up');
      });
      const TokenRefresher = await loadTokenRefresher();
      const refresh = vi.fn(async () => credentials(tokenExpiringInMs(60 * MINUTE)));
      const refresher = TokenRefresher.getInstance(refresh, 5 * MINUTE);

      refresher.start(tokenExpiringInMs(-1));
      await vi.advanceTimersByTimeAsync(0);

      expect(mockDebug.error).toHaveBeenCalledWith(
        'Failed to handle token refresh:',
        expect.objectContaining({ message: 'store blew up' })
      );
      // the reschedule still happens: the store failure is not fatal
      await vi.advanceTimersByTimeAsync(55 * MINUTE);
      expect(refresh).toHaveBeenCalledTimes(2);
      refresher.cancel();
    });

    it('de-duplicates overlapping triggers onto the one in-flight refresh', async () => {
      // A second trigger arriving while the first request is still open used to
      // send its own. Wasted at best, and a rotation race at worst: two
      // refreshes against a rotating refresh token, where the response that
      // lands second may already have been invalidated by the first.
      const TokenRefresher = await loadTokenRefresher();
      let release: (value: SigninResult) => void = () => {};
      const pending = new Promise<SigninResult>((resolve) => {
        release = resolve;
      });
      const refresh = vi.fn(() => pending);
      const refresher = TokenRefresher.getInstance(refresh, 5 * MINUTE);

      refresher.start(tokenExpiringInMs(-1));
      refresher.start(tokenExpiringInMs(-1));
      await vi.advanceTimersByTimeAsync(0);

      expect(refresh).toHaveBeenCalledTimes(1);

      // The joined caller gets the real outcome, not a no-op: the store is
      // marked logged in exactly once, when the single request lands.
      release(credentials(tokenExpiringInMs(60 * MINUTE)));
      await vi.advanceTimersByTimeAsync(0);
      expect(mockLoggedInStore.setLoggedIn).toHaveBeenCalledTimes(1);

      refresher.cancel();
    });

    it('releases the in-flight slot so the next trigger refreshes for real', async () => {
      // De-duplication must not become a permanent lock: once a refresh has
      // settled, a later trigger has to reach the endpoint again.
      const TokenRefresher = await loadTokenRefresher();
      const refresh = vi.fn(async () => credentials(tokenExpiringInMs(60 * MINUTE)));
      const refresher = TokenRefresher.getInstance(refresh, 5 * MINUTE);

      refresher.start(tokenExpiringInMs(-1));
      await vi.advanceTimersByTimeAsync(0);
      expect(refresh).toHaveBeenCalledTimes(1);

      refresher.start(tokenExpiringInMs(-1));
      await vi.advanceTimersByTimeAsync(0);
      expect(refresh).toHaveBeenCalledTimes(2);

      refresher.cancel();
    });

    it('releases the slot after a failed refresh too, so a retry is still possible', async () => {
      const TokenRefresher = await loadTokenRefresher();
      const refresh = vi
        .fn<() => Promise<SigninResult>>()
        .mockRejectedValueOnce(new Error('network down'))
        .mockResolvedValue(credentials(tokenExpiringInMs(60 * MINUTE)));
      const refresher = TokenRefresher.getInstance(refresh, 5 * MINUTE);

      refresher.start(tokenExpiringInMs(-1));
      await vi.advanceTimersByTimeAsync(0);
      expect(refresh).toHaveBeenCalledTimes(1);

      refresher.start(tokenExpiringInMs(-1));
      await vi.advanceTimersByTimeAsync(0);
      expect(refresh).toHaveBeenCalledTimes(2);
      expect(mockLoggedInStore.setLoggedIn).toHaveBeenCalledTimes(1);

      refresher.cancel();
    });

    it('lets a refreshed-but-already-stale token refresh again immediately', async () => {
      // The slot is released before the reschedule, so a server that hands back
      // a token already inside the refresh window does not deadlock the
      // refresher against the call that just returned it.
      const TokenRefresher = await loadTokenRefresher();
      const refresh = vi
        .fn<() => Promise<SigninResult>>()
        .mockResolvedValueOnce(credentials(tokenExpiringInMs(1 * MINUTE)))
        .mockResolvedValue(credentials(tokenExpiringInMs(60 * MINUTE)));
      const refresher = TokenRefresher.getInstance(refresh, 5 * MINUTE);

      refresher.start(tokenExpiringInMs(-1));
      await vi.advanceTimersByTimeAsync(0);

      expect(refresh).toHaveBeenCalledTimes(2);
      refresher.cancel();
    });
  });
});
