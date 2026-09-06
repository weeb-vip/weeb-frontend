import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/svelte';
import AiringIndicator from './AiringIndicator.svelte';

/**
 * One rule: green is airing, amber is upcoming, and nothing else is either.
 *
 * The bug this pins is a disagreement, not a shade -- `AnimeCard` drew "airing
 * now" in AMBER, the colour the rest of the app uses for "not out yet", so the
 * palette said two opposite things at once, and the chip form managed to be
 * amber with a green dot inside it.
 *
 * jsdom loads no stylesheet, so "green" here is the token the rules key on
 * (`--chip-color: var(--weeb-green)`) plus the `is-airing` class, asserted
 * together so the chip and the dot inside it cannot drift apart again. What the
 * token resolves to on screen is a browser assertion.
 */

const chipOf = (container: HTMLElement) => container.querySelector('.chip') as HTMLElement;
const dotOf = (container: HTMLElement) => container.querySelector('.dot') as HTMLElement;

describe('AiringIndicator', () => {
  describe('the solo dot', () => {
    it('names itself "Airing" for a reader, since it is the only content', () => {
      render(AiringIndicator, { props: { state: 'airing' } });

      expect(screen.getByRole('img', { name: 'Airing' })).toBeInTheDocument();
    });

    it('names itself "Upcoming" when it is not on the air yet', () => {
      render(AiringIndicator, { props: { state: 'upcoming' } });

      expect(screen.getByRole('img', { name: 'Upcoming' })).toBeInTheDocument();
    });

    /** REGRESSION: airing is the green branch. */
    it('is green while airing', () => {
      const { container } = render(AiringIndicator, { props: { state: 'airing' } });

      expect(dotOf(container)).toHaveClass('dot--solo', 'is-airing');
    });

    /** REGRESSION: upcoming is NOT the green branch -- it falls through to amber. */
    it('is amber while upcoming -- never the airing green', () => {
      const { container } = render(AiringIndicator, { props: { state: 'upcoming' } });

      expect(dotOf(container)).toHaveClass('dot--solo');
      expect(dotOf(container)).not.toHaveClass('is-airing');
    });

    it('pulses only while airing -- a scheduled thing must not move', () => {
      const airing = render(AiringIndicator, { props: { state: 'airing' } });
      expect(dotOf(airing.container)).toHaveClass('pulse');
      airing.unmount();

      const upcoming = render(AiringIndicator, { props: { state: 'upcoming' } });
      expect(dotOf(upcoming.container)).not.toHaveClass('pulse');
    });

    it('can be told not to pulse where the motion would be noise', () => {
      const { container } = render(AiringIndicator, {
        props: { state: 'airing', pulse: false }
      });

      expect(dotOf(container)).not.toHaveClass('pulse');
      expect(dotOf(container)).toHaveClass('is-airing');
    });
  });

  describe('the chip', () => {
    it('reads "Airing" and tints the whole chip green -- dot included', () => {
      const { container } = render(AiringIndicator, {
        props: { state: 'airing', presentation: 'chip' }
      });

      expect(screen.getByText('Airing')).toBeInTheDocument();
      expect(chipOf(container).getAttribute('style')).toContain('--chip-color: var(--weeb-green)');
      expect(dotOf(container)).toHaveClass('is-airing');
    });

    /**
     * REGRESSION. The chip and the dot inside it are asserted in the same test
     * on purpose: the old bug was an amber chip carrying a green dot, which
     * either assertion alone would have missed.
     */
    it('reads "Upcoming" and tints the whole chip amber -- dot included', () => {
      const { container } = render(AiringIndicator, {
        props: { state: 'upcoming', presentation: 'chip' }
      });

      expect(screen.getByText('Upcoming')).toBeInTheDocument();
      const style = chipOf(container).getAttribute('style') ?? '';
      expect(style).toContain('--chip-color: var(--weeb-amber)');
      expect(style).not.toContain('--weeb-green');
      expect(dotOf(container)).not.toHaveClass('is-airing');
    });

    it('takes a label of its own, for a countdown', () => {
      render(AiringIndicator, {
        props: { state: 'airing', presentation: 'chip', label: 'Ep 5 in 2h', mono: true }
      });

      expect(screen.getByText('Ep 5 in 2h')).toBeInTheDocument();
    });

    it('puts a countdown label in the mono face, per the mono numeral rule', () => {
      const { container } = render(AiringIndicator, {
        props: { state: 'airing', presentation: 'chip', label: 'Ep 5 in 2h', mono: true }
      });

      expect(chipOf(container)).toHaveClass('chip--mono');
    });

    it('hides the dot from the reader -- the label already says which it is', () => {
      const { container } = render(AiringIndicator, {
        props: { state: 'airing', presentation: 'chip' }
      });

      expect(dotOf(container)).toHaveAttribute('aria-hidden', 'true');
    });

    it('is a plain span, not a control', () => {
      render(AiringIndicator, { props: { state: 'airing', presentation: 'chip' } });

      expect(screen.queryByRole('button')).not.toBeInTheDocument();
      expect(screen.queryByRole('link')).not.toBeInTheDocument();
    });
  });
});
