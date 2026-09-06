import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { configStore } from '$lib/stores/config';
import type { IConfig } from '../../../../config/interfaces';
import { airingStateOf, posterSourcesFor } from './PosterCard.logic';

const CDN = 'https://cdn.weeb.vip/weeb';

beforeEach(() => configStore.setConfig({ cdn_url: CDN } as unknown as IConfig));
afterEach(() => configStore.setConfig(null as unknown as IConfig));

describe('airingStateOf', () => {
  it('accepts both vocabularies -- the GraphQL enum and the homepage shorthand', () => {
    expect(airingStateOf('CURRENTLY_AIRING')).toBe('airing');
    expect(airingStateOf('airing')).toBe('airing');
    expect(airingStateOf('NOT_YET_RELEASED')).toBe('upcoming');
    expect(airingStateOf('upcoming')).toBe('upcoming');
  });

  it('draws neither mark for anything else', () => {
    // Green is airing, amber is upcoming, and nothing else is either.
    for (const status of ['FINISHED', 'finished', 'CANCELLED', '', null, undefined]) {
      expect(airingStateOf(status)).toBeNull();
    }
  });

  it('does not fold case, so a near-miss is not silently claimed', () => {
    expect(airingStateOf('Currently_Airing')).toBeNull();
  });
});

describe('posterSourcesFor', () => {
  it('prefers TheTVDB’s poster over the scraper’s MyAnimeList image', () => {
    // MAL serves at 225px wide, which is soft at card size on any 2x display.
    expect(posterSourcesFor('a1', 'posters')).toEqual([`${CDN}/posters/a1`, `${CDN}/a1`]);
  });

  it('falls back per-anime, so shows TheTVDB does not carry are unaffected', () => {
    expect(posterSourcesFor('a1', 'posters')).toHaveLength(2);
  });

  it('offers nothing for a card with no image key', () => {
    expect(posterSourcesFor('', 'posters')).toEqual([]);
  });

  it('still offers the root object when no folder was named', () => {
    expect(posterSourcesFor('a1', '')).toEqual([`${CDN}/a1`, `${CDN}/a1`]);
  });
});
