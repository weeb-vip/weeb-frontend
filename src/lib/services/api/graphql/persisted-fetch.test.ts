import { afterEach, describe, expect, it, vi } from 'vitest';
import { operationType, resetPersistedQueriesForTests, sha256Hex, withPersistedQueries } from './persisted-fetch';

const QUERY = 'query getHome($limit: Int) { topRatedAnime(limit: $limit) { id } }';
const URL_ = 'https://gateway.test/graphql';

function post(query: string, variables?: unknown, operationName?: string, headers?: Record<string, string>): RequestInit {
  return {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...headers },
    body: JSON.stringify({ query, variables, operationName }),
    credentials: 'include'
  };
}

const json = (payload: unknown, status = 200) =>
  new Response(JSON.stringify(payload), { status, headers: { 'content-type': 'application/json' } });

afterEach(() => resetPersistedQueriesForTests());

describe('operationType', () => {
  it('reads the operation off the document, comments and whitespace aside', () => {
    expect(operationType(QUERY)).toBe('query');
    expect(operationType('# cached\n  mutation AddAnime { x }')).toBe('mutation');
    expect(operationType('{ __typename }')).toBe('query');
    expect(operationType('subscription S { x }')).toBe('subscription');
    expect(operationType('fragment F on X { id }')).toBeNull();
  });
});

describe('withPersistedQueries', () => {
  it('sends a query as a GET by hash, variables and name in the URL, no body', async () => {
    const inner = vi.fn(async () => json({ data: { ok: true } }));
    const f = withPersistedQueries(inner as any);

    const res = await f(URL_, post(QUERY, { limit: 20 }, 'getHome', { Cookie: 'access_token=x' }));

    expect(inner).toHaveBeenCalledTimes(1);
    const [url, init] = inner.mock.calls[0] as any;
    const u = new URL(url);
    expect(u.origin + u.pathname).toBe(URL_);
    expect(u.searchParams.get('operationName')).toBe('getHome');
    expect(u.searchParams.get('variables')).toBe('{"limit":20}');
    expect(JSON.parse(u.searchParams.get('extensions')!)).toEqual({
      persistedQuery: { version: 1, sha256Hash: await sha256Hex(QUERY) }
    });
    expect(init.method).toBe('GET');
    expect(init.body).toBeUndefined();
    expect(new Headers(init.headers).get('content-type')).toBeNull();
    // Auth and credentials travel with it: a signed-in GET is still signed in.
    expect(new Headers(init.headers).get('cookie')).toBe('access_token=x');
    expect(init.credentials).toBe('include');
    expect(await res.json()).toEqual({ data: { ok: true } });
  });

  it('leaves a mutation as the POST it was', async () => {
    const inner = vi.fn(async () => json({ data: {} }));
    const f = withPersistedQueries(inner as any);
    const init = post('mutation AddAnime($id: ID!) { addAnime(id: $id) { id } }', { id: '1' }, 'AddAnime');
    await f(URL_, init);
    expect(inner).toHaveBeenCalledWith(URL_, init);
  });

  it('registers the text once when the router does not know the hash, and returns that answer', async () => {
    const inner = vi
      .fn()
      .mockResolvedValueOnce(json({ errors: [{ message: 'PersistedQueryNotFound', extensions: { code: 'PERSISTED_QUERY_NOT_FOUND' } }] }))
      .mockResolvedValueOnce(json({ data: { registered: true } }));
    const f = withPersistedQueries(inner as any);

    const res = await f(URL_, post(QUERY, { limit: 1 }, 'getHome'));

    expect(inner).toHaveBeenCalledTimes(2);
    const [url, init] = inner.mock.calls[1] as any;
    expect(url).toBe(URL_);
    expect(init.method).toBe('POST');
    const body = JSON.parse(init.body);
    expect(body.query).toBe(QUERY);
    expect(body.extensions.persistedQuery.sha256Hash).toBe(await sha256Hex(QUERY));
    expect(await res.json()).toEqual({ data: { registered: true } });
  });

  it('stops asking a router that does not do persisted queries', async () => {
    const inner = vi
      .fn()
      .mockResolvedValueOnce(json({ errors: [{ message: 'PersistedQueryNotSupported' }] }))
      .mockResolvedValue(json({ data: {} }));
    const f = withPersistedQueries(inner as any);

    await f(URL_, post(QUERY, {}, 'getHome'));
    await f(URL_, post(QUERY, {}, 'getHome'));

    // GET (refused), POST fallback, then straight POST: three calls, the last two POST.
    expect(inner).toHaveBeenCalledTimes(3);
    expect((inner.mock.calls[1] as any)[1].method).toBe('POST');
    expect((inner.mock.calls[2] as any)[1].method).toBe('POST');
  });

  it('treats 405 the same way', async () => {
    const inner = vi.fn().mockResolvedValueOnce(new Response('', { status: 405 })).mockResolvedValue(json({ data: {} }));
    const f = withPersistedQueries(inner as any);
    const res = await f(URL_, post(QUERY, {}, 'getHome'));
    expect(res.status).toBe(200);
    await f(URL_, post(QUERY, {}, 'getHome'));
    expect(inner).toHaveBeenCalledTimes(3);
  });

  it('is a no-op when disabled, and for anything that is not a GraphQL POST', async () => {
    const inner = vi.fn(async () => json({ data: {} }));
    await withPersistedQueries(inner as any, { enabled: false })(URL_, post(QUERY));
    expect(inner).toHaveBeenCalledWith(URL_, expect.objectContaining({ method: 'POST' }));
    await withPersistedQueries(inner as any)('https://cdn.test/x.png');
    expect(inner).toHaveBeenLastCalledWith('https://cdn.test/x.png', undefined);
  });

  it('hashes with sha256, hex, and remembers the answer', async () => {
    expect(await sha256Hex('{__typename}')).toBe('ecf4edb46db40b5132295c0291d62fb65d6759a9eedfa4d5d612dd5ec54a6b38');
  });
});
