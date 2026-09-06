/**
 * @vitest-environment node
 *
 * `AuthStorage` is imported on the server — the request hooks read the auth
 * token out of the `Cookie:` header with it — so every method has to be safe
 * where there is no `document`, no `window` and no `localStorage`. The default
 * jsdom environment supplies all three and would quietly turn each of these
 * cases into an ordinary browser one, which is why this file (and only this
 * file) runs in node.
 *
 * Nothing is stubbed here: the absence *is* the fixture.
 */
import { describe, expect, it, vi } from 'vitest';
import { AuthStorage } from '$lib/utils/auth-storage';

describe('AuthStorage without a DOM', () => {
  it('has no globals to read — this is what makes the rest of the file meaningful', () => {
    expect(typeof document).toBe('undefined');
    expect(typeof window).toBe('undefined');
  });

  it('reports no auth token rather than throwing on document.cookie', () => {
    expect(AuthStorage.getAuthToken()).toBeNull();
  });

  it('reports no refresh token from either source', () => {
    expect(AuthStorage.getRefreshToken()).toBeNull();
    expect(AuthStorage.getRefreshTokenLocalStorage()).toBeNull();
  });

  it('reports logged out', () => {
    expect(AuthStorage.isLoggedIn()).toBe(false);
  });

  it('writes nothing, and does not blow up trying', () => {
    expect(() => AuthStorage.setTokensForLocalhost('a', 'r')).not.toThrow();
    expect(() => AuthStorage.setRefreshTokenLocalStorage('r')).not.toThrow();
    expect(() => AuthStorage.clearRefreshTokenLocalStorage()).not.toThrow();
    expect(() => AuthStorage.clearTokens()).not.toThrow();
    expect(() => AuthStorage.logout()).not.toThrow();
  });

  it('still parses a cookie header, which is the whole point of it on the server', () => {
    const header = 'theme=dark; auth_token=server-side; refresh_token=r';
    expect(AuthStorage.getTokenFromCookieString(header)).toBe('server-side');
    expect(AuthStorage.getTokensFromCookieString(header)).toEqual({
      authToken: 'server-side',
      refreshToken: 'r'
    });
    expect(AuthStorage.isLoggedInFromCookieString(header)).toBe(true);
  });

  it('leaves no timer behind when it declines to set cookies', () => {
    // The browser path schedules a verification read per cookie; the server
    // path must not schedule anything at all.
    vi.useFakeTimers();
    try {
      AuthStorage.setTokensForLocalhost('a', 'r');
      expect(vi.getTimerCount()).toBe(0);
    } finally {
      vi.useRealTimers();
    }
  });
});
