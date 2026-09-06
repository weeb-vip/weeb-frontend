import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { render, screen, within } from '@testing-library/svelte';
import RelatedAnime from './RelatedAnime.svelte';
import { stubNeverLoadingImages } from '$lib/components/__tests__/jsdom-gaps';

/**
 * The related rail's rendering. Which shelves exist, what they are called, in
 * what order and which entries land in each is `RelatedAnime.logic.ts`'s job and
 * is covered by its own suite; what is asserted here is what a reader sees --
 * the shelf headings, the "you are here" entry that is deliberately not a link,
 * the "View all seasons" link that belongs to exactly one shelf, and that the
 * type badge is the shared `Chip` rather than a re-rolled pill.
 */

let restoreImages: () => void;
beforeEach(() => {
  // Every card carries a poster through SafeImage, whose `new Image()` probe
  // never settles in jsdom.
  restoreImages = stubNeverLoadingImages();
});
afterEach(() => restoreImages());

const entry = (over: Record<string, unknown> = {}) => ({
  id: 'a1',
  slug: 'cowboy-bebop',
  titleEn: 'Cowboy Bebop',
  startDate: '1998-04-03T00:00:00Z',
  type: 'TV',
  seasonNumber: 1,
  ...over
});

const current = {
  id: 'c1',
  slug: 'bebop-movie',
  titleEn: 'Cowboy Bebop: The Movie',
  startDate: '2001-09-01T00:00:00Z',
  type: 'Movie',
  seasonNumber: null,
  thetvdbid: '76885'
};

describe('RelatedAnime', () => {
  describe('the shelves', () => {
    it('heads the same-series shelf with a real h3', () => {
      render(RelatedAnime, {
        props: {
          related: [
            { relation: 'SAME_SERIES', anime: entry({ id: 'a1', titleEn: 'Season 1' }) },
            {
              relation: 'SAME_SERIES',
              anime: entry({
                id: 'a2',
                titleEn: 'Season 2',
                seasonNumber: 2,
                startDate: '2000-01-01T00:00:00Z'
              })
            }
          ]
        }
      });

      // h3, under ShowSection's h2: an eyebrow over a group *within* a section.
      expect(screen.getByRole('heading', { level: 3, name: 'Same series' })).toBeInTheDocument();
    });

    it('falls back to a "Related" shelf for a relation kind this build does not know', () => {
      render(RelatedAnime, {
        props: {
          related: [{ relation: 'SHARED_CREATOR', anime: entry({ id: 'x', titleEn: 'Spin-off' }) }]
        }
      });

      // Unknown kinds must not vanish: the API grows kinds before this list
      // learns their names, and dropping them would hide data the server sent.
      expect(screen.getByRole('heading', { level: 3, name: 'Related' })).toBeInTheDocument();
      expect(screen.getByText('Spin-off')).toBeInTheDocument();
    });

    it('draws each shelf as its own list of entries', () => {
      render(RelatedAnime, {
        props: {
          related: [
            { relation: 'SAME_SERIES', anime: entry({ id: 'a1', titleEn: 'Season 1' }) },
            {
              relation: 'SAME_SERIES',
              anime: entry({ id: 'a2', titleEn: 'Season 2', seasonNumber: 2 })
            },
            { relation: 'SIDE_STORY', anime: entry({ id: 'b1', titleEn: 'An OVA', type: 'OVA' }) }
          ]
        }
      });

      const lists = screen.getAllByRole('list');
      expect(lists).toHaveLength(2);
      expect(within(lists[0]).getAllByRole('listitem')).toHaveLength(2);
      expect(within(lists[1]).getAllByRole('listitem')).toHaveLength(1);
    });

    /**
     * A same-series shelf holding only the anime you are already looking at is
     * a timeline of one, so it is suppressed. Any other kind is shown even at
     * one entry -- a single spin-off is still worth naming.
     */
    it('hides a same-series shelf that would list only the current anime', () => {
      render(RelatedAnime, { props: { related: [], current } });

      expect(screen.queryByRole('heading', { name: 'Same series' })).not.toBeInTheDocument();
    });

    it('shows a one-entry shelf of any other kind', () => {
      render(RelatedAnime, {
        props: { related: [{ relation: 'PREQUEL', anime: entry({ titleEn: 'The prequel' }) }] }
      });

      expect(screen.getByRole('heading', { name: 'Related' })).toBeInTheDocument();
      expect(screen.getAllByRole('listitem')).toHaveLength(1);
    });
  });

  describe('when there is nothing related', () => {
    /**
     * FINDING, asserted as-is rather than fixed. Unlike `AnimeNews` and
     * `ShowSynopsis`, this component renders NOTHING at all for a show with no
     * related entries -- no `EmptyState`, not even an empty container. That is
     * only safe because the page guards the whole section on having entries; a
     * caller that does not would leave a bare heading standing over nothing.
     */
    it.each([
      ['an empty list', []],
      ['entries with no anime attached', [{ relation: 'SAME_SERIES', anime: null }]]
    ])('renders nothing at all for %s', (_label, related) => {
      const { container } = render(RelatedAnime, { props: { related } });

      expect(container.querySelector('.rel-group')).toBeNull();
      expect(screen.queryAllByRole('heading')).toHaveLength(0);
      expect(screen.queryAllByRole('list')).toHaveLength(0);
    });
  });

  describe('an entry', () => {
    it('links to the slug, with the year and the type badge beside the title', () => {
      render(RelatedAnime, {
        props: {
          related: [
            { relation: 'PREQUEL', anime: entry({ titleEn: 'Cowboy Bebop', slug: 'cowboy-bebop' }) }
          ]
        }
      });

      const link = screen.getByRole('link', { name: /Cowboy Bebop/ });
      expect(link).toHaveAttribute('href', '/anime/cowboy-bebop');
      expect(link).toHaveTextContent('1998');
      expect(link).toHaveTextContent('TV');
    });

    it('falls back to the id when the entry has no slug yet', () => {
      render(RelatedAnime, {
        props: { related: [{ relation: 'PREQUEL', anime: entry({ slug: null, id: 'raw-id' }) }] }
      });

      expect(screen.getByRole('link', { name: /Cowboy Bebop/ })).toHaveAttribute(
        'href',
        '/anime/raw-id'
      );
    });

    it('falls back to the Japanese title when there is no English one', () => {
      render(RelatedAnime, {
        props: {
          related: [
            {
              relation: 'PREQUEL',
              anime: entry({ titleEn: null, titleJp: 'カウボーイビバップ' })
            }
          ]
        }
      });

      expect(screen.getByText('カウボーイビバップ')).toBeInTheDocument();
    });

    it('renders the type badge through Chip, accented only for the TV through-line', () => {
      const { container } = render(RelatedAnime, {
        props: {
          related: [
            { relation: 'PREQUEL', anime: entry({ id: 'tv', titleEn: 'The series', type: 'TV' }) },
            { relation: 'PREQUEL', anime: entry({ id: 'ova', titleEn: 'An OVA', type: 'OVA' }) }
          ]
        }
      });

      // `.chip` is Chip's root class -- finding it is what proves the badge is
      // the primitive and not a local pill. `chip--colored` is the class Chip
      // adds for any non-neutral tone; the colour itself is a CSS token jsdom
      // never resolves, so only the toned/untoned split is assertable.
      const chips = [...container.querySelectorAll('.chip')];
      expect(chips.map((c) => c.textContent?.trim())).toEqual(['TV', 'OVA']);
      expect(chips[0]).toHaveClass('chip--colored');
      expect(chips[1]).not.toHaveClass('chip--colored');
    });

    it('draws no type badge at all when the record has no type', () => {
      const { container } = render(RelatedAnime, {
        props: { related: [{ relation: 'PREQUEL', anime: entry({ type: null }) }] }
      });

      expect(container.querySelectorAll('.chip')).toHaveLength(0);
    });

    it('reads "TBA" for an entry with no air date rather than an empty gap', () => {
      render(RelatedAnime, {
        props: { related: [{ relation: 'PREQUEL', anime: entry({ startDate: null }) }] }
      });

      expect(screen.getByText('TBA')).toBeInTheDocument();
    });
  });

  describe('the season label', () => {
    it('names which run of the series an entry is', () => {
      render(RelatedAnime, {
        props: {
          related: [
            { relation: 'PREQUEL', anime: entry({ titleEn: 'Second run', seasonNumber: 2 }) }
          ]
        }
      });

      expect(screen.getByText('Season 2')).toBeInTheDocument();
    });

    /**
     * A season-0 entry already typed "Special" would otherwise read "Special
     * Special" -- the badge and the label saying the same word twice.
     */
    it('is dropped when it would repeat the type badge verbatim', () => {
      const { container } = render(RelatedAnime, {
        props: {
          related: [
            {
              relation: 'PREQUEL',
              anime: entry({ titleEn: 'A special', type: 'Special', seasonNumber: 0 })
            }
          ]
        }
      });

      expect(container.querySelector('.rel-season')).toBeNull();
      expect(container.querySelector('.chip')).toHaveTextContent('Special');
    });

    it('is kept when the two words are saying different things', () => {
      const { container } = render(RelatedAnime, {
        props: {
          related: [
            {
              relation: 'PREQUEL',
              anime: entry({ titleEn: 'A TV special', type: 'TV Special', seasonNumber: 0 })
            }
          ]
        }
      });

      expect(container.querySelector('.rel-season')).toHaveTextContent('Special');
    });

    it('renders nothing for the unknown season most of the catalogue has', () => {
      const { container } = render(RelatedAnime, {
        props: { related: [{ relation: 'PREQUEL', anime: entry({ seasonNumber: null }) }] }
      });

      expect(container.querySelector('.rel-season')).toBeNull();
    });
  });

  describe('the entry you are already on', () => {
    const sameSeries = [
      { relation: 'SAME_SERIES', anime: entry({ id: 'a1', titleEn: 'Season 1' }) }
    ];

    it('is placed in the same-series timeline and marked "You are here"', () => {
      render(RelatedAnime, { props: { related: sameSeries, current } });

      expect(screen.getByText('You are here')).toBeInTheDocument();
      expect(screen.getAllByRole('listitem')).toHaveLength(2);
    });

    it('is deliberately not a link to itself', () => {
      render(RelatedAnime, { props: { related: sameSeries, current } });

      // Present for orientation, not navigation. The one entry link on the
      // shelf is the other season; the shelf's own "View all seasons" link
      // points at the series page, not at an entry.
      const entryLinks = screen
        .getAllByRole('link')
        .map((a) => a.getAttribute('href'))
        .filter((href) => href?.startsWith('/anime/'));
      expect(entryLinks).toEqual(['/anime/cowboy-bebop']);
    });

    it('says where you are with aria-current="page"', () => {
      const { container } = render(RelatedAnime, { props: { related: sameSeries, current } });

      const here = container.querySelector('[aria-current="page"]') as HTMLElement;
      expect(here).toHaveTextContent('Cowboy Bebop: The Movie');
      expect(here.tagName).toBe('DIV');
    });

    it('is not added to shelves other than same-series', () => {
      render(RelatedAnime, {
        props: {
          related: [{ relation: 'SIDE_STORY', anime: entry({ titleEn: 'A side story' }) }],
          current
        }
      });

      // A spin-off list has no "you are here" position.
      expect(screen.queryByText('You are here')).not.toBeInTheDocument();
    });
  });

  describe('the "View all seasons" link', () => {
    const twoSeasons = [
      { relation: 'SAME_SERIES', anime: entry({ id: 'a1', titleEn: 'Season 1' }) },
      {
        relation: 'SAME_SERIES',
        anime: entry({
          id: 'a2',
          titleEn: 'Season 2',
          seasonNumber: 2,
          startDate: '2000-01-01T00:00:00Z'
        })
      }
    ];

    it('sits beside the same-series heading when the series has a page', () => {
      render(RelatedAnime, { props: { related: twoSeasons, current } });

      const viewAll = screen.getByRole('link', { name: 'View all seasons →' });
      expect(viewAll).toHaveAttribute('href', expect.stringContaining('76885'));
    });

    it('is absent when the anime has no TheTVDB id to build a series page from', () => {
      render(RelatedAnime, {
        props: { related: twoSeasons, current: { ...current, thetvdbid: null } }
      });

      expect(screen.queryByRole('link', { name: /View all seasons/ })).not.toBeInTheDocument();
    });

    it('never appears on a shelf that is not the same-series timeline', () => {
      render(RelatedAnime, {
        props: {
          related: [{ relation: 'SIDE_STORY', anime: entry({ titleEn: 'A side story' }) }],
          current
        }
      });

      // Only the same-series list is a timeline of a single thing, and so the
      // only one a series page could show more of.
      expect(screen.queryByRole('link', { name: /View all seasons/ })).not.toBeInTheDocument();
    });
  });

  describe('artwork', () => {
    it('labels each poster with the entry title so the card is not named twice', () => {
      const { container } = render(RelatedAnime, {
        props: { related: [{ relation: 'PREQUEL', anime: entry() }] }
      });

      // With the image probe failing, SafeImage settles into its no-artwork
      // state -- a real state of the app, and the one jsdom can reach. Whether
      // the poster paints is a network fact and belongs to the e2e layer.
      expect(container.querySelector('.rel-poster')).toBeInTheDocument();
      expect(screen.getByRole('link', { name: /Cowboy Bebop/ })).toBeInTheDocument();
    });

    it('survives an entry with a title long enough to clamp', () => {
      const titleEn = 'A very long localised title that keeps going and going '.repeat(4).trim();
      render(RelatedAnime, {
        props: { related: [{ relation: 'PREQUEL', anime: entry({ titleEn }) }] }
      });

      // Clamped to two lines by `-webkit-line-clamp`; nothing leaves the DOM.
      expect(screen.getByText(titleEn)).toBeInTheDocument();
    });
  });
});
