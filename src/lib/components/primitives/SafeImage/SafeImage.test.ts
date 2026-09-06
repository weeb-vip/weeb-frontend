import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/svelte';
import SafeImage from './SafeImage.svelte';

/**
 * SafeImage walks a list of candidate URLs and stops at the first that decodes.
 * The ordering rules themselves are pure and already covered by
 * `SafeImage.logic`; what is left for a component test is the state machine
 * around them -- which element ends up in the DOM, and what `onChosen` reports.
 *
 * jsdom loads no resources, so a real `new Image()` here would neither fire
 * `load` nor `error` and every attempt would sit until the 3s per-try timeout.
 * The constructor is stubbed instead, with a predicate saying which URLs
 * "exist". That is the only way to exercise the walk at all in this
 * environment; it also means nothing below proves anything about real decoding,
 * caching or the bfcache retries -- those need a browser.
 */

let attempted: string[] = [];
let succeeds: (url: string) => boolean;
const OriginalImage = globalThis.Image;

class StubImage {
  onload: (() => void) | null = null;
  onerror: (() => void) | null = null;
  decoding = 'auto';
  naturalWidth = 0;
  naturalHeight = 0;
  #src = '';

  get src(): string {
    return this.#src;
  }

  set src(value: string) {
    this.#src = value;
    attempted.push(value);
    queueMicrotask(() => {
      if (succeeds(value)) {
        this.naturalWidth = 680;
        this.naturalHeight = 1000;
        this.onload?.();
      } else {
        this.onerror?.();
      }
    });
  }
}

beforeEach(() => {
  attempted = [];
  succeeds = () => true;
  globalThis.Image = StubImage as unknown as typeof Image;
});

afterEach(() => {
  globalThis.Image = OriginalImage;
});

describe('SafeImage', () => {
  it('shows a decorative skeleton before anything has painted', () => {
    succeeds = () => false;
    const { container } = render(SafeImage, {
      props: { sources: ['https://cdn.example/a.jpg'], alt: 'Cowboy Bebop' }
    });

    const skeleton = container.querySelector('.skeleton') as HTMLElement;
    expect(skeleton).toBeInTheDocument();
    // A shelf of 60 cards must not produce 60 polite live regions, nor prefix
    // every card's accessible name with "Loading...".
    expect(skeleton).toHaveAttribute('aria-hidden', 'true');
  });

  it('renders the first candidate that loads, and reports it', async () => {
    const onChosen = vi.fn();
    render(SafeImage, {
      props: {
        sources: ['https://cdn.example/a.jpg', 'https://cdn.example/b.jpg'],
        alt: 'Cowboy Bebop',
        onChosen
      }
    });

    const img = await screen.findByAltText('Cowboy Bebop');
    expect(img).toHaveAttribute('src', 'https://cdn.example/a.jpg');
    expect(onChosen).toHaveBeenCalledWith({ src: 'https://cdn.example/a.jpg', reason: 'load' });

    // Stopped at the first: it does not fetch the fallbacks it did not need.
    expect(attempted).toEqual(['https://cdn.example/a.jpg']);
  });

  it('falls through to the next candidate when the preferred one fails', async () => {
    const onChosen = vi.fn();
    succeeds = (url) => url.endsWith('b.jpg');
    render(SafeImage, {
      props: {
        sources: ['https://cdn.example/a.jpg', 'https://cdn.example/b.jpg'],
        alt: 'Cowboy Bebop',
        onChosen
      }
    });

    const img = await screen.findByAltText('Cowboy Bebop');
    expect(img).toHaveAttribute('src', 'https://cdn.example/b.jpg');
    // Landing on the last of several is called out, but is not an error.
    expect(onChosen).toHaveBeenCalledWith({
      src: 'https://cdn.example/b.jpg',
      reason: 'last-source'
    });
    expect(attempted).toEqual(['https://cdn.example/a.jpg', 'https://cdn.example/b.jpg']);
  });

  it('rejects a decoded image that is only an error sprite', async () => {
    const onChosen = vi.fn();
    render(SafeImage, {
      props: {
        sources: ['https://cdn.example/a.jpg', 'https://cdn.example/b.jpg'],
        alt: 'Cowboy Bebop',
        onChosen,
        // A 1x1 tracking pixel decodes perfectly well and is not the artwork.
        accept: (img: HTMLImageElement, url: string) => url.endsWith('b.jpg') && img.naturalWidth > 2
      }
    });

    const img = await screen.findByAltText('Cowboy Bebop');
    expect(img).toHaveAttribute('src', 'https://cdn.example/b.jpg');
  });

  describe('when nothing loads', () => {
    it('draws the titled panel rather than a bright not-found illustration', async () => {
      const onChosen = vi.fn();
      succeeds = () => false;
      render(SafeImage, {
        props: {
          sources: ['https://cdn.example/a.jpg'],
          alt: '',
          placeholderTitle: 'Cowboy Bebop',
          onChosen
        }
      });

      const panel = await screen.findByRole('img', {
        name: 'Cowboy Bebop — no artwork available'
      });
      expect(panel).toHaveTextContent('Cowboy Bebop');
      expect(onChosen).toHaveBeenCalledWith({ src: null, reason: 'placeholder' });
    });

    it('stops the skeleton once the panel is final -- there is nothing left to wait for', async () => {
      succeeds = () => false;
      const { container } = render(SafeImage, {
        props: {
          sources: ['https://cdn.example/a.jpg'],
          placeholderTitle: 'Cowboy Bebop'
        }
      });

      await screen.findByRole('img', { name: /Cowboy Bebop/ });
      expect(container.querySelector('.skeleton')).toBeNull();
    });

    it('uses the fallback image where no placeholder title was given', async () => {
      const onChosen = vi.fn();
      succeeds = () => false;
      render(SafeImage, {
        props: {
          sources: ['https://cdn.example/a.jpg'],
          alt: 'Cowboy Bebop',
          fallbackSrc: '/assets/not found.jpg',
          onChosen
        }
      });

      await waitFor(() => {
        expect(onChosen).toHaveBeenCalledWith({
          src: '/assets/not found.jpg',
          reason: 'all-failed'
        });
      });
      expect(await screen.findByAltText('Cowboy Bebop')).toHaveAttribute(
        'src',
        '/assets/not found.jpg'
      );
    });
  });

  describe('the <img> it emits', () => {
    it('is lazy by default and eager when the caller says it is above the fold', async () => {
      const lazy = render(SafeImage, {
        props: { sources: ['https://cdn.example/a.jpg'], alt: 'Lazy' }
      });
      expect(await screen.findByAltText('Lazy')).toHaveAttribute('loading', 'lazy');
      lazy.unmount();

      render(SafeImage, {
        props: { sources: ['https://cdn.example/a.jpg'], alt: 'Eager', priority: true }
      });
      const eager = await screen.findByAltText('Eager');
      expect(eager).toHaveAttribute('loading', 'eager');
      expect(eager).toHaveAttribute('fetchpriority', 'high');
    });

    it('adds no duplicate request for a cdnWidth the config has not enabled resizing for', async () => {
      render(SafeImage, {
        props: { sources: ['https://cdn.example/a.jpg'], alt: 'Cowboy Bebop', cdnWidth: 360 }
      });

      await screen.findByAltText('Cowboy Bebop');
      // `resizeCdnUrl` returns its input unchanged when resizing is off, and a
      // duplicate candidate would just be a second identical request.
      expect(attempted).toEqual(['https://cdn.example/a.jpg']);
    });
  });
});

/**
 * The rest of the state machine: what the DOM `<img>`'s own load and error
 * events do once a candidate has been chosen, what happens when the props name
 * a different image after mount, and the four ways a restored page asks for the
 * artwork again.
 *
 * Same stub as above -- `StubImage` decides which URLs "exist" -- and the same
 * caveat, more sharply: nothing here proves anything about real decoding, real
 * caching, or what a browser actually does on bfcache restore. jsdom fires no
 * `pageshow`, has no back/forward cache and paints nothing; the events below
 * are dispatched by hand, so what is asserted is that the component *responds*
 * to them by re-probing, not that the restore works. That is a browser fact and
 * belongs to the e2e layer, as does whether the CDN serves the artwork at all.
 */
describe('SafeImage, once a candidate is in the DOM', () => {
  describe('the <img>’s own events', () => {
    it('clears the skeleton once the element has actually painted', async () => {
      const { container } = render(SafeImage, {
        props: { sources: ['https://cdn.example/a.jpg'], alt: 'Cowboy Bebop' }
      });

      const img = await screen.findByAltText('Cowboy Bebop');
      // Chosen, but not yet painted: the element is held transparent over the
      // skeleton rather than popping in.
      expect(img).toHaveClass('opacity-0');
      expect(container.querySelector('.skeleton')).toBeInTheDocument();

      await fireEvent.load(img);

      expect(img).not.toHaveClass('opacity-0');
      expect(container.querySelector('.skeleton')).toBeNull();
    });

    /**
     * The probe accepted the URL and the element still failed -- a cache miss,
     * a URL that 404s only for the real request. The fallback is the answer
     * when the caller gave no placeholder title.
     */
    it('swaps in the fallback when the chosen element fails anyway', async () => {
      render(SafeImage, {
        props: {
          sources: ['https://cdn.example/a.jpg'],
          alt: 'Cowboy Bebop',
          fallbackSrc: '/assets/not found.jpg'
        }
      });

      const img = await screen.findByAltText('Cowboy Bebop');
      await fireEvent.error(img);

      expect(await screen.findByAltText('Cowboy Bebop')).toHaveAttribute(
        'src',
        '/assets/not found.jpg'
      );
    });

    it('draws the titled panel instead, where the caller gave one', async () => {
      render(SafeImage, {
        props: {
          sources: ['https://cdn.example/a.jpg'],
          alt: 'Cowboy Bebop',
          placeholderTitle: 'Cowboy Bebop'
        }
      });

      await fireEvent.error(await screen.findByAltText('Cowboy Bebop'));

      // `/assets/not found.jpg` is a bright white illustration; on this ground
      // it would be the highest-contrast object in the viewport.
      const panel = await screen.findByRole('img', { name: 'Cowboy Bebop' });
      expect(panel).toHaveTextContent('Cowboy Bebop');
      expect(screen.queryByAltText('Cowboy Bebop')).not.toBeInTheDocument();
    });
  });

  describe('when the props name a different image', () => {
    it('walks the new candidates and swaps the element', async () => {
      const { rerender } = render(SafeImage, {
        props: { sources: ['https://cdn.example/a.jpg'], alt: 'Cowboy Bebop' }
      });
      await screen.findByAltText('Cowboy Bebop');

      await rerender({ sources: ['https://cdn.example/c.jpg'], alt: 'Cowboy Bebop' });

      await waitFor(() =>
        expect(screen.getByAltText('Cowboy Bebop')).toHaveAttribute(
          'src',
          'https://cdn.example/c.jpg'
        )
      );
      expect(attempted).toEqual(['https://cdn.example/a.jpg', 'https://cdn.example/c.jpg']);
    });

    it('re-walks when only the CDN folder changes', async () => {
      const { rerender } = render(SafeImage, {
        props: { src: 'abc123', path: 'posters', alt: 'Cowboy Bebop' }
      });
      await screen.findByAltText('Cowboy Bebop');
      const first = attempted[0];

      await rerender({ src: 'abc123', path: 'banners', alt: 'Cowboy Bebop' });

      await waitFor(() => expect(attempted).toHaveLength(2));
      expect(attempted[1]).not.toBe(first);
      expect(attempted[1]).toContain('banners');
    });

    it('re-reports an image it has already painted rather than fetching it twice', async () => {
      const onChosen = vi.fn();
      const { rerender } = render(SafeImage, {
        props: { sources: ['https://cdn.example/a.jpg'], alt: 'Cowboy Bebop', onChosen }
      });
      await fireEvent.load(await screen.findByAltText('Cowboy Bebop'));
      onChosen.mockClear();

      // `src` changes but `sources` wins, so the candidate list is the same one
      // that is already on screen. The parent may have reset its own fade gate,
      // so it is told again -- but nothing is re-requested.
      await rerender({
        sources: ['https://cdn.example/a.jpg'],
        src: 'ignored-because-sources-win',
        alt: 'Cowboy Bebop',
        onChosen
      });

      await waitFor(() =>
        expect(onChosen).toHaveBeenCalledWith({
          src: 'https://cdn.example/a.jpg',
          reason: 'already-loaded'
        })
      );
      expect(attempted).toEqual(['https://cdn.example/a.jpg']);
    });

    it('reports a retry when the same candidate wins but has not painted yet', async () => {
      const onChosen = vi.fn();
      const { rerender } = render(SafeImage, {
        props: { sources: ['https://cdn.example/a.jpg'], alt: 'Cowboy Bebop', onChosen }
      });
      await screen.findByAltText('Cowboy Bebop');
      onChosen.mockClear();

      // Same list, and this time the DOM element never fired `load`.
      await rerender({
        sources: ['https://cdn.example/a.jpg'],
        src: 'ignored-because-sources-win',
        alt: 'Cowboy Bebop',
        onChosen
      });

      await waitFor(() =>
        expect(onChosen).toHaveBeenCalledWith({
          src: 'https://cdn.example/a.jpg',
          reason: 'retry-same'
        })
      );
    });

    it('reports a re-walk that lands back on the painted fallback candidate', async () => {
      const onChosen = vi.fn();
      succeeds = (url) => url.endsWith('b.jpg');
      const { rerender } = render(SafeImage, {
        props: {
          sources: ['https://cdn.example/a.jpg', 'https://cdn.example/b.jpg'],
          alt: 'Cowboy Bebop',
          onChosen
        }
      });
      await fireEvent.load(await screen.findByAltText('Cowboy Bebop'));
      onChosen.mockClear();

      // The first candidate still fails, so the walk is real -- and it ends on
      // the element already on screen.
      await rerender({
        sources: ['https://cdn.example/a.jpg', 'https://cdn.example/b.jpg'],
        src: 'ignored-because-sources-win',
        alt: 'Cowboy Bebop',
        onChosen
      });

      await waitFor(() =>
        expect(onChosen).toHaveBeenCalledWith({
          src: 'https://cdn.example/b.jpg',
          reason: 'same-already-loaded'
        })
      );
    });
  });

  describe('a page that comes back', () => {
    /**
     * jsdom has no back/forward cache, so these events are dispatched by hand.
     * What is assertable is the response -- the candidates are probed again --
     * and not that a real restore triggers it. That needs a browser.
     */
    const restored = async (event: Event) => {
      window.dispatchEvent(event);
      await waitFor(() => expect(attempted.length).toBeGreaterThan(1));
    };

    it('re-probes after a bfcache restore', async () => {
      render(SafeImage, {
        props: { sources: ['https://cdn.example/a.jpg'], alt: 'Cowboy Bebop' }
      });
      await screen.findByAltText('Cowboy Bebop');

      await restored(Object.assign(new Event('pageshow'), { persisted: true }));

      expect(attempted).toEqual(['https://cdn.example/a.jpg', 'https://cdn.example/a.jpg']);
    });

    it('ignores a pageshow that is not a restore', async () => {
      render(SafeImage, {
        props: { sources: ['https://cdn.example/a.jpg'], alt: 'Cowboy Bebop' }
      });
      await screen.findByAltText('Cowboy Bebop');

      window.dispatchEvent(Object.assign(new Event('pageshow'), { persisted: false }));
      await Promise.resolve();

      expect(attempted).toEqual(['https://cdn.example/a.jpg']);
    });

    it('re-probes after a mobile swipe-back', async () => {
      render(SafeImage, {
        props: { sources: ['https://cdn.example/a.jpg'], alt: 'Cowboy Bebop' }
      });
      await screen.findByAltText('Cowboy Bebop');

      await restored(new Event('swipe-navigation-restored'));

      expect(attempted).toHaveLength(2);
    });

    it('re-probes when a hidden tab comes back with the image still unpainted', async () => {
      render(SafeImage, {
        props: { sources: ['https://cdn.example/a.jpg'], alt: 'Cowboy Bebop' }
      });
      // Chosen but never painted -- the state a backgrounded mobile tab leaves
      // the element in.
      await screen.findByAltText('Cowboy Bebop');

      document.dispatchEvent(new Event('visibilitychange'));
      await waitFor(() => expect(attempted).toHaveLength(2));
    });

    it('does not re-probe for a tab whose image has already painted', async () => {
      render(SafeImage, {
        props: { sources: ['https://cdn.example/a.jpg'], alt: 'Cowboy Bebop' }
      });
      await fireEvent.load(await screen.findByAltText('Cowboy Bebop'));

      document.dispatchEvent(new Event('visibilitychange'));
      await Promise.resolve();

      expect(attempted).toEqual(['https://cdn.example/a.jpg']);
    });

    it('collapses two restores in the same frame into one walk', async () => {
      render(SafeImage, {
        props: { sources: ['https://cdn.example/a.jpg'], alt: 'Cowboy Bebop' }
      });
      await screen.findByAltText('Cowboy Bebop');

      // Both handlers queue a walk; the second finds one already in progress
      // and drops it rather than racing the first.
      window.dispatchEvent(Object.assign(new Event('pageshow'), { persisted: true }));
      window.dispatchEvent(new Event('swipe-navigation-restored'));

      await waitFor(() => expect(attempted).toHaveLength(2));
      // Settle anything still queued, then confirm nothing further ran.
      await new Promise((resolve) => setTimeout(resolve, 10));
      expect(attempted).toHaveLength(2);
    });

    it('drops its handlers when it goes away', async () => {
      const { unmount } = render(SafeImage, {
        props: { sources: ['https://cdn.example/a.jpg'], alt: 'Cowboy Bebop' }
      });
      await screen.findByAltText('Cowboy Bebop');

      unmount();
      window.dispatchEvent(Object.assign(new Event('pageshow'), { persisted: true }));
      await new Promise((resolve) => setTimeout(resolve, 10));

      expect(attempted).toEqual(['https://cdn.example/a.jpg']);
    });
  });

  describe('a caller that gave it nothing to go on', () => {
    it('falls straight through to the fallback', async () => {
      const onChosen = vi.fn();
      succeeds = () => false;
      render(SafeImage, { props: { alt: 'Cowboy Bebop', onChosen } });

      await waitFor(() =>
        expect(onChosen).toHaveBeenCalledWith({
          src: '/assets/not found.jpg',
          reason: 'all-failed'
        })
      );
    });

    it('takes a bare `src` as its single candidate, keyed through the CDN', async () => {
      render(SafeImage, { props: { src: 'abc123', alt: 'Cowboy Bebop' } });

      const img = await screen.findByAltText('Cowboy Bebop');
      expect(attempted).toHaveLength(1);
      expect(img).toHaveAttribute('src', attempted[0]);
      // The host comes from config's `cdn_url`, so it is not asserted here --
      // building that URL is `SafeImage.logic`'s job and has its own suite.
      expect(attempted[0]).toContain('abc123');
    });
  });
});
