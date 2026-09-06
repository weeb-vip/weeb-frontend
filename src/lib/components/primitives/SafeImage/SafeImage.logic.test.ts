import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { configStore } from '$lib/stores/config';
import type { IConfig } from '../../../../config/interfaces';
import {
  DEFAULT_REJECT_PATTERNS,
  defaultAccept,
  firstThatLoads,
  loadOne,
  loadReason,
  orderedSources,
  withTimeout
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

describe('loadOne', () => {
  /** Runs `loadOne` and hands back the <img> it created, so the test can fire events. */
  function attempt(url: string, accept: (img: HTMLImageElement, url: string) => boolean) {
    let img!: HTMLImageElement;
    const promise = loadOne(url, accept, (created) => (img = created));
    return { promise, get img() { return img; } };
  }

  it('registers the element before it starts loading, so a caller can abort it', () => {
    const register = vi.fn();
    void loadOne(`${CDN}/a`, () => true, register).catch(() => {});

    expect(register).toHaveBeenCalledTimes(1);
    expect(register.mock.calls[0][0]).toBeInstanceOf(HTMLImageElement);
  });

  it('sets the URL it was asked to try and decodes off the main thread', () => {
    const run = attempt(`${CDN}/a`, () => true);
    void run.promise.catch(() => {});

    expect(run.img.getAttribute('src')).toBe(`${CDN}/a`);
    expect(run.img.decoding).toBe('async');
  });

  it('resolves with the URL and the element once it loads and is accepted', async () => {
    const run = attempt(`${CDN}/a`, () => true);
    run.img.onload?.(new Event('load'));

    await expect(run.promise).resolves.toEqual({ url: `${CDN}/a`, img: run.img });
  });

  it('rejects an image that loaded but `accept` turned down', async () => {
    const run = attempt('/assets/404.jpg', () => false);
    run.img.onload?.(new Event('load'));

    await expect(run.promise).rejects.toThrow('Rejected by accept()');
  });

  it('rejects a URL that failed outright', async () => {
    const run = attempt(`${CDN}/a`, () => true);
    run.img.onerror?.(new Event('error'));

    await expect(run.promise).rejects.toThrow('Failed load');
  });

  it('accepts anyway when decode() throws -- a failed decode is not a failed image', async () => {
    const run = attempt(`${CDN}/a`, () => true);
    run.img.decode = () => Promise.reject(new Error('decode unsupported'));
    run.img.onload?.(new Event('load'));

    await expect(run.promise).resolves.toMatchObject({ url: `${CDN}/a` });
  });

  it('rejects when `accept` itself throws rather than hanging', async () => {
    const run = attempt(`${CDN}/a`, () => {
      throw new Error('accept exploded');
    });
    run.img.onload?.(new Event('load'));

    await expect(run.promise).rejects.toThrow('accept exploded');
  });
});

describe('withTimeout', () => {
  it('returns the promise untouched when there is no bound to apply', async () => {
    const p = Promise.resolve('ok');

    expect(withTimeout(p, undefined)).toBe(p);
    expect(withTimeout(p, 0)).toBe(p);
    expect(withTimeout(p, -1)).toBe(p);
  });

  it('passes a value through before the deadline', async () => {
    await expect(withTimeout(Promise.resolve('ok'), 50)).resolves.toBe('ok');
  });

  it('passes a rejection through unchanged', async () => {
    await expect(withTimeout(Promise.reject(new Error('boom')), 50)).rejects.toThrow('boom');
  });

  it('rejects with a timeout when nothing settles in time', async () => {
    vi.useFakeTimers();
    const pending = withTimeout(new Promise(() => {}), 100);
    const assertion = expect(pending).rejects.toThrow('timeout');

    await vi.advanceTimersByTimeAsync(100);
    await assertion;
  });

  it('clears its timer once the promise settles', async () => {
    vi.useFakeTimers();
    await expect(withTimeout(Promise.resolve('ok'), 100)).resolves.toBe('ok');

    expect(vi.getTimerCount()).toBe(0);
  });
});

describe('firstThatLoads', () => {
  it('stops at the first candidate that loads', async () => {
    const attempt = vi.fn(async () => undefined);

    await expect(firstThatLoads(['a', 'b', 'c'], attempt, () => false)).resolves.toEqual({
      url: 'a',
      index: 0
    });
    // One request per image, not one per candidate: 54 cards with a two-step
    // fallback used to fetch 108 images to show 54.
    expect(attempt).toHaveBeenCalledTimes(1);
  });

  it('walks to the next candidate when one fails', async () => {
    const attempt = vi.fn(async (url: string) => {
      if (url !== 'c') throw new Error('nope');
    });

    await expect(firstThatLoads(['a', 'b', 'c'], attempt, () => false)).resolves.toEqual({
      url: 'c',
      index: 2
    });
    expect(attempt).toHaveBeenCalledTimes(3);
  });

  it('reports null when every candidate failed', async () => {
    const attempt = vi.fn(async () => Promise.reject(new Error('nope')));

    await expect(firstThatLoads(['a', 'b'], attempt, () => false)).resolves.toBeNull();
  });

  it('reports null for an empty candidate list without attempting anything', async () => {
    const attempt = vi.fn();

    await expect(firstThatLoads([], attempt, () => false)).resolves.toBeNull();
    expect(attempt).not.toHaveBeenCalled();
  });

  it('gives up as undefined once the run has been abandoned', async () => {
    const attempt = vi.fn(async () => Promise.reject(new Error('nope')));

    await expect(firstThatLoads(['a', 'b', 'c'], attempt, () => true)).resolves.toBeUndefined();
    // Checked between attempts, so the first one still ran and no more did.
    expect(attempt).toHaveBeenCalledTimes(1);
  });

  it('does not abandon a run that already succeeded', async () => {
    const attempt = vi.fn(async () => undefined);

    await expect(firstThatLoads(['a', 'b'], attempt, () => true)).resolves.toEqual({
      url: 'a',
      index: 0
    });
  });

  it('stops walking as soon as the run is superseded mid-chain', async () => {
    const attempt = vi.fn(async () => Promise.reject(new Error('nope')));
    let calls = 0;
    const abandoned = () => ++calls >= 2;

    await expect(firstThatLoads(['a', 'b', 'c'], attempt, abandoned)).resolves.toBeUndefined();
    expect(attempt).toHaveBeenCalledTimes(2);
  });
});
