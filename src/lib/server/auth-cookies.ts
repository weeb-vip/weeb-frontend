// Single source of truth for the auth cookie names and attributes.
// The names/attributes here MUST match what the gateway and
// ssr-token-refresh set, or logout/refresh silently stop working.

export const AUTH_COOKIE_NAMES = ['auth_token', 'access_token', 'refresh_token'] as const;

// Legacy names from the pre-migration era; cleared on logout for hygiene
export const LEGACY_AUTH_COOKIE_NAMES = ['authToken', 'refreshToken', 'session', 'auth', 'user'] as const;

export function authCookieDomain(): string | undefined {
  // Dot-prefixed domain in production (works across subdomains);
  // undefined = current host only (localhost/dev)
  return import.meta.env.PROD ? '.weeb.vip' : undefined;
}

export function clearAuthCookies(cookies: import('@sveltejs/kit').Cookies) {
  const domain = authCookieDomain();

  for (const name of [...AUTH_COOKIE_NAMES, ...LEGACY_AUTH_COOKIE_NAMES]) {
    // Delete both with and without the domain attribute — a cookie can
    // only be removed with the same domain scope it was set with, and
    // both variants have existed historically
    cookies.delete(name, { path: '/' });
    if (domain) {
      cookies.delete(name, { path: '/', domain });
    }
  }
}
