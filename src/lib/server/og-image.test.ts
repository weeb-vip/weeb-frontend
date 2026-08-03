import { resolveOgImage, animeCdnSlug, _clearOgImageCache } from './og-image';

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

describe('animeCdnSlug', () => {
  it('lowercases and underscores, matching GetImageFromAnime', () => {
    expect(animeCdnSlug('One Piece')).toBe('one_piece');
  });

  it('escapes characters that would otherwise break the CDN key', () => {
    // The comma is why "Oh Boy, Was I Wrong About Her" missed its poster.
    expect(animeCdnSlug('Oh Boy, Was I Wrong About Her')).toBe(
      'oh_boy%2C_was_i_wrong_about_her'
    );
  });
});

describe('resolveOgImage', () => {
  it('prefers the banner, and routes it through Cloudflare resizing', async () => {
    const banner = `${CDN}/banners/${ID}`;
    const { impl } = fakeFetch([banner]);

    const url = await resolveOgImage({
      id: ID,
      getSource: async () => ({ title: 'One Piece' }),
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

  it('falls back to the poster slug when there is no banner', async () => {
    const poster = `${CDN}/one_piece`;
    const { impl } = fakeFetch([poster]);

    const url = await resolveOgImage({
      id: ID,
      getSource: async () => ({ title: 'One Piece' }),
      cdnUrl: CDN,
      origin: ORIGIN,
      fetchImpl: impl
    });

    expect(url).toContain('/cdn-cgi/image/');
    expect(url).toContain('/weeb/one_piece');
  });

  it('falls back to the site default when neither exists', async () => {
    const { impl } = fakeFetch([]);

    const url = await resolveOgImage({
      id: ID,
      getSource: async () => ({ title: 'Nonexistent Show' }),
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

  it('skips the poster probe entirely when no title is given', async () => {
    const { impl, calls } = fakeFetch([]);

    const url = await resolveOgImage({ id: ID, cdnUrl: CDN, origin: ORIGIN, fetchImpl: impl });

    expect(calls).toHaveLength(1);
    expect(url).toBe('https://weeb.vip/assets/og-image.jpg');
  });

  it('falls back to the MyAnimeList poster when our CDN cannot be probed', async () => {
    // This is production. Cloudflare bot-challenges Pages/Workers requests to
    // /weeb/*, so both CDN candidates answer 403 and tell us nothing. MyAnimeList
    // is outside that zone, so it can still be confirmed.
    const MAL = 'https://cdn.myanimelist.net/images/anime/1371/154308.jpg';
    const calls: string[] = [];
    const impl = (async (url: any) => {
      calls.push(String(url));
      return { status: String(url) === MAL ? 206 : 403 } as Response;
    }) as unknown as typeof fetch;

    const url = await resolveOgImage({
      id: ID,
      getSource: async () => ({ title: 'One Piece', imageUrl: MAL }),
      cdnUrl: CDN,
      origin: ORIGIN,
      fetchImpl: impl
    });

    expect(url).toBe(MAL);
    // The CDN poster is skipped: it lives on the origin that just refused to answer.
    expect(calls).toEqual([`${CDN}/banners/${ID}`, MAL]);
  });

  it('still prefers the CDN banner when it can be confirmed', async () => {
    // Staging: egress is not challenged, so the landscape banner wins and
    // MyAnimeList is never consulted.
    const MAL = 'https://cdn.myanimelist.net/images/anime/1/1.jpg';
    const { impl, calls } = fakeFetch([`${CDN}/banners/${ID}`]);

    const url = await resolveOgImage({
      id: ID,
      getSource: async () => ({ title: 'One Piece', imageUrl: MAL }),
      cdnUrl: CDN,
      origin: ORIGIN,
      fetchImpl: impl
    });

    expect(url).toContain('/cdn-cgi/image/');
    expect(calls.map((c) => c.url)).not.toContain(MAL);
  });

  it('prefers the CDN poster over MyAnimeList when the banner is merely absent', async () => {
    const MAL = 'https://cdn.myanimelist.net/images/anime/1/1.jpg';
    const { impl } = fakeFetch([`${CDN}/one_piece`]);

    const url = await resolveOgImage({
      id: ID,
      getSource: async () => ({ title: 'One Piece', imageUrl: MAL }),
      cdnUrl: CDN,
      origin: ORIGIN,
      fetchImpl: impl
    });

    expect(url).toContain('/weeb/one_piece');
  });

  it('lands on the branded default when even MyAnimeList is missing', async () => {
    const { impl } = fakeFetch([], 403);

    const url = await resolveOgImage({
      id: ID,
      getSource: async () => ({ title: 'One Piece', imageUrl: null }),
      cdnUrl: CDN,
      origin: ORIGIN,
      fetchImpl: impl
    });

    expect(url).toBe('https://weeb.vip/assets/og-image.jpg');
  });

  it('does not look up the title when the banner is there', async () => {
    const { impl } = fakeFetch([`${CDN}/banners/${ID}`]);
    const getSource = jest.fn(async () => ({ title: 'One Piece' }));

    await resolveOgImage({ id: ID, getSource, cdnUrl: CDN, origin: ORIGIN, fetchImpl: impl });

    // The title is only needed for the poster slug, and the poster was never reached.
    expect(getSource).not.toHaveBeenCalled();
  });

  it('looks up the title only once the banner is definitively absent', async () => {
    const { impl } = fakeFetch([`${CDN}/one_piece`]);
    const getSource = jest.fn(async () => ({ title: 'One Piece' }));

    const url = await resolveOgImage({
      id: ID,
      getSource,
      cdnUrl: CDN,
      origin: ORIGIN,
      fetchImpl: impl
    });

    expect(getSource).toHaveBeenCalledTimes(1);
    expect(url).toContain('/weeb/one_piece');
  });

  it('survives a failing title lookup', async () => {
    const { impl } = fakeFetch([]);
    const getSource = jest.fn(async () => {
      throw new Error('gateway down');
    });

    const url = await resolveOgImage({
      id: ID,
      getSource,
      cdnUrl: CDN,
      origin: ORIGIN,
      fetchImpl: impl
    });

    expect(url).toBe('https://weeb.vip/assets/og-image.jpg');
  });

  it('caches, so repeated crawler hits do not re-probe', async () => {
    const { impl, calls } = fakeFetch([`${CDN}/banners/${ID}`]);
    const args = { id: ID, getSource: async () => ({ title: 'One Piece' }), cdnUrl: CDN, origin: ORIGIN, fetchImpl: impl };

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
      getSource: async () => ({ title: 'One Piece' }),
      cdnUrl: CDN,
      origin: ORIGIN,
      fetchImpl: impl
    });

    expect(url).toBe('https://weeb.vip/assets/og-image.jpg');
  });

  it('stops probing once an answer is inconclusive', async () => {
    const { impl, calls } = fakeFetch([], 403);

    await resolveOgImage({
      id: ID,
      getSource: async () => ({ title: 'One Piece' }),
      cdnUrl: CDN,
      origin: ORIGIN,
      fetchImpl: impl
    });

    // Whatever blocked the banner probe blocks the poster probe too.
    expect(calls).toHaveLength(1);
  });

  it('keeps probing past a definitive 404 to reach the poster', async () => {
    const poster = `${CDN}/one_piece`;
    const { impl, calls } = fakeFetch([poster]);

    const url = await resolveOgImage({
      id: ID,
      getSource: async () => ({ title: 'One Piece' }),
      cdnUrl: CDN,
      origin: ORIGIN,
      fetchImpl: impl
    });

    expect(calls).toHaveLength(2);
    expect(url).toContain('/weeb/one_piece');
  });

  it('returns the default rather than throwing when the probe errors', async () => {
    const impl = (async () => {
      throw new Error('network down');
    }) as unknown as typeof fetch;

    const url = await resolveOgImage({
      id: ID,
      getSource: async () => ({ title: 'One Piece' }),
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
