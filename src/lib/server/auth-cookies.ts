// Single source of truth for the auth cookie names and attributes.
// The names/attributes here MUST match what the gateway and
// ssr-token-refresh set, or logout/refresh silently stop working.
//
// The name literals themselves live in `$lib/utils/auth-cookie-names`, which
// both client and server code may import — SvelteKit will not bundle anything
// under `$lib/server` into the client, and `AuthStorage` (which reads the same
// names) runs on both sides. They are re-exported here so this module's public
// API is unchanged.

export {
  AUTH_COOKIE_NAMES,
  LEGACY_AUTH_COOKIE_NAMES,
  ACCESS_TOKEN_COOKIE_NAMES,
  REFRESH_TOKEN_COOKIE_NAMES
} from '$lib/utils/auth-cookie-names';

import { AUTH_COOKIE_NAMES, LEGACY_AUTH_COOKIE_NAMES } from '$lib/utils/auth-cookie-names';

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
