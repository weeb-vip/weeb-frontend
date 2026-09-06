import { describe, it, expect, vi, beforeAll, afterAll } from 'vitest';
import { render, screen, within } from '@testing-library/svelte';
import userEvent from '@testing-library/user-event';
import { stubScrollIntoView } from '$lib/components/__tests__/jsdom-gaps';
import Episodes from './Episodes.svelte';
import type { EpisodeLike, WatchIntent } from './Episodes.bloc.svelte';

/**
 * The episode list as it is drawn: the rows, the toolbar, the watch controls
 * and the show-more/show-fewer pair.
 *
 * The decisions behind all of that -- reading order, the cut-off, which episode
 * is next up, what counts as watched, the date format -- belong to
 * `EpisodesBloc` and are asserted in `Episodes.test.ts`. This file renders the
 * component through its ordinary props (so the default bloc is the real one)
 * and asserts only the markup and the interaction.
 *
 * Dates are pinned by being absurd rather than by faking the clock: 2019 has
 * aired under any clock this suite will ever run on, and 2099 has not. That
 * keeps `userEvent`'s own timers real.
 *
 * jsdom caveats, stated rather than papered over:
 *  - `stubScrollIntoView`, because collapsing the list returns the reader to
 *    its top and jsdom implements no scrolling at all. Whether they actually
 *    land on the toolbar is a browser fact and belongs to the e2e layer.
 *  - The row states other than "watched" are carried by class and colour only:
 *    `ep-row--future` dims an unaired row and `.ep-next-dot` marks the next
 *    one. jsdom loads no stylesheet, so those are asserted as *present* and
 *    nothing more -- that they read as distinct is a visual question. Only the
 *    watched state has an accessible representation (`aria-pressed` on the
 *    row's control), which is what is asserted for it.
 */

const ep = (
  episodeNumber: number,
  overrides: Partial<EpisodeLike> = {}
): EpisodeLike => ({
  id: `e${episodeNumber}`,
  episodeNumber,
  titleEn: `Episode ${episodeNumber}`,
  airDate: '2019-04-03T12:00:00Z',
  ...overrides
});

const AIRED = [ep(1), ep(2), ep(3)];

/** The rows, in the order they are drawn. */
const rowNumbers = () =>
  screen.getAllByRole('listitem').map((row) => row.querySelector('.ep-num')?.textContent?.trim());

const watchButtons = () => screen.queryAllByRole('button', { name: /^Mark episode/ });

let restoreScroll: () => void;
beforeAll(() => {
  restoreScroll = stubScrollIntoView();
});
afterAll(() => restoreScroll());

describe('Episodes (rendering)', () => {
  describe('the list', () => {
    it('draws one row per episode, newest first', () => {
      render(Episodes, { props: { episodes: AIRED } });

      // "Did the latest one drop" is the recurring question, so the answer is
      // the first row rather than the last.
      expect(rowNumbers()).toEqual(['3', '2', '1']);
    });

    it('names each episode, and says so when the source has no name for one', () => {
      render(Episodes, {
        props: { episodes: [ep(1, { titleEn: 'The Real Folk Blues' }), ep(2, { titleEn: null })] }
      });

      expect(screen.getByText('The Real Folk Blues')).toBeInTheDocument();
      expect(screen.getByText('TBA')).toBeInTheDocument();
    });

    it('carries the Japanese title as a second line, when it is a different one', () => {
      const { container } = render(Episodes, {
        props: {
          episodes: [ep(1, { titleEn: 'Asteroid Blues', titleJp: 'アステロイド・ブルース' })]
        }
      });

      expect(screen.getByText('アステロイド・ブルース')).toBeInTheDocument();
      expect(container.querySelectorAll('.ep-sub')).toHaveLength(1);
    });

    it('does not repeat a Japanese title that is the same string', () => {
      const { container } = render(Episodes, {
        props: { episodes: [ep(1, { titleEn: 'Bebop', titleJp: 'Bebop' })] }
      });

      expect(container.querySelector('.ep-sub')).toBeNull();
    });

    it('prints TBA for a row with no air date', () => {
      render(Episodes, { props: { episodes: [ep(1, { titleEn: 'Named', airDate: null })] } });

      const row = screen.getByRole('listitem');
      expect(within(row).getByText('TBA')).toBeInTheDocument();
    });

    it('renders an empty list, and no controls around it, for a show with no episodes', () => {
      render(Episodes, { props: { episodes: [] } });

      expect(screen.queryAllByRole('listitem')).toHaveLength(0);
      expect(screen.getByText('0 episodes')).toBeInTheDocument();
      expect(screen.queryByRole('button', { name: /Show all/ })).not.toBeInTheDocument();
      expect(screen.queryByRole('button', { name: 'Show fewer' })).not.toBeInTheDocument();
    });
  });

  describe('the count line', () => {
    it('agrees with itself about one episode', () => {
      render(Episodes, { props: { episodes: [ep(1)] } });

      expect(screen.getByText('1 episode')).toBeInTheDocument();
    });

    it('adds how many the viewer has watched, but only when they can track', () => {
      render(Episodes, {
        props: { episodes: AIRED, canTrack: true, watchedCount: 2, watchedNumbers: new Set([1, 2]) }
      });

      expect(screen.getByText(/3 episodes\s*·\s*2 watched/)).toBeInTheDocument();
    });

    it('says nothing about watching to someone who cannot track', () => {
      render(Episodes, { props: { episodes: AIRED, watchedCount: 2 } });

      expect(screen.getByText('3 episodes')).toBeInTheDocument();
      expect(screen.queryByText(/watched/)).not.toBeInTheDocument();
    });
  });

  describe('the sort control', () => {
    it('reports the order it is currently in', () => {
      render(Episodes, { props: { episodes: AIRED } });

      const sort = screen.getByRole('button', { name: 'Newest first' });
      expect(sort).toHaveAttribute('aria-pressed', 'true');
    });

    it('flips the rows for anyone starting the show', async () => {
      render(Episodes, { props: { episodes: AIRED } });

      await userEvent.click(screen.getByRole('button', { name: 'Newest first' }));

      expect(rowNumbers()).toEqual(['1', '2', '3']);
      expect(screen.getByRole('button', { name: 'Oldest first' })).toHaveAttribute(
        'aria-pressed',
        'false'
      );
    });

    it('flips back', async () => {
      render(Episodes, { props: { episodes: AIRED } });

      await userEvent.click(screen.getByRole('button', { name: 'Newest first' }));
      await userEvent.click(screen.getByRole('button', { name: 'Oldest first' }));

      expect(rowNumbers()).toEqual(['3', '2', '1']);
    });
  });

  describe('unaired episodes', () => {
    it('marks the first episode still to come, and only that one', () => {
      const { container } = render(Episodes, {
        props: {
          episodes: [
            ep(1),
            ep(2, { airDate: '2099-01-01T12:00:00Z' }),
            ep(3, { airDate: '2099-02-01T12:00:00Z' })
          ]
        }
      });

      // The dot is `aria-hidden` decoration and the row tint is a class: this
      // marker has no accessible representation, so presence is all that can be
      // asserted here. Whether it reads as "next" is a visual question.
      expect(container.querySelectorAll('.ep-next-dot')).toHaveLength(1);
      const next = container.querySelector('.ep-row--next');
      expect(next?.querySelector('.ep-num')?.textContent?.trim()).toBe('2');
    });

    it('sets every unaired row apart from the ones that have been', () => {
      const { container } = render(Episodes, {
        props: { episodes: [ep(1), ep(2, { airDate: '2099-01-01T12:00:00Z' })] }
      });

      const future = container.querySelectorAll('.ep-row--future');
      expect(future).toHaveLength(1);
      expect(future[0].querySelector('.ep-num')?.textContent?.trim()).toBe('2');
    });

    it('marks nothing as next up on a show that has finished airing', () => {
      const { container } = render(Episodes, { props: { episodes: AIRED } });

      expect(container.querySelector('.ep-next-dot')).toBeNull();
      expect(container.querySelector('.ep-row--future')).toBeNull();
    });
  });

  describe('the watch control', () => {
    /**
     * A dead button teaches nothing, and the page already had two of them, so
     * the control is absent rather than disabled while signed out.
     */
    it('is not rendered at all for a show that is not on the viewer’s list', () => {
      render(Episodes, { props: { episodes: AIRED, canTrack: false } });

      expect(watchButtons()).toHaveLength(0);
    });

    it('is one toggle per row once the show is tracked', () => {
      render(Episodes, { props: { episodes: AIRED, canTrack: true } });

      expect(watchButtons()).toHaveLength(3);
    });

    it('says which episode it marks, and which way', () => {
      render(Episodes, {
        props: { episodes: AIRED, canTrack: true, watchedNumbers: new Set([1]) }
      });

      const watched = screen.getByRole('button', { name: 'Mark episode 1 unwatched' });
      expect(watched).toHaveAttribute('aria-pressed', 'true');
      expect(screen.getByRole('button', { name: 'Mark episode 2 watched' })).toHaveAttribute(
        'aria-pressed',
        'false'
      );
    });

    it('falls back to the aggregate count while the per-episode query is unanswered', () => {
      // Signed in, list entry says 2 watched, no per-episode data yet. The
      // fallback is what keeps the list from showing everything unwatched and
      // inviting a click that un-marks something.
      render(Episodes, {
        props: { episodes: AIRED, canTrack: true, watchedCount: 2, watchedNumbers: null }
      });

      expect(screen.getByRole('button', { name: 'Mark episode 1 unwatched' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Mark episode 2 unwatched' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Mark episode 3 watched' })).toBeInTheDocument();
    });

    it('reports the episode itself, not a new high-water mark', async () => {
      const onWatch = vi.fn<(intent: WatchIntent) => void>();
      render(Episodes, {
        props: { episodes: AIRED, canTrack: true, watchedNumbers: new Set([1]), onWatch }
      });

      await userEvent.click(screen.getByRole('button', { name: 'Mark episode 3 watched' }));

      // Watching 1, 2 and 5 is a thing people do; "up to 5" would silently
      // claim 3 and 4 as well.
      expect(onWatch).toHaveBeenCalledWith({ episodeNumber: 3, watched: true });
      expect(onWatch).toHaveBeenCalledTimes(1);
    });

    it('reports an un-marking the same way round', async () => {
      const onWatch = vi.fn<(intent: WatchIntent) => void>();
      render(Episodes, {
        props: { episodes: AIRED, canTrack: true, watchedNumbers: new Set([1, 2]), onWatch }
      });

      await userEvent.click(screen.getByRole('button', { name: 'Mark episode 2 unwatched' }));

      expect(onWatch).toHaveBeenCalledWith({ episodeNumber: 2, watched: false });
    });

    it('is disabled, and reports nothing, while a write is in flight', async () => {
      const onWatch = vi.fn<(intent: WatchIntent) => void>();
      render(Episodes, {
        props: { episodes: AIRED, canTrack: true, pending: true, onWatch }
      });

      const button = screen.getByRole('button', { name: 'Mark episode 3 watched' });
      expect(button).toBeDisabled();

      await userEvent.click(button);
      expect(onWatch).not.toHaveBeenCalled();
    });
  });

  describe('showing more of a long run', () => {
    const many = Array.from({ length: 30 }, (_, index) => ep(index + 1));

    it('renders the first page of rows and offers the rest', () => {
      render(Episodes, { props: { episodes: many } });

      // A 500-episode show used to ship every row into the SSR payload.
      expect(screen.getAllByRole('listitem')).toHaveLength(24);
      expect(screen.getByRole('button', { name: 'Show all 30 episodes' })).toBeInTheDocument();
      expect(screen.queryByRole('button', { name: 'Show fewer' })).not.toBeInTheDocument();
    });

    it('draws them all once asked, and offers the way back', async () => {
      render(Episodes, { props: { episodes: many } });

      await userEvent.click(screen.getByRole('button', { name: 'Show all 30 episodes' }));

      expect(screen.getAllByRole('listitem')).toHaveLength(30);
      expect(screen.getByRole('button', { name: 'Show fewer' })).toBeInTheDocument();
      expect(screen.queryByRole('button', { name: /Show all/ })).not.toBeInTheDocument();
    });

    it('collapses back to the first page', async () => {
      render(Episodes, { props: { episodes: many } });

      await userEvent.click(screen.getByRole('button', { name: 'Show all 30 episodes' }));
      await userEvent.click(screen.getByRole('button', { name: 'Show fewer' }));

      expect(screen.getAllByRole('listitem')).toHaveLength(24);
      expect(screen.getByRole('button', { name: 'Show all 30 episodes' })).toBeInTheDocument();
    });

    it('returns the reader to the top of the list rather than the top of the page', async () => {
      // The list's own element is the anchor: collapsing 136 rows removes
      // ~15,000px from above the viewport. Where the browser then puts them is
      // a scrolling fact -- jsdom performs none -- so only the call is
      // assertable here.
      const scrollIntoView = vi.fn();
      Element.prototype.scrollIntoView = scrollIntoView;

      render(Episodes, { props: { episodes: many } });
      await userEvent.click(screen.getByRole('button', { name: 'Show all 30 episodes' }));
      await userEvent.click(screen.getByRole('button', { name: 'Show fewer' }));

      expect(scrollIntoView).toHaveBeenCalledWith({ block: 'start', behavior: 'auto' });
      Element.prototype.scrollIntoView = () => {};
    });

    it('offers neither control when everything already fits', () => {
      render(Episodes, { props: { episodes: AIRED } });

      expect(screen.queryByRole('button', { name: /Show all/ })).not.toBeInTheDocument();
      expect(screen.queryByRole('button', { name: 'Show fewer' })).not.toBeInTheDocument();
    });
  });
});
