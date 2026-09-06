import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/svelte';
import PosterCardSkeleton from './PosterCardSkeleton.svelte';

/**
 * A placeholder has almost no behaviour, so there is almost nothing here: it
 * is three `Skeleton` boxes and a pass-through class.
 *
 * What IS worth holding is the reason the component exists at all -- the
 * homepage and the season page each had their own three boxes and their own
 * `shimmer` keyframe. So this asserts that the boxes come from `Skeleton`
 * (the shared `animate-pulse` class, which is the only pulse in the app) and
 * that there are three of them in the PosterCard's order.
 *
 * jsdom applies no CSS, so "2:3 poster, title line, subtitle line" is a
 * measurement and stays with the visual layer. The Tailwind sizing classes are
 * asserted as the strings the browser keys on, not as an appearance.
 */

describe('PosterCardSkeleton', () => {
  it('is three shared Skeleton boxes -- not a local shimmer', () => {
    const { container } = render(PosterCardSkeleton);

    const boxes = container.querySelectorAll('.animate-pulse');
    expect(boxes).toHaveLength(3);
  });

  it('lays the boxes out in the PosterCard order: poster, title, subtitle', () => {
    const { container } = render(PosterCardSkeleton);

    const [poster, title, subtitle] = Array.from(container.querySelectorAll('.animate-pulse'));

    // The classes are the contract with Tailwind, and the only record in the
    // DOM of which box stands in for which part of the card.
    expect(poster).toHaveClass('aspect-2/3');
    expect(title).toHaveClass('w-4/5');
    expect(subtitle).toHaveClass('w-3/5');
  });

  it('takes an extra class so a grid can place it', () => {
    const { container } = render(PosterCardSkeleton, { props: { class: 'pml-card' } });

    expect(container.querySelector('.poster-card-skeleton')).toHaveClass('pml-card');
  });

  /**
   * A wall of eight of these must not put eight anonymous somethings into the
   * accessibility tree, or a grid that is merely loading reads as a grid of
   * unnamed items.
   */
  it('contributes nothing to the accessibility tree', () => {
    const { container } = render(PosterCardSkeleton);

    expect(screen.queryAllByRole('img')).toHaveLength(0);
    expect(screen.queryAllByRole('status')).toHaveLength(0);
    expect(container.textContent?.trim()).toBe('');
  });
});
