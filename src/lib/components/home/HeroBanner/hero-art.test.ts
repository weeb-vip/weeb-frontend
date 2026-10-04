import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { configStore } from '$lib/stores/config';
import { heroSources, heroPhoneSources, heroPreloads } from './hero-art';

// Absolute, as the real builder's output is: SafeImage keys a bare string through the CDN.
const url = (id: string, path?: string) => (path ? `https://cdn.test/${path}/${id}` : `https://cdn.test/${id}`);

describe('hero artwork', () => {
  it('leads with the wide banner for a wide box', () => {
    expect(heroSources('a1', url)).toEqual(['https://cdn.test/banners/a1', 'https://cdn.test/posters/a1', 'https://cdn.test/a1']);
  });

  it('leads with the tall poster on a phone, and keeps the 225px image off the top', () => {
    expect(heroPhoneSources('a1', url)).toEqual(['https://cdn.test/posters/a1', 'https://cdn.test/a1', 'https://cdn.test/banners/a1']);
    expect(heroPhoneSources('a1', url)[0]).not.toBe('https://cdn.test/a1');
  });
});

describe('heroPreloads', () => {
  const previous = configStore.get();
  beforeEach(() => configStore.setConfig(null as any));
  afterEach(() => configStore.setConfig(previous as any));

  it('is empty without an id', () => {
    expect(heroPreloads(null, url)).toEqual([]);
    expect(heroPreloads('', url)).toEqual([]);
  });

  it('hints one image per viewport, each the URL SafeImage would request first', () => {
    expect(heroPreloads('a1', url)).toEqual([
      { href: 'https://cdn.test/banners/a1', media: '(min-width: 768px)' },
      { href: 'https://cdn.test/posters/a1', media: '(max-width: 767px)' }
    ]);
  });

  it('follows the CDN resize when the config enables it', () => {
    configStore.setConfig({ cdn_url: 'https://cdn.weeb.vip/weeb', cdn_image_resize: true } as any);
    const real = (id: string, path?: string) => `https://cdn.weeb.vip/weeb/${path ? `${path}/` : ''}${id}`;

    const [desktop, phone] = heroPreloads('a1', real);

    expect(desktop.href).toBe('https://cdn.weeb.vip/cdn-cgi/image/width=1600,format=auto,quality=85,fit=cover/weeb/banners/a1');
    expect(phone.href).toBe('https://cdn.weeb.vip/cdn-cgi/image/width=800,format=auto,quality=85,fit=cover/weeb/posters/a1');
  });
});
