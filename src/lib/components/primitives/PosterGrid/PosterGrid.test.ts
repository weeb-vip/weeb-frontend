import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/svelte';
import { createRawSnippet } from 'svelte';
import PosterGrid from './PosterGrid.svelte';

/**
 * The poster grid, in one place. Its whole job is the column count and the two
 * layout-stability affordances, and jsdom lays nothing out -- so what is
 * asserted here is that the grid passes its children through untouched and puts
 * the reserved height and the refetch dim where the CSS expects them. Whether
 * three columns actually appear on a phone is a browser assertion and belongs
 * in the Playwright/visual layer.
 */

const cards = (html: string) => createRawSnippet(() => ({ render: () => html }));

describe('PosterGrid', () => {
  it('renders its children', () => {
    render(PosterGrid, {
      props: { children: cards('<div><a href="/show/1">Cowboy Bebop</a></div>') }
    });

    expect(screen.getByRole('link', { name: 'Cowboy Bebop' })).toBeInTheDocument();
  });

  it('renders empty without complaint', () => {
    const { container } = render(PosterGrid, {});

    const grid = container.querySelector('.poster-grid') as HTMLElement;
    expect(grid).toBeInTheDocument();
    expect(grid.children).toHaveLength(0);
  });

  it('reserves height so the layout does not jump while a page loads', () => {
    const { container } = render(PosterGrid, { props: { minHeight: '600px' } });

    expect(container.querySelector('.poster-grid')).toHaveStyle({ minHeight: '600px' });
  });

  it('reserves nothing by default', () => {
    const { container } = render(PosterGrid, {});

    expect(container.querySelector('.poster-grid')).not.toHaveAttribute('style', 'min-height');
  });

  it('dims during a refetch without collapsing -- the cards stay in the DOM', () => {
    const { container } = render(PosterGrid, {
      props: { loading: true, children: cards('<div><a href="/show/1">Cowboy Bebop</a></div>') }
    });

    expect(container.querySelector('.poster-grid')).toHaveClass('loading');
    expect(screen.getByRole('link', { name: 'Cowboy Bebop' })).toBeInTheDocument();
  });

  it('is not dimmed by default', () => {
    const { container } = render(PosterGrid, {});

    expect(container.querySelector('.poster-grid')).not.toHaveClass('loading');
  });

  it('forwards a caller class alongside its own', () => {
    const { container } = render(PosterGrid, { props: { class: 'mt-8' } });

    expect(container.querySelector('.poster-grid')).toHaveClass('poster-grid', 'mt-8');
  });
});
