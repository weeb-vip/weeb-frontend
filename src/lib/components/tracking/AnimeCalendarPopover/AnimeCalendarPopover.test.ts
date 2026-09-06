import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/svelte';
import userEvent from '@testing-library/user-event';
import { readable } from 'svelte/store';
import type { TitleLanguage } from '$lib/stores/preferences';
import { stubNeverLoadingImages } from '$lib/components/__tests__/jsdom-gaps';
import AnimeCalendarPopover from './AnimeCalendarPopover.svelte';
import {
  AnimeCalendarPopoverBloc,
  browserMediaQuery,
  type AnimeCalendarPopoverDeps,
  type MediaQueryPort
} from './AnimeCalendarPopover.bloc.svelte';

const ANIME = {
  id: 'a1',
  slug: 'frieren',
  titleEn: 'Frieren',
  titleJp: '葬送のフリーレン',
  tags: ['Adventure', 'Fantasy', 'Drama', 'Award Winning'],
  duration: '24 min per ep',
  episodeAirTime: new Date('2024-03-01T14:30:00Z'),
  episodes: [{ episodeNumber: 12, titleEn: 'Frieren the Slayer', airDate: '2024-03-01T14:30:00Z' }]
};

/** A media query the test can flip. */
function media(initial: boolean) {
  let listener: ((matches: boolean) => void) | null = null;
  let matches = initial;
  const port: MediaQueryPort = {
    matches: () => matches,
    onChange: (_query, fn) => {
      listener = fn;
      return () => {
        listener = null;
      };
    }
  };
  return {
    port,
    get listening() {
      return listener !== null;
    },
    resizeTo(next: boolean) {
      matches = next;
      listener?.(next);
    }
  };
}

function makeBloc(
  anime: unknown = ANIME,
  deps: AnimeCalendarPopoverDeps = {},
  language: TitleLanguage = 'english'
) {
  return new AnimeCalendarPopoverBloc(
    { anime },
    {
      preferences: readable({ titleLanguage: language }),
      mediaQuery: media(false).port,
      ...deps
    }
  );
}

describe('AnimeCalendarPopoverBloc', () => {
  describe('the cell', () => {
    it('titles the show in the reader’s language', () => {
      expect(makeBloc(ANIME, {}, 'english').title).toBe('Frieren');
      expect(makeBloc(ANIME, {}, 'japanese').title).toBe('葬送のフリーレン');
    });

    it('links by slug, falling back to the id', () => {
      expect(makeBloc().href).toBe('/anime/frieren');
      expect(makeBloc({ id: 'a1' }).href).toBe('/anime/a1');
    });

    it('names the show, the episode and the time in the button’s tooltip', () => {
      expect(makeBloc().buttonTitle).toMatch(/^Frieren \(Ep 12\) at \d{1,2}:\d{2} (AM|PM)$/);
    });

    it('leaves the time out of the tooltip when there is none', () => {
      const bloc = makeBloc({ ...ANIME, episodeAirTime: null });

      expect(bloc.airTimeText).toBeNull();
      expect(bloc.buttonTitle).toBe('Frieren (Ep 12)');
    });

    it('says "?" for an entry with no episode packed into it', () => {
      const bloc = makeBloc({ ...ANIME, episodes: [] });

      expect(bloc.episodeNumber).toBe('?');
      expect(bloc.episode).toBeUndefined();
    });

    it('reads the first episode -- the calendar packs one per entry', () => {
      expect(makeBloc().episode.episodeNumber).toBe(12);
      expect(makeBloc().episodeNumber).toBe('12');
    });
  });

  describe('the card', () => {
    it('shows at most three tags -- what fits on one line beside the poster', () => {
      // The row used to marquee the whole list on hover, which a touch device
      // cannot reach, and this popover opens from a tap.
      expect(makeBloc().tags).toEqual(['Adventure', 'Fantasy', 'Drama']);
    });

    it('shows no tags for a record with none', () => {
      expect(makeBloc({ ...ANIME, tags: null }).tags).toEqual([]);
      expect(makeBloc({ ...ANIME, tags: [] }).tags).toEqual([]);
    });

    it('prefers the resolved air time for the date line', () => {
      expect(makeBloc().airDateLabel).toMatch(
        /^\w{3} \w{3} \d{1,2}(st|nd|rd|th) at \d{1,2}:\d{2} (AM|PM)$/
      );
    });

    it('falls back to the episode’s own date, with no time on it', () => {
      const bloc = makeBloc({ ...ANIME, episodeAirTime: null });

      expect(bloc.airDateLabel).toMatch(/^\w{3} \w{3} \d{1,2}(st|nd|rd|th)$/);
    });

    it('says Unknown rather than an invalid date', () => {
      expect(makeBloc({ ...ANIME, episodeAirTime: null, episodes: [{}] }).airDateLabel).toBe(
        'Unknown'
      );
      expect(makeBloc({ id: 'a1' }).airDateLabel).toBe('Unknown');
    });

    it('prefers the episode’s English title, then its Japanese one, then Unknown', () => {
      expect(makeBloc().episodeTitle).toBe('Frieren the Slayer');
      expect(makeBloc({ ...ANIME, episodes: [{ titleJp: 'JP' }] }).episodeTitle).toBe('JP');
      expect(makeBloc({ ...ANIME, episodes: [{}] }).episodeTitle).toBe('Unknown');
    });

    it('trims MyAnimeList’s "per ep" off the duration', () => {
      expect(makeBloc().episodeLength).toBe('24 min ');
      expect(makeBloc({ ...ANIME, duration: '24 min' }).episodeLength).toBe('24 min');
      expect(makeBloc({ ...ANIME, duration: null }).episodeLength).toBe('?');
    });
  });

  describe('opening and closing', () => {
    it('starts closed and toggles', () => {
      const bloc = makeBloc();

      expect(bloc.isOpen).toBe(false);
      bloc.togglePopover();
      expect(bloc.isOpen).toBe(true);
      bloc.togglePopover();
      expect(bloc.isOpen).toBe(false);
    });

    it('closes, and closing again is a no-op', () => {
      const bloc = makeBloc();
      bloc.togglePopover();

      bloc.closePopover();
      bloc.closePopover();

      expect(bloc.isOpen).toBe(false);
    });
  });

  describe('the viewport', () => {
    it('takes the media query’s answer at construction', () => {
      expect(makeBloc(ANIME, { mediaQuery: media(true).port }).isCompact).toBe(true);
      expect(makeBloc(ANIME, { mediaQuery: media(false).port }).isCompact).toBe(false);
    });

    it('follows a resize across the breakpoint', () => {
      const screen = media(false);
      const bloc = makeBloc(ANIME, { mediaQuery: screen.port });
      bloc.watchViewport();

      screen.resizeTo(true);
      expect(bloc.isCompact).toBe(true);

      screen.resizeTo(false);
      expect(bloc.isCompact).toBe(false);
    });

    it('hands its teardown back for the view’s effect', () => {
      const screen = media(false);
      const bloc = makeBloc(ANIME, { mediaQuery: screen.port });

      const stop = bloc.watchViewport();
      expect(screen.listening).toBe(true);

      stop();
      expect(screen.listening).toBe(false);
    });
  });
});

describe('browserMediaQuery', () => {
  it('asks the browser and answers change events', () => {
    const listeners: ((e: { matches: boolean }) => void)[] = [];
    const removeEventListener = vi.fn();
    vi.stubGlobal(
      'matchMedia',
      vi.fn(() => ({
        matches: true,
        addEventListener: (_: string, fn: (e: { matches: boolean }) => void) => listeners.push(fn),
        removeEventListener
      }))
    );

    expect(browserMediaQuery.matches('(max-width: 767px)')).toBe(true);

    const listener = vi.fn();
    const stop = browserMediaQuery.onChange('(max-width: 767px)', listener);
    listeners[0]({ matches: false });
    expect(listener).toHaveBeenCalledWith(false);

    stop();
    expect(removeEventListener).toHaveBeenCalledTimes(1);
    vi.unstubAllGlobals();
  });
});

/**
 * The calendar cell and the card it opens.
 *
 * The strings -- the title, the tooltip, the date line, the three tags -- are
 * the bloc's and are asserted above. What is asserted here is the markup: that
 * the cell is a button that says whether it is expanded, what the episode row
 * actually contains, and that the two shared actions (`clickOutside`,
 * `anchoredPosition`) are wired up rather than re-hand-rolled.
 *
 * jsdom caveats:
 *  - `SafeImage` probes each candidate with `new Image()`, which never settles
 *    here, so the poster is stubbed into its failed state (`stubNeverLoadingImages`)
 *    and the artwork itself is not assertable.
 *  - jsdom performs no layout: every `getBoundingClientRect()` is zeros and no
 *    stylesheet is loaded. So `anchoredPosition`'s *numbers* are meaningless
 *    here and are not asserted -- only its contract, that the surface is made
 *    `position: fixed` and stamped with the placement it chose. The arithmetic
 *    has its own suite in `actions/__tests__/anchoredPosition.test.ts`; where
 *    the card actually lands is a browser fact.
 *  - the phone backdrop is hidden from `md` up by a `md:hidden` utility, which
 *    no stylesheet applies here, so its presence is assertable but its
 *    visibility is not.
 */
describe('AnimeCalendarPopover', () => {
  let restoreImages: () => void;
  beforeEach(() => {
    restoreImages = stubNeverLoadingImages();
    // jsdom implements no `window.matchMedia` at all. The component builds its
    // own bloc from `$props()` regardless of whether one is injected, and that
    // constructor asks the real `browserMediaQuery` -- so without this every
    // mount throws before any markup exists. It answers "not compact", which is
    // the desktop case; the phone case is driven through the injected bloc's
    // own fake port instead, since jsdom has no viewport to narrow.
    vi.stubGlobal(
      'matchMedia',
      vi.fn(() => ({ matches: false, addEventListener() {}, removeEventListener() {} }))
    );
  });
  afterEach(() => {
    restoreImages();
    vi.unstubAllGlobals();
  });

  function renderCell(
    options: {
      anime?: unknown;
      compact?: boolean;
      track?: (id: string, title: string) => void;
      language?: TitleLanguage;
    } = {}
  ) {
    const track = options.track ?? vi.fn();
    const anime = options.anime ?? ANIME;
    const bloc = makeBloc(
      anime,
      { mediaQuery: media(options.compact ?? false).port },
      options.language ?? 'english'
    );
    const result = render(AnimeCalendarPopover, { props: { anime, bloc, track } });
    return { ...result, track, bloc };
  }

  const cell = () => screen.getByRole('button', { expanded: false }) as HTMLButtonElement;
  const popover = () => document.querySelector('.calendar-popover') as HTMLElement;

  async function open(rendered = renderCell()) {
    await userEvent.click(cell());
    await screen.findByRole('link');
    return rendered;
  }

  describe('the cell', () => {
    it('is a button naming the show and the episode, closed to begin with', () => {
      renderCell();

      const button = cell();
      expect(button).toHaveAttribute('aria-expanded', 'false');
      expect(button).toHaveTextContent('Frieren (Ep 12)');
      expect(button).toHaveAttribute('title', expect.stringContaining('Frieren (Ep 12) at'));
    });

    it('carries the air time on a second line when there is one', () => {
      const { container } = renderCell();

      // The same clock string the tooltip uses, rendered as its own line.
      const time = container.querySelector('button span:last-child');
      expect(time?.textContent?.trim()).toMatch(/^\d{1,2}:\d{2} (AM|PM)$/);
    });

    it('shows the title alone when the episode has no known air time', () => {
      renderCell({ anime: { ...ANIME, episodeAirTime: null } });

      const button = cell();
      expect(button).toHaveTextContent('Frieren (Ep 12)');
      expect(button).toHaveAttribute('title', 'Frieren (Ep 12)');
    });

    it('draws no card until the cell is used', () => {
      renderCell();

      expect(popover()).not.toBeInTheDocument();
      expect(screen.queryByRole('link')).not.toBeInTheDocument();
    });
  });

  describe('the card it opens', () => {
    it('opens on a click and says so on the cell', async () => {
      await open();

      expect(popover()).toBeInTheDocument();
      expect(screen.getByRole('button', { expanded: true })).toBeInTheDocument();
    });

    it('is one link to the show, carrying the title, the tags and the episode', async () => {
      await open();

      const row = screen.getByRole('link');
      expect(row).toHaveAttribute('href', '/anime/frieren');
      expect(row).toHaveTextContent('Frieren');
      expect(row).toHaveTextContent('Frieren the Slayer');
      expect(row).toHaveTextContent('Episode 12');
    });

    it('shows the three tags that fit beside the poster, and no more', async () => {
      await open();

      const row = screen.getByRole('link');
      for (const tag of ['Adventure', 'Fantasy', 'Drama']) {
        expect(within(row).getByText(tag)).toBeInTheDocument();
      }
      expect(within(row).queryByText('Award Winning')).not.toBeInTheDocument();
    });

    it('draws no tag strip at all for a show with none', async () => {
      const { container } = await open(renderCell({ anime: { ...ANIME, tags: [] } }));

      expect(container.ownerDocument.querySelector('.episode-tags')).not.toBeInTheDocument();
    });

    it('dates the episode', async () => {
      await open();

      expect(screen.getByRole('link')).toHaveTextContent(/\w{3} \w{3} \d+(st|nd|rd|th) at/);
    });

    it('reports the view when the row is opened', async () => {
      const track = vi.fn();
      await open(renderCell({ track }));

      await userEvent.click(screen.getByRole('link'));

      expect(track).toHaveBeenCalledWith('a1', 'Frieren');
    });
  });

  /**
   * The card is `position: fixed` and hung off the cell by `anchoredPosition`,
   * which replaced hand-rolled maths that added `window.scrollY` to a fixed
   * element -- so the card drifted down the page by exactly the scroll offset.
   * The contract is what is checked; the numbers are meaningless without layout.
   */
  describe('placement', () => {
    it('is positioned by the shared action rather than by the flow', async () => {
      await open();

      const card = popover();
      expect(card.style.position).toBe('fixed');
      // The action stamps which side of the cell it chose, for transform-origin.
      expect(card.dataset.placement).toMatch(/^(top|bottom)$/);
    });

    it('positions the phone layout the same way -- only the alignment differs', async () => {
      await open(renderCell({ compact: true }));

      expect(popover().style.position).toBe('fixed');
    });
  });

  describe('dismissal', () => {
    /**
     * The dismiss rule is the shared `clickOutside` action, with the cell passed
     * as an `ignore` so the click that opened the card cannot also close it.
     */
    it('closes on a click anywhere outside the card', async () => {
      await open();

      await userEvent.click(document.body);

      await waitFor(() => expect(popover()).not.toBeInTheDocument());
    });

    it('stays open for a click inside the card', async () => {
      await open();

      await userEvent.click(within(popover()).getByText('Frieren the Slayer'));

      expect(popover()).toBeInTheDocument();
    });

    it('closes when the cell is used a second time', async () => {
      await open();

      await userEvent.click(screen.getByRole('button', { expanded: true }));

      await waitFor(() => expect(popover()).not.toBeInTheDocument());
    });

    it('offers a phone-sized backdrop to dismiss with, named for a screen reader', async () => {
      await open();

      const backdrop = screen.getByRole('button', { name: 'Close popover' });
      await userEvent.click(backdrop);

      await waitFor(() => expect(popover()).not.toBeInTheDocument());
    });

    it('takes its document listener with it when the cell is destroyed while open', async () => {
      const { unmount } = await open();

      unmount();

      expect(popover()).not.toBeInTheDocument();
      // A click that would have reached a stranded handler is now inert.
      expect(() => document.body.click()).not.toThrow();
    });
  });
});
