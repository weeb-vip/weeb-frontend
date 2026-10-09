/**
 * Queries as GET requests by hash, so the CDN can cache them.
 *
 * graphql-request sends every operation as `POST /graphql` with the whole
 * document in the body, and no CDN caches a POST. This wraps the `fetch` it is
 * given: a `query` operation goes out as
 * `GET /graphql?operationName=…&variables=…&extensions={"persistedQuery":
 * {"version":1,"sha256Hash":…}}` -- the automatic persisted queries protocol
 * the Cosmo router speaks -- which gives it a URL. Cloudflare caches that URL
 * for anonymous visitors (the gateway proxy marks those responses cacheable
 * and a cache rule bypasses when the auth cookie is present); a signed-in
 * visitor's GET goes to origin as before. Mutations stay POST, untouched.
 *
 * The first time a router replica sees a hash it answers PersistedQueryNotFound
 * and the wrapper registers the text with one POST carrying hash and query,
 * returning that answer; every later GET is by hash alone. A router without
 * the feature answers PersistedQueryNotSupported, after which the wrapper
 * stops trying for the life of the process so nothing pays a double round
 * trip, and plain POST goes on as before.
 */

type Fetch = typeof fetch;

export interface PersistedFetchOptions {
  /** Off: the wrapper is a no-op. Default on. */
  enabled?: boolean;
  /** sha256 hex of a document; the default uses Web Crypto. */
  hash?: (document: string) => Promise<string>;
}

interface GraphQLBody {
  query?: string;
  variables?: unknown;
  operationName?: string;
}

/** The operation type a document opens with, or null when unreadable. */
export function operationType(document: string): 'query' | 'mutation' | 'subscription' | null {
  const stripped = document.replace(/#[^\n]*/g, '').trimStart();
  if (stripped.startsWith('{')) return 'query';
  const m = /^(query|mutation|subscription)\b/.exec(stripped);
  return m ? (m[1] as 'query' | 'mutation' | 'subscription') : null;
}

const hashes = new Map<string, string>();

export async function sha256Hex(text: string): Promise<string> {
  const cached = hashes.get(text);
  if (cached) return cached;
  const subtle = globalThis.crypto?.subtle;
  if (!subtle) throw new Error('Web Crypto is not available');
  const digest = await subtle.digest('SHA-256', new TextEncoder().encode(text));
  const hex = Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, '0')).join('');
  hashes.set(text, hex);
  return hex;
}

function errorCodes(payload: any): string[] {
  const errors = Array.isArray(payload?.errors) ? payload.errors : [];
  return errors.map((e: any) => `${e?.extensions?.code ?? ''} ${e?.message ?? ''}`);
}

const notFound = (codes: string[]) => codes.some((c) => /PERSISTED_QUERY_NOT_FOUND|PersistedQueryNotFound/i.test(c));
const notSupported = (codes: string[]) => codes.some((c) => /PERSISTED_QUERY_NOT_SUPPORTED|PersistedQueryNotSupported/i.test(c));

function withoutContentType(headers: HeadersInit | undefined): Headers {
  const h = new Headers(headers);
  h.delete('content-type');
  return h;
}

/** Process-wide: once a router says it does not do persisted queries, stop asking. */
let unsupported = false;

/** Test seam. */
export function resetPersistedQueriesForTests(): void {
  unsupported = false;
  hashes.clear();
}

export function withPersistedQueries(fetchImpl: Fetch, options: PersistedFetchOptions = {}): Fetch {
  const enabled = options.enabled ?? true;
  const hash = options.hash ?? sha256Hex;
  if (!enabled) return fetchImpl;

  return async (input, init) => {
    if (unsupported || !init || (init.method ?? 'GET').toUpperCase() !== 'POST' || typeof init.body !== 'string') {
      return fetchImpl(input, init);
    }
    let body: GraphQLBody;
    try {
      body = JSON.parse(init.body);
    } catch {
      return fetchImpl(input, init);
    }
    if (!body.query || operationType(body.query) !== 'query') {
      return fetchImpl(input, init);
    }

    let sha256Hash: string;
    try {
      sha256Hash = await hash(body.query);
    } catch {
      return fetchImpl(input, init);
    }
    const extensions = { persistedQuery: { version: 1, sha256Hash } };
    const url = new URL(typeof input === 'string' ? input : input instanceof URL ? input.href : input.url);
    if (body.operationName) url.searchParams.set('operationName', body.operationName);
    if (body.variables !== undefined) url.searchParams.set('variables', JSON.stringify(body.variables));
    url.searchParams.set('extensions', JSON.stringify(extensions));

    const { body: _omit, method: _m, ...rest } = init;
    const response = await fetchImpl(url.toString(), { ...rest, method: 'GET', headers: withoutContentType(init.headers) });

    // A router that does not take GET at all (405, 400) is treated like one
    // that does not know the protocol: fall back, and stop asking.
    if (response.status === 405 || response.status === 400) {
      unsupported = true;
      return fetchImpl(input, init);
    }
    let payload: any = null;
    try {
      payload = await response.clone().json();
    } catch {
      return response;
    }
    const codes = errorCodes(payload);
    if (notSupported(codes)) {
      unsupported = true;
      return fetchImpl(input, init);
    }
    if (notFound(codes)) {
      // Register the text once; this answer is the real one -- unless the
      // router answers not-found to the registration too, which is a router
      // running without the feature (an old process, a config not yet
      // loaded): then the plain POST it always took, and stop asking.
      const registered = await fetchImpl(input, { ...init, body: JSON.stringify({ ...body, extensions }) });
      let payload: any = null;
      try {
        payload = await registered.clone().json();
      } catch {
        return registered;
      }
      if (notFound(errorCodes(payload)) || notSupported(errorCodes(payload))) {
        unsupported = true;
        return fetchImpl(input, init);
      }
      return registered;
    }
    return response;
  };
}
