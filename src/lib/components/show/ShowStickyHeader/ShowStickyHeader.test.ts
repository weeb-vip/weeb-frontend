import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { render, screen, within } from '@testing-library/svelte';
import ShowStickyHeader from './ShowStickyHeader.svelte';
import { stubNeverLoadingImages, stubResizeObserver } from '$lib/components/__tests__/jsdom-gaps';

/**
 * The compact bar that takes over once the hero has scrolled away.
 *
 * Two things about it are structural rather than visual, and both are here: it
 * portals itself to `<body>` (a fixed element cannot have a transformed
 * ancestor, and the hero grows those), and its title is deliberately NOT an
 * `h1` -- having one here made every show page emit two identical h1s.
 *
 * Because it portals, `container` from `render()` is empty: everything is
 * queried through `screen`, which searches the whole document.
 */

let restore: (() => void)[] = [];
beforeEach(() => {
  // The bar measures its own height back out (`bind:clientHeight`) and carries
  // a poster through SafeImage.
  restore = [stubResizeObserver(), stubNeverLoadingImages()];
});
afterEach(() => restore.forEach((fn) => fn()));

const anime = { id: 'a1', startDate: '1998-04-03T00:00:00Z' };

const base = { anime, title: 'Cowboy Bebop' };

const bar = () => document.querySelector('[data-sticky-header]') as HTMLElement;

describe('ShowStickyHeader', () => {
  describe('the document outline', () => {
    /**
     * REGRESSION. This repeats the title as navigation chrome; the page's h1 is
     * the hero title. An `h1` here gave every show page two identical ones.
     */
    it('renders the title as a paragraph, never a second h1', () => {
      render(ShowStickyHeader, { props: base });

      expect(screen.queryAllByRole('heading')).toHaveLength(0);
      const title = bar().querySelector('.sticky-header__title') as HTMLElement;
      expect(title.tagName).toBe('P');
      expect(title).toHaveTextContent('Cowboy Bebop');
    });
  });

  describe('the portal', () => {
    it('moves itself to <body>, so no transformed ancestor can unpin it', () => {
      const { container } = render(ShowStickyHeader, { props: base });

      expect(container.contains(bar())).toBe(false);
      expect(bar().parentElement).toBe(document.body);
    });

    it('takes itself back out of <body> when the page unmounts', () => {
      const { unmount } = render(ShowStickyHeader, { props: base });
      expect(bar()).toBeInTheDocument();

      unmount();

      expect(document.querySelector('[data-sticky-header]')).toBeNull();
    });
  });

  describe('showing and hiding', () => {
    it('is hidden from assistive tech while the hero is still on screen', () => {
      render(ShowStickyHeader, { props: { ...base, visible: false } });

      // It is always in the DOM -- it slides in rather than mounting -- so
      // `aria-hidden` is what keeps it out of the accessibility tree while it
      // is off screen. Its transform is CSS and invisible to jsdom.
      expect(bar()).toHaveAttribute('aria-hidden', 'true');
      expect(bar()).not.toHaveClass('is-visible');
      // And `aria-hidden` on the wrapper takes the whole bar out of the
      // accessibility tree, so its action is genuinely unreachable rather than
      // merely off screen -- which is the point of setting it at all.
      expect(within(bar()).queryByRole('button')).not.toBeInTheDocument();
    });

    it('is exposed and marked visible once the hero has scrolled away', async () => {
      const { rerender } = render(ShowStickyHeader, { props: { ...base, visible: false } });

      await rerender({ ...base, visible: true });

      expect(bar()).toHaveAttribute('aria-hidden', 'false');
      expect(bar()).toHaveClass('is-visible');
    });
  });

  describe('the one line of qualifiers', () => {
    it('reads year, airing state and studio', () => {
      render(ShowStickyHeader, {
        props: { ...base, airingLabel: 'Finished', studio: 'Sunrise' }
      });

      expect(bar().querySelector('.sticky-header__meta')?.textContent?.replace(/\s+/g, ' ').trim())
        .toBe('1998 • Finished• Sunrise');
    });

    it('drops the studio, and its separator with it, when there is none', () => {
      render(ShowStickyHeader, { props: { ...base, airingLabel: 'Airing' } });

      expect(bar().querySelector('.sticky-header__meta')?.textContent?.replace(/\s+/g, ' ').trim())
        .toBe('1998 • Airing');
    });

    it('reads "TBA" rather than an empty year for an unscheduled show', () => {
      render(ShowStickyHeader, {
        props: { ...base, anime: { id: 'a1' }, airingLabel: 'Upcoming' }
      });

      expect(bar().querySelector('.sticky-header__meta')).toHaveTextContent('TBA');
    });

    it('survives a record the page has not resolved yet', () => {
      // `getYearUTC(anime?.startDate)` is optional-chained on purpose: the bar
      // renders for a beat before the query answers.
      render(ShowStickyHeader, { props: { anime: null, title: '' } });

      expect(bar()).toBeInTheDocument();
    });
  });

  describe('the blurred plate', () => {
    it('carries the hero artwork as a background image', () => {
      render(ShowStickyHeader, { props: { ...base, background: '/banners/a1.jpg' } });

      // The inline `background-image` is the contract -- the page hands the
      // bar the hero's first candidate so the two agree on the artwork. How
      // blurred it ends up is CSS.
      expect(bar().querySelector('.sticky-header__plate')?.getAttribute('style')).toContain(
        '/banners/a1.jpg'
      );
    });

    it('draws no plate image at all before the artwork is known', () => {
      render(ShowStickyHeader, { props: base });

      expect(bar().querySelector('.sticky-header__plate')).toHaveAttribute(
        'style',
        'background-image: none;'
      );
    });
  });

  describe('the poster and the action', () => {
    it('carries the compact tracking control once the bar is showing', () => {
      render(ShowStickyHeader, { props: { ...base, visible: true } });

      // `compact` draws the small labelled button -- "Add to list", lower-case
      // "list", where the hero variant title-cases it.
      expect(within(bar()).getByRole('button', { name: 'Add to list' })).toBeInTheDocument();
    });

    it('swaps to the status control for a show already on the list', () => {
      render(ShowStickyHeader, {
        props: {
          ...base,
          visible: true,
          anime: { ...anime, userAnime: { id: 'u1', status: 'COMPLETED' } }
        }
      });

      expect(within(bar()).queryByRole('button', { name: /Add to list/i })).not.toBeInTheDocument();
      expect(bar().querySelector('.asd-label')).toHaveTextContent('Completed');
    });

    it('keeps the cover decorative -- the bar already names the show', () => {
      render(ShowStickyHeader, { props: { ...base, visible: true } });

      expect(within(bar()).queryAllByRole('img')).toHaveLength(0);
    });
  });

  describe('long titles', () => {
    it('keeps the whole title in the DOM; the ellipsis is CSS', () => {
      const title = 'A show with an extremely long localised title that will not fit on one line';
      render(ShowStickyHeader, { props: { ...base, title } });

      // `text-overflow: ellipsis` truncates visually only. Whether it actually
      // truncates -- and at what width -- needs a browser.
      expect(bar().querySelector('.sticky-header__title')).toHaveTextContent(title);
    });
  });
});
