import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/svelte';
import { createRawSnippet } from 'svelte';
import SectionHeader from './SectionHeader.svelte';

/**
 * Three scales of the same heading. The scale is a class the CSS keys on; the
 * LEVEL is the document outline, and those are deliberately separate props --
 * an eyebrow over a group inside a section must not become a second h2 just
 * because it is small.
 */

const trailing = (html: string) => createRawSnippet(() => ({ render: () => html }));

describe('SectionHeader', () => {
  it('renders the title as an h2 by default', () => {
    render(SectionHeader, { props: { title: 'Currently airing' } });

    expect(screen.getByRole('heading', { level: 2, name: 'Currently airing' })).toBeInTheDocument();
  });

  it('takes the level the page outline needs', () => {
    render(SectionHeader, { props: { title: 'Related', as: 'h3' } });

    expect(screen.getByRole('heading', { level: 3, name: 'Related' })).toBeInTheDocument();
  });

  it('keeps the level independent of the visual scale', () => {
    render(SectionHeader, { props: { title: 'Sequels', size: 'eyebrow', as: 'h3' } });

    const heading = screen.getByRole('heading', { level: 3, name: 'Sequels' });
    expect(heading).toBeInTheDocument();
    expect(heading.closest('.section-header')).toHaveClass('section-header--eyebrow');
  });

  it('takes an id, so something can point an aria-labelledby at it', () => {
    render(SectionHeader, { props: { title: 'Episodes', id: 'episodes-heading' } });

    expect(screen.getByRole('heading', { name: 'Episodes' })).toHaveAttribute(
      'id',
      'episodes-heading'
    );
  });

  describe('the trailing link', () => {
    it('is drawn when both an href and a link text are given', () => {
      render(SectionHeader, {
        props: { title: 'Currently airing', href: '/airing', linkText: 'See all' }
      });

      expect(screen.getByRole('link', { name: 'See all' })).toHaveAttribute('href', '/airing');
    });

    it('is not drawn with only half of the pair', () => {
      render(SectionHeader, { props: { title: 'Currently airing', href: '/airing' } });

      expect(screen.queryByRole('link')).not.toBeInTheDocument();
    });
  });

  describe('the rule', () => {
    it('is off by default', () => {
      const { container } = render(SectionHeader, { props: { title: 'Currently airing' } });

      expect(container.querySelector('.rule')).toBeNull();
      expect(container.querySelector('.section-header')).not.toHaveClass('has-rule');
    });

    it('is a decorative hairline, hidden from the reader', () => {
      const { container } = render(SectionHeader, {
        props: { title: 'Currently airing', rule: true }
      });

      expect(container.querySelector('.section-header')).toHaveClass('has-rule');
      expect(container.querySelector('.rule')).toHaveAttribute('aria-hidden', 'true');
    });
  });

  it('renders trailing content after the title', () => {
    render(SectionHeader, {
      props: { title: 'Episodes', children: trailing('<button type="button">Sort</button>') }
    });

    expect(screen.getByRole('button', { name: 'Sort' })).toBeInTheDocument();
  });
});
