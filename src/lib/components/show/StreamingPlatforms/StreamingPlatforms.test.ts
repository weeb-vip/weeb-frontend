import { describe, it, expect, vi, afterEach } from 'vitest';
import { STREAMING_FLAG, StreamingPlatformsBloc } from './StreamingPlatforms.bloc.svelte';

/** A flag port that only answers true after N asks, like PostHog loading late. */
function flagsAfter(asks: number) {
  let seen = 0;
  return {
    isEnabled: vi.fn(() => ++seen > asks),
    get asks() {
      return seen;
    }
  };
}

afterEach(() => vi.useRealTimers());

describe('StreamingPlatformsBloc', () => {
  describe('the gate', () => {
    it('is off until the flag says otherwise', () => {
      expect(new StreamingPlatformsBloc({ flags: { isEnabled: () => false } }).enabled).toBe(false);
    });

    it('asks once up front, so a resolved flag needs no interval at all', () => {
      const flags = { isEnabled: vi.fn(() => true) };

      const bloc = new StreamingPlatformsBloc({ flags });

      expect(flags.isEnabled).toHaveBeenCalledExactlyOnceWith(STREAMING_FLAG);
      expect(bloc.enabled).toBe(true);
    });

    it('does not poll at all once the answer is known', () => {
      vi.useFakeTimers();
      const flags = { isEnabled: vi.fn(() => true) };
      const bloc = new StreamingPlatformsBloc({ flags, pollMs: 10 });

      bloc.watchFlag();
      vi.advanceTimersByTime(1000);

      expect(flags.isEnabled).toHaveBeenCalledTimes(1);
    });

    it('keeps asking until the flag resolves, then stops', () => {
      vi.useFakeTimers();
      // `onFeatureFlags` can fire once while the flag still reads false and
      // then never fire again, so the answer has to be re-asked.
      const flags = flagsAfter(3);
      const bloc = new StreamingPlatformsBloc({ flags, pollMs: 100, maxTries: 25 });

      const stop = bloc.watchFlag();
      vi.advanceTimersByTime(300);
      expect(bloc.enabled).toBe(true);

      const asksWhenResolved = flags.asks;
      vi.advanceTimersByTime(1000);
      expect(flags.asks).toBe(asksWhenResolved);

      stop();
    });

    it('gives up after the try limit rather than polling forever', () => {
      vi.useFakeTimers();
      const flags = { isEnabled: vi.fn(() => false) };
      const bloc = new StreamingPlatformsBloc({ flags, pollMs: 100, maxTries: 5 });

      bloc.watchFlag();
      vi.advanceTimersByTime(100 * 20);

      // One ask in the constructor, then exactly `maxTries` polls.
      expect(flags.isEnabled).toHaveBeenCalledTimes(6);
      expect(bloc.enabled).toBe(false);
    });

    it('stops polling when the view goes away', () => {
      vi.useFakeTimers();
      const flags = { isEnabled: vi.fn(() => false) };
      const bloc = new StreamingPlatformsBloc({ flags, pollMs: 100 });

      bloc.watchFlag()();
      vi.advanceTimersByTime(1000);

      expect(flags.isEnabled).toHaveBeenCalledTimes(1);
    });
  });

  describe('the platform logos', () => {
    const bloc = () => new StreamingPlatformsBloc({ flags: { isEnabled: () => true } });

    it('serves a bundled logo rather than hotlinking one that 403s', () => {
      expect(bloc().iconFor('crunchyroll')).toBe('/assets/streams/crunchyroll.svg');
      expect(bloc().iconFor('netflix')).toBe('/assets/streams/netflix.svg');
    });

    it('matches whatever case the platform arrived in', () => {
      expect(bloc().iconFor('Crunchyroll')).toBe(bloc().iconFor('crunchyroll'));
      expect(bloc().iconFor('NETFLIX')).toBe(bloc().iconFor('netflix'));
    });

    it('maps a platform’s several names onto one logo', () => {
      const amazon = bloc().iconFor('amazon');

      expect(bloc().iconFor('Prime Video')).toBe(amazon);
      expect(bloc().iconFor('primevideo')).toBe(amazon);

      const apple = bloc().iconFor('apple');
      expect(bloc().iconFor('Apple TV')).toBe(apple);
      expect(bloc().iconFor('appletv')).toBe(apple);
    });

    it('falls back to a generic mark rather than to a broken image', () => {
      expect(bloc().iconFor('some new service')).toBe('/assets/streams/generic.svg');
      expect(bloc().iconFor('')).toBe('/assets/streams/generic.svg');
    });
  });

  describe('the platform links', () => {
    const bloc = () => new StreamingPlatformsBloc({ flags: { isEnabled: () => true } });

    it('leaves an absolute URL alone', () => {
      expect(bloc().hrefFor('https://www.crunchyroll.com/x')).toBe(
        'https://www.crunchyroll.com/x'
      );
      expect(bloc().hrefFor('http://example.com')).toBe('http://example.com');
    });

    it('gives a bare host a scheme, or it would resolve as a relative path', () => {
      expect(bloc().hrefFor('www.netflix.com/title/1')).toBe('https://www.netflix.com/title/1');
    });
  });
});
