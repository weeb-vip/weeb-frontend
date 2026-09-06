import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/svelte';
import userEvent from '@testing-library/user-event';
import { createRawSnippet } from 'svelte';
import { faInbox } from '@fortawesome/free-solid-svg-icons';
import EmptyState from './EmptyState.svelte';

/**
 * "There is nothing here", in one shape. The two things worth pinning are the
 * document outline -- the caller picks the heading level, because some of the
 * thirteen call sites sit under an existing h2 and some are the only thing on
 * screen -- and the single call to action, which is a link for the call sites
 * that send you somewhere and a button for the ones that undo a filter in place.
 */

const body = (html: string) => createRawSnippet(() => ({ render: () => html }));

describe('EmptyState', () => {
  it('renders its heading, message and detail', () => {
    render(EmptyState, {
      props: {
        heading: 'Nothing on your list yet',
        message: 'Shows you add will appear here.',
        detail: 'Try browsing this season.'
      }
    });

    expect(screen.getByRole('heading', { name: 'Nothing on your list yet' })).toBeInTheDocument();
    expect(screen.getByText('Shows you add will appear here.')).toBeInTheDocument();
    expect(screen.getByText('Try browsing this season.')).toBeInTheDocument();
  });

  it('defaults the heading to h3', () => {
    render(EmptyState, { props: { heading: 'Nothing here' } });

    expect(screen.getByRole('heading', { level: 3, name: 'Nothing here' })).toBeInTheDocument();
  });

  it('takes the level the caller needs to keep the outline honest', () => {
    render(EmptyState, { props: { heading: 'Nothing here', headingTag: 'h2' } });

    expect(screen.getByRole('heading', { level: 2, name: 'Nothing here' })).toBeInTheDocument();
  });

  it('can drop out of the outline entirely, for a state under an existing heading', () => {
    render(EmptyState, { props: { heading: 'Nothing here', headingTag: 'p' } });

    expect(screen.queryByRole('heading')).not.toBeInTheDocument();
    expect(screen.getByText('Nothing here')).toBeInTheDocument();
  });

  it('omits every part it was given nothing for', () => {
    const { container } = render(EmptyState, { props: { message: 'Nothing to show.' } });

    expect(screen.queryByRole('heading')).not.toBeInTheDocument();
    expect(container.querySelector('.es-detail')).toBeNull();
    expect(container.querySelector('.es-icon')).toBeNull();
    expect(container.querySelector('.es-action')).toBeNull();
  });

  describe('the icon', () => {
    it('is decorative -- the heading does the naming', () => {
      const { container } = render(EmptyState, {
        props: { icon: faInbox, heading: 'Nothing here' }
      });

      expect(container.querySelector('.es-icon')).toHaveAttribute('aria-hidden', 'true');
    });

    it('accepts a snippet, for the inline SVGs the pages already use', () => {
      const { container } = render(EmptyState, {
        props: { icon: body('<svg data-glyph="custom"></svg>'), heading: 'Nothing here' }
      });

      expect(container.querySelector('[data-glyph="custom"]')).toBeInTheDocument();
    });

    it('takes the 64px disc frame when asked', () => {
      const { container } = render(EmptyState, {
        props: { icon: faInbox, iconFrame: 'circle', heading: 'Nothing here' }
      });

      expect(container.querySelector('.es-icon')).toHaveClass('es-icon--circle');
    });
  });

  describe('the one call to action', () => {
    it('is a link when it sends you somewhere', () => {
      render(EmptyState, {
        props: { heading: 'Nothing here', action: { label: 'Explore Anime', href: '/season' } }
      });

      expect(screen.getByRole('link', { name: 'Explore Anime' })).toHaveAttribute('href', '/season');
    });

    it('is a button when it undoes a filter in place, and calls back', async () => {
      const onClick = vi.fn();
      render(EmptyState, {
        props: { heading: 'No matches', action: { label: 'Clear filters', onClick } }
      });

      await userEvent.click(screen.getByRole('button', { name: 'Clear filters' }));
      expect(onClick).toHaveBeenCalledTimes(1);
    });

    it('is the shared Button at sm, not a fourth hand-rolled copy', () => {
      render(EmptyState, {
        props: { heading: 'No matches', action: { label: 'Clear filters', onClick: () => {} } }
      });

      expect(screen.getByRole('button', { name: 'Clear filters' })).toHaveClass('btn', 'btn--sm');
    });

    it('the ghost variant is the outlined one', () => {
      render(EmptyState, {
        props: {
          heading: 'No matches',
          action: { label: 'Clear filters', onClick: () => {}, variant: 'ghost' }
        }
      });

      expect(screen.getByRole('button', { name: 'Clear filters' })).toHaveClass('btn-ghost');
    });
  });

  it('renders richer body content as children', () => {
    render(EmptyState, {
      props: {
        heading: 'Nothing here',
        children: body('<p>Try <a href="/search">searching</a> instead.</p>')
      }
    });

    expect(screen.getByRole('link', { name: 'searching' })).toBeInTheDocument();
  });

  it('carries the variant and size classes the CSS keys on', () => {
    const { container } = render(EmptyState, {
      props: { heading: 'Nothing here', variant: 'panel', size: 'hero' }
    });

    expect(container.querySelector('.es')).toHaveClass('es--panel', 'es--hero');
  });
});
