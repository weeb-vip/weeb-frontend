import { describe, it, expect, vi, beforeAll, afterAll } from 'vitest';
import { render, screen, within } from '@testing-library/svelte';
import userEvent from '@testing-library/user-event';
import ShowQuickInfo from './ShowQuickInfo.svelte';
import { SCORE_OPTIONS } from './ShowQuickInfo.logic';

/**
 * The strip under the hero: the facts as chips on the left, the viewer's own
 * controls on the right.
 *
 * Presentational -- every write leaves as a callback so the page's one mutation
 * owns them, which is what keeps the score and the episode stepper from
 * blanking each other's field. So the assertions are: which chips exist for
 * which record, and that each control reports rather than mutates.
 */

/**
 * `Select` portals its menu and calls `scrollIntoView` while arrowing; jsdom
 * implements neither layout nor that method. Stubbed rather than avoided --
 * whether the row scrolls into view needs a browser.
 */
beforeAll(() => {
  Element.prototype.scrollIntoView = function scrollIntoView() {};
});
afterAll(() => {
  delete (Element.prototype as unknown as Record<string, unknown>).scrollIntoView;
});

const base = {
  anime: { id: 'a1' },
  airingLabel: 'Finished',
  onScore: () => {},
  onStep: () => {}
};

const chips = (container: HTMLElement) =>
  [...container.querySelectorAll('.quick-info__stats .chip')].map((el) =>
    el.textContent?.replace(/\s+/g, ' ').trim()
  );

describe('ShowQuickInfo', () => {
  describe('the facts', () => {
    it('draws every chip the record has a value for, in page order', () => {
      const { container } = render(ShowQuickInfo, {
        props: {
          ...base,
          anime: { id: 'a1', ranking: 24, duration: '24 min', rating: 'R - 17+' },
          episodeCount: 26,
          studio: 'Sunrise',
          nextChip: 'EP 12 in 3h'
        }
      });

      expect(chips(container)).toEqual([
        '#24',
        'Finished',
        '26 ep',
        '24 min',
        'Sunrise',
        'R - 17+',
        'EP 12 in 3h'
      ]);
    });

    it('carries only the airing state for a bare record', () => {
      const { container } = render(ShowQuickInfo, { props: base });

      // Every other chip is a fact we do not have; a chip reading "0 ep" or an
      // empty studio pill would assert something false.
      expect(chips(container)).toEqual(['Finished']);
    });

    it.each([
      ['the ranking', { ranking: null }],
      ['the runtime', { duration: null }],
      ['the rating', { rating: null }]
    ])('omits %s when the record has none', (_label, over) => {
      const { container } = render(ShowQuickInfo, {
        props: { ...base, anime: { id: 'a1', ...over } }
      });

      expect(chips(container)).toEqual(['Finished']);
    });

    it('omits the episode chip for a show with no episodes recorded', () => {
      const { container } = render(ShowQuickInfo, { props: { ...base, episodeCount: 0 } });

      expect(chips(container)).not.toContain('0 ep');
    });
  });

  describe('the airing state', () => {
    /**
     * Airing is green with the one pulse; anything else is a plain fact with a
     * muted dot. It used to be a green chip AND an amber "NOW" chip carrying a
     * green dot, in a palette where amber already means "upcoming".
     */
    it('gives an airing show the live indicator', () => {
      const { container } = render(ShowQuickInfo, {
        props: { ...base, airing: true, airingLabel: 'Airing' }
      });

      const chip = container.querySelector('.quick-info__stats .chip') as HTMLElement;
      expect(chip).toHaveTextContent('Airing');
      // `.dot.is-airing` is AiringIndicator's own marker -- the class is the
      // contract because the colour and the pulse are CSS jsdom cannot see.
      expect(chip.querySelector('.dot.is-airing')).toBeInTheDocument();
    });

    it('gives a finished show a plain dotted chip, not the live one', () => {
      const { container } = render(ShowQuickInfo, {
        props: { ...base, airing: false, airingLabel: 'Finished' }
      });

      const chip = container.querySelector('.quick-info__stats .chip') as HTMLElement;
      expect(chip).toHaveTextContent('Finished');
      expect(chip.querySelector('.dot.is-airing')).toBeNull();
      expect(chip.querySelector('.chip-dot')).toBeInTheDocument();
    });
  });

  describe('the next-episode chip', () => {
    it('is amber for something scheduled', () => {
      const { container } = render(ShowQuickInfo, { props: { ...base, nextChip: 'EP 12 in 3h' } });

      const chip = [...container.querySelectorAll('.chip')].at(-1) as HTMLElement;
      expect(chip).toHaveTextContent('EP 12 in 3h');
      expect(chip.querySelector('.dot.is-airing')).toBeNull();
    });

    it('becomes the live indicator, not an amber chip, while an episode is on air', () => {
      const { container } = render(ShowQuickInfo, { props: { ...base, nextChip: 'NOW' } });

      const chip = [...container.querySelectorAll('.chip')].at(-1) as HTMLElement;
      expect(chip).toHaveTextContent('NOW');
      expect(chip.querySelector('.dot.is-airing')).toBeInTheDocument();
    });

    it('is absent when there is nothing scheduled', () => {
      const { container } = render(ShowQuickInfo, { props: { ...base, nextChip: null } });

      expect(chips(container)).toEqual(['Finished']);
    });
  });

  describe('the score control', () => {
    it('is a named select showing the viewer\'s score', () => {
      render(ShowQuickInfo, { props: { ...base, canTrack: true, score: 8 } });

      const select = screen.getByRole('button', { name: 'Your score' });
      expect(select).toHaveTextContent('8');
      expect(select).toHaveAttribute('aria-haspopup', 'listbox');
    });

    it('reads "Score" while the viewer has not rated it', () => {
      render(ShowQuickInfo, { props: { ...base, canTrack: true, score: '' } });

      expect(screen.getByRole('button', { name: 'Your score' })).toHaveTextContent('Score');
    });

    it('offers ten scores plus the blank "no score yet"', () => {
      // The option list is `SCORE_OPTIONS`, tested as data in the logic suite;
      // this only checks the component actually hands it over.
      expect(SCORE_OPTIONS).toHaveLength(11);

      render(ShowQuickInfo, { props: { ...base, canTrack: true } });

      expect(screen.getByRole('button', { name: 'Your score' })).toBeInTheDocument();
    });

    it('reports the chosen score as a string rather than writing it itself', async () => {
      const onScore = vi.fn();
      render(ShowQuickInfo, { props: { ...base, canTrack: true, score: '', onScore } });

      await userEvent.click(screen.getByRole('button', { name: 'Your score' }));
      await userEvent.click(within(screen.getByRole('listbox')).getByRole('option', { name: '9' }));

      // A string, not a number: the page's mutation takes it as one, and a
      // bare `9` would have been written as an int by one call site and a
      // string by the other.
      expect(onScore).toHaveBeenCalledExactlyOnceWith('9');
      expect(onScore.mock.calls[0][0]).toBeTypeOf('string');
    });

    it.each([
      ['the show is not on the viewer\'s list', { canTrack: false, pending: false }],
      ['a write is already in flight', { canTrack: true, pending: true }]
    ])('is inert while %s', (_label, over) => {
      render(ShowQuickInfo, { props: { ...base, ...over } });

      expect(screen.getByRole('button', { name: 'Your score' })).toBeDisabled();
    });
  });

  describe('the episode stepper', () => {
    it('reads watched over total', () => {
      const { container } = render(ShowQuickInfo, {
        props: { ...base, canTrack: true, watched: 7, total: 26 }
      });

      expect(container.querySelector('.qi-ep-count')).toHaveTextContent('7/26');
    });

    it('reads a question mark for a show whose length is unknown', () => {
      const { container } = render(ShowQuickInfo, {
        props: { ...base, canTrack: true, watched: 7, total: null }
      });

      expect(container.querySelector('.qi-ep-count')).toHaveTextContent('7/?');
    });

    it('reports a step rather than moving the count itself', async () => {
      const onStep = vi.fn();
      render(ShowQuickInfo, { props: { ...base, canTrack: true, watched: 7, total: 26, onStep } });

      await userEvent.click(screen.getByRole('button', { name: 'Increase episodes watched' }));
      expect(onStep).toHaveBeenCalledExactlyOnceWith(1);

      await userEvent.click(screen.getByRole('button', { name: 'Decrease episodes watched' }));
      expect(onStep).toHaveBeenLastCalledWith(-1);
    });

    it('names both buttons, which carry a glyph and no text', () => {
      render(ShowQuickInfo, { props: { ...base, canTrack: true, watched: 1, total: 26 } });

      // A "−" and a "+" are not accessible names, so the aria-labels are the
      // only thing naming these controls.
      expect(screen.getByRole('button', { name: 'Decrease episodes watched' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Increase episodes watched' })).toBeInTheDocument();
    });

    it('cannot step below zero', async () => {
      const onStep = vi.fn();
      render(ShowQuickInfo, { props: { ...base, canTrack: true, watched: 0, total: 26, onStep } });

      const minus = screen.getByRole('button', { name: 'Decrease episodes watched' });
      expect(minus).toBeDisabled();

      await userEvent.click(minus);
      expect(onStep).not.toHaveBeenCalled();
    });

    it('cannot step past the last episode', async () => {
      const onStep = vi.fn();
      render(ShowQuickInfo, { props: { ...base, canTrack: true, watched: 26, total: 26, onStep } });

      const plus = screen.getByRole('button', { name: 'Increase episodes watched' });
      expect(plus).toBeDisabled();

      await userEvent.click(plus);
      expect(onStep).not.toHaveBeenCalled();
    });

    it('keeps stepping up while the show\'s length is unknown', () => {
      render(ShowQuickInfo, { props: { ...base, canTrack: true, watched: 99, total: null } });

      expect(screen.getByRole('button', { name: 'Increase episodes watched' })).toBeEnabled();
    });

    it.each([
      ['the show is not on the viewer\'s list', { canTrack: false, pending: false }],
      ['a write is already in flight', { canTrack: true, pending: true }]
    ])('is inert in both directions while %s', (_label, over) => {
      render(ShowQuickInfo, { props: { ...base, ...over, watched: 5, total: 26 } });

      expect(screen.getByRole('button', { name: 'Decrease episodes watched' })).toBeDisabled();
      expect(screen.getByRole('button', { name: 'Increase episodes watched' })).toBeDisabled();
    });
  });

  describe('the tracking action', () => {
    it('offers add-to-list for a show not on the list', () => {
      render(ShowQuickInfo, { props: base });

      expect(screen.getByRole('button', { name: 'Add to list' })).toBeInTheDocument();
    });

    it('swaps to the status control once it is on the list', () => {
      const { container } = render(ShowQuickInfo, {
        props: { ...base, anime: { id: 'a1', userAnime: { id: 'u1', status: 'ONHOLD' } } }
      });

      expect(screen.queryByRole('button', { name: 'Add to list' })).not.toBeInTheDocument();
      expect(container.querySelector('.asd-label')).toHaveTextContent('On Hold');
    });
  });
});
