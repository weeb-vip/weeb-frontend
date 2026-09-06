import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

/**
 * POST /api/logout. It does one thing -- clear the auth cookies -- and the
 * thing worth pinning is that it clears ALL of them: the three current names
 * plus the five legacy ones, since a stale `authToken` left behind is still
 * sent to the gateway and still logs the visitor in.
 *
 * A failure has to answer 500 rather than a cheerful success, or the client
 * navigates away believing it is signed out.
 */

const { POST } = await import('./+server');
const { AUTH_COOKIE_NAMES, LEGACY_AUTH_COOKIE_NAMES } = await import('$lib/server/auth-cookies');

/** A cookie jar that records deletions. */
function jar(onDelete?: (name: string) => void) {
  const deleted: { name: string; options: any }[] = [];
  const cookies = {
    delete: vi.fn((name: string, options: any) => {
      onDelete?.(name);
      deleted.push({ name, options });
    })
  };
  return { cookies: cookies as any, deleted };
}

function event(cookies: any) {
  return { cookies } as any;
}

beforeEach(() => {
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('a successful logout', () => {
  it('answers 200 with JSON', async () => {
    const { cookies } = jar();

    const res = await POST(event(cookies));

    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toContain('application/json');
  });

  it('reports success in a body the client can branch on', async () => {
    const { cookies } = jar();

    expect(await (await POST(event(cookies))).json()).toEqual({
      success: true,
      message: 'Logged out successfully'
    });
  });

  it('clears every current auth cookie', async () => {
    const { cookies, deleted } = jar();

    await POST(event(cookies));

    for (const name of AUTH_COOKIE_NAMES) {
      expect(deleted.map((d) => d.name)).toContain(name);
    }
  });

  it('clears the legacy names too -- a stale authToken still signs you in', async () => {
    const { cookies, deleted } = jar();

    await POST(event(cookies));

    for (const name of LEGACY_AUTH_COOKIE_NAMES) {
      expect(deleted.map((d) => d.name)).toContain(name);
    }
  });

  it('clears each one at the root path, the scope they were set with', async () => {
    const { cookies, deleted } = jar();

    await POST(event(cookies));

    expect(deleted.every((d) => d.options.path === '/')).toBe(true);
  });

  it('deletes each name exactly once outside production, where there is no cookie domain', async () => {
    // In production every name is deleted twice, with and without the
    // dot-domain; under test import.meta.env.PROD is false, so one each.
    const { cookies, deleted } = jar();

    await POST(event(cookies));

    expect(deleted).toHaveLength(AUTH_COOKIE_NAMES.length + LEGACY_AUTH_COOKIE_NAMES.length);
    expect(new Set(deleted.map((d) => d.name)).size).toBe(deleted.length);
  });
});

describe('a logout that goes wrong', () => {
  it('answers 500, so the client does not report a logout that did not happen', async () => {
    const { cookies } = jar((name) => {
      if (name === 'refresh_token') throw new Error('cookie store unavailable');
    });

    const res = await POST(event(cookies));

    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({ success: false, error: 'Logout failed' });
  });

  it('does not leak the underlying error to the client', async () => {
    const { cookies } = jar(() => {
      throw new Error('secret internal detail');
    });

    expect(JSON.stringify(await (await POST(event(cookies))).json())).not.toContain('secret');
  });
});
