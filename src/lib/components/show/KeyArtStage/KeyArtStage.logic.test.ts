import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { configStore } from '$lib/stores/config';
import type { IConfig } from '../../../../config/interfaces';
import { bannerSourcesFor } from './KeyArtStage.logic';

const CDN = 'https://cdn.weeb.vip/weeb';

beforeEach(() => configStore.setConfig({ cdn_url: CDN } as unknown as IConfig));
afterEach(() => configStore.setConfig(null as unknown as IConfig));

describe('bannerSourcesFor', () => {
  it('asks for the wide key art first, then the poster behind it', () => {
    // SafeImage stops at the first that loads, so a show with no banner still
    // fills the stage rather than showing nothing.
    expect(bannerSourcesFor('a1')).toEqual([`${CDN}/banners/a1`, `${CDN}/a1`]);
  });

  it('offers nothing at all for a record with no image', () => {
    expect(bannerSourcesFor(null)).toEqual([]);
    expect(bannerSourcesFor(undefined)).toEqual([]);
    expect(bannerSourcesFor('')).toEqual([]);
  });

  it('encodes the record id', () => {
    expect(bannerSourcesFor('a b')).toEqual([`${CDN}/banners/a%20b`, `${CDN}/a%20b`]);
  });
});
