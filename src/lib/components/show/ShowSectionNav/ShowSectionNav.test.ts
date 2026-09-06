import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, within } from '@testing-library/svelte';
import userEvent from '@testing-library/user-event';
import ShowSectionNav from './ShowSectionNav.svelte';
import { stubResizeObserver } from '$lib/components/__tests__/jsdom-gaps';
import { sectionTabs, type SectionTab } from '$lib/components/show/ShowContent.rules';

/**
 * The strip pinned under the nav that says which part of the page you are in.
 *
 * It is presentational: `active` is the page's state and every click leaves as
 * a callback, so what is testable here is the ARIA shape, the labels, and that
 * the marker follows the prop. Whether the *page* then moves `active` is the
 * page's business and belongs to the e2e layer.
 */

const sections: SectionTab[] = [
  { value: 'synopsis', label: 'Synopsis' },
  { value: 'news', label: 'News', count: 3 },
  { value: 'episodes', label: 'Episodes', count: 26 },
  { value: 'characters', label: 'Characters' }
];

// The bar measures its own height back out with `bind:clientHeight`, which
// compiles to a ResizeObserver jsdom does not have.
let restoreResizeObserver: () => void;
beforeEach(() => {
  restoreResizeObserver = stubResizeObserver();
});
afterEach(() => restoreResizeObserver());

const props = (overrides: Partial<Record<string, unknown>> = {}) => ({
  sections,
  active: 'synopsis',
  onSelect: () => {},
  ...overrides
});

describe('ShowSectionNav', () => {
  describe('the ARIA shape', () => {
    /**
     * These buttons scroll the page; they do not swap panels. There is no
     * `tabpanel` anywhere in the codebase, so a `tablist` would promise a
     * keyboard user panels that do not exist -- and it would strip the buttons
     * of their implicit role, which is how `news.spec.ts` addresses them.
     */
    it('renders plain buttons, never a tablist', () => {
      render(ShowSectionNav, { props: props() });

      expect(screen.queryByRole('tablist')).not.toBeInTheDocument();
      expect(screen.queryAllByRole('tab')).toHaveLength(0);
      expect(screen.getAllByRole('button')).toHaveLength(4);
    });

    it('is a navigation landmark named "Section navigation"', () => {
      render(ShowSectionNav, { props: props() });

      const nav = screen.getByRole('navigation', { name: 'Section navigation' });
      expect(within(nav).getAllByRole('button')).toHaveLength(4);
    });

    it('leaves every entry its own tab stop -- no roving tabindex', () => {
      render(ShowSectionNav, { props: props() });

      for (const button of screen.getAllByRole('button')) {
        expect(button).not.toHaveAttribute('tabindex');
      }
    });
  });

  describe('the active marker', () => {
    it('presses the active entry and only that one', () => {
      render(ShowSectionNav, { props: props({ active: 'episodes' }) });

      expect(screen.getByRole('button', { name: /Episodes/ })).toHaveAttribute(
        'aria-pressed',
        'true'
      );
      for (const name of ['Synopsis', 'News', 'Characters']) {
        expect(screen.getByRole('button', { name: new RegExp(name) })).toHaveAttribute(
          'aria-pressed',
          'false'
        );
      }
    });

    it('moves the marker when the page hands it a new active section', async () => {
      const { rerender } = render(ShowSectionNav, { props: props({ active: 'synopsis' }) });

      expect(screen.getByRole('button', { name: 'Synopsis' })).toHaveAttribute(
        'aria-pressed',
        'true'
      );

      await rerender(props({ active: 'characters' }));

      expect(screen.getByRole('button', { name: 'Characters' })).toHaveAttribute(
        'aria-pressed',
        'true'
      );
      expect(screen.getByRole('button', { name: 'Synopsis' })).toHaveAttribute(
        'aria-pressed',
        'false'
      );
    });

    /**
     * REPORTED BUG, left skipped: clicking a section on the show page sets the
     * location hash but the pressed marker stays on the first item, both on
     * click and via the scroll spy.
     *
     * It is NOT in this component, and the two tests above are the proof: the
     * marker follows `active` on the first render and on every rerender. Nor is
     * it the obvious page-level candidate -- `ShowContentBloc.selectSection()`
     * does set `#activeSection = section` before it scrolls and writes the hash.
     * The remaining suspects are both things jsdom cannot reach: `syncScroll()`
     * recomputing `activeSection(...)` from live element positions and
     * overwriting the click's answer mid-smooth-scroll, and the threshold
     * (`navHeight + 160`) disagreeing with where `sectionScrollTop()` actually
     * lands the section. jsdom performs no layout, implements no
     * `window.scrollTo` and reports every `getBoundingClientRect()` as zero, so
     * a unit test here would only re-assert the stubs it was given.
     *
     * Reproduce in a browser: load /anime/<slug>, click "Episodes", observe
     * `location.hash` become `#show-section-episodes` while
     * `[aria-pressed="true"]` is still "Synopsis". Pinning it belongs to the
     * Playwright layer; this placeholder is here because it is where a reader
     * looks for it first.
     *
     * Do NOT "fix" ShowSectionNav to make this pass -- this source is correct.
     */
    it.skip('the page moves the marker to the section a click scrolled to', () => {
      // Belongs to a real browser: click "Episodes" -> the page's activeSection
      // becomes "episodes" -> this component's `active` prop follows.
    });
  });

  describe('the entries', () => {
    it('labels each entry, with its count beside it where there is one', () => {
      render(ShowSectionNav, { props: props() });

      const news = screen.getByRole('button', { name: /News/ });
      expect(news).toHaveTextContent('News');
      expect(news).toHaveTextContent('3');

      const episodes = screen.getByRole('button', { name: /Episodes/ });
      expect(episodes).toHaveTextContent('26');

      // No count on the two unconditional sections: a "0" would read as a fact.
      expect(screen.getByRole('button', { name: 'Synopsis' }).textContent?.trim()).toBe('Synopsis');
    });

    it('draws exactly the sections `sectionTabs` decided exist', () => {
      // The nav renders what it is given -- which sections exist is
      // `sectionTabs`'s decision and is covered by its own suite. What is
      // asserted here is that nothing is added or dropped in between.
      const tabs = sectionTabs({ newsEnabled: false, newsCount: 0, episodeCount: 0 });
      render(ShowSectionNav, { props: props({ sections: tabs }) });

      expect(screen.getAllByRole('button').map((b) => b.textContent?.trim())).toEqual([
        'Synopsis',
        'Characters'
      ]);
    });

    it('renders nothing but the bar when there are no sections at all', () => {
      render(ShowSectionNav, { props: props({ sections: [] }) });

      const nav = screen.getByRole('navigation', { name: 'Section navigation' });
      expect(within(nav).queryAllByRole('button')).toHaveLength(0);
    });
  });

  describe('interaction', () => {
    it('reports the section value, not its label, when one is clicked', async () => {
      const onSelect = vi.fn();
      render(ShowSectionNav, { props: props({ onSelect }) });

      await userEvent.click(screen.getByRole('button', { name: /Episodes/ }));

      expect(onSelect).toHaveBeenCalledExactlyOnceWith('episodes');
    });

    it('reports the already-active section too, so a re-click still scrolls back', async () => {
      const onSelect = vi.fn();
      render(ShowSectionNav, { props: props({ active: 'news', onSelect }) });

      await userEvent.click(screen.getByRole('button', { name: /News/ }));

      expect(onSelect).toHaveBeenCalledExactlyOnceWith('news');
    });

    it('is reachable and activatable from the keyboard', async () => {
      const onSelect = vi.fn();
      render(ShowSectionNav, { props: props({ onSelect }) });

      screen.getByRole('button', { name: /Episodes/ }).focus();
      await userEvent.keyboard('{Enter}');

      expect(onSelect).toHaveBeenCalledWith('episodes');
    });
  });

  describe('the sticky offset', () => {
    it('applies the offset the page measured as an inline `top`', () => {
      const { container } = render(ShowSectionNav, {
        props: props({ top: 'calc(var(--weeb-nav-height, 60px) + 71px)' })
      });

      // The inline style IS the contract: `tabBarTop()` computes this string
      // and the bar's stickiness depends on it landing on the element. That it
      // then *sticks* is a layout fact jsdom cannot see -- Playwright's job.
      expect(container.querySelector('.tab-bar')).toHaveAttribute(
        'style',
        expect.stringContaining('top: calc(var(--weeb-nav-height, 60px) + 71px)')
      );
    });

    it('carries the `data-tab-bar` hook the page and the e2e suite measure it by', () => {
      const { container } = render(ShowSectionNav, { props: props() });

      expect(container.querySelector('[data-tab-bar]')).toBeInTheDocument();
    });
  });
});
