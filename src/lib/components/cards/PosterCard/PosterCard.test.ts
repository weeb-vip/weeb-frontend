import { describe, it, expect, vi } from 'vitest';
import { render, screen, within, fireEvent, waitFor } from '@testing-library/svelte';
import userEvent from '@testing-library/user-event';
import PosterCard from './PosterCard.svelte';
import { noCardTracking } from '$lib/components/cards/Card.bloc.svelte';


const base = {
  id: 'abc123',
  title: 'Cowboy Bebop',
  image: 'abc123',
  track: noCardTracking
};

describe('PosterCard', () => {
  describe('the link', () => {
    it('links to the slug when it has one', () => {
      render(PosterCard, { props: { ...base, slug: 'cowboy-bebop' } });

      expect(screen.getByRole('link')).toHaveAttribute('href', '/anime/cowboy-bebop');
    });

    it('falls back to the id, which permanently redirects once a slug lands', () => {
      render(PosterCard, { props: base });

      expect(screen.getByRole('link')).toHaveAttribute('href', '/anime/abc123');
    });

    it('an explicit href wins over both', () => {
      render(PosterCard, { props: { ...base, slug: 'cowboy-bebop', href: '/season/1998/spring' } });

      expect(screen.getByRole('link')).toHaveAttribute('href', '/season/1998/spring');
    });

    it('reports the open through the injected tracking port', async () => {
      const track = vi.fn();
      render(PosterCard, { props: { ...base, track } });

      await userEvent.click(screen.getByRole('link'));

      expect(track).toHaveBeenCalledWith('abc123', 'Cowboy Bebop');
    });
  });

  describe('the title block', () => {
    it('draws the title it was handed, already resolved for the language preference', () => {
      const { container } = render(PosterCard, { props: { ...base, title: 'カウボーイビバップ' } });

      expect(container.querySelector('.poster-title')).toHaveTextContent('カウボーイビバップ');
    });

    it('draws the sub-line when there is one', () => {
      const { container } = render(PosterCard, { props: { ...base, sub: 'Ep 12 · Fri' } });

      expect(container.querySelector('.poster-sub')).toHaveTextContent('Ep 12 · Fri');
    });

    it('omits the sub-line when there is not', () => {
      const { container } = render(PosterCard, { props: base });

      expect(container.querySelector('.poster-sub')).toBeNull();
    });

    it('renders whatever the call site slots underneath', () => {
      render(PosterCard, { props: { ...base, sub: 'Ep 12' } });

      // The children snippet is the caller's; the card only has to leave room.
      expect(screen.getByRole('link')).toHaveTextContent('Ep 12');
    });
  });

  describe('the corners', () => {
    it('shows the score badge when there is a score', () => {
      const { container } = render(PosterCard, { props: { ...base, score: 8.4 } });

      const badge = container.querySelector('.score-mark') as HTMLElement;
      expect(badge).toBeInTheDocument();
      expect(within(badge).getByText('8.4')).toBeInTheDocument();
      expect(badge.querySelector('.score--badge')).toBeInTheDocument();
    });

    it('draws no score badge without one', () => {
      const { container } = render(PosterCard, { props: base });

      expect(container.querySelector('.score-mark')).toBeNull();
    });

    /**
     * The corner opposite the score says ONE thing at a time. A card that is on
     * the viewer's list AND currently airing draws the list status only.
     */
    it('prefers the viewer’s list status over the airing state', () => {
      const { container } = render(PosterCard, {
        props: { ...base, onList: 'WATCHING', status: 'CURRENTLY_AIRING' }
      });

      expect(container.querySelector('.list-mark')).toBeInTheDocument();
      expect(container.querySelector('.airing-mark')).toBeNull();
      expect(screen.getByRole('img', { name: 'On your list: Watching' })).toBeInTheDocument();
    });

    it('falls back to the airing state when the show is not on the list', () => {
      const { container } = render(PosterCard, {
        props: { ...base, status: 'CURRENTLY_AIRING' }
      });

      expect(container.querySelector('.list-mark')).toBeNull();
      expect(container.querySelector('.airing-mark')).toBeInTheDocument();
      expect(screen.getByRole('img', { name: 'Airing' })).toBeInTheDocument();
    });

    it('accepts the homepage’s lower-case shorthand as well as the GraphQL enum', () => {
      render(PosterCard, { props: { ...base, status: 'upcoming' } });

      expect(screen.getByRole('img', { name: 'Upcoming' })).toBeInTheDocument();
    });

    it('draws neither corner for a finished show that is not on the list', () => {
      const { container } = render(PosterCard, {
        props: { ...base, status: 'FINISHED_AIRING' }
      });

      expect(container.querySelector('.list-mark')).toBeNull();
      expect(container.querySelector('.airing-mark')).toBeNull();
    });
  });

  describe('the hover overlay', () => {
    it('is hidden from the reader -- it repeats what the card already says', () => {
      const { container } = render(PosterCard, {
        props: { ...base, description: 'A bounty hunter crew.' }
      });

      expect(container.querySelector('.hover-overlay')).toHaveAttribute('aria-hidden', 'true');
    });

    it('strips markup out of the description and truncates it', () => {
      const description = `<p>${'a'.repeat(200)}</p>`;
      const { container } = render(PosterCard, { props: { ...base, description } });

      const text = container.querySelector('.hover-desc')?.textContent ?? '';
      expect(text).not.toContain('<p>');
      expect(text).toBe(`${'a'.repeat(120)}...`);
    });

    it('shows at most three genres, as chips', () => {
      const { container } = render(PosterCard, {
        props: { ...base, genres: ['Action', 'Drama', 'Sci-Fi', 'Space', 'Comedy'] }
      });

      const chips = container.querySelectorAll('.hover-genres .chip');
      expect(chips).toHaveLength(3);
      expect(chips[0]).toHaveTextContent('Action');
      expect(chips[2]).toHaveTextContent('Sci-Fi');
    });

    it('shows the episode count when there is one', () => {
      const { container } = render(PosterCard, { props: { ...base, episodeCount: 26 } });

      expect(container.querySelector('.hover-meta')).toHaveTextContent('26 episodes');
    });

    it('does not repeat the score inside the overlay -- it is already in the corner', () => {
      const { container } = render(PosterCard, { props: { ...base, score: 8.4 } });

      expect(container.querySelector('.hover-overlay')?.textContent).not.toContain('8.4');
    });
  });

  describe('the poster', () => {
    it('names the image with the title', () => {
      render(PosterCard, { props: base });

      expect(screen.getByRole('img', { name: 'Cowboy Bebop' })).toHaveAttribute('loading', 'lazy');
    });

    it('lands on a titled placeholder, still named by the title, when every candidate fails', async () => {
      render(PosterCard, { props: base });

      // The card passes `alt={title}`, so the panel is named by the title rather
      // than by SafeImage's "<title> — no artwork available" fallback wording.
      const poster = () => document.querySelector('.poster img') as HTMLImageElement;
      await fireEvent.error(poster());
      await waitFor(() => expect(poster()).not.toBeNull());
      if (poster()) await fireEvent.error(poster());

      const panel = await screen.findByRole('img', { name: 'Cowboy Bebop' });
      expect(panel).toHaveClass('art-placeholder');
      expect(panel).toHaveTextContent('Cowboy Bebop');
    });
  });
});
