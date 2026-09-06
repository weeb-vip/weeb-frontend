import { describe, it, expect, vi } from 'vitest';
import { readable } from 'svelte/store';
import type { TitleLanguage } from '$lib/stores/preferences';
import {
  AnimeToastBloc,
  browserDevice,
  type AnimeToastDeps,
  type AnimeToastInputs,
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
