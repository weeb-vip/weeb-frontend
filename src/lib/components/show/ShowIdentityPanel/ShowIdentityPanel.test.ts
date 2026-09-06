import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { render, screen, within } from '@testing-library/svelte';
import ShowIdentityPanel from './ShowIdentityPanel.svelte';
import { stubNeverLoadingImages } from '$lib/components/__tests__/jsdom-gaps';

/**
 * Who this show is: the cover, the name, and the qualifiers that place it.
 *
 * Presentational -- every string is resolved by the page -- so the assertions
 * are about the outline (exactly one h1), the qualifier line's behaviour when a
 * qualifier is missing, and the two links that are the only ways out of the
 * panel. Its layout (poster beside the name, the body band centred under both)
 * is CSS and invisible to jsdom.
 */

let restoreImages: () => void;
beforeEach(() => {
  restoreImages = stubNeverLoadingImages();
});
afterEach(() => restoreImages());

const anime = (over: Record<string, unknown> = {}) => ({
  id: 'a1',
  type: 'TV',
  startDate: '1998-04-03T00:00:00Z',
  ...over
});

describe('ShowIdentityPanel', () => {
  describe('the name', () => {
    it('renders the title as the page\'s one h1', () => {
      render(ShowIdentityPanel, { props: { anime: anime(), title: 'Cowboy Bebop' } });

      expect(screen.getByRole('heading', { level: 1, name: 'Cowboy Bebop' })).toBeInTheDocument();
      // The sticky header repeats the title as chrome and must NOT be a second
      // h1; this is the only one on the page.
      expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1);
    });

    it('marks the Japanese title `lang="ja"` inside an English document', () => {
      render(ShowIdentityPanel, {
        props: { anime: anime({ titleJp: 'カウボーイビバップ' }), title: 'Cowboy Bebop' }
      });

      expect(screen.getByText('カウボーイビバップ')).toHaveAttribute('lang', 'ja');
    });

    it('omits the Japanese line for a record that has none', () => {
      const { container } = render(ShowIdentityPanel, {
        props: { anime: anime(), title: 'Cowboy Bebop' }
      });

      expect(container.querySelector('.hero-title-jp')).toBeNull();
    });

    it('keeps a long title in full -- the panel shrinks, the name does not', () => {
      const title =
        'That Time I Got Reincarnated as a Slime and Everyone Around Me Had Opinions About It';
      render(ShowIdentityPanel, { props: { anime: anime(), title } });

      expect(screen.getByRole('heading', { level: 1, name: title })).toBeInTheDocument();
    });
  });

  describe('the season label', () => {
    it('is a link into the series page when the series has one', () => {
      render(ShowIdentityPanel, {
        props: {
          anime: anime(),
          title: 'Cowboy Bebop',
          seasonText: 'Season 2',
          seriesLink: '/series/76885-cowboy-bebop'
        }
      });

      const link = screen.getByRole('link', { name: 'Season 2' });
      expect(link).toHaveAttribute('href', '/series/76885-cowboy-bebop');
      // It is already accent-coloured, which is exactly why colour cannot be
      // the signal -- the underline class is what tells it apart from the
      // static label. Whether it is visibly underlined needs a browser.
      expect(link).toHaveClass('hero-season-link');
    });

    it('is inert text when the series has no page to point at', () => {
      const { container } = render(ShowIdentityPanel, {
        props: { anime: anime(), title: 'Cowboy Bebop', seasonText: 'Special' }
      });

      const label = container.querySelector('.hero-season') as HTMLElement;
      expect(label.tagName).toBe('P');
      expect(label).toHaveTextContent('Special');
      expect(screen.queryByRole('link', { name: 'Special' })).not.toBeInTheDocument();
    });

    it('renders as nothing at all for the unknown season most of the catalogue has', () => {
      const { container } = render(ShowIdentityPanel, {
        props: { anime: anime(), title: 'Cowboy Bebop' }
      });

      // The derivation refuses rather than guesses, so an unknown season is
      // absent -- not "Season ?" and not an empty line.
      expect(container.querySelector('.hero-season')).toBeNull();
    });
  });

  describe('the qualifier line', () => {
    it('names the format, the year and the studio', () => {
      const { container } = render(ShowIdentityPanel, {
        props: { anime: anime(), title: 'Cowboy Bebop', studio: 'Sunrise' }
      });

      const items = [...container.querySelectorAll('.hero-meta-item')].map((el) => el.textContent);
      expect(items).toEqual(['TV Series', '1998', 'Sunrise']);
    });

    it('assumes a TV series for a record with no type recorded', () => {
      render(ShowIdentityPanel, {
        props: { anime: anime({ type: null }), title: 'Cowboy Bebop' }
      });

      expect(screen.getByText('TV Series')).toBeInTheDocument();
    });

    it('reads "TBA" rather than an empty gap for a show with no start date', () => {
      render(ShowIdentityPanel, {
        props: { anime: anime({ startDate: null }), title: 'Cowboy Bebop' }
      });

      expect(screen.getByText('TBA')).toBeInTheDocument();
    });

    /**
     * The separators are drawn by CSS between adjacent items
     * (`.hero-meta-item + .hero-meta-item::before`), so an absent studio cannot
     * strand a dot. What jsdom can check is the half that makes that work: one
     * element per qualifier, and the missing one simply not emitted. The dots
     * themselves are generated content and are invisible here.
     */
    it('drops the studio element entirely rather than leaving a blank qualifier', () => {
      const { container } = render(ShowIdentityPanel, {
        props: { anime: anime(), title: 'Cowboy Bebop', studio: null }
      });

      expect(container.querySelectorAll('.hero-meta-item')).toHaveLength(2);
      expect(container.querySelector('.hero-meta')?.textContent).not.toContain('·');
    });
  });

  describe('what it adapts', () => {
    it('links to the source work, which is the only way into a work page', () => {
      render(ShowIdentityPanel, {
        props: {
          anime: anime({ sourceWork: { urlSlug: 'berserk', titleEn: 'Berserk' } }),
          title: 'Berserk'
        }
      });

      expect(screen.getByText('Adapted from')).toBeInTheDocument();
      expect(screen.getByRole('link', { name: 'Berserk' })).toHaveAttribute(
        'href',
        '/manga/berserk'
      );
    });

    it('falls back to the Japanese title of the work', () => {
      render(ShowIdentityPanel, {
        props: {
          anime: anime({ sourceWork: { urlSlug: 'sao', titleJp: 'ソードアート・オンライン' } }),
          title: 'SAO'
        }
      });

      expect(screen.getByRole('link', { name: 'ソードアート・オンライン' })).toBeInTheDocument();
    });

    it('says nothing when the work is not yet known', () => {
      render(ShowIdentityPanel, { props: { anime: anime(), title: 'Cowboy Bebop' } });

      expect(screen.queryByText('Adapted from')).not.toBeInTheDocument();
    });

    it('says nothing for a work record with no page of its own yet', () => {
      render(ShowIdentityPanel, {
        props: { anime: anime({ sourceWork: { titleEn: 'Berserk' } }), title: 'Berserk' }
      });

      expect(screen.queryByText('Adapted from')).not.toBeInTheDocument();
    });
  });

  describe('the genres', () => {
    it('is a named list, so a screen reader hears how many there are', () => {
      render(ShowIdentityPanel, {
        props: { anime: anime({ tags: ['Action', 'Sci-Fi', 'Space'] }), title: 'Cowboy Bebop' }
      });

      const list = screen.getByRole('list', { name: 'Genres' });
      expect(within(list).getAllByRole('listitem').map((li) => li.textContent)).toEqual([
        'Action',
        'Sci-Fi',
        'Space'
      ]);
    });

    it.each([
      ['no tags field', undefined],
      ['an empty tag list', []]
    ])('draws no genre list for %s', (_label, tags) => {
      render(ShowIdentityPanel, { props: { anime: anime({ tags }), title: 'Cowboy Bebop' } });

      expect(screen.queryByRole('list', { name: 'Genres' })).not.toBeInTheDocument();
    });

    it('renders every genre of a heavily-tagged show', () => {
      const tags = Array.from({ length: 24 }, (_, i) => `Genre ${i}`);
      render(ShowIdentityPanel, { props: { anime: anime({ tags }), title: 'Cowboy Bebop' } });

      expect(within(screen.getByRole('list', { name: 'Genres' })).getAllByRole('listitem'))
        .toHaveLength(24);
    });
  });

  describe('the poster and the action', () => {
    it('renders the cover as decoration -- the h1 already names the show', () => {
      const { container } = render(ShowIdentityPanel, {
        props: { anime: anime(), title: 'Cowboy Bebop' }
      });

      expect(container.querySelector('.hero-poster')).toBeInTheDocument();
      // Nothing in the panel is announced as an image: the poster's alt is
      // empty on purpose. Whether the artwork paints is a network fact.
      expect(screen.queryAllByRole('img')).toHaveLength(0);
    });

    it('offers the one add-to-list action for a show not on the viewer\'s list', () => {
      render(ShowIdentityPanel, { props: { anime: anime(), title: 'Cowboy Bebop' } });

      expect(screen.getByRole('button', { name: /Add to List/ })).toBeInTheDocument();
    });

    it('swaps to the status control once the show is on the list', () => {
      const { container } = render(ShowIdentityPanel, {
        props: {
          anime: anime({ userAnime: { id: 'u1', status: 'WATCHING' } }),
          title: 'Cowboy Bebop'
        }
      });

      expect(screen.queryByRole('button', { name: /Add to List/ })).not.toBeInTheDocument();
      // `.asd-label` is AnimeStatusDropdown's trigger label; the same words
      // also appear in its (closed) menu, so the trigger is addressed directly.
      expect(container.querySelector('.asd-label')).toHaveTextContent('Watching');
    });

    /**
     * `StreamingPlatforms` is behind a PostHog flag that answers false with no
     * PostHog present, so the watch-on row renders nothing in jsdom whatever
     * platforms are passed. That gate is covered by
     * `StreamingPlatforms.test.ts`; asserted here only so the absence is not
     * mistaken for the panel dropping the data.
     */
    it('leaves the watch-on row to its own feature gate', () => {
      const { container } = render(ShowIdentityPanel, {
        props: {
          anime: anime({
            streamingPlatforms: [{ platform: 'crunchyroll', url: 'https://crunchyroll.com/x' }]
          }),
          title: 'Cowboy Bebop'
        }
      });

      expect(container.querySelector('.streaming-platforms')).toBeNull();
    });
  });
});
