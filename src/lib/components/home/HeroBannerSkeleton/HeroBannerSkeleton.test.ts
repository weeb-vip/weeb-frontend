import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/svelte';
import HeroBannerSkeleton from './HeroBannerSkeleton.svelte';

/**
 * The banner placeholder takes no props and has no behaviour: it is a fixed
 * stack of grey boxes standing in for the badge, title, two description lines,
 * three meta tags and two buttons.
 *
 * There is genuinely little to assert here, and most of what one might want to
 * assert is a measurement -- "it reserves 720px so the page does not jump when
 * the banner arrives" is the whole point of the component and jsdom neither
 * lays out nor loads its stylesheet, so that belongs to the visual/e2e layer.
 * What is left, and what is real, is that it stays silent to a screen reader:
 * it must not announce a heading, a button or a link that is not there yet.
 */

describe('HeroBannerSkeleton', () => {
  it('draws the banner placeholder shape', () => {
    const { container } = render(HeroBannerSkeleton);

    expect(container.querySelector('.hero-skeleton')).toBeInTheDocument();
    // Badge dot + badge line, title, two description lines, three meta tags,
    // two buttons: the boxes the loaded banner's parts land on.
    expect(container.querySelectorAll('.skeleton-line')).toHaveLength(9);
  });

  it('announces nothing -- no headings, buttons or links stand in for the banner', () => {
    const { container } = render(HeroBannerSkeleton);

    expect(screen.queryAllByRole('heading')).toHaveLength(0);
    expect(screen.queryAllByRole('button')).toHaveLength(0);
    expect(screen.queryAllByRole('link')).toHaveLength(0);
    expect(screen.queryAllByRole('img')).toHaveLength(0);
    expect(container.textContent?.trim()).toBe('');
  });
});
