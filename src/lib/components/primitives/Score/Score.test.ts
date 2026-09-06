import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/svelte';
import Score from './Score.svelte';

/**
 * A rating, drawn one way. The point of this component is that there are no
 * longer four star glyphs for one idea, so the regression to guard is that both
 * variants keep drawing the SAME star -- one filled SVG, never a text `★`,
 * whose rendering depends on whichever emoji font the platform picks.
 */

const starOf = (container: HTMLElement) => container.querySelector('svg.score-star');

describe('Score', () => {
  describe('the value', () => {
    it('draws a number to one decimal place, so a column of them lines up', () => {
      render(Score, { props: { value: 8 } });

      expect(screen.getByText('8.0')).toBeInTheDocument();
    });

    it('passes an already-formatted string through', () => {
      render(Score, { props: { value: '7.85' } });

      expect(screen.getByText('7.85')).toBeInTheDocument();
    });

    it('inline renders the placeholder when there is no score', () => {
      const { container } = render(Score, { props: { value: null } });

      expect(screen.getByText('—')).toBeInTheDocument();
      expect(starOf(container)).toBeNull();
      expect(container.querySelector('.score')).toHaveClass('no-score');
    });

    it('treats an empty string as absent -- an unrated show sends one', () => {
      render(Score, { props: { value: '' } });

      expect(screen.getByText('—')).toBeInTheDocument();
    });

    it('takes a custom placeholder', () => {
      render(Score, { props: { value: null, placeholder: 'Unrated' } });

      expect(screen.getByText('Unrated')).toBeInTheDocument();
    });

    it('a badge with no score renders nothing at all -- it does not sit empty over art', () => {
      const { container } = render(Score, { props: { value: null, variant: 'badge' } });

      expect(container.querySelector('.score')).toBeNull();
    });
  });

  describe('one star treatment', () => {
    /**
     * REGRESSION. `badge` and `inline` must draw the same star: one filled SVG
     * marked decorative, exactly once, with the same path in both. The five
     * hand-rolled ancestors had a text `&#9733;` in three of them and an inline
     * SVG in a fourth.
     */
    it('badge and inline draw the identical star SVG, once each', () => {
      const badge = render(Score, { props: { value: 8.4, variant: 'badge' } });
      const badgeStar = starOf(badge.container);
      expect(badge.container.querySelectorAll('svg.score-star')).toHaveLength(1);
      badge.unmount();

      const inline = render(Score, { props: { value: 8.4, variant: 'inline' } });
      const inlineStar = starOf(inline.container);
      expect(inline.container.querySelectorAll('svg.score-star')).toHaveLength(1);

      expect(badgeStar).not.toBeNull();
      expect(inlineStar).not.toBeNull();

      const pathOf = (star: Element | null) => star?.querySelector('path')?.getAttribute('d');
      expect(pathOf(badgeStar)).toBe(pathOf(inlineStar));
      expect(badgeStar?.getAttribute('fill')).toBe(inlineStar?.getAttribute('fill'));
      expect(badgeStar?.getAttribute('fill')).toBe('currentColor');
    });

    it('the star is decorative -- the number is the content', () => {
      const { container } = render(Score, { props: { value: 8.4 } });

      expect(starOf(container)).toHaveAttribute('aria-hidden', 'true');
      expect(container.querySelector('.score')).toHaveTextContent('8.4');
    });

    it('no text star glyph is emitted anywhere', () => {
      const { container } = render(Score, { props: { value: 8.4, variant: 'badge' } });

      expect(container.textContent).not.toContain('★');
      expect(container.textContent).not.toContain('☆');
    });

    it('carries the variant class the CSS keys on', () => {
      const { container } = render(Score, { props: { value: 8.4, variant: 'badge' } });

      expect(container.querySelector('.score')).toHaveClass('score--badge');
    });
  });
});
