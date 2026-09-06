import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/svelte';
import userEvent from '@testing-library/user-event';
import { readable } from 'svelte/store';
import { QueryClient } from '@tanstack/svelte-query';
import ShowSectionNav from './ShowSectionNav.svelte';
import { stubResizeObserver } from '$lib/components/__tests__/jsdom-gaps';
import { sectionTabs, type SectionTab } from '$lib/components/show/ShowContent.rules';
// The page that owns `active`. Imported for exactly one test -- the one that
// asks whether a click on this strip actually moves the marker -- because that
// question is only answerable with the thing on the other end of `onSelect`.
import { ShowContentBloc } from '../../../../routes/anime/[slug]/ShowContent.bloc.svelte';

vi.mock('svelte-sonner', () => ({ toast: { error: vi.fn() } }));

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

/**
 * The page behind the strip, with every port stubbed: no network, no window,
 * no router. `navigate` returns a promise, because the real one is `goto` and
 * the order of the scroll against it is the whole of the bug below.
 */
function showPage() {
  const tops: Record<string, number> = {
    'show-section-synopsis': 1036,
    'show-section-episodes': 1254,
    'show-section-characters': 2147
  };
  const viewport = {
    scrollY: vi.fn(() => 0),
    innerWidth: vi.fn(() => 1280),
    sectionTop: vi.fn((id: string): number | null => tops[id] ?? null),
    scrollTo: vi.fn((_top: number) => {}),
    cssLength: vi.fn((_name: string, fallback: number) => fallback),
    setStickyOffset: vi.fn((_px: number | null) => {}),
    onScroll: vi.fn((_listener: () => void) => vi.fn())
  };
  const navigate = vi.fn(async (_href: string) => {});
  const bloc = new ShowContentBloc({
    source: () => ({
      animeId: 'abc',
      ssrAnimeData: { anime: { id: 'abc', episodes: [{ episodeNumber: 1 }] } },
      ssrCharactersData: null,
      ssrError: null
    }),
    details: ((id: string) => ({ queryKey: ['details', id], queryFn: async () => ({}) })) as any,
    watched: ((id: string) => ({ queryKey: ['watched', id], queryFn: async () => [] })) as any,
    tracking: { save: vi.fn(), markEpisode: vi.fn() } as any,
    preferences: readable({ titleLanguage: 'english' }) as any,
    notifications: readable({ timingData: {}, countdowns: {} }) as any,
    config: { init: vi.fn(async () => ({})) } as any,
    flags: { isEnabled: () => false },
    viewport,
    navigate,
    notify: { error: vi.fn() },
    clock: () => new Date('2025-03-01T12:00:00Z'),
    imageUrl: (id: string) => id,
    queryClient: new QueryClient({
      defaultOptions: {
        queries: { retry: false, retryOnMount: false, refetchOnMount: false, staleTime: Infinity },
        mutations: { retry: false }
      }
    }),
    flagMaxTries: 0
  });
  return { bloc, viewport, navigate };
}

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
     * THE reported bug, now a real test.
     *
     * Clicking a section set the hash but left the marker on the first item,
     * on the click and afterwards. It was never this component -- the two tests
     * above are the proof -- and it was not the obvious page-level candidate
     * either: `selectSection()` does set the section before anything else.
     *
     * It was the ORDER of the two things it does next. `goto(..., { noScroll })`
     * does not leave the scroll position alone; it puts it back where it was,
     * with a `window.scrollTo(x, y)`. Issued after the section's own
     * `scrollTo({ behavior: 'smooth' })`, that cancelled the smooth scroll
     * outright: the page stopped short of the section, the scroll spy found
     * that nothing had crossed its threshold, fell back to `sections[0]` and
     * put the marker back on Synopsis. Measured in Chromium on the real page:
     * the click asked for y=1145 and the page settled at y=461.
     *
     * So the page half IS reachable from here after all -- what it turns on is
     * whether the scroll waits for the navigation, which is ordering, not
     * layout. This drives the strip against the real bloc with an async
     * navigate port, which is the shape that used to lose the race.
     */
    it('the page moves the marker to the section a click scrolled to', async () => {
      const page = showPage();
      const nav = () => ({
        sections: page.bloc.sections,
        active: page.bloc.activeSection,
        onSelect: (section: string) => page.bloc.selectSection(section)
      });

      const { rerender } = render(ShowSectionNav, { props: nav() });
      expect(screen.getByRole('button', { name: 'Synopsis' })).toHaveAttribute(
        'aria-pressed',
        'true'
      );

      await userEvent.click(screen.getByRole('button', { name: /Episodes/ }));

      // The navigation settles first, and only then is the section scrolled to
      // -- the reverse of that is the bug.
      await waitFor(() => expect(page.viewport.scrollTo).toHaveBeenCalledTimes(1));
      expect(page.navigate).toHaveBeenCalledWith('#show-section-episodes');
      expect(page.navigate.mock.invocationCallOrder[0]).toBeLessThan(
        page.viewport.scrollTo.mock.invocationCallOrder[0]
      );

      // And the marker the page hands back is the section it scrolled to.
      expect(page.bloc.activeSection).toBe('episodes');
      await rerender(nav());
      expect(screen.getByRole('button', { name: /Episodes/ })).toHaveAttribute(
        'aria-pressed',
        'true'
      );
      expect(screen.getByRole('button', { name: 'Synopsis' })).toHaveAttribute(
        'aria-pressed',
        'false'
      );
    });

    it('keeps the marker on the clicked section when the scroll spy runs after it', async () => {
      // The spy runs on every scroll event of the smooth scroll. Once the page
      // has actually arrived, it has to agree with the click rather than
      // fall back to the first section -- which is what it did while the
      // scroll was being cancelled underneath it.
      const page = showPage();

      page.bloc.selectSection('episodes');
      await waitFor(() => expect(page.viewport.scrollTo).toHaveBeenCalled());

      // Where the page now is: the section sits just under the pinned bars.
      const arrived: Record<string, number> = {
        'show-section-synopsis': -400,
        'show-section-episodes': 108,
        'show-section-characters': 900
      };
      page.viewport.sectionTop.mockImplementation((id: string): number | null => arrived[id] ?? null);
      page.bloc.syncScroll();

      expect(page.bloc.activeSection).toBe('episodes');
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
