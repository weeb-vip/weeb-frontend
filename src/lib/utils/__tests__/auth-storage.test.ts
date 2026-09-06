/**
 * `AuthStorage` is the one place the app decides "is this request
 * authenticated, and with which token" — on the client from `document.cookie`
 * and `localStorage`, and on the server from the raw `Cookie:` header string.
 * So the assertions here are about the *stored shape* and about precedence
 * between the several names the same token has worn over time, not about
 * whether a function was called.
 *
 * jsdom supplies real `document.cookie` and a real `localStorage`, so nothing
 * here is faked away except:
 *   - `window.location`, redefined for the one case that must not be localhost
 *     (jsdom always serves `http://localhost:3000/`);
 *   - the module's own `console.log` chatter, silenced so a failure is legible.
 * Neither hides behaviour: what is asserted is read back out of the real
 * storage afterwards.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthStorage } from '$lib/utils/auth-storage';

/** jsdom keeps cookies for the whole file, so wipe them between tests. */
function clearCookies(): void {
  for (const pair of document.cookie.split(';')) {
    const name = pair.split('=')[0]?.trim();
    if (name) document.cookie = `${name}=; Path=/; Expires=Thu, 01 Jan 1970 00:00:00 GMT`;
  }
}

let logSpy: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  clearCookies();
  localStorage.clear();
  logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
});

afterEach(() => {
  logSpy.mockRestore();
  clearCookies();
  localStorage.clear();
  vi.useRealTimers();
});

describe('server-side cookie-string parsing', () => {
  it('reads the auth token out of a real Cookie header', () => {
    expect(AuthStorage.getTokenFromCookieString('auth_token=abc123')).toBe('abc123');
  });

  it('prefers auth_token, then access_token, then the legacy authToken', () => {
    const all = 'authToken=legacy; access_token=access; auth_token=canonical';
    expect(AuthStorage.getTokenFromCookieString(all)).toBe('canonical');
    expect(AuthStorage.getTokenFromCookieString('authToken=legacy; access_token=access')).toBe(
      'access'
    );
    expect(AuthStorage.getTokenFromCookieString('authToken=legacy')).toBe('legacy');
  });

  it('matches on a whole cookie name, not a suffix of one', () => {
    // The reason `cookieFromString` anchors on `^` or `; `: a cookie called
    // `guest_access_token` must never be served up as the access token.
    expect(AuthStorage.getTokenFromCookieString('guest_access_token=not-mine')).toBeUndefined();
    expect(AuthStorage.getTokenFromCookieString('xauth_token=not-mine')).toBeUndefined();
  });

  it('finds a token that is neither first nor last in the header', () => {
    expect(
      AuthStorage.getTokenFromCookieString('theme=dark; auth_token=abc; locale=en')
    ).toBe('abc');
  });

  it('percent-decodes the stored value', () => {
    expect(AuthStorage.getTokenFromCookieString('auth_token=a%20b%2Bc')).toBe('a b+c');
  });

  it('returns undefined for an absent, empty or valueless cookie', () => {
    expect(AuthStorage.getTokenFromCookieString(undefined)).toBeUndefined();
    expect(AuthStorage.getTokenFromCookieString('')).toBeUndefined();
    expect(AuthStorage.getTokenFromCookieString('theme=dark')).toBeUndefined();
    // `([^;]+)` needs at least one character, so a cleared cookie reads as absent
    // rather than as the empty-string token.
    expect(AuthStorage.getTokenFromCookieString('auth_token=')).toBeUndefined();
  });

  it('is unbothered by a header that is not cookie-shaped at all', () => {
    expect(AuthStorage.getTokenFromCookieString('nonsense')).toBeUndefined();
    expect(AuthStorage.getTokenFromCookieString(';;;')).toBeUndefined();
  });

  it('returns both tokens, each with its own name precedence', () => {
    expect(
      AuthStorage.getTokensFromCookieString('access_token=a; refresh_token=r')
    ).toEqual({ authToken: 'a', refreshToken: 'r' });

    expect(
      AuthStorage.getTokensFromCookieString('authToken=a; refreshToken=r')
    ).toEqual({ authToken: 'a', refreshToken: 'r' });

    expect(
      AuthStorage.getTokensFromCookieString('refresh_token=canonical; refreshToken=legacy')
    ).toEqual({ authToken: undefined, refreshToken: 'canonical' });
  });

  it('returns an empty object, not a pair of undefineds, for no header', () => {
    expect(AuthStorage.getTokensFromCookieString(undefined)).toEqual({});
  });

  it('counts either token as logged in, and neither as logged out', () => {
    expect(AuthStorage.isLoggedInFromCookieString('auth_token=a')).toBe(true);
    expect(AuthStorage.isLoggedInFromCookieString('refresh_token=r')).toBe(true);
    expect(AuthStorage.isLoggedInFromCookieString('theme=dark')).toBe(false);
    expect(AuthStorage.isLoggedInFromCookieString('')).toBe(false);
    expect(AuthStorage.isLoggedInFromCookieString(undefined)).toBe(false);
  });

  /*
   * FIXED (was: `decodeURIComponent` threw `URIError` straight out of
   * `getTokenFromCookieString`, on the server, for every request, on an
   * attacker-supplied header that no caller guarded — `Cookie:
   * auth_token=%E0%A4%A` was the whole exploit).
   *
   * The answer chosen is *absent*, not the raw bytes: everything the app issues
   * is a base64url JWT and contains no `%` at all, so an undecodable value
   * cannot be a token. Reporting it as one would advertise a session that
   * cannot authenticate — and would let a visitor make their own response
   * uncacheable with a junk cookie.
   */
  it('survives a malformed percent-escape instead of throwing', () => {
    expect(() => AuthStorage.getTokenFromCookieString('auth_token=%E0%A4%A')).not.toThrow();
    expect(AuthStorage.getTokenFromCookieString('auth_token=%E0%A4%A')).toBeUndefined();
  });

  it.each([
    ['a truncated escape', 'auth_token=%E0%A4%A'],
    ['a lone percent', 'auth_token=%'],
    ['a percent followed by non-hex', 'auth_token=%ZZ'],
    ['a stray high surrogate byte', 'auth_token=%C3%28']
  ])('treats %s as no token at all', (_label, cookie) => {
    expect(AuthStorage.getTokenFromCookieString(cookie)).toBeUndefined();
    expect(AuthStorage.getTokensFromCookieString(cookie)).toEqual({
      authToken: undefined,
      refreshToken: undefined
    });
    expect(AuthStorage.isLoggedInFromCookieString(cookie)).toBe(false);
  });

  it('reads a malformed refresh cookie as absent too, not as a session', () => {
    expect(AuthStorage.getTokensFromCookieString('refresh_token=%E0%A4%A')).toEqual({
      authToken: undefined,
      refreshToken: undefined
    });
    expect(AuthStorage.isLoggedInFromCookieString('refresh_token=%E0%A4%A')).toBe(false);
  });

  it('falls through to the next name when the preferred one will not decode', () => {
    // "Absent" is meant literally: a junk `auth_token` must not shadow a
    // perfectly good `access_token` behind it.
    expect(
      AuthStorage.getTokenFromCookieString('auth_token=%E0%A4%A; access_token=good')
    ).toBe('good');
    expect(
      AuthStorage.getTokensFromCookieString('refresh_token=%; refreshToken=legacy-ok')
    ).toEqual({ authToken: undefined, refreshToken: 'legacy-ok' });
  });

  it('is unbothered by a malformed escape on a cookie it does not care about', () => {
    expect(AuthStorage.getTokenFromCookieString('theme=%E0%A4%A; auth_token=fine')).toBe('fine');
  });
});

describe('client-side cookie reads', () => {
  it('reads the auth token from document.cookie', () => {
    document.cookie = 'authToken=from-cookie; Path=/';
    expect(AuthStorage.getAuthToken()).toBe('from-cookie');
  });

  it('returns null when no auth cookie is set', () => {
    expect(AuthStorage.getAuthToken()).toBeNull();
  });

  it('ignores a cookie whose name merely ends with the one it wants', () => {
    document.cookie = 'notauthToken=someone-elses; Path=/';
    expect(AuthStorage.getAuthToken()).toBeNull();
  });

  it('skips the space after a "; " separator when matching', () => {
    document.cookie = 'theme=dark; Path=/';
    document.cookie = 'authToken=second-in-line; Path=/';
    expect(AuthStorage.getAuthToken()).toBe('second-in-line');
  });

  it('prefers the refresh-token cookie over the localStorage fallback', () => {
    document.cookie = 'refreshToken=from-cookie; Path=/';
    localStorage.setItem('refreshToken', 'from-storage');
    expect(AuthStorage.getRefreshToken()).toBe('from-cookie');
  });

  it('falls back to localStorage when the cookie is gone', () => {
    localStorage.setItem('refreshToken', 'from-storage');
    expect(AuthStorage.getRefreshToken()).toBe('from-storage');
  });

  it('returns null when neither source has a refresh token', () => {
    expect(AuthStorage.getRefreshToken()).toBeNull();
  });

  it('is logged in on either cookie alone, logged out on neither', () => {
    expect(AuthStorage.isLoggedIn()).toBe(false);
    document.cookie = 'authToken=a; Path=/';
    expect(AuthStorage.isLoggedIn()).toBe(true);
    clearCookies();
    document.cookie = 'refreshToken=r; Path=/';
    expect(AuthStorage.isLoggedIn()).toBe(true);
  });

  it('does not treat a localStorage-only refresh token as being logged in', () => {
    // isLoggedIn() reads cookies only; the localStorage copy exists to feed a
    // refresh attempt, not to stand in for a session.
    localStorage.setItem('refreshToken', 'from-storage');
    expect(AuthStorage.isLoggedIn()).toBe(false);
  });
});

describe('when the cookie jar itself throws', () => {
  /**
   * A `document.cookie` getter that throws stands in for the environments where
   * reading cookies is blocked outright (a sandboxed iframe with no
   * allow-same-origin, some privacy modes). Every read must degrade to "not
   * logged in" rather than take the page down.
   */
  function withBrokenCookieJar(run: () => void): void {
    const descriptor = Object.getOwnPropertyDescriptor(Document.prototype, 'cookie')!;
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    Object.defineProperty(document, 'cookie', {
      configurable: true,
      get() {
        throw new DOMException('SecurityError');
      },
      set: descriptor.set
    });

    try {
      run();
    } finally {
      delete (document as unknown as Record<string, unknown>).cookie;
      errorSpy.mockRestore();
    }
  }

  it('reads no auth token', () => {
    withBrokenCookieJar(() => {
      expect(AuthStorage.getAuthToken()).toBeNull();
    });
  });

  it('reads no refresh token, not even the localStorage fallback', () => {
    localStorage.setItem('refreshToken', 'from-storage');
    withBrokenCookieJar(() => {
      // The fallback lives inside the same try, so a throwing jar loses it too.
      expect(AuthStorage.getRefreshToken()).toBeNull();
    });
  });

  it('reports logged out', () => {
    withBrokenCookieJar(() => {
      expect(AuthStorage.isLoggedIn()).toBe(false);
    });
  });
});

describe('refresh token in localStorage', () => {
  it('round-trips under the "refreshToken" key', () => {
    AuthStorage.setRefreshTokenLocalStorage('r-1');
    expect(localStorage.getItem('refreshToken')).toBe('r-1');
    expect(AuthStorage.getRefreshTokenLocalStorage()).toBe('r-1');
  });

  it('reads null when nothing was stored', () => {
    expect(AuthStorage.getRefreshTokenLocalStorage()).toBeNull();
  });

  it('clears the key outright', () => {
    localStorage.setItem('refreshToken', 'r-1');
    AuthStorage.clearRefreshTokenLocalStorage();
    expect(localStorage.getItem('refreshToken')).toBeNull();
  });

  it('swallows a storage that throws, as private browsing does', () => {
    const setItem = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('QuotaExceededError');
    });
    const getItem = vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new DOMException('SecurityError');
    });
    const removeItem = vi.spyOn(Storage.prototype, 'removeItem').mockImplementation(() => {
      throw new DOMException('SecurityError');
    });
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    try {
      expect(() => AuthStorage.setRefreshTokenLocalStorage('r')).not.toThrow();
      expect(AuthStorage.getRefreshTokenLocalStorage()).toBeNull();
      expect(() => AuthStorage.clearRefreshTokenLocalStorage()).not.toThrow();
      // The cookie path is untouched by a broken localStorage.
      expect(AuthStorage.getRefreshToken()).toBeNull();
    } finally {
      setItem.mockRestore();
      getItem.mockRestore();
      removeItem.mockRestore();
      errorSpy.mockRestore();
    }
  });
});

describe('clearTokens / logout', () => {
  it('clearTokens deliberately preserves the localStorage refresh token', () => {
    // The comment in the source is load-bearing: an auth *error* must not
    // destroy the token that a silent refresh would recover the session with.
    localStorage.setItem('refreshToken', 'r-1');
    AuthStorage.clearTokens();
    expect(localStorage.getItem('refreshToken')).toBe('r-1');
  });

  it('logout does clear the localStorage refresh token', () => {
    localStorage.setItem('refreshToken', 'r-1');
    AuthStorage.logout();
    expect(localStorage.getItem('refreshToken')).toBeNull();
  });

  it('neither can clear the HttpOnly cookies — that is the server’s job', () => {
    // Asserted so the "logout clears everything" assumption cannot creep back
    // in: whatever the server set stays set until the server unsets it.
    document.cookie = 'authToken=still-here; Path=/';
    AuthStorage.clearTokens();
    AuthStorage.logout();
    expect(AuthStorage.getAuthToken()).toBe('still-here');
  });
});

describe('setTokensForLocalhost', () => {
  // The verification read is a `setTimeout(..., 100)` per cookie; fake timers
  // keep those from outliving the test.
  beforeEach(() => {
    vi.useFakeTimers();
  });

  it('writes both the canonical and legacy names for each token', () => {
    AuthStorage.setTokensForLocalhost('access-1', 'refresh-1');

    expect(document.cookie).toContain('access_token=access-1');
    expect(document.cookie).toContain('authToken=access-1');
    expect(document.cookie).toContain('refresh_token=refresh-1');
    expect(document.cookie).toContain('refreshToken=refresh-1');

    // And the accessors agree with what actually landed in the jar.
    expect(AuthStorage.getAuthToken()).toBe('access-1');
    expect(AuthStorage.getRefreshToken()).toBe('refresh-1');
    expect(AuthStorage.isLoggedIn()).toBe(true);

    vi.runAllTimers();
  });

  it('sets only the access cookies when no refresh token is supplied', () => {
    AuthStorage.setTokensForLocalhost('access-only');
    expect(AuthStorage.getAuthToken()).toBe('access-only');
    expect(document.cookie).not.toContain('refresh_token=');
    vi.runAllTimers();
  });

  it('writes nothing at all when the token is empty', () => {
    AuthStorage.setTokensForLocalhost('');
    expect(document.cookie).toBe('');
    vi.runAllTimers();
  });

  it('emits a Path and a SameSite on every cookie it writes', () => {
    // jsdom exposes only `name=value` through `document.cookie`, so the
    // attributes are checked on the string handed to the setter instead.
    const written: string[] = [];
    const descriptor = Object.getOwnPropertyDescriptor(Document.prototype, 'cookie')!;
    Object.defineProperty(document, 'cookie', {
      configurable: true,
      get: () => descriptor.get!.call(document),
      set: (value: string) => {
        written.push(value);
        descriptor.set!.call(document, value);
      }
    });

    try {
      AuthStorage.setTokensForLocalhost('a', 'r');
    } finally {
      delete (document as unknown as Record<string, unknown>).cookie;
    }

    expect(written).toHaveLength(4);
    for (const value of written) {
      expect(value).toContain('; Path=/');
      expect(value).toContain('; SameSite=Lax');
    }
    // 24h for the access token, 7d for the refresh token.
    expect(written[0]).toContain('Max-Age=86400');
    expect(written[2]).toContain('Max-Age=604800');
    // Not `Secure`: these exist only so http://localhost can hold a session.
    expect(written.some((value) => value.includes('Secure'))).toBe(false);

    vi.runAllTimers();
  });

  it('refuses to write cookies off localhost', () => {
    const original = Object.getOwnPropertyDescriptor(window, 'location')!;
    Object.defineProperty(window, 'location', {
      configurable: true,
      value: { ...window.location, hostname: 'weeb.vip', href: 'https://weeb.vip/' }
    });

    try {
      AuthStorage.setTokensForLocalhost('a', 'r');
      expect(document.cookie).toBe('');
    } finally {
      Object.defineProperty(window, 'location', original);
    }

    vi.runAllTimers();
  });

  it('treats 127.0.0.1 as localhost too', () => {
    const original = Object.getOwnPropertyDescriptor(window, 'location')!;
    Object.defineProperty(window, 'location', {
      configurable: true,
      value: { ...window.location, hostname: '127.0.0.1' }
    });

    try {
      AuthStorage.setTokensForLocalhost('a');
      expect(AuthStorage.getAuthToken()).toBe('a');
    } finally {
      Object.defineProperty(window, 'location', original);
    }

    vi.runAllTimers();
  });
});
