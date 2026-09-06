import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/svelte';
import { createRawSnippet } from 'svelte';
import ShowHero from './ShowHero.svelte';
import { stubNeverLoadingImages } from '$lib/components/__tests__/jsdom-gaps';

/**
 * The show page's key-art stage: full-bleed artwork, scrims, the identity panel
 * on panel glass, and the schedule panel slotted beside it.
 *
 * ShowHero itself is a shell -- the panel's own contents are
 * `ShowIdentityPanel`'s and are covered there. What is asserted here is the
 * shell: the landmark, that the aside is optional, that the artwork layer is
 * absent rather than empty when there is none, and the load-fade wiring.
 */

let restoreImages: () => void;
beforeEach(() => {
  restoreImages = stubNeverLoadingImages();
});
afterEach(() => restoreImages());

const anime = { id: 'a1', type: 'TV', startDate: '1998-04-03T00:00:00Z' };

const base = {
  anime,
  title: 'Cowboy Bebop',
  onArtChosen: () => {}
};

const aside = (text: string) =>
  createRawSnippet(() => ({ render: () => `<aside aria-label="Broadcast schedule">${text}</aside>` }));

describe('ShowHero', () => {
  describe('the stage', () => {
    it('is a region named "Anime overview"', () => {
      render(ShowHero, { props: base });

      expect(screen.getByRole('region', { name: 'Anime overview' })).toBeInTheDocument();
    });

    it('stands the identity panel on the stage', () => {
      render(ShowHero, { props: { ...base, studio: 'Sunrise', seasonText: 'Season 1' } });

      const stage = screen.getByRole('region', { name: 'Anime overview' });
      expect(within(stage).getByRole('heading', { level: 1, name: 'Cowboy Bebop' })).toBeInTheDocument();
      expect(within(stage).getByText('Sunrise')).toBeInTheDocument();
    });

    it('passes the season link straight through to the panel', () => {
      render(ShowHero, {
        props: { ...base, seasonText: 'Season 2', seriesLink: '/series/76885-bebop' }
      });

      expect(screen.getByRole('link', { name: 'Season 2' })).toHaveAttribute(
        'href',
        '/series/76885-bebop'
      );
    });
  });

  describe('the schedule aside', () => {
    it('renders the panel beside the identity panel when there is a schedule', () => {
      render(ShowHero, { props: { ...base, aside: aside('Next episode 3h') } });

      expect(
        screen.getByRole('complementary', { name: 'Broadcast schedule' })
      ).toHaveTextContent('Next episode 3h');
    });

    it('leaves the stage to the identity panel alone when there is none', () => {
      render(ShowHero, { props: base });

      expect(screen.queryByRole('complementary')).not.toBeInTheDocument();
    });
  });

  describe('the artwork', () => {
    it('draws no artwork layer at all for a show with no candidates', () => {
      const { container } = render(ShowHero, { props: { ...base, imageSources: [] } });

      // Absent rather than an empty box: an empty SafeImage would draw its own
      // placeholder across the whole stage.
      expect(container.querySelector('.hero-banner__bg')).toBeNull();
    });

    it('draws the layer, held at opacity 0, until something has painted', () => {
      const { container } = render(ShowHero, {
        props: { ...base, imageSources: ['/banners/a1', '/a1'], loaded: false }
      });

      // The inline opacity is the contract: the fade is driven by the page's
      // `loaded` flag, and CSS transitions it. Whether it *looks* faded needs
      // a browser.
      expect(container.querySelector('.hero-banner__bg')).toHaveAttribute(
        'style',
        'opacity: 0;'
      );
    });

    it('reveals the layer once the page says something has painted', () => {
      const { container } = render(ShowHero, {
        props: { ...base, imageSources: ['/banners/a1'], loaded: true }
      });

      expect(container.querySelector('.hero-banner__bg')).toHaveAttribute('style', 'opacity: 1;');
    });

    it('tells the page a candidate has been settled on, so the fade can start', async () => {
      const onArtChosen = vi.fn();
      render(ShowHero, {
        props: { ...base, imageSources: ['/banners/a1', '/a1'], onArtChosen }
      });

      // With every probe failing, SafeImage settles on the fallback -- which is
      // still a settled decision, and the page must be told or the artwork
      // stays at opacity 0 forever. (That was the bug KeyArtStage dropped the
      // gate over; here the gate is still the page's.)
      await waitFor(() => expect(onArtChosen).toHaveBeenCalled());
    });

    it('does not announce the artwork -- the h1 already names the show', () => {
      render(ShowHero, { props: { ...base, imageSources: ['/banners/a1'] } });

      expect(screen.queryAllByRole('img')).toHaveLength(0);
    });
  });

  describe('the scrims', () => {
    it('draws the top and bottom scrims, both empty', () => {
      const { container } = render(ShowHero, { props: base });

      // Pure gradient overlays. jsdom applies no CSS, so the only honest check
      // is that they exist and carry nothing; "does the nav stay legible over
      // the art" is a visual-diff question.
      expect(container.querySelector('.hero-scrim-top')?.textContent).toBe('');
      expect(container.querySelector('.hero-scrim-bottom')?.textContent).toBe('');
    });
  });
});
