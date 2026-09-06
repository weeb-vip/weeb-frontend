import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/svelte';
import StatusMarker from './StatusMarker.svelte';

/**
 * "This is on your list", as a wordless corner ribbon. Wordless means the
 * accessible name is the ONLY thing carrying the fact, so it is what this
 * suite is mostly about -- plus the rule that an unrecognised status draws
 * nothing rather than an unlabelled blob over the artwork.
 *
 * The colour comes from the shared STATUS_COLORS map. jsdom resolves no
 * tokens, so what is asserted is that the ribbon reads the shared map at all
 * (via `--marker-color`), never what green looks like.
 */

const markerOf = (container: HTMLElement) =>
  container.querySelector('.status-marker') as HTMLElement;

describe('StatusMarker', () => {
  it('names the status for a reader, since the ribbon carries no words', () => {
    render(StatusMarker, { props: { status: 'WATCHING' } });

    expect(screen.getByRole('img', { name: 'On your list: Watching' })).toBeInTheDocument();
  });

  it('uses the shared labels, so the ribbon and the profile row cannot disagree', () => {
    render(StatusMarker, { props: { status: 'PLANTOWATCH' } });

    expect(screen.getByRole('img', { name: 'On your list: Plan to Watch' })).toBeInTheDocument();
  });

  it('accepts the legacy snake_case spellings the API still sends', () => {
    render(StatusMarker, { props: { status: 'plan_to_watch' } });

    expect(screen.getByRole('img', { name: 'On your list: Plan to Watch' })).toBeInTheDocument();
  });

  it('renders nothing for a status it does not recognise', () => {
    const { container } = render(StatusMarker, { props: { status: 'REWATCHING' } });

    expect(markerOf(container)).toBeNull();
    expect(screen.queryByRole('img')).not.toBeInTheDocument();
  });

  it('renders nothing when the show is not on the list at all', () => {
    const { container } = render(StatusMarker, { props: { status: null } });

    expect(markerOf(container)).toBeNull();
  });

  it('takes its colour from the shared status map', () => {
    const { container } = render(StatusMarker, { props: { status: 'DROPPED' } });

    expect(markerOf(container).getAttribute('style')).toContain(
      '--marker-color: var(--weeb-red)'
    );
  });

  it('the glyph is decorative -- the label is the content', () => {
    const { container } = render(StatusMarker, { props: { status: 'COMPLETED' } });

    expect(markerOf(container).querySelector('svg')).toHaveAttribute('aria-hidden', 'true');
  });

  it('draws a different glyph per status', () => {
    const glyphs = new Set<string>();

    for (const status of ['WATCHING', 'COMPLETED', 'DROPPED', 'ONHOLD', 'PLANTOWATCH']) {
      const { container, unmount } = render(StatusMarker, { props: { status } });
      glyphs.add(markerOf(container).querySelector('svg')?.innerHTML ?? '');
      unmount();
    }

    expect(glyphs.size).toBe(5);
  });
});
