import { describe, it, expect, vi } from 'vitest';
import { readable } from 'svelte/store';
import type { TitleLanguage } from '$lib/stores/preferences';
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
