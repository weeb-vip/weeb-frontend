import { describe, it, expect, vi } from 'vitest';
import { readable } from 'svelte/store';
import type { EpisodeTiming } from '$lib/services/airTimeUtils';
import type { TitleLanguage } from '$lib/stores/preferences';
import {
  HeroBannerBloc,
  type HeroBannerDeps,
  type HeroBannerInputs,
  type MediaQueryPort
} from './HeroBanner.bloc.svelte';

const ANIME = {
  id: 'a1',
  titleEn: 'Frieren',
  titleJp: '葬送のフリーレン',
  description: 'A long walk.'
};

/** The image-url port, so candidates are readable rather than CDN strings. */
const imageUrl = (id: string, path?: string) => (path ? `cdn/${path}/${id}` : `cdn/${id}`);

/** A media query the test can flip. */
function media(initial: boolean) {
  let listener: ((matches: boolean) => void) | null = null;
  let matches = initial;
  const port: MediaQueryPort = {
    matches: () => matches,
    onChange: (_q, fn) => {
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

const timing = (overrides: Partial<EpisodeTiming> = {}): EpisodeTiming =>
  ({
    isLive: false,
    hasAired: false,
    countdown: '2h',
    airDateTime: new Date(Date.now() + 2 * 60 * 60 * 1000),
    ...overrides
  }) as EpisodeTiming;

function makeBloc(
  inputs: Partial<HeroBannerInputs> = {},
  deps: HeroBannerDeps = {},
  language: TitleLanguage = 'english'
) {
  return new HeroBannerBloc(
    { anime: ANIME, timing: null, ...inputs },
    {
      config: { init: vi.fn(async () => undefined) },
      notifications: readable({ timingData: {}, countdowns: {} }),
      preferences: readable({ titleLanguage: language }),
      auth: readable({ isLoggedIn: false, isAuthInitialized: true }),
      imageUrl,
      webPProbe: vi.fn(async () => true),
      mediaQuery: media(false).port,
      ...deps
    }
  );
}

describe('HeroBannerBloc', () => {
  describe('which artwork to try', () => {
    it('leads with the wide banner on a wide hero', () => {
      const bloc = makeBloc({}, { mediaQuery: media(false).port });

      // A poster cropped to a wide frame still beats a 225px image blown up.
      expect(bloc.imageSources).toEqual(['cdn/banners/a1', 'cdn/posters/a1', 'cdn/a1']);
    });

    it('leads with the tall poster on a phone', () => {
      const bloc = makeBloc({}, { mediaQuery: media(true).port });

      // Cropping a 16:9 banner into a 100svh box usually frames background
      // with the subject outside it.
      expect(bloc.imageSources).toEqual(['cdn/posters/a1', 'cdn/a1', 'cdn/banners/a1']);
    });

    it('keeps the 225px MyAnimeList image out of first place either way', () => {
      for (const phone of [true, false]) {
        const bloc = makeBloc({}, { mediaQuery: media(phone).port });

        expect(bloc.imageSources[0]).not.toBe('cdn/a1');
      }
    });

    it('offers nothing for a record with no id', () => {
      expect(makeBloc({ anime: { titleEn: 'Orphan' } }).imageSources).toEqual([]);
    });

    it('re-picks the art when the viewport rotates across the breakpoint', () => {
      const screen = media(false);
      const bloc = makeBloc({}, { mediaQuery: screen.port });
      bloc.init();

      screen.resizeTo(true);

      expect(bloc.isPhone).toBe(true);
      expect(bloc.imageSources[0]).toBe('cdn/posters/a1');
    });

    it('asks the CDN for less art on a phone', () => {
      expect(makeBloc({}, { mediaQuery: media(true).port }).heroCdnWidth).toBe(800);
      expect(makeBloc({}, { mediaQuery: media(false).port }).heroCdnWidth).toBe(1600);
    });
  });

  describe('bringing the banner up', () => {
    it('loads config and probes WebP', async () => {
      const config = { init: vi.fn(async () => undefined) };
      const webPProbe = vi.fn(async () => true);
      const bloc = makeBloc({}, { config, webPProbe });

      bloc.init();
      await new Promise((resolve) => setTimeout(resolve, 1));

      expect(config.init).toHaveBeenCalledTimes(1);
      expect(bloc.supportsWebP).toBe(true);
    });

    it('hands back the teardown, rather than leaking the listener', () => {
      const screen = media(false);
      const bloc = makeBloc({}, { mediaQuery: screen.port });

      const stop = bloc.init();
      expect(screen.listening).toBe(true);

      stop();
      expect(screen.listening).toBe(false);
    });
  });

  describe('the fade', () => {
    it('is not loaded until this anime’s own art has painted', () => {
      const bloc = makeBloc();
      expect(bloc.bgLoaded).toBe(false);

      bloc.imageChosen();

      expect(bloc.bgLoaded).toBe(true);
    });

    it('goes back to unloaded when the rail retargets the banner', () => {
      let anime = ANIME;
      const bloc = new HeroBannerBloc(
        {
          get anime() {
            return anime;
          },
          timing: null
        },
        {
          config: { init: vi.fn(async () => undefined) },
          notifications: readable({ timingData: {}, countdowns: {} }),
          preferences: readable({ titleLanguage: 'english' }),
          auth: readable({ isLoggedIn: false, isAuthInitialized: true }),
          imageUrl,
          webPProbe: vi.fn(async () => true),
          mediaQuery: media(false).port
        }
      );
      bloc.imageChosen();
      expect(bloc.bgLoaded).toBe(true);

      anime = { ...ANIME, id: 'a2' };

      // So the new art fades in too.
      expect(bloc.bgLoaded).toBe(false);
    });
  });

  describe('the panel', () => {
    it('titles the show in the reader’s language', () => {
      expect(makeBloc({}, {}, 'english').title).toBe('Frieren');
      expect(makeBloc({}, {}, 'japanese').title).toBe('葬送のフリーレン');
    });

    it('steps the title size by length, so the panel stays one height', () => {
      expect(makeBloc({ anime: { id: 'a1', titleEn: 'Chiikawa' } }).titleTier).toBe('short');
      expect(makeBloc({ anime: { id: 'a1', titleEn: 'x'.repeat(19) } }).titleTier).toBe('mid');
      expect(makeBloc({ anime: { id: 'a1', titleEn: 'x'.repeat(41) } }).titleTier).toBe('long');
    });

    it('steps on the boundary, not inside it', () => {
      expect(makeBloc({ anime: { id: 'a1', titleEn: 'x'.repeat(18) } }).titleTier).toBe('short');
      expect(makeBloc({ anime: { id: 'a1', titleEn: 'x'.repeat(40) } }).titleTier).toBe('mid');
    });

    it('shows the description, or nothing at all', () => {
      expect(makeBloc().description).toBe('A long walk.');
      expect(makeBloc({ anime: { id: 'a1' } }).description).toBe('');
    });

    it('offers the sign-up line only to a resolved signed-out visitor', () => {
      expect(
        makeBloc({}, { auth: readable({ isLoggedIn: false, isAuthInitialized: true }) })
          .showSignUpLine
      ).toBe(true);
      expect(
        makeBloc({}, { auth: readable({ isLoggedIn: true, isAuthInitialized: true }) })
          .showSignUpLine
      ).toBe(false);
      // Before auth resolves a returning visitor reads as signed out.
      expect(
        makeBloc({}, { auth: readable({ isLoggedIn: false, isAuthInitialized: false }) })
          .showSignUpLine
      ).toBe(false);
    });

    it('toggles the broadcast-slot popover', () => {
      const bloc = makeBloc();

      expect(bloc.showJstPopover).toBe(false);
      bloc.toggleJstPopover();
      expect(bloc.showJstPopover).toBe(true);
      bloc.toggleJstPopover();
      expect(bloc.showJstPopover).toBe(false);
    });
  });

  describe('the schedule badge', () => {
    it('has nothing to say without a timing or a worker entry', () => {
      const bloc = makeBloc();

      expect(bloc.hasSchedule).toBe(false);
      expect(bloc.badgeCountdown).toBe('');
      expect(bloc.liveNow).toBe(false);
      expect(bloc.airedAlready).toBe(false);
    });

    it('reads the resolved timing when the page has one', () => {
      const bloc = makeBloc({ timing: timing({ isLive: true, countdown: 'AIRING NOW' }) });

      expect(bloc.hasSchedule).toBe(true);
      expect(bloc.liveNow).toBe(true);
      expect(bloc.badgeCountdown).toBe('AIRING NOW');
    });

    it('prefers the resolved timing over the worker’s own countdown', () => {
      const bloc = makeBloc(
        { timing: timing({ countdown: '19h' }) },
        {
          notifications: readable({
            timingData: { a1: { countdown: '18H', isCurrentlyAiring: true } },
            countdowns: {}
          })
        }
      );

      // Using the worker for the countdown put "18H" in the badge while the
      // rail beside it read "Airing in 19h" for the same episode.
      expect(bloc.badgeCountdown).toBe('19h');
      expect(bloc.liveNow).toBe(false);
    });

    it('falls back to the worker when there is no resolved timing', () => {
      const bloc = makeBloc(
        {},
        {
          notifications: readable({
            timingData: { a1: { countdown: '3h', hasAlreadyAired: true, progress: 0.4 } },
            countdowns: {}
          })
        }
      );

      expect(bloc.hasSchedule).toBe(true);
      expect(bloc.badgeCountdown).toBe('3h');
      expect(bloc.airedAlready).toBe(true);
      expect(bloc.progress).toBe(0.4);
    });

    it('falls back again to the worker’s countdown map', () => {
      const bloc = makeBloc(
        {},
        {
          notifications: readable({
            timingData: {},
            countdowns: { a1: { countdown: '45m', isAiring: true, progress: 0.9 } }
          })
        }
      );

      expect(bloc.badgeCountdown).toBe('45m');
      expect(bloc.liveNow).toBe(true);
      expect(bloc.progress).toBe(0.9);
    });

    it('has no progress to draw when only the page resolved the timing', () => {
      expect(makeBloc({ timing: timing() }).progress).toBeUndefined();
    });

    it('shows the episode number only when the worker knows one', () => {
      expect(
        makeBloc(
          {},
          {
            notifications: readable({
              timingData: { a1: { episode: { episodeNumber: 12 } } },
              countdowns: {}
            })
          }
        ).episodeNumber
      ).toBe('12');
      expect(makeBloc().episodeNumber).toBe('');
    });
  });

  describe('"Airing Soon" has to mean soon', () => {
    it('says so within six hours', () => {
      const bloc = makeBloc({
        timing: timing({ airDateTime: new Date(Date.now() + 60 * 60 * 1000) })
      });

      expect(bloc.upcomingLabel).toBe('Airing Soon');
    });

    it('does not say so nineteen hours out', () => {
      const bloc = makeBloc({
        timing: timing({ airDateTime: new Date(Date.now() + 19 * 60 * 60 * 1000) })
      });

      // It used to ship over an episode nineteen hours away.
      expect(bloc.upcomingLabel).toBe('Next Episode');
    });

    it('says "Next Episode" when nothing resolved a time at all', () => {
      expect(makeBloc().upcomingLabel).toBe('Next Episode');
    });
  });

  describe('the countdown beside the label', () => {
    it('prints a real countdown', () => {
      expect(makeBloc({ timing: timing({ countdown: '2h' }) }).showUpcomingCountdown).toBe(true);
    });

    it('does not print one that is already the label', () => {
      expect(
        makeBloc({ timing: timing({ countdown: 'AIRING NOW' }) }).showUpcomingCountdown
      ).toBe(false);
      expect(
        makeBloc({ timing: timing({ countdown: 'JUST AIRED' }) }).showUpcomingCountdown
      ).toBe(false);
    });

    it('prints nothing when there is no countdown', () => {
      expect(makeBloc().showUpcomingCountdown).toBe(false);
    });
  });
});
