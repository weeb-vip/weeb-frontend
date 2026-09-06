/**
 * The single source of truth for auth cookie *names*.
 *
 * It lives under `$lib/utils` rather than `$lib/server` because both sides of
 * the app have to agree on it: `$lib/server/auth-cookies` clears these names,
 * `$lib/utils/ssr-token-refresh` reads them on the server, and
 * `$lib/utils/auth-storage` reads them on both the server (from the raw
 * `Cookie:` header) and the client (from `document.cookie`). SvelteKit refuses
 * to bundle anything under `$lib/server` into client code, so the literals
 * cannot live there and still be shared — `$lib/server/auth-cookies` re-exports
 * the aggregate lists so its public API is unchanged.
 *
 * The two readers disagreeing about which names count is not hypothetical: it
 * is exactly the bug where a visitor holding only the legacy `refreshToken`
 * cookie was judged refreshable by `AuthStorage` and un-refreshable by
 * `refreshTokenSSR`, and so was signed out on every request forever.
 */

/** Access-token cookie names, most-preferred first. */
export const ACCESS_TOKEN_COOKIE_NAMES = ['auth_token', 'access_token', 'authToken'] as const;

/** Refresh-token cookie names, most-preferred first. */
export const REFRESH_TOKEN_COOKIE_NAMES = ['refresh_token', 'refreshToken'] as const;

/**
 * Pre-migration names that never carried a token themselves but were set
 * alongside one, so they still have to be cleared on logout.
 */
export const LEGACY_SESSION_COOKIE_NAMES = ['session', 'auth', 'user'] as const;

/** camelCase names from the pre-migration era. */
const LEGACY_NAMES = new Set<string>(['authToken', 'refreshToken', ...LEGACY_SESSION_COOKIE_NAMES]);

const ALL_NAMES: readonly string[] = [
  ...ACCESS_TOKEN_COOKIE_NAMES,
  ...REFRESH_TOKEN_COOKIE_NAMES,
  ...LEGACY_SESSION_COOKIE_NAMES
];

/** The names the app writes today. */
export const AUTH_COOKIE_NAMES: readonly string[] = ALL_NAMES.filter((n) => !LEGACY_NAMES.has(n));

/** The names it only ever reads, and clears for hygiene. */
export const LEGACY_AUTH_COOKIE_NAMES: readonly string[] = ALL_NAMES.filter((n) =>
  LEGACY_NAMES.has(n)
);
