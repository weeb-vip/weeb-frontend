import { resolveOgImage, _clearOgImageCache } from './og-image';

const CDN = 'https://cdn.weeb.vip/weeb';
const ORIGIN = 'https://weeb.vip';
const ID = 'f3450266-1eaf-4d9e-8d31-8724a113c8bf';

/** A fetch that 206s for the listed URLs and 404s for everything else. */
function fakeFetch(present: string[], otherStatus = 404) {
  const calls: { url: string; init: any }[] = [];
  const impl = jest.fn(async (url: any, init: any) => {
    calls.push({ url: String(url), init });
    const ok = present.includes(String(url));
    return { status: ok ? 206 : otherStatus } as Response;
  });
  return { impl: impl as unknown as typeof fetch, calls };
}

beforeEach(() => _clearOgImageCache());

describe('resolveOgImage', () => {
  it('prefers the banner, and routes it through Cloudflare resizing', async () => {
    const banner = `${CDN}/banners/${ID}`;
    const { impl } = fakeFetch([banner]);

    const url = await resolveOgImage({
      id: ID,
      cdnUrl: CDN,
      origin: ORIGIN,
      fetchImpl: impl
    });

    // Resizing is what makes the CDN return image/jpeg instead of
    // application/octet-stream, which is what blanked the cards.
    expect(url).toBe(
      'https://cdn.weeb.vip/cdn-cgi/image/width=1200,height=630,format=jpeg,quality=85,fit=cover' +
        `/weeb/banners/${ID}`
    );
  });

  it('falls back to the poster when there is no banner', async () => {
    const poster = `${CDN}/${ID}`;
    const { impl } = fakeFetch([poster]);

    const url = await resolveOgImage({
      id: ID,
      cdnUrl: CDN,
      origin: ORIGIN,
      fetchImpl: impl
    });

    expect(url).toContain('/cdn-cgi/image/');
    expect(url).toContain(`/weeb/${ID}`);
  });

  it('keys the poster on the id, needing no title lookup', async () => {
    // Posters were keyed by a slug derived from the title, which had to be
    // escaped twice to match how the object was stored — every title holding a
    // ":" or "(" fell through to the default share image. The id needs no
    // derivation, so there is nothing left to get wrong.
    const poster = `${CDN}/${ID}`;
    const { impl, calls } = fakeFetch([poster]);

    const url = await resolveOgImage({
      id: ID,
      cdnUrl: CDN,
      origin: ORIGIN,
      fetchImpl: impl
    });

    expect(url).toContain(`/weeb/${ID}`);
    expect(url).not.toBe('https://weeb.vip/assets/og-image.jpg');
    // The banner is still tried first.
    expect(calls[0].url).toBe(`${CDN}/banners/${ID}`);
  });

  it('falls back to the site default when neither exists', async () => {
    const { impl } = fakeFetch([]);

    const url = await resolveOgImage({
      id: ID,
      cdnUrl: CDN,
      origin: ORIGIN,
      fetchImpl: impl
    });

    // Absolute: og:image must not be a relative path.
    expect(url).toBe('https://weeb.vip/assets/og-image.jpg');
  });

  it('probes with a ranged GET, because the CDN answers HEAD with 403', async () => {
    const { impl, calls } = fakeFetch([`${CDN}/banners/${ID}`]);

    await resolveOgImage({ id: ID, cdnUrl: CDN, origin: ORIGIN, fetchImpl: impl });

    expect(calls).toHaveLength(1);
    expect(calls[0].init?.method).toBeUndefined();
    expect(calls[0].init?.headers).toMatchObject({ range: 'bytes=0-0' });
    // Probes the raw URL, not the transformed one — no point making
    // Cloudflare re-encode an image we might discard.
    expect(calls[0].url).toBe(`${CDN}/banners/${ID}`);
  });

  it('sends x-og-probe so the WAF Skip rule can let our own origin through', async () => {
    const { impl, calls } = fakeFetch([`${CDN}/banners/${ID}`]);

    await resolveOgImage({
      id: ID,
      probeSecret: 's3cret',
      cdnUrl: CDN,
      origin: ORIGIN,
      fetchImpl: impl
    });

    expect(calls[0].init?.headers).toMatchObject({ 'x-og-probe': 's3cret' });
  });

  it('omits the header when no secret is configured', async () => {
    const { impl, calls } = fakeFetch([`${CDN}/banners/${ID}`]);

    await resolveOgImage({ id: ID, cdnUrl: CDN, origin: ORIGIN, fetchImpl: impl });

    expect(calls[0].init?.headers).not.toHaveProperty('x-og-probe');
  });

  it('does not probe the poster when the banner is there', async () => {
    const { impl, calls } = fakeFetch([`${CDN}/banners/${ID}`]);

    await resolveOgImage({ id: ID, cdnUrl: CDN, origin: ORIGIN, fetchImpl: impl });

    expect(calls).toHaveLength(1);
  });

  it('caches, so repeated crawler hits do not re-probe', async () => {
    const { impl, calls } = fakeFetch([`${CDN}/banners/${ID}`]);
    const args = { id: ID, cdnUrl: CDN, origin: ORIGIN, fetchImpl: impl };

    const first = await resolveOgImage(args);
    const second = await resolveOgImage(args);

    expect(second).toBe(first);
    expect(calls).toHaveLength(1);
  });

  it('uses the default when the probe is inconclusive, rather than gambling', async () => {
    // Cloudflare bot-challenges server-side requests to /weeb/*, which is exactly
    // this case: a 403 tells us nothing about whether the banner exists.
    const { impl } = fakeFetch([], 403);

    const url = await resolveOgImage({
      id: ID,
      cdnUrl: CDN,
      origin: ORIGIN,
      fetchImpl: impl
    });

    expect(url).toBe('https://weeb.vip/assets/og-image.jpg');
  });

  it('stops probing once an answer is inconclusive', async () => {
    const { impl, calls } = fakeFetch([], 403);

    await resolveOgImage({ id: ID, cdnUrl: CDN, origin: ORIGIN, fetchImpl: impl });

    // Whatever blocked the banner probe blocks the poster probe too.
    expect(calls).toHaveLength(1);
  });

  it('keeps probing past a definitive 404 to reach the poster', async () => {
    const poster = `${CDN}/${ID}`;
    const { impl, calls } = fakeFetch([poster]);

    const url = await resolveOgImage({ id: ID, cdnUrl: CDN, origin: ORIGIN, fetchImpl: impl });

    expect(calls).toHaveLength(2);
    expect(url).toContain(`/weeb/${ID}`);
  });

  it('returns the default rather than throwing when the probe errors', async () => {
    const impl = (async () => {
      throw new Error('network down');
    }) as unknown as typeof fetch;

    const url = await resolveOgImage({
      id: ID,
      cdnUrl: CDN,
      origin: ORIGIN,
      fetchImpl: impl
    });

    expect(url).toBe('https://weeb.vip/assets/og-image.jpg');
  });

  it('tolerates a cdn_url with a trailing slash', async () => {
    const banner = `${CDN}/banners/${ID}`;
    const { impl } = fakeFetch([banner]);

    const url = await resolveOgImage({
      id: ID,
      cdnUrl: `${CDN}/`,
      origin: ORIGIN,
      fetchImpl: impl
    });

    expect(url).toContain(`/weeb/banners/${ID}`);
    expect(url).not.toContain('//banners');
  });
});
