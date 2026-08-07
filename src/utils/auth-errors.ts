/**
 * Auth error classification.
 *
 * The gateway federates the auth service, so the useful error is nested two
 * levels down and the top-level message is always the useless
 * "Failed to fetch from Subgraph 'auth-staging'.". The real signal lives at
 * `errors[].extensions.errors[].extensions.code`. Observed codes:
 *
 *   INACTIVE_CREDENTIALS  — account exists but is unverified, OR the account
 *                           doesn't exist at all (deliberately collapsed by the
 *                           backend so login can't be used to enumerate users)
 *   INVALID_CREDENTIALS   — account is verified, password is wrong
 *   DOWNSTREAM_SERVICE_ERROR / "Access denied"
 *                         — a verification token that is expired, malformed, or
 *                           signed by an unknown key. These are NOT
 *                           distinguishable from each other.
 *
 * graphql-request's ClientError also embeds the whole JSON response in its
 * `.message`, so the raw-string fallback below still matches when the
 * structured `response` isn't present (e.g. a re-thrown or serialised error).
 */

/** Collect every GraphQL error code in a response, at any nesting depth. */
function collectCodes(node: any, out: Set<string>, depth = 0): void {
  if (!node || depth > 6) return;

  if (Array.isArray(node)) {
    for (const item of node) collectCodes(item, out, depth + 1);
    return;
  }

  if (typeof node !== 'object') return;

  const code = node?.extensions?.code;
  if (typeof code === 'string') out.add(code.toUpperCase());

  collectCodes(node.errors, out, depth + 1);
  collectCodes(node?.extensions?.errors, out, depth + 1);
}

function codesOf(error: any): Set<string> {
  const codes = new Set<string>();
  collectCodes(error?.response?.errors ?? error?.errors, codes);
  return codes;
}

function messageOf(error: any): string {
  return String(error?.message ?? error ?? '').toLowerCase();
}

/**
 * True when a login failed because the credentials aren't active — in practice,
 * an account whose email has never been verified.
 *
 * Note this also fires for an address that was never registered, because the
 * backend returns the same code for both. Copy at the call site must therefore
 * not assert that the account exists.
 */
export function isUnverifiedEmailError(error: any): boolean {
  if (codesOf(error).has('INACTIVE_CREDENTIALS')) return true;

  const msg = messageOf(error);
  if (!msg) return false;

  return (
    msg.includes('inactive_credentials') ||
    msg.includes('credentials are not active')
  );
}

/**
 * True when a login failed on a verified account with the wrong password.
 * Kept alongside the above so the two cases can never both be true.
 */
export function isInvalidCredentialsError(error: any): boolean {
  if (codesOf(error).has('INVALID_CREDENTIALS')) return true;

  const msg = messageOf(error);
  if (!msg) return false;

  return msg.includes('invalid_credentials') || msg.includes('invalid credentials');
}
