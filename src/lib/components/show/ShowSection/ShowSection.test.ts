import { describe, it, expect } from 'vitest';
import { render, screen, within } from '@testing-library/svelte';
import { createRawSnippet } from 'svelte';
import ShowSection from './ShowSection.svelte';
import { sectionElementId, SYNOPSIS } from '$lib/components/show/ShowContent.rules';

/**
 * The block six sections of the show page used to spell out by hand: a ruled
 * heading, the `aria-labelledby` wiring, and a DOM id the scroll spy and the
 * section links both address.
 *
 * The id is the contract -- `activeSection` looks the element up by it and the
 * nav scrolls to it -- so it is asserted as an attribute rather than through a
 * class.
 */
const body = (text: string) =>
  createRawSnippet(() => ({ render: () => `<p>${text}</p>` }));

describe('ShowSection', () => {
  it('is a region named by its own heading', () => {
    render(ShowSection, {
      props: { id: 'show-section-synopsis', heading: 'Synopsis', children: body('Content') }
    });

    // `aria-labelledby` on a <section> is what promotes it to a named region,
    // which is how a screen reader user lands on it from the landmark list.
    const region = screen.getByRole('region', { name: 'Synopsis' });
    expect(region).toHaveAttribute('id', 'show-section-synopsis');
    expect(region).toHaveAttribute('aria-labelledby', 'show-section-synopsis-heading');
  });

  it('renders the heading as a real h2, not styled text', () => {
    render(ShowSection, {
      props: { id: 'show-section-episodes', heading: 'Episodes', children: body('Rows') }
    });

    const heading = screen.getByRole('heading', { level: 2, name: 'Episodes' });
    expect(heading).toHaveAttribute('id', 'show-section-episodes-heading');
  });

  it('renders its children inside the section', () => {
    render(ShowSection, {
      props: { id: 'show-section-news', heading: 'News', children: body('Three stories') }
    });

    const region = screen.getByRole('region', { name: 'News' });
    expect(within(region).getByText('Three stories')).toBeInTheDocument();
  });

  it('takes the id the page computes, so the spy and the nav address the same node', () => {
    render(ShowSection, {
      props: { id: sectionElementId(SYNOPSIS), heading: 'Synopsis', children: body('x') }
    });

    expect(document.getElementById('show-section-synopsis')).toBeInTheDocument();
  });

  it('draws the trailing rule as decoration, hidden from assistive tech', () => {
    const { container } = render(ShowSection, {
      props: { id: 'show-section-characters', heading: 'Characters', children: body('x') }
    });

    // `.rule` is genuinely the contract here: it is a presentational hairline
    // SectionHeader draws only when `rule` is set, and the point of asserting
    // it is that it is `aria-hidden`. Its *appearance* needs a browser.
    const rule = container.querySelector('.rule');
    expect(rule).toBeInTheDocument();
    expect(rule).toHaveAttribute('aria-hidden', 'true');
  });

  it('does not break on a heading long enough to wrap', () => {
    const heading = 'Characters, voice actors and the production staff behind them';
    render(ShowSection, {
      props: { id: 'show-section-characters', heading, children: body('x') }
    });

    expect(screen.getByRole('region', { name: heading })).toBeInTheDocument();
  });
});
