import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/svelte';
import userEvent from '@testing-library/user-event';
import { readable } from 'svelte/store';
import type { TitleLanguage } from '$lib/stores/preferences';
import AnimeToast from './AnimeToast.svelte';
import {
  AnimeToastBloc,
  browserDevice,
  type AnimeToastDeps,
  type AnimeToastInputs,
  type AnimeToastStatus,
  type DevicePort
} from './AnimeToast.bloc.svelte';

const ANIME = { id: '42', slug: 'frieren', titleEn: 'Frieren', titleJp: '葬送のフリーレン' };
const EPISODE = { episodeNumber: 4, titleEn: 'The Land Where Souls Rest' };

/** A device port the test can flip. */
function device(initial: boolean) {
  let listener: ((isCompact: boolean) => void) | null = null;
  let compact = initial;
  const port: DevicePort = {
    isCompact: () => compact,
    onChange: (fn) => {
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
      compact = next;
      listener?.(next);
    }
  };
}

function makeBloc(
  inputs: Partial<AnimeToastInputs> = {},
  deps: AnimeToastDeps = {},
  language: TitleLanguage = 'english'
) {
  const full: AnimeToastInputs = {
    anime: ANIME,
    episode: EPISODE,
    status: 'airing',
    ...inputs
  };
  return new AnimeToastBloc(full, {
    preferences: readable({ titleLanguage: language }),
    navigate: vi.fn(),
    device: device(false).port,
    ...deps
  });
}

describe('AnimeToastBloc', () => {
  describe('what the card shows', () => {
    it('titles the show in the reader’s language', () => {
      expect(makeBloc({}, {}, 'english').title).toBe('Frieren');
      expect(makeBloc({}, {}, 'japanese').title).toBe('葬送のフリーレン');
    });

    it('falls back to the other title when its own is missing', () => {
      expect(makeBloc({ anime: { id: '1', titleJp: 'JP' } }, {}, 'english').title).toBe('JP');
      expect(makeBloc({ anime: { id: '1', titleEn: 'EN' } }, {}, 'japanese').title).toBe('EN');
    });

    it('names the show in the arrow button’s accessible name', () => {
      expect(makeBloc().goToShowLabel).toBe('Go to Frieren page');
    });

    it('passes the poster and the status straight through', () => {
      const bloc = makeBloc({
        anime: { ...ANIME, imageUrl: 'poster.jpg' },
        status: 'airing-soon'
      });

      expect(bloc.imageUrl).toBe('poster.jpg');
      expect(bloc.status).toBe('airing-soon');
    });

    it('prefers the episode’s English title, then its Japanese one', () => {
      expect(makeBloc({ episode: { titleEn: 'EN', titleJp: 'JP' } }).episodeTitle).toBe('EN');
      expect(makeBloc({ episode: { titleJp: 'JP' } }).episodeTitle).toBe('JP');
    });

    it('shows no episode title rather than "undefined"', () => {
      expect(makeBloc({ episode: {} }).episodeTitle).toBe('');
    });

    it('shows a question mark for an episode with no number', () => {
      expect(makeBloc({ episode: {} }).episodeNumber).toBe('?');
      // Zero is not an episode number either.
      expect(makeBloc({ episode: { episodeNumber: 0 } }).episodeNumber).toBe('?');
      expect(makeBloc({ episode: { episodeNumber: 4 } }).episodeNumber).toBe(4);
    });
  });

  describe('navigating', () => {
    it('opens the show by slug when the whole card is clicked on a pointer device', () => {
      const navigate = vi.fn();
      const bloc = makeBloc({}, { navigate, device: device(false).port });

      bloc.activateCard();

      expect(navigate).toHaveBeenCalledWith('/anime/frieren');
    });

    it('does not navigate on a card tap on a touch device', () => {
      const navigate = vi.fn();
      const bloc = makeBloc({}, { navigate, device: device(true).port });

      bloc.activateCard();

      // What was really a scroll must not become a navigation.
      expect(navigate).not.toHaveBeenCalled();
    });

    it('navigates from the arrow button on every device', () => {
      for (const compact of [true, false]) {
        const navigate = vi.fn();
        const bloc = makeBloc({}, { navigate, device: device(compact).port });

        bloc.activateButton();

        expect(navigate).toHaveBeenCalledWith('/anime/frieren');
      }
    });

    it('stops the button’s click from also activating the card underneath it', () => {
      const event = { stopPropagation: vi.fn() } as unknown as Event;

      makeBloc().activateButton(event);

      expect(event.stopPropagation).toHaveBeenCalledTimes(1);
    });

    it('falls back to the id when the record has no slug', () => {
      const navigate = vi.fn();
      const bloc = makeBloc({ anime: { id: '42' } }, { navigate });

      bloc.activateButton();

      expect(navigate).toHaveBeenCalledWith('/anime/42');
    });

    it('goes nowhere at all for a record with no id', () => {
      const navigate = vi.fn();
      const bloc = makeBloc({ anime: { titleEn: 'Orphan' } }, { navigate });

      bloc.activateCard();
      bloc.activateButton();

      expect(navigate).not.toHaveBeenCalled();
    });
  });

  describe('the viewport', () => {
    it('takes the device’s answer at construction', () => {
      expect(makeBloc({}, { device: device(true).port }).isCompact).toBe(true);
      expect(makeBloc({}, { device: device(false).port }).isCompact).toBe(false);
    });

    it('follows a resize across the breakpoint', () => {
      const screen = device(false);
      const bloc = makeBloc({}, { device: screen.port });
      bloc.watchViewport();

      screen.resizeTo(true);
      expect(bloc.isCompact).toBe(true);

      screen.resizeTo(false);
      expect(bloc.isCompact).toBe(false);
    });

    it('hands its teardown back for the view’s effect', () => {
      const screen = device(false);
      const bloc = makeBloc({}, { device: screen.port });

      const stop = bloc.watchViewport();
      expect(screen.listening).toBe(true);

      stop();
      expect(screen.listening).toBe(false);
    });
  });
});

describe('browserDevice', () => {
  const width = window.innerWidth;
  const setWidth = (px: number) =>
    Object.defineProperty(window, 'innerWidth', { value: px, configurable: true });

  it('calls a narrow viewport compact', () => {
    setWidth(800);
    expect(browserDevice.isCompact()).toBe(true);

    setWidth(1440);
    expect(browserDevice.isCompact()).toBe(false);

    setWidth(width);
  });

  it('re-asks on resize, and stops when torn down', () => {
    setWidth(1440);
    const listener = vi.fn();
    const stop = browserDevice.onChange(listener);

    setWidth(800);
    window.dispatchEvent(new Event('resize'));
    expect(listener).toHaveBeenCalledWith(true);

    stop();
    window.dispatchEvent(new Event('resize'));
    expect(listener).toHaveBeenCalledTimes(1);

    setWidth(width);
  });
});

/**
 * The card itself: what the four severities draw, what the two lines of copy
 * say, and which gesture navigates on which kind of device.
 *
 * Everything the bloc decides -- the title language, the compact rule, the
 * href -- is asserted against the bloc above; this half is the markup. The bloc
 * is the real one throughout, driven through the same fake ports, so the only
 * thing under test is what the view does with it.
 *
 * jsdom caveat, stated once: this environment loads no stylesheets at all
 * (`document.styleSheets` is empty after a render), so a severity's *colour* is
 * not observable here -- `getComputedStyle` answers `rgba(0, 0, 0, 0)` for
 * every one of them. What IS the contract, and what is asserted below, is the
 * class each severity puts on the indicator and the status line: those class
 * names are the only thing tying the markup to the shared `--weeb-*-tint` /
 * `-edge` recipe in the component's stylesheet. That the tokens themselves
 * resolve to the right hue is a browser fact and belongs to the visual layer.
 */
describe('AnimeToast', () => {
  const render_ = (
    props: {
      status?: AnimeToastStatus;
      timeInfo?: string;
      anime?: AnimeToastInputs['anime'];
      episode?: AnimeToastInputs['episode'];
      compact?: boolean;
      navigate?: (href: string) => void;
      language?: TitleLanguage;
    } = {}
  ) => {
    const navigate = props.navigate ?? vi.fn();
    const bloc = makeBloc(
      {
        anime: props.anime ?? ANIME,
        episode: props.episode ?? EPISODE,
        status: props.status ?? 'airing'
      },
      { navigate, device: device(props.compact ?? false).port },
      props.language ?? 'english'
    );
    const result = render(AnimeToast, {
      props: {
        anime: props.anime ?? ANIME,
        episode: props.episode ?? EPISODE,
        status: props.status ?? 'airing',
        timeInfo: props.timeInfo ?? '',
        bloc
      }
    });
    return { ...result, navigate, bloc };
  };

  describe('what it says', () => {
    it('leads with the show’s title, in the reader’s language', () => {
      const { container } = render_({ language: 'japanese' });

      expect(container.querySelector('.toast-title')).toHaveTextContent('葬送のフリーレン');
    });

    it('names the episode by number and title', () => {
      const { container } = render_();

      const line = container.querySelector('.toast-episode');
      expect(line).toHaveTextContent('Episode 4');
      expect(line).toHaveTextContent('The Land Where Souls Rest');
    });

    it('drops the separator and the title when the episode has no name', () => {
      const { container } = render_({ episode: { episodeNumber: 9 } });

      expect(container.querySelector('.toast-episode')).toHaveTextContent('Episode 9');
      expect(container.querySelector('.toast-ep-title')).not.toBeInTheDocument();
      expect(container.querySelector('.toast-dot')).not.toBeInTheDocument();
    });

    it('says "Episode ?" rather than "Episode undefined" for an unnumbered episode', () => {
      const { container } = render_({ episode: {} });

      expect(container.querySelector('.toast-episode')).toHaveTextContent('Episode ?');
    });

    it('draws the timing line when there is timing to show', () => {
      const { container } = render_({ timeInfo: 'Airs in 20m' });

      expect(container.querySelector('.toast-status')).toHaveTextContent('Airs in 20m');
    });

    it('draws no timing line at all when there is none', () => {
      const { container } = render_({ timeInfo: '' });

      expect(container.querySelector('.toast-status')).not.toBeInTheDocument();
    });
  });

  describe('the poster', () => {
    it('draws the artwork with the show’s title as its alt text', () => {
      render_({ anime: { ...ANIME, imageUrl: 'https://cdn.example/frieren.jpg' } });

      const poster = screen.getByRole('img', { name: 'Frieren' });
      expect(poster).toHaveAttribute('src', 'https://cdn.example/frieren.jpg');
      // Lazy: a toast stack can hold several and none of them is the LCP.
      expect(poster).toHaveAttribute('loading', 'lazy');
    });

    it('falls back to a placeholder rather than a broken image when there is no artwork', () => {
      const { container } = render_({ anime: { id: '42', titleEn: 'Frieren' } });

      expect(screen.queryByRole('img')).not.toBeInTheDocument();
      expect(container.querySelector('.toast-poster-placeholder')).toBeInTheDocument();
    });
  });

  /**
   * REGRESSION. These four used to be hardcoded `oklch()` literals at their own
   * 0.1/0.3 alpha stops -- a green of `62% 0.17 145` against a `--weeb-green` of
   * `65% 0.15 155`, an amber of `75% 0.15 80` against a `--weeb-amber` of
   * `72% 0.14 85` -- so the toast stack carried a second severity palette that
   * was a near-miss of the shared one. They are now `--weeb-<hue>-tint` /
   * `-edge`, the same recipe ErrorBanner and GlobalToaster use.
   *
   * What is assertable here is the hook: exactly one severity class, and the
   * right one, on both the indicator and the status line. The colour it maps to
   * lives in a stylesheet jsdom does not load (see the note above the suite).
   */
  describe('the four severities', () => {
    const severities: AnimeToastStatus[] = ['airing-soon', 'airing', 'finished', 'warning'];

    for (const status of severities) {
      it(`marks "${status}" on the indicator with its own token class`, () => {
        const { container } = render_({ status });

        const indicator = container.querySelector('.toast-indicator');
        expect(indicator).toHaveClass(`toast-indicator-${status}`);

        // And only its own: a second severity class would mean two grounds.
        const others = severities.filter((other) => other !== status);
        for (const other of others) {
          expect(indicator).not.toHaveClass(`toast-indicator-${other}`);
        }
      });

      it(`marks "${status}" on the timing line with the matching token class`, () => {
        const { container } = render_({ status, timeInfo: 'Aired 2h ago' });

        expect(container.querySelector('.toast-status')).toHaveClass(`toast-status-${status}`);
      });
    }

    it('gives each severity a distinct glyph rather than one shared dot', () => {
      const glyphOf = (status: AnimeToastStatus) => {
        const { container } = render_({ status });
        return container.querySelector('.toast-indicator svg')!.innerHTML;
      };

      const glyphs = severities.map(glyphOf);
      expect(new Set(glyphs).size).toBe(severities.length);
    });
  });

  describe('opening the show', () => {
    it('navigates when the card is clicked on a pointer device', async () => {
      const navigate = vi.fn();
      const { container } = render_({ navigate });

      await userEvent.click(container.querySelector('.anime-toast-content')!);

      expect(navigate).toHaveBeenCalledWith('/anime/frieren');
    });

    it('offers no arrow button on a pointer device -- the whole card is the target', () => {
      const { container } = render_();

      expect(screen.queryByRole('button', { name: 'Go to Frieren page' })).not.toBeInTheDocument();
      expect(container.querySelector('.anime-toast-content')).toHaveClass('clickable');
    });

    /**
     * REGRESSION shape: on a touch device a tap on the card is as likely to be
     * a scroll that started on the toast, so only an explicit control navigates.
     */
    it('does not navigate on a card tap on a touch device', async () => {
      const navigate = vi.fn();
      const { container } = render_({ navigate, compact: true });

      await userEvent.click(container.querySelector('.anime-toast-content')!);

      expect(navigate).not.toHaveBeenCalled();
      expect(container.querySelector('.anime-toast-content')).not.toHaveClass('clickable');
    });

    it('gives a touch device a named arrow button that does navigate', async () => {
      const navigate = vi.fn();
      render_({ navigate, compact: true });

      const arrow = screen.getByRole('button', { name: 'Go to Frieren page' });
      expect(arrow).toHaveAttribute('title', 'Go to Frieren page');

      await userEvent.click(arrow);

      expect(navigate).toHaveBeenCalledWith('/anime/frieren');
    });

    it('stays put when the show has no id to open', async () => {
      const navigate = vi.fn();
      const { container } = render_({ navigate, anime: { titleEn: 'Frieren' } });

      await userEvent.click(container.querySelector('.anime-toast-content')!);

      expect(navigate).not.toHaveBeenCalled();
    });
  });
});
