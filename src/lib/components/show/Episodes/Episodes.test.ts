import { describe, it, expect, vi } from 'vitest';
import { EpisodesBloc, type EpisodeLike, type EpisodesDeps } from './Episodes.bloc.svelte';

/**
 * A list this long is mostly decisions: reading order, the cut-off, which
 * episode is next up, and what counts as watched.
 */

const NOW = new Date('2024-03-01T00:00:00Z');

const ep = (episodeNumber: number, airDate: string | null = null): EpisodeLike => ({
  id: `e${episodeNumber}`,
  episodeNumber,
  titleEn: `Episode ${episodeNumber}`,
  airDate
});

function makeBloc(
  source: Partial<ReturnType<NonNullable<EpisodesDeps['source']>>> = {},
  deps: Partial<EpisodesDeps> = {}
) {
  return new EpisodesBloc({
    source: () => ({
      episodes: [],
      watchedCount: 0,
      watchedNumbers: null,
      canTrack: false,
      pending: false,
      ...source
    }),
    now: () => NOW,
    ...deps
  });
}

const numbers = (episodes: EpisodeLike[]) => episodes.map((e) => e.episodeNumber);

describe('EpisodesBloc', () => {
  describe('reading order', () => {
    it('is newest first -- "did the latest one drop" is the recurring question', () => {
      const bloc = makeBloc({ episodes: [ep(1), ep(3), ep(2)] });

      expect(bloc.newestFirst).toBe(true);
      expect(numbers(bloc.ordered)).toEqual([3, 2, 1]);
      expect(bloc.sortLabel).toBe('Newest first');
    });

    it('flips to oldest first for anyone starting the show', () => {
      const bloc = makeBloc({ episodes: [ep(1), ep(3), ep(2)] });

      bloc.toggleSort();

      expect(numbers(bloc.ordered)).toEqual([1, 2, 3]);
      expect(bloc.sortLabel).toBe('Oldest first');

      bloc.toggleSort();
      expect(numbers(bloc.ordered)).toEqual([3, 2, 1]);
    });

    it('does not reorder the source array in place', () => {
      const episodes = [ep(1), ep(3), ep(2)];
      makeBloc({ episodes }).ordered;

      expect(numbers(episodes)).toEqual([1, 3, 2]);
    });

    it('copes with a show that has no episodes recorded', () => {
      const bloc = makeBloc();

      expect(bloc.ordered).toEqual([]);
      expect(bloc.visible).toEqual([]);
      expect(bloc.total).toBe(0);
      expect(bloc.hiddenCount).toBe(0);
    });
  });

  describe('the cut-off', () => {
    const many = Array.from({ length: 100 }, (_, i) => ep(i + 1));

    it('renders only the first page before the reader asks for more', () => {
      // A 500-episode show shipped every row into the SSR payload: 796KB for
      // Naruto, 960KB for Bleach.
      const bloc = makeBloc({ episodes: many }, { initialRows: 24 });

      expect(bloc.visible).toHaveLength(24);
      expect(bloc.hiddenCount).toBe(76);
      expect(bloc.total).toBe(100);
    });

    it('cuts from the top of the current order, not the raw list', () => {
      const bloc = makeBloc({ episodes: many }, { initialRows: 3 });

      expect(numbers(bloc.visible)).toEqual([100, 99, 98]);

      bloc.toggleSort();
      expect(numbers(bloc.visible)).toEqual([1, 2, 3]);
    });

    it('shows everything once expanded', () => {
      const bloc = makeBloc({ episodes: many }, { initialRows: 24 });

      bloc.expand();

      expect(bloc.expanded).toBe(true);
      expect(bloc.visible).toHaveLength(100);
      expect(bloc.hiddenCount).toBe(0);
    });

    it('hides nothing when the show is shorter than a page', () => {
      const bloc = makeBloc({ episodes: [ep(1), ep(2)] }, { initialRows: 24 });

      expect(bloc.hiddenCount).toBe(0);
    });

    it('returns the reader to the top only after the rows are gone', async () => {
      const scrollToTop = vi.fn();
      const bloc = makeBloc({ episodes: many }, { initialRows: 3, scrollToTop });
      bloc.expand();

      const collapsing = bloc.collapse();
      // Scrolling into the old layout lands at an offset the shrinking document
      // immediately clamps away.
      expect(scrollToTop).not.toHaveBeenCalled();

      await collapsing;
      expect(bloc.expanded).toBe(false);
      expect(scrollToTop).toHaveBeenCalledTimes(1);
    });
  });

  describe('the count line', () => {
    it('agrees with its noun', () => {
      expect(makeBloc({ episodes: [ep(1)] }).countLabel).toBe('1 episode');
      expect(makeBloc({ episodes: [ep(1), ep(2)] }).countLabel).toBe('2 episodes');
      expect(makeBloc().countLabel).toBe('0 episodes');
    });
  });

  describe('what has aired', () => {
    it('reads a past date as aired and a future one as not', () => {
      const bloc = makeBloc();

      expect(bloc.isAired(ep(1, '2024-02-01T00:00:00Z'))).toBe(true);
      expect(bloc.isAired(ep(2, '2024-04-01T00:00:00Z'))).toBe(false);
    });

    it('treats an episode with no usable date as unaired', () => {
      const bloc = makeBloc();

      expect(bloc.isAired(ep(1, null))).toBe(false);
      expect(bloc.isAired(ep(2, 'sometime'))).toBe(false);
      expect(bloc.airDateOf(ep(2, 'sometime'))).toBeNull();
    });

    it('picks the lowest-numbered unaired episode as next up', () => {
      const bloc = makeBloc({
        episodes: [
          ep(1, '2024-01-01T00:00:00Z'),
          ep(3, '2024-04-08T00:00:00Z'),
          ep(2, '2024-04-01T00:00:00Z')
        ]
      });

      // The one the whole page is about.
      expect(bloc.nextUp?.episodeNumber).toBe(2);
      expect(bloc.isNextUp(ep(2, '2024-04-01T00:00:00Z'))).toBe(true);
      expect(bloc.isNextUp(ep(3, '2024-04-08T00:00:00Z'))).toBe(false);
    });

    it('has no next up once everything has aired', () => {
      const bloc = makeBloc({ episodes: [ep(1, '2024-01-01T00:00:00Z')] });

      expect(bloc.nextUp).toBeUndefined();
      expect(bloc.isNextUp(ep(1, '2024-01-01T00:00:00Z'))).toBe(false);
    });

    it('does not depend on the current sort', () => {
      const bloc = makeBloc({
        episodes: [ep(2, '2024-04-01T00:00:00Z'), ep(3, '2024-04-08T00:00:00Z')]
      });
      const before = bloc.nextUp;

      bloc.toggleSort();

      expect(bloc.nextUp).toBe(before);
    });
  });

  describe('the date beside a row', () => {
    it('says TBA rather than an invalid date', () => {
      expect(makeBloc().dateLabel(ep(1, null))).toBe('TBA');
      expect(makeBloc().dateLabel(ep(1, 'soon'))).toBe('TBA');
    });

    it('gives the next episode a time and everything else just a date', () => {
      const next = ep(2, '2024-04-01T12:00:00Z');
      const bloc = makeBloc({ episodes: [ep(1, '2024-01-01T12:00:00Z'), next] });

      // Times are rendered in the viewer's zone, which is why they are stored.
      expect(bloc.dateLabel(next)).toMatch(/^\d{1,2} \w{3}, \d{1,2}:\d{2} (AM|PM)$/);
      expect(bloc.dateLabel(ep(1, '2024-01-01T12:00:00Z'))).toMatch(/^\d{1,2} \w{3} \d{4}$/);
    });
  });

  describe('what counts as watched', () => {
    it('uses the per-episode set wherever it exists', () => {
      const bloc = makeBloc({ watchedNumbers: new Set([1, 2, 5]), watchedCount: 5 });

      // Watching 1, 2 and 5 is a thing people do.
      expect(bloc.isWatched(ep(2))).toBe(true);
      expect(bloc.isWatched(ep(3))).toBe(false);
      expect(bloc.isWatched(ep(5))).toBe(true);
    });

    it('falls back to the high-water count before that query resolves', () => {
      const bloc = makeBloc({ watchedNumbers: null, watchedCount: 3 });

      expect(bloc.isWatched(ep(3))).toBe(true);
      expect(bloc.isWatched(ep(4))).toBe(false);
    });

    it('prefers an empty set over a stale count', () => {
      const bloc = makeBloc({ watchedNumbers: new Set(), watchedCount: 5 });

      expect(bloc.isWatched(ep(1))).toBe(false);
    });

    it('names the action the tick will perform', () => {
      const bloc = makeBloc({ watchedNumbers: new Set([1]) });

      expect(bloc.watchLabel(ep(1))).toBe('Mark episode 1 unwatched');
      expect(bloc.watchLabel(ep(2))).toBe('Mark episode 2 watched');
    });
  });

  describe('ticking an episode', () => {
    it('reports the episode itself, not a new high-water mark', () => {
      const watch = vi.fn();
      const bloc = makeBloc({ canTrack: true, watchedNumbers: new Set([1, 2]) }, { watch });

      bloc.toggleWatched(ep(5));

      // The old model could only say "up to 5", silently claiming 3 and 4.
      expect(watch).toHaveBeenCalledWith({ episodeNumber: 5, watched: true });
    });

    it('unticks one that is already watched', () => {
      const watch = vi.fn();
      const bloc = makeBloc({ canTrack: true, watchedNumbers: new Set([1]) }, { watch });

      bloc.toggleWatched(ep(1));

      expect(watch).toHaveBeenCalledWith({ episodeNumber: 1, watched: false });
    });

    it('does nothing for a viewer who cannot track', () => {
      const watch = vi.fn();
      const bloc = makeBloc({ canTrack: false }, { watch });

      bloc.toggleWatched(ep(1));

      expect(watch).not.toHaveBeenCalled();
    });

    it('does nothing while a write is already in flight', () => {
      const watch = vi.fn();
      const bloc = makeBloc({ canTrack: true, pending: true }, { watch });

      bloc.toggleWatched(ep(1));

      expect(watch).not.toHaveBeenCalled();
    });

    it('exposes the two flags the view dims itself with', () => {
      const bloc = makeBloc({ canTrack: true, pending: true, watchedCount: 7 });

      expect(bloc.canTrack).toBe(true);
      expect(bloc.pending).toBe(true);
      expect(bloc.watchedCount).toBe(7);
    });
  });
});
