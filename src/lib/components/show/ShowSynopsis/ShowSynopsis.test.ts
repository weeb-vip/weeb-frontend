import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/svelte';
import ShowSynopsis from './ShowSynopsis.svelte';

/**
 * The whole component is one branch: there is a synopsis, or there is not.
 * What matters is that the "not" case is the shared `EmptyState` surface rather
 * than a heading standing over nothing -- and that the empty heading is a `p`,
 * because the section's own `h2` is directly above it.
 */
describe('ShowSynopsis', () => {
  it('renders the synopsis as a paragraph', () => {
    render(ShowSynopsis, {
      props: { description: 'Spike Spiegel is a bounty hunter travelling on the Bebop.' }
    });

    expect(
      screen.getByText('Spike Spiegel is a bounty hunter travelling on the Bebop.')
    ).toBeInTheDocument();
    expect(screen.queryByText('No synopsis yet')).not.toBeInTheDocument();
  });

  it('preserves a long synopsis in full -- the measure is CSS, not a truncation', () => {
    // 80ch is a `max-width`, so nothing is dropped from the DOM. jsdom does no
    // layout, so "does it wrap at 80ch" is a Playwright question; what is
    // assertable here is that the component does not itself cut the string.
    const long = 'A sentence about the show. '.repeat(200);
    const { container } = render(ShowSynopsis, { props: { description: long } });

    expect(container.querySelector('.synopsis-text p')?.textContent).toBe(long);
  });

  describe('when there is no synopsis', () => {
    /**
     * A gap in the catalogue is not a failure, so it says so plainly. The
     * heading is a `p`: ShowSection already emitted the `h2` above it, and an
     * `h3` here would claim a subsection that does not exist.
     */
    it.each([
      ['undefined', undefined],
      ['null', null],
      ['an empty string', ''],
    ])('says so via EmptyState when the description is %s', (_label, description) => {
      render(ShowSynopsis, { props: { description } });

      const heading = screen.getByText('No synopsis yet');
      expect(heading.tagName).toBe('P');
      expect(
        screen.getByText('Nobody has written one for this show in the sources we read.')
      ).toBeInTheDocument();
      expect(screen.queryByRole('heading')).not.toBeInTheDocument();
    });

    it('draws no prose block at all', () => {
      const { container } = render(ShowSynopsis, { props: { description: null } });

      expect(container.querySelector('.synopsis-text')).toBeNull();
    });
  });
});
