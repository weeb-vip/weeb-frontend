import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

/**
 * GET /og/<id> -- the stable share-image URL that every og:image tag points at.
 *
 * The resolution itself (banner, then poster, then the branded default) is
 * pinned in `src/lib/server/og-image.test.ts`. What this endpoint adds is the
 * redirect: crawlers follow it, so the status, the location header and the
 * cache policy are the contract. It must also hand the resolver the request's
 * own environment -- the configured CDN, the requesting origin and the
 * request-scoped fetch -- or staging redirects to production's CDN.
 */

const resolveOgImage = vi.fn(async (_args: any) => 'https://cdn.test/weeb/banners/anime-1');

vi.mock('$lib/server/og-image', () => ({
  resolveOgImage: (args: unknown) => resolveOgImage(args)
}));

vi.mock('$env/dynamic/private', () => ({
  env: { OG_PROBE_SECRET: 'probe-secret' }
}));

const { GET } = await import('./+server');

const requestFetch = vi.fn(async () => new Response(null));

function event(id: string, overrides: Record<string, unknown> = {}) {
  return {
    params: { id },
    url: new URL(`https://weeb.vip/og/${id}`),
    locals: { config: { cdn_url: 'https://cdn.test/weeb' } },
    fetch: requestFetch,
    ...overrides
  } as any;
}

beforeEach(() => {
  resolveOgImage.mockClear();
  resolveOgImage.mockResolvedValue('https://cdn.test/weeb/banners/anime-1');
  requestFetch.mockClear();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('the redirect a crawler follows', () => {
  it('is a 302, not a rendered image', async () => {
    expect((await GET(event('anime-1'))).status).toBe(302);
  });

  it('points at whatever the resolver chose', async () => {
    resolveOgImage.mockResolvedValue('https://cdn.test/cdn-cgi/image/x/weeb/banners/anime-1');

    const res = await GET(event('anime-1'));

    expect(res.headers.get('location')).toBe(
      'https://cdn.test/cdn-cgi/image/x/weeb/banners/anime-1'
    );
  });

  it('carries no body of its own', async () => {
    expect(await (await GET(event('anime-1'))).text()).toBe('');
  });

  it('lets the CDN absorb the crawl, but re-checks within the day', async () => {
    // Long enough that repeated crawler hits do not re-probe; short enough that
    // a newly synced banner appears the same day.
    const res = await GET(event('anime-1'));

    expect(res.headers.get('cache-control')).toBe('public, max-age=3600, s-maxage=86400');
  });

  it('still redirects when the resolver fell all the way through to the default', async () => {
    // The fallback chain must always reach *a* response: an og:image that 404s
    // renders a blank card on every social platform.
    resolveOgImage.mockResolvedValue('https://weeb.vip/assets/og-image.jpg');

    const res = await GET(event('anime-1'));

    expect(res.status).toBe(302);
    expect(res.headers.get('location')).toBe('https://weeb.vip/assets/og-image.jpg');
  });
});

describe('what it hands the resolver', () => {
  it('passes the id from the path, verbatim', async () => {
    await GET(event('f3450266-1eaf-4d9e-8d31-8724a113c8bf'));

    expect(resolveOgImage.mock.calls[0][0].id).toBe('f3450266-1eaf-4d9e-8d31-8724a113c8bf');
  });

  it('does not pre-encode the id -- the resolver owns that', async () => {
    // Double encoding is what broke the old title-derived poster keys.
    await GET(event('a b/c'));

    expect(resolveOgImage.mock.calls[0][0].id).toBe('a b/c');
  });

  it('passes the environment\'s CDN, so staging never points at production', async () => {
    await GET(event('anime-1'));

    expect(resolveOgImage.mock.calls[0][0].cdnUrl).toBe('https://cdn.test/weeb');
  });

  it('passes undefined rather than throwing when locals carries no config', async () => {
    // hooks.server.ts returns early for anything that looks like a static asset,
    // which is exactly why this route is extensionless -- but the optional chain
    // still has to hold if config is ever absent.
    await GET(event('anime-1', { locals: {} }));

    expect(resolveOgImage.mock.calls[0][0].cdnUrl).toBeUndefined();
  });

  it('passes the requesting origin, so the default asset resolves locally', async () => {
    await GET(
      event('anime-1', { url: new URL('https://staging.weeb.vip/og/anime-1') })
    );

    expect(resolveOgImage.mock.calls[0][0].origin).toBe('https://staging.weeb.vip');
  });

  it('passes the request-scoped fetch rather than the global one', async () => {
    await GET(event('anime-1'));

    expect(resolveOgImage.mock.calls[0][0].fetchImpl).toBe(requestFetch);
  });

  it('passes the probe secret the WAF Skip rule matches on', async () => {
    await GET(event('anime-1'));

    expect(resolveOgImage.mock.calls[0][0].probeSecret).toBe('probe-secret');
  });

  it('resolves once per request, with no second lookup', async () => {
    await GET(event('anime-1'));

    expect(resolveOgImage).toHaveBeenCalledTimes(1);
  });
});

describe('when resolution itself fails', () => {
  it('rejects rather than redirecting somewhere unknown', async () => {
    // Pinned as it stands: the resolver swallows probe failures and returns the
    // default, so this only happens if it throws outright.
    resolveOgImage.mockRejectedValue(new Error('boom'));

    await expect(GET(event('anime-1'))).rejects.toThrow('boom');
  });
});
