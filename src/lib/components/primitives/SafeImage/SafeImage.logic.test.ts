import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { configStore } from '$lib/stores/config';
import type { IConfig } from '../../../../config/interfaces';
import {
  DEFAULT_REJECT_PATTERNS,
  defaultAccept,
  loadReason,
  orderedSources,
} from './SafeImage.logic';

/**
 * The candidate list, the CDN-resize fallback chain, and the walk over them.
 *
 * `configStore` is the seam the image helpers read their CDN base and their
 * resize opt-in through, so it is set per test rather than mocked away.
 */
const ORIGIN = 'https://cdn.weeb.vip';
const CDN = `${ORIGIN}/weeb`;

function useConfig(resize: boolean) {
  configStore.setConfig({ cdn_url: CDN, cdn_image_resize: resize } as unknown as IConfig);
}

beforeEach(() => useConfig(false));
afterEach(() => {
  configStore.setConfig(null as unknown as IConfig);
  vi.useRealTimers();
});

describe('defaultAccept', () => {
  const big = { naturalWidth: 300, naturalHeight: 450 };

  it('accepts a real image', () => {
    expect(defaultAccept(big, `${CDN}/abc`)).toBe(true);
  });

  it('rejects the known placeholder and error filenames', () => {
    for (const url of [
      '/assets/not-found.png',
      '/assets/404.jpg',
      '/assets/error.webp',
      '/assets/placeholder.png',
      '/assets/default.jpeg'
    ]) {
      expect(defaultAccept(big, url)).toBe(false);
    }
  });

  it('rejects an image no bigger than a tracking pixel', () => {
    expect(defaultAccept({ naturalWidth: 1, naturalHeight: 1 }, `${CDN}/abc`)).toBe(false);
    expect(defaultAccept({ naturalWidth: 2, naturalHeight: 2 }, `${CDN}/abc`)).toBe(false);
  });

  it('keeps a legitimately narrow image as long as one side is bigger', () => {
    expect(defaultAccept({ naturalWidth: 2, naturalHeight: 400 }, `${CDN}/abc`)).toBe(true);
  });

  it('takes the caller’s patterns in place of the defaults, as strings or regexes', () => {
    expect(defaultAccept(big, `${CDN}/blocked`, ['blocked'])).toBe(false);
    expect(defaultAccept(big, `${CDN}/blocked`, [/BLOCKED/i])).toBe(false);
    // The defaults no longer apply once the caller supplied its own list.
    expect(defaultAccept(big, '/assets/404.jpg', ['blocked'])).toBe(true);
  });

  it('accepts anything when the caller passes no patterns at all', () => {
    expect(defaultAccept(big, '/assets/404.jpg', [])).toBe(true);
  });

  it('ships patterns that only match a whole filename, not a substring', () => {
    // "error" inside a word must not disqualify a real poster.
    const [errorish] = DEFAULT_REJECT_PATTERNS;
    expect(errorish.test(`${CDN}/terror-in-resonance`)).toBe(false);
  });
});

describe('orderedSources', () => {
  it('has no candidates when nothing was named, rather than the CDN root', () => {
    expect(orderedSources([], '', '', undefined)).toEqual([]);
    expect(orderedSources([], '', 'posters', 360)).toEqual([]);
  });

  it('builds one CDN URL from `src` when no list was given', () => {
    expect(orderedSources([], 'abc', 'banners', undefined)).toEqual([`${CDN}/banners/abc`]);
  });

  it('keeps the caller’s priority order', () => {
    expect(orderedSources(['a', 'b'], 'ignored', '', undefined)).toEqual([
      `${CDN}/a`,
      `${CDN}/b`
    ]);
  });

  it('passes an already-finished URL straight through', () => {
    const sources = ['https://artworks.thetvdb.com/p.jpg', 'data:image/png;base64,AAA', 'abc'];

    expect(orderedSources(sources, '', '', undefined)).toEqual([
      'https://artworks.thetvdb.com/p.jpg',
      'data:image/png;base64,AAA',
      `${CDN}/abc`
    ]);
  });

  it('encodes the record id exactly once', () => {
    expect(orderedSources([], 'a b:c', '', undefined)).toEqual([`${CDN}/a%20b%3Ac`]);
  });

  it('adds no resize step when no width was asked for', () => {
    useConfig(true);

    expect(orderedSources(['abc'], '', '', undefined)).toEqual([`${CDN}/abc`]);
  });

  it('adds no resize step when the deployment has resizing off', () => {
    useConfig(false);

    expect(orderedSources(['abc'], '', '', 360)).toEqual([`${CDN}/abc`]);
  });

  it('puts the untransformed URL right behind each resized one', () => {
    useConfig(true);

    // ERROR 9422 exhausts the transformation quota monthly; falling through to
    // the original degrades to full-size images rather than losing the artwork.
    expect(orderedSources(['abc'], '', '', 360)).toEqual([
      `${ORIGIN}/cdn-cgi/image/width=360,format=auto,quality=85,fit=cover/weeb/abc`,
      `${CDN}/abc`
    ]);
  });

  it('does not duplicate a candidate the resizer left alone', () => {
    useConfig(true);
    const foreign = 'https://artworks.thetvdb.com/p.jpg';

    // A second identical request buys nothing.
    expect(orderedSources([foreign, 'abc'], '', '', 360)).toEqual([
      foreign,
      `${ORIGIN}/cdn-cgi/image/width=360,format=auto,quality=85,fit=cover/weeb/abc`,
      `${CDN}/abc`
    ]);
  });

  it('interleaves the pairs rather than grouping all the resized ones first', () => {
    useConfig(true);

    expect(orderedSources(['a', 'b'], '', '', 360)).toEqual([
      `${ORIGIN}/cdn-cgi/image/width=360,format=auto,quality=85,fit=cover/weeb/a`,
      `${CDN}/a`,
      `${ORIGIN}/cdn-cgi/image/width=360,format=auto,quality=85,fit=cover/weeb/b`,
      `${CDN}/b`
    ]);
  });
});

describe('loadReason', () => {
  it('is a plain load when there was only ever one candidate', () => {
    expect(loadReason(0, 1)).toBe('load');
  });

  it('is a plain load for any candidate that is not the last', () => {
    expect(loadReason(0, 3)).toBe('load');
    expect(loadReason(1, 3)).toBe('load');
  });

  it('calls out only the last of several', () => {
    expect(loadReason(2, 3)).toBe('last-source');
    expect(loadReason(1, 2)).toBe('last-source');
  });
});
