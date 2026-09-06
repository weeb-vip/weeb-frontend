import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen } from '@testing-library/svelte';
import userEvent from '@testing-library/user-event';
import { readable } from 'svelte/store';
import type { EpisodeTiming } from '$lib/services/airTimeUtils';
import type { TitleLanguage } from '$lib/stores/preferences';
import { stubNeverLoadingImages } from '$lib/components/__tests__/jsdom-gaps';
import HeroBanner from './HeroBanner.svelte';
import {
  HeroBannerBloc,
  type HeroBannerDeps,
  type HeroBannerInputs,
  type MediaQueryPort
} from './HeroBanner.bloc.svelte';

/**
 * The homepage banner as it is drawn: which schedule badge appears, what the
 * meta line says, the broadcast-slot disclosure, the sign-up offer, and the two
 * ways out of the panel.
 *
 * Every decision behind those -- which artwork to try, what the countdown reads,
 * when "Airing Soon" is honest, whether the sign-up line is owed -- is asserted
 * against the bloc in `HeroBanner.test.ts`. This file drives the real bloc
 * through in-memory ports and asserts only the DOM that comes out of it.
 *
 * jsdom caveats, stated rather than papered over:
 *
 *  - `stubNeverLoadingImages` fails the artwork probe immediately. jsdom loads
 *    nothing, so the real probe would hang until SafeImage's 3s per-try timeout
 *    and every test here would assert against a half-settled banner. Nothing
 *    below therefore proves that the key art paints, that the CDN resize works,
 *    or that the 500ms fade happens -- those are browser facts and belong to
 *    the e2e/visual layer.
 *  - The badge's fill (`--progress-factor` driving a `scaleX`), the title tier
 *    (`t-short`/`t-mid`/`t-long` selecting a `clamp()` font size) and the panel
 *    geometry are asserted as the *markup that carries them* only. Whether the
 *    bar is actually 40% full or the title actually fits on two lines is
 *    layout, and jsdom performs none.
 *  - `.hero` is asserted by class deliberately. It is not styling: it is the
 *    selector `tests/e2e/notifications-store.spec.ts` and `anime-news.spec.ts`
 *    use to find the banner, and it was lost once already when the backdrop
 *    moved into `KeyArtStage`. A class passthrough is the contract.
 */

const ANIME = {
  id: 'a1',
  slug: 'frieren',
  titleEn: 'Frieren',
  titleJp: '葬送のフリーレン',
  description: 'A long walk.'
};

/** The image-url port, so the candidates are readable rather than CDN strings. */
const imageUrl = (id: string, path?: string) => (path ? `cdn/${path}/${id}` : `cdn/${id}`);

const mediaQuery = (initial = false): MediaQueryPort => ({
  matches: () => initial,
  onChange: () => () => {}
});

const timing = (overrides: Partial<EpisodeTiming> = {}): EpisodeTiming =>
  ({
    isLive: false,
    hasAired: false,
    countdown: '2h',
    label: 'Airing in 2h',
    localTime: 'Thu 6:40 PM',
    localZone: 'PDT',
    variant: 'countdown',
    broadcastSlot: null,
    exact: true,
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
      mediaQuery: mediaQuery(),
      ...deps
    }
  );
}

const banner = (...args: Parameters<typeof makeBloc>) =>
  render(HeroBanner, { props: { anime: args[0]?.anime ?? ANIME, bloc: makeBloc(...args) } });

let restoreImages: () => void;
beforeEach(() => {
  restoreImages = stubNeverLoadingImages();
  // jsdom implements no `window.matchMedia` at all. The view builds its own
  // bloc from `$props()` whether or not one is injected, and that constructor
  // asks the real `browserMediaQuery` -- so without this every mount throws
  // before any markup exists. Same stand-in as `AnimeCalendarPopover.test.ts`,
  // kept local for the same reason: it answers "not a phone", which is the
  // desktop case, and jsdom has no viewport to narrow anyway. Which artwork a
  // phone gets is decided in the bloc and asserted there through a fake port.
  vi.stubGlobal(
    'matchMedia',
    vi.fn(() => ({ matches: false, addEventListener() {}, removeEventListener() {} }))
  );
});
afterEach(() => {
  restoreImages();
  vi.unstubAllGlobals();
});

describe('HeroBanner (rendering)', () => {
  describe('the stage it stands on', () => {
    /**
     * The e2e hook. `notifications-store.spec.ts` and `anime-news.spec.ts` both
     * select `.hero` to find the banner; when the backdrop moved into
     * KeyArtStage the class went with the old root element and both suites lost
     * the banner. This is the class as a contract, not as styling.
     */
    it('carries `.hero` on the stage root, which the e2e suites select on', () => {
      const { container } = banner();

      const hero = container.querySelector('.hero');
      expect(hero).toBeInTheDocument();
      // On the stage itself, not on some inner div: the e2e selectors treat it
      // as the whole banner.
      expect(hero).toHaveClass('key-art');
    });

    it('draws an artwork layer for a show that has an id to build one from', () => {
      const { container } = banner();

      expect(container.querySelector('.key-art__bg')).toBeInTheDocument();
    });

    it('renders the whole panel for a record with no artwork at all', () => {
      // No id, so `imageSources` is empty and KeyArtStage draws no artwork
      // layer. The banner is still the banner.
      const { container } = banner({ anime: { titleEn: 'Orphan' } });

      expect(container.querySelector('.key-art__bg')).toBeNull();
      expect(screen.getByRole('heading', { level: 2, name: 'Orphan' })).toBeInTheDocument();
      expect(container.querySelector('.hero')).toBeInTheDocument();
    });
  });

  describe('the schedule badge', () => {
    it('says the show is airing now, with the countdown beside it', () => {
      banner({ timing: timing({ isLive: true, countdown: '12m left' }) });

      expect(screen.getByText('Currently Airing')).toBeInTheDocument();
      expect(screen.getByText('12m left')).toBeInTheDocument();
    });

    it('writes the worker’s progress onto the badge as the fill factor', () => {
      const { container } = banner(
        {},
        {
          notifications: readable({
            timingData: { a1: { isCurrentlyAiring: true, countdown: '12m', progress: 0.4 } },
            countdowns: {}
          })
        }
      );

      // The custom property is the contract between bloc and stylesheet. What
      // it renders as -- a bar scaled to 40% of the badge -- is a browser fact.
      expect(container.querySelector('.hero-badge--progress')).toHaveAttribute(
        'style',
        expect.stringContaining('--progress-factor: 0.4')
      );
    });

    it('falls back to zero fill when nothing computed a progress', () => {
      const { container } = banner({ timing: timing({ isLive: true }) });

      expect(container.querySelector('.hero-badge--progress')).toHaveAttribute(
        'style',
        expect.stringContaining('--progress-factor: 0')
      );
    });

    it('names the next episode, with its countdown, when one is still to come', () => {
      banner({
        timing: timing({
          countdown: '19h',
          airDateTime: new Date(Date.now() + 19 * 60 * 60 * 1000)
        })
      });

      expect(screen.getByText('Next Episode')).toBeInTheDocument();
      expect(screen.getByText('19h')).toBeInTheDocument();
      expect(screen.queryByText('Currently Airing')).not.toBeInTheDocument();
    });

    it('says "Airing Soon" only inside the six-hour window', () => {
      banner({
        timing: timing({ countdown: '1h', airDateTime: new Date(Date.now() + 60 * 60 * 1000) })
      });

      expect(screen.getByText('Airing Soon')).toBeInTheDocument();
    });

    it('prints no countdown next to a label that already is one', () => {
      const { container } = banner({ timing: timing({ countdown: 'AIRING NOW', isLive: false }) });

      expect(screen.getByText('Airing Soon')).toBeInTheDocument();
      expect(container.querySelector('.badge-countdown')).toBeNull();
    });

    it('marks an episode that has just been and gone', () => {
      banner({ timing: timing({ hasAired: true, countdown: 'JUST AIRED' }) });

      expect(screen.getByText('Recently Aired')).toBeInTheDocument();
      expect(screen.queryByText('Currently Airing')).not.toBeInTheDocument();
      expect(screen.queryByText('Next Episode')).not.toBeInTheDocument();
    });

    it('draws no badge at all for the fallback banner, which has no schedule', () => {
      const { container } = banner();

      expect(container.querySelector('.hero-badge')).toBeNull();
    });
  });

  describe('the title', () => {
    /**
     * As an h1 the homepage's primary heading changed with whatever the
     * carousel happened to be showing. The page-level h1 lives in HomepageSSR.
     */
    it('is an h2, so the rotating banner never owns the page heading', () => {
      banner();

      expect(screen.getByRole('heading', { level: 2, name: 'Frieren' })).toBeInTheDocument();
      expect(screen.queryByRole('heading', { level: 1 })).not.toBeInTheDocument();
    });

    it('follows the viewer’s title language', () => {
      banner({}, {}, 'japanese');

      expect(screen.getByRole('heading', { level: 2, name: '葬送のフリーレン' })).toBeInTheDocument();
    });

    it('carries the length tier as a class, so a long name does not resize the panel', () => {
      banner();
      expect(screen.getByRole('heading', { level: 2 })).toHaveClass('t-short');

      const long = 'The Exiled Heavy Knight Knows How to Game the System, Actually';
      render(HeroBanner, {
        props: {
          anime: { ...ANIME, titleEn: long },
          bloc: makeBloc({ anime: { ...ANIME, titleEn: long } })
        }
      });
      // The tier picks a `clamp()` font size in the stylesheet. That the title
      // then fits in the panel is layout, which jsdom does not do.
      expect(screen.getByRole('heading', { level: 2, name: long })).toHaveClass('t-long');
    });
  });

  describe('the synopsis', () => {
    it('is rendered when the record carries one', () => {
      banner();

      expect(screen.getByText('A long walk.')).toBeInTheDocument();
    });

    it('leaves no empty paragraph behind when it does not', () => {
      const { container } = banner({ anime: { id: 'a1', titleEn: 'Frieren' } });

      expect(container.querySelector('.hero-desc')).toBeNull();
    });
  });

  describe('the meta line', () => {
    it('names the episode the worker knows about', () => {
      banner(
        {},
        {
          notifications: readable({
            timingData: { a1: { episode: { episodeNumber: 12 }, countdown: '3h' } },
            countdowns: {}
          })
        }
      );

      expect(screen.getByText('Episode 12')).toBeInTheDocument();
    });

    it('prints the air time in the viewer’s zone, with the zone marked', () => {
      const { container } = banner({ timing: timing() });

      expect(screen.getByText(/Airs Thu 6:40 PM/)).toBeInTheDocument();
      expect(container.querySelector('.air-time-zone')).toHaveTextContent('PDT');
    });

    it('falls back to the raw broadcast string when nothing resolved a time', () => {
      const anime = { ...ANIME, broadcast: 'Fridays at 23:00 (JST)' };
      render(HeroBanner, { props: { anime, bloc: makeBloc({ anime }) } });

      expect(screen.getByText('Fridays at 23:00 (JST)')).toBeInTheDocument();
    });

    it('offers no broadcast-slot disclosure when the API gave no slot', () => {
      banner({ timing: timing({ broadcastSlot: null }) });

      expect(screen.queryByRole('button', { name: 'Broadcast time' })).not.toBeInTheDocument();
    });
  });

  describe('the broadcast-slot disclosure', () => {
    const withSlot = () =>
      banner({ timing: timing({ broadcastSlot: 'Wednesdays at 01:29 (JST)' }) });

    it('is a collapsed disclosure until it is asked for', () => {
      withSlot();

      const toggle = screen.getByRole('button', { name: 'Broadcast time' });
      expect(toggle).toHaveAttribute('aria-expanded', 'false');
      expect(toggle).toHaveAttribute('aria-controls', 'hero-broadcast-slot');
      expect(screen.queryByText(/Broadcast slot:/)).not.toBeInTheDocument();
    });

    it('reveals the slot, and the element it says it controls is the one that appears', async () => {
      withSlot();

      await userEvent.click(screen.getByRole('button', { name: 'Broadcast time' }));

      const popover = screen.getByText(/Broadcast slot: Wednesdays at 01:29 \(JST\)/);
      expect(popover).toHaveAttribute('id', 'hero-broadcast-slot');
      expect(screen.getByRole('button', { name: 'Broadcast time' })).toHaveAttribute(
        'aria-expanded',
        'true'
      );
    });

    it('closes again on a second press', async () => {
      withSlot();

      const toggle = screen.getByRole('button', { name: 'Broadcast time' });
      await userEvent.click(toggle);
      await userEvent.click(toggle);

      expect(toggle).toHaveAttribute('aria-expanded', 'false');
      expect(screen.queryByText(/Broadcast slot:/)).not.toBeInTheDocument();
    });
  });

  describe('the actions', () => {
    it('points "View Details" at the show', () => {
      banner();

      expect(screen.getByRole('link', { name: 'View Details' })).toHaveAttribute(
        'href',
        '/anime/frieren'
      );
    });

    it('offers to add a show the viewer is not tracking', () => {
      banner();

      expect(screen.getByRole('button', { name: 'Add to List' })).toBeInTheDocument();
    });

    it('shows the status control instead once the show is on their list', () => {
      const anime = { ...ANIME, userAnime: { id: 'ua1', status: 'WATCHING' } };
      render(HeroBanner, { props: { anime, bloc: makeBloc({ anime }) } });

      expect(screen.getByRole('button', { name: 'Watching' })).toBeInTheDocument();
      expect(screen.queryByRole('button', { name: 'Add to List' })).not.toBeInTheDocument();
    });
  });

  describe('the sign-up line', () => {
    /**
     * Nowhere on the homepage did it say what an account is for, so "Add to
     * List" read as a wall rather than an offer.
     */
    it('says what an account buys, to a resolved signed-out visitor', () => {
      banner({}, { auth: readable({ isLoggedIn: false, isAuthInitialized: true }) });

      expect(
        screen.getByText(
          'Free account — track every episode and get notified the moment one airs.'
        )
      ).toBeInTheDocument();
    });

    it('is absent for someone already signed in', () => {
      banner({}, { auth: readable({ isLoggedIn: true, isAuthInitialized: true }) });

      expect(screen.queryByText(/Free account/)).not.toBeInTheDocument();
    });

    it('does not flash at a returning visitor before auth resolves', () => {
      banner({}, { auth: readable({ isLoggedIn: false, isAuthInitialized: false }) });

      expect(screen.queryByText(/Free account/)).not.toBeInTheDocument();
    });
  });
});
