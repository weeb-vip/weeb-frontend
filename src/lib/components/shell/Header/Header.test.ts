import { describe, it, expect, vi } from 'vitest';
import { readable, writable } from 'svelte/store';
import { HeaderBloc, seasonSlug, type FramePort, type HeaderDeps } from './Header.bloc.svelte';

/**
 * The nav bar's glass, and which item is current.
 *
 * The easing is the point: a single wheel tick can move scrollY by 200px in ONE
 * event, so a scroll only sets a target and a frame loop travels toward it.
 * The loop runs through a `FramePort` here, one frame per `tick()`.
 */
function frames() {
  const queue: (() => void)[] = [];
  let next = 1;
  const cancelled = new Set<number>();

  const port: FramePort = {
    request(callback) {
      queue.push(callback);
      return next++;
    },
    cancel(handle) {
      cancelled.add(handle);
    }
  };

  return {
    port,
    get pending() {
      return queue.length;
    },
    get cancelled() {
      return cancelled.size;
    },
    /** Run one frame. */
    tick() {
      queue.shift()?.();
    },
    /** Run frames until the loop stops asking for more. */
    settle(limit = 500) {
      for (let i = 0; i < limit && queue.length; i++) this.tick();
    }
  };
}

function makeBloc(deps: Partial<HeaderDeps> = {}) {
  return new HeaderBloc({
    route: readable('/'),
    frames: frames().port,
    prefersReducedMotion: () => false,
    ...deps
  });
}

describe('seasonSlug', () => {
  it('names the season the date falls in', () => {
    expect(seasonSlug(new Date(2024, 0, 15))).toBe('WINTER_2024');
    expect(seasonSlug(new Date(2024, 4, 15))).toBe('SPRING_2024');
    expect(seasonSlug(new Date(2024, 7, 15))).toBe('SUMMER_2024');
    expect(seasonSlug(new Date(2024, 10, 15))).toBe('FALL_2024');
  });

  it('changes season on the boundary month, not inside it', () => {
    expect(seasonSlug(new Date(2024, 2, 31))).toBe('WINTER_2024');
    expect(seasonSlug(new Date(2024, 3, 1))).toBe('SPRING_2024');
    expect(seasonSlug(new Date(2024, 8, 30))).toBe('SUMMER_2024');
    expect(seasonSlug(new Date(2024, 9, 1))).toBe('FALL_2024');
  });

  it('covers every month with a season', () => {
    for (let month = 0; month < 12; month++) {
      expect(seasonSlug(new Date(2024, month, 1))).toMatch(/^(WINTER|SPRING|SUMMER|FALL)_2024$/);
    }
  });
});

describe('HeaderBloc', () => {
  describe('where the bar starts', () => {
    it('is solid on an ordinary page', () => {
      const bloc = makeBloc({ overlay: false });

      expect(bloc.overlay).toBe(false);
      expect(bloc.solid).toBe(1);
      expect(bloc.hasGlass).toBe(true);
    });

    it('is dissolved over artwork', () => {
      const bloc = makeBloc({ overlay: true });

      expect(bloc.solid).toBe(0);
      // Below the threshold there is no glass to blur, so the filter stays off.
      expect(bloc.hasGlass).toBe(false);
    });
  });

  describe('changing what kind of page this is', () => {
    it('hands the bar its glass back when leaving an artwork page', () => {
      const bloc = makeBloc({ overlay: true });

      bloc.setOverlay(false);

      expect(bloc.overlay).toBe(false);
      expect(bloc.solid).toBe(1);
    });

    it('dissolves it again when arriving on one', () => {
      const bloc = makeBloc({ overlay: false });

      bloc.setOverlay(true);

      expect(bloc.solid).toBe(0);
    });

    it('does not reset the fade when the kind of page has not changed', () => {
      const clock = frames();
      const bloc = makeBloc({ overlay: true, frames: clock.port });
      bloc.scrolled(220);
      clock.settle();
      expect(bloc.solid).toBeCloseTo(1, 2);

      bloc.setOverlay(true);

      expect(bloc.solid).toBeCloseTo(1, 2);
    });
  });

  describe('scrolling', () => {
    it('does not jump the whole way in one frame', () => {
      const clock = frames();
      const bloc = makeBloc({ overlay: true, frames: clock.port });

      // One wheel tick, 220px: the input is a jump, so the output must not be.
      bloc.scrolled(220);
      clock.tick();

      expect(bloc.solid).toBeGreaterThan(0);
      expect(bloc.solid).toBeLessThan(0.5);
    });

    it('settles on the target', () => {
      const clock = frames();
      const bloc = makeBloc({ overlay: true, frames: clock.port });

      bloc.scrolled(110);
      clock.settle();

      expect(bloc.solid).toBeCloseTo(0.5, 5);
      expect(clock.pending).toBe(0);
    });

    it('eases back down when the page scrolls up again', () => {
      const clock = frames();
      const bloc = makeBloc({ overlay: true, frames: clock.port });
      bloc.scrolled(400);
      clock.settle();
      expect(bloc.solid).toBe(1);

      bloc.scrolled(0);
      clock.settle();

      expect(bloc.solid).toBe(0);
    });

    it('clamps at both ends', () => {
      const clock = frames();
      const bloc = makeBloc({ overlay: true, frames: clock.port });

      bloc.scrolled(99999);
      clock.settle();
      expect(bloc.solid).toBe(1);

      bloc.scrolled(-50);
      clock.settle();
      expect(bloc.solid).toBe(0);
    });

    it('runs one frame loop however many scroll events arrive', () => {
      const clock = frames();
      const bloc = makeBloc({ overlay: true, frames: clock.port });

      bloc.scrolled(50);
      bloc.scrolled(100);
      bloc.scrolled(150);

      expect(clock.pending).toBe(1);
    });

    it('goes straight there for a visitor who asked for less movement', () => {
      const clock = frames();
      const bloc = makeBloc({
        overlay: true,
        frames: clock.port,
        prefersReducedMotion: () => true
      });

      bloc.scrolled(110);

      expect(bloc.solid).toBeCloseTo(0.5, 5);
      expect(clock.pending).toBe(0);
    });

    it('turns the blur on as soon as there is any glass to blur', () => {
      const clock = frames();
      const bloc = makeBloc({ overlay: true, frames: clock.port });
      expect(bloc.hasGlass).toBe(false);

      bloc.scrolled(220);
      clock.settle();

      expect(bloc.hasGlass).toBe(true);
    });

    it('leaves a solid page alone -- it has glass at every scroll position', () => {
      const clock = frames();
      const bloc = makeBloc({ overlay: false, frames: clock.port });

      bloc.scrolled(0);
      clock.settle();

      expect(bloc.hasGlass).toBe(true);
    });
  });

  describe('the nav highlight', () => {
    it('lights home only on home', () => {
      expect(makeBloc({ route: readable('/') }).isCurrent('/')).toBe(true);
      expect(makeBloc({ route: readable('/search') }).isCurrent('/')).toBe(false);
    });

    it('keeps a section lit on its detail pages', () => {
      const bloc = makeBloc({ route: readable('/manga/berserk') });

      expect(bloc.isCurrent('/manga')).toBe(true);
      expect(bloc.isCurrent('/search')).toBe(false);
    });

    it('follows a navigation', () => {
      const route = writable('/');
      const bloc = makeBloc({ route });

      route.set('/airing');

      expect(bloc.pathname).toBe('/airing');
      expect(bloc.isCurrent('/airing')).toBe(true);
    });

    it('reads as home when the route store has nothing', () => {
      const bloc = makeBloc({ route: readable(undefined as unknown as string) });

      expect(bloc.pathname).toBe('/');
    });
  });

  it('links to the season that is on now', () => {
    expect(makeBloc().seasonHref).toBe(`/season/${seasonSlug()}`);
  });

  it('cancels the frame loop when the bar goes away', () => {
    const clock = frames();
    const bloc = makeBloc({ overlay: true, frames: clock.port });
    bloc.scrolled(220);

    bloc.destroy();

    expect(clock.cancelled).toBe(1);
    // And destroying twice cancels nothing extra.
    bloc.destroy();
    expect(clock.cancelled).toBe(1);
  });

  it('has a real frame port that degrades where there are no frames', () => {
    const stubbed = vi.fn();
    expect(() => makeBloc({ frames: { request: stubbed, cancel: stubbed } })).not.toThrow();
  });
});
