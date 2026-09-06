import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/svelte';
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
