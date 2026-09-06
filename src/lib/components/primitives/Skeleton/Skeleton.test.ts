import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/svelte';
import Skeleton from './Skeleton.svelte';

/**
 * One placeholder box, one pulse. It is decorative by construction -- an empty
 * div with no text and no role -- which is the property worth keeping: a shelf
 * of sixty loading cards must not announce sixty things.
 */

const boxOf = (container: HTMLElement) => container.firstElementChild as HTMLElement;

describe('Skeleton', () => {
  it('renders one pulsing box on the surface colour', () => {
    const { container } = render(Skeleton, {});

    expect(boxOf(container)).toHaveClass('animate-pulse', 'bg-weeb-surface');
  });

  it('has no text and no role of its own', () => {
    const { container } = render(Skeleton, {});

    const box = boxOf(container);
    expect(box.textContent).toBe('');
    expect(box).not.toHaveAttribute('role');
    expect(box).not.toHaveAttribute('aria-live');
  });

  it('keeps Tailwind’s default radius so a caller-supplied rounded-* still wins', () => {
    const { container } = render(Skeleton, { props: { className: 'rounded-full w-8 h-8' } });

    const box = boxOf(container);
    expect(box).toHaveClass('rounded', 'rounded-full', 'w-8', 'h-8');
    // No inline radius, which would out-specify the caller's class.
    expect(box.style.borderRadius).toBe('');
  });

  it('a design-system radius is applied inline, and replaces the default class', () => {
    const { container } = render(Skeleton, { props: { radius: 'lg' } });

    const box = boxOf(container);
    expect(box).not.toHaveClass('rounded');
    expect(box.getAttribute('style')).toContain('border-radius: var(--weeb-radius-lg)');
  });

  it('maps every named radius to its token', () => {
    const tokens = {
      sm: 'var(--weeb-radius-sm)',
      md: 'var(--weeb-radius)',
      lg: 'var(--weeb-radius-lg)',
      full: 'var(--weeb-radius-full)'
    } as const;

    for (const [radius, token] of Object.entries(tokens)) {
      const { container, unmount } = render(Skeleton, {
        props: { radius: radius as keyof typeof tokens }
      });
      expect(boxOf(container).getAttribute('style')).toContain(`border-radius: ${token}`);
      unmount();
    }
  });
});
