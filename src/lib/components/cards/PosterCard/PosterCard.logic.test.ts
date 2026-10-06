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
  it('leads with the anime’s own image at the root, TheTVDB’s poster behind it', () => {
    // The root object is the show's own art, upscaled to 600px; the poster is
    // often different art and exists only for shows TheTVDB carries.
    expect(posterSourcesFor('a1', 'posters')).toEqual([`${CDN}/a1`, `${CDN}/posters/a1`]);
  });

  it('keeps the poster as a per-anime fallback', () => {
    expect(posterSourcesFor('a1', 'posters')).toHaveLength(2);
  });

  it('keeps a work’s folder first: works have no root object', () => {
    expect(posterSourcesFor('w1', 'works')).toEqual([`${CDN}/works/w1`, `${CDN}/w1`]);
  });

  it('offers nothing for a card with no image key', () => {
    expect(posterSourcesFor('', 'posters')).toEqual([]);
  });

  it('still offers the root object when no folder was named', () => {
    expect(posterSourcesFor('a1', '')).toEqual([`${CDN}/a1`, `${CDN}/a1`]);
  });
});
