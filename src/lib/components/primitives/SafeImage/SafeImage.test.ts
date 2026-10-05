import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/svelte';
import SafeImage from './SafeImage.svelte';

/**
 * SafeImage puts its first candidate straight into the HTML and walks the rest
 * from the element's own `error` event. The ordering rules are pure and live
 * in `SafeImage.logic`; what is left for a component test is the element: what
 * it points at after each failure, and what `onChosen` reports.
 *
 * jsdom never fetches, so the events are fired by hand and the decoded size
 * is stubbed on the element. Nothing here proves anything about real decoding
 * or the bfcache retries -- those need a browser.
 */

const img = () => document.querySelector('img') as HTMLImageElement;

function decoded(el: HTMLImageElement, width = 680, height = 1000) {
  Object.defineProperty(el, 'naturalWidth', { value: width, configurable: true });
  Object.defineProperty(el, 'naturalHeight', { value: height, configurable: true });
}

async function loads(el: HTMLImageElement, width = 680, height = 1000) {
  decoded(el, width, height);
  await fireEvent.load(el);
}

const SOURCES = ['https://cdn.example/posters/one', 'https://cdn.example/one'];

afterEach(() => {
  vi.restoreAllMocks();
});

describe('SafeImage', () => {
  it('renders the first candidate before any script has run', () => {
    render(SafeImage, { sources: SOURCES, alt: 'One' });

    const el = screen.getByRole('img', { name: 'One' }) as HTMLImageElement;
    expect(el.getAttribute('src')).toBe(SOURCES[0]);
    expect(el.getAttribute('decoding')).toBe('async');
  });

  it('keeps a decorative skeleton under the element until it has decoded', async () => {
    const { container } = render(SafeImage, { sources: SOURCES });
    expect(container.querySelector('.skeleton')).not.toBeNull();
    expect(container.querySelector('.skeleton')?.getAttribute('aria-hidden')).toBe('true');

    await loads(img());

    await waitFor(() => expect(container.querySelector('.skeleton')).toBeNull());
  });

  it('reports the candidate that decoded', async () => {
    const onChosen = vi.fn();
    render(SafeImage, { sources: SOURCES, onChosen });

    await loads(img());

    expect(onChosen).toHaveBeenCalledTimes(1);
    expect(onChosen).toHaveBeenCalledWith({ src: SOURCES[0], reason: 'load' });
  });

  it('falls through to the next candidate when the preferred one fails', async () => {
    const onChosen = vi.fn();
    render(SafeImage, { sources: SOURCES, onChosen });

    await fireEvent.error(img());

    await waitFor(() => expect(img().getAttribute('src')).toBe(SOURCES[1]));
    expect(onChosen).not.toHaveBeenCalled();

    await loads(img());

    expect(onChosen).toHaveBeenCalledWith({ src: SOURCES[1], reason: 'last-source' });
  });

  it('rejects a decoded image that is only an error sprite', async () => {
    const onChosen = vi.fn();
    render(SafeImage, { sources: SOURCES, onChosen });

    await loads(img(), 1, 1);

    await waitFor(() => expect(img().getAttribute('src')).toBe(SOURCES[1]));
    expect(onChosen).not.toHaveBeenCalled();
  });

  it('honours a custom accept check', async () => {
    const accept = vi.fn(() => false);
    render(SafeImage, { sources: SOURCES, accept });

    await loads(img());

    expect(accept).toHaveBeenCalledWith(expect.any(HTMLImageElement), SOURCES[0]);
    await waitFor(() => expect(img().getAttribute('src')).toBe(SOURCES[1]));
  });

  describe('when every candidate fails', () => {
    it('draws the titled panel rather than a bright not-found illustration', async () => {
      const onChosen = vi.fn();
      const { container } = render(SafeImage, { sources: SOURCES, placeholderTitle: 'Koupen-chan', onChosen });

      await fireEvent.error(img());
      await waitFor(() => expect(img().getAttribute('src')).toBe(SOURCES[1]));
      await fireEvent.error(img());

      const panel = await screen.findByRole('img', { name: 'Koupen-chan — no artwork available' });
      expect(panel).toHaveTextContent('Koupen-chan');
      expect(container.querySelector('img')).toBeNull();
      // Nothing left to wait for, so the skeleton stops here too.
      expect(container.querySelector('.skeleton')).toBeNull();
      expect(onChosen).toHaveBeenCalledWith({ src: null, reason: 'placeholder' });
    });

    it('uses the fallback image where no placeholder title was given', async () => {
      const onChosen = vi.fn();
      render(SafeImage, { sources: SOURCES, fallbackSrc: '/assets/not found.jpg', onChosen });

      await fireEvent.error(img());
      await waitFor(() => expect(img().getAttribute('src')).toBe(SOURCES[1]));
      await fireEvent.error(img());

      await waitFor(() => expect(img().getAttribute('src')).toBe('/assets/not found.jpg'));
      expect(onChosen).toHaveBeenCalledWith({ src: '/assets/not found.jpg', reason: 'all-failed' });

      // A broken fallback is the end of the line, not another walk.
      await fireEvent.error(img());
      expect(img().getAttribute('src')).toBe('/assets/not found.jpg');
      expect(onChosen).toHaveBeenCalledTimes(1);
    });

    it('does not report the fallback a second time when it decodes', async () => {
      const onChosen = vi.fn();
      render(SafeImage, { sources: [SOURCES[0]], fallbackSrc: '/assets/not found.jpg', onChosen });

      await fireEvent.error(img());
      await waitFor(() => expect(img().getAttribute('src')).toBe('/assets/not found.jpg'));
      await loads(img());

      expect(onChosen).toHaveBeenCalledTimes(1);
    });
  });

  describe('with nothing to show', () => {
    it('falls straight through to the fallback', async () => {
      const onChosen = vi.fn();
      render(SafeImage, { sources: [], fallbackSrc: '/assets/not found.jpg', onChosen });

      expect(img().getAttribute('src')).toBe('/assets/not found.jpg');
      await waitFor(() => expect(onChosen).toHaveBeenCalledWith({ src: '/assets/not found.jpg', reason: 'all-failed' }));
    });

    it('draws the panel instead, where the caller gave one', async () => {
      const onChosen = vi.fn();
      render(SafeImage, { sources: [], placeholderTitle: 'Untitled', onChosen });

      expect(screen.getByRole('img', { name: 'Untitled — no artwork available' })).toBeInTheDocument();
      await waitFor(() => expect(onChosen).toHaveBeenCalledWith({ src: null, reason: 'placeholder' }));
    });
  });

  describe('loading hints', () => {
    it('is lazy by default and eager with a high priority when above the fold', () => {
      const { unmount } = render(SafeImage, { sources: SOURCES });
      expect(img().getAttribute('loading')).toBe('lazy');
      expect(img().getAttribute('fetchpriority')).toBe('auto');
      unmount();

      render(SafeImage, { sources: SOURCES, priority: true });
      expect(img().getAttribute('loading')).toBe('eager');
      expect(img().getAttribute('fetchpriority')).toBe('high');
    });

    it('lets an explicit loading value win', () => {
      render(SafeImage, { sources: SOURCES, priority: true, loading: 'lazy' });
      expect(img().getAttribute('loading')).toBe('lazy');
    });

    it('takes a bare `src` as its single candidate, keyed through the CDN', () => {
      render(SafeImage, { src: 'abc', path: 'posters' });
      expect(img().getAttribute('src')).toBe('https://cdn.weeb.vip/weeb/posters/abc');
    });

    it('adds no duplicate request for a cdnWidth the config has not enabled resizing for', async () => {
      render(SafeImage, { sources: [SOURCES[0]], cdnWidth: 360, placeholderTitle: 'x' });
      expect(img().getAttribute('src')).toBe(SOURCES[0]);

      await fireEvent.error(img());

      // One candidate, so one failure is the end: no second request to the same URL.
      expect(await screen.findByRole('img', { name: /no artwork/ })).toBeInTheDocument();
    });
  });

  describe('an element the browser finished before hydration', () => {
    it('reports it without waiting for a load event that already fired', async () => {
      vi.spyOn(HTMLImageElement.prototype, 'complete', 'get').mockReturnValue(true);
      vi.spyOn(HTMLImageElement.prototype, 'naturalWidth', 'get').mockReturnValue(680);
      vi.spyOn(HTMLImageElement.prototype, 'naturalHeight', 'get').mockReturnValue(1000);
      const onChosen = vi.fn();

      render(SafeImage, { sources: SOURCES, onChosen });

      await waitFor(() => expect(onChosen).toHaveBeenCalledWith({ src: SOURCES[0], reason: 'load' }));
      expect(onChosen).toHaveBeenCalledTimes(1);
    });

    it('moves on when the browser had already given up on it', async () => {
      vi.spyOn(HTMLImageElement.prototype, 'complete', 'get').mockReturnValue(true);
      vi.spyOn(HTMLImageElement.prototype, 'naturalWidth', 'get').mockReturnValue(0);

      render(SafeImage, { sources: SOURCES, placeholderTitle: 'x' });

      // Both candidates read as finished-and-empty, so the walk ends on the panel.
      expect(await screen.findByRole('img', { name: /no artwork/ })).toBeInTheDocument();
    });
  });

  describe('when the candidates change', () => {
    it('walks the new candidates and swaps the element', async () => {
      const onChosen = vi.fn();
      const { rerender } = render(SafeImage, { sources: SOURCES, onChosen });
      await loads(img());
      const before = img();

      await rerender({ sources: ['https://cdn.example/two'], onChosen });

      await waitFor(() => expect(img().getAttribute('src')).toBe('https://cdn.example/two'));
      expect(img()).not.toBe(before);
      await loads(img());
      expect(onChosen).toHaveBeenLastCalledWith({ src: 'https://cdn.example/two', reason: 'load' });
    });

    it('re-walks when only the CDN folder changes', async () => {
      const { rerender } = render(SafeImage, { src: 'abc', path: 'posters' });
      await rerender({ src: 'abc', path: 'banners' });
      await waitFor(() => expect(img().getAttribute('src')).toBe('https://cdn.weeb.vip/weeb/banners/abc'));
    });

    it('leaves a painted element alone when nothing named a different image', async () => {
      const { rerender } = render(SafeImage, { sources: SOURCES, alt: 'a' });
      await loads(img());
      const before = img();

      await rerender({ sources: [...SOURCES], alt: 'b' });

      expect(img()).toBe(before);
    });
  });

  describe('restores', () => {
    const restore = (persisted: boolean) => {
      const event = new Event('pageshow') as PageTransitionEvent;
      Object.defineProperty(event, 'persisted', { value: persisted });
      window.dispatchEvent(event);
    };

    it('re-requests after a bfcache restore when the image never arrived', async () => {
      render(SafeImage, { sources: SOURCES });
      const before = img();

      restore(true);

      await waitFor(() => expect(img()).not.toBe(before));
      expect(img().getAttribute('src')).toBe(SOURCES[0]);
    });

    it('ignores a pageshow that is not a restore', async () => {
      render(SafeImage, { sources: SOURCES });
      const before = img();
      restore(false);
      await Promise.resolve();
      expect(img()).toBe(before);
    });

    it('re-requests after a mobile swipe-back', async () => {
      render(SafeImage, { sources: SOURCES });
      const before = img();
      window.dispatchEvent(new Event('swipe-navigation-restored'));
      await waitFor(() => expect(img()).not.toBe(before));
    });

    it('re-requests when a hidden tab comes back with the image still unpainted', async () => {
      render(SafeImage, { sources: SOURCES });
      const before = img();
      vi.spyOn(document, 'hidden', 'get').mockReturnValue(false);
      document.dispatchEvent(new Event('visibilitychange'));
      await waitFor(() => expect(img()).not.toBe(before));
    });

    it('does not touch an element that has already painted', async () => {
      render(SafeImage, { sources: SOURCES });
      await loads(img());
      const before = img();

      restore(true);
      window.dispatchEvent(new Event('swipe-navigation-restored'));
      await Promise.resolve();

      expect(img()).toBe(before);
    });

    it('drops its handlers when it goes away', async () => {
      const remove = vi.spyOn(window, 'removeEventListener');
      const { unmount } = render(SafeImage, { sources: SOURCES });
      unmount();
      expect(remove).toHaveBeenCalledWith('pageshow', expect.any(Function));
      expect(remove).toHaveBeenCalledWith('swipe-navigation-restored', expect.any(Function));
    });
  });

  describe('with widths', () => {
    const useResize = async (on: boolean) => {
      const { configStore } = await import('$lib/stores/config');
      configStore.setConfig({ cdn_url: 'https://cdn.weeb.vip/weeb', cdn_image_resize: on } as any);
    };
    afterEach(async () => {
      const { configStore } = await import('$lib/stores/config');
      configStore.setConfig(null as any);
    });

    it('offers a srcset of the widths and the sizes the caller laid the element out at', async () => {
      await useResize(true);
      render(SafeImage, { sources: ['https://cdn.weeb.vip/weeb/posters/one'], cdnWidth: 360, widths: [180, 360], sizes: '180px', alt: 'One' });

      const el = img();
      expect(el.getAttribute('src')).toContain('width=360');
      expect(el.getAttribute('srcset')).toBe(
        'https://cdn.weeb.vip/cdn-cgi/image/width=180,format=auto,quality=85,fit=cover/weeb/posters/one 180w, ' +
          'https://cdn.weeb.vip/cdn-cgi/image/width=360,format=auto,quality=85,fit=cover/weeb/posters/one 360w',
      );
      expect(el.getAttribute('sizes')).toBe('180px');
    });

    it('offers none where the source cannot be resized, so nothing lies about the fallback', async () => {
      await useResize(false);
      render(SafeImage, { sources: SOURCES, cdnWidth: 360, widths: [180, 360], sizes: '180px' });

      expect(img().hasAttribute('srcset')).toBe(false);
      expect(img().hasAttribute('sizes')).toBe(false);
    });

    /**
     * REGRESSION. The resizer hit its monthly cap (ERROR 9422) and every
     * card showed the not-found image: the raw fallback still carried a
     * srcset of resized variants, the browser picked from it, and the raw
     * step failed exactly like the resized one before it.
     */
    it('offers no srcset on the raw fallback, so the raw object is what gets requested', async () => {
      await useResize(true);
      render(SafeImage, { sources: ['https://cdn.weeb.vip/weeb/posters/one'], cdnWidth: 360, widths: [180, 360], sizes: '180px' });
      expect(img().getAttribute('srcset')).toContain('width=180');

      await fireEvent.error(img()); // the resized candidate: 429 from the resizer

      await waitFor(() => expect(img().getAttribute('src')).toBe('https://cdn.weeb.vip/weeb/posters/one'));
      expect(img().hasAttribute('srcset')).toBe(false);
      expect(img().hasAttribute('sizes')).toBe(false);
    });

    it('drops the srcset once the walk lands on the fallback image', async () => {
      await useResize(true);
      render(SafeImage, { sources: ['https://cdn.weeb.vip/weeb/posters/one'], cdnWidth: 360, widths: [180, 360], sizes: '180px' });

      await fireEvent.error(img()); // resized
      await fireEvent.error(img()); // raw
      await waitFor(() => expect(img().getAttribute('src')).toBe('/assets/not found.jpg'));
      expect(img().hasAttribute('srcset')).toBe(false);
    });
  });

  describe('with a phone ordering', () => {
    const PHONE = ['https://cdn.example/posters/one', 'https://cdn.example/one'];
    const DESKTOP = ['https://cdn.example/banners/one', 'https://cdn.example/posters/one'];

    it('offers the phone candidate through a <picture> source the browser picks itself', () => {
      const { container } = render(SafeImage, { sources: DESKTOP, phoneSources: PHONE });
      const source = container.querySelector('picture > source') as HTMLSourceElement;
      expect(source.getAttribute('media')).toBe('(max-width: 767px)');
      expect(source.getAttribute('srcset')).toBe(PHONE[0]);
      expect(img().getAttribute('src')).toBe(DESKTOP[0]);
    });

    it('walks both orderings in step when the element fails', async () => {
      const { container } = render(SafeImage, { sources: DESKTOP, phoneSources: PHONE });

      await fireEvent.error(img());

      await waitFor(() => expect(img().getAttribute('src')).toBe(DESKTOP[1]));
      expect(container.querySelector('picture > source')?.getAttribute('srcset')).toBe(PHONE[1]);
    });

    it('drops the source once the walk ends on the fallback', async () => {
      const { container } = render(SafeImage, { sources: [DESKTOP[0]], phoneSources: [PHONE[0]], fallbackSrc: '/f.jpg' });

      await fireEvent.error(img());

      await waitFor(() => expect(img().getAttribute('src')).toBe('/f.jpg'));
      expect(container.querySelector('picture')).toBeNull();
    });
  });

  describe('per-candidate deadline', () => {
    it('moves on when a candidate neither loads nor fails in time', async () => {
      vi.useFakeTimers();
      try {
        render(SafeImage, { sources: SOURCES, perTryTimeoutMs: 50 });
        expect(img().getAttribute('src')).toBe(SOURCES[0]);

        await vi.advanceTimersByTimeAsync(60);

        expect(img().getAttribute('src')).toBe(SOURCES[1]);
      } finally {
        vi.useRealTimers();
      }
    });
  });
});
