import { describe, it, expect } from 'vitest';
import { render, screen, within } from '@testing-library/svelte';
import ShowInformation from './ShowInformation.svelte';

/**
 * The reference grid: everything about the record that is not the story.
 *
 * The rule it exists to keep is that a row with no value is ABSENT rather than
 * blank -- "Licensors: --" asserts we looked and there were none, which is a
 * different claim from "we have no licensor data". So most of these assert a
 * label is not in the document at all.
 *
 * Rows are label/value pairs of spans, not a real `<dl>`, so they are queried
 * by their visible label text. The grid's *shape* (one column, two, or four) is
 * media-query CSS and is invisible to jsdom.
 */

const full = {
  titleEn: 'Cowboy Bebop',
  titleJp: 'カウボーイビバップ',
  titleRomaji: 'Kaubōi Bibappu',
  studios: ['Sunrise', 'Bones'],
  source: 'Original',
  licensors: ['Funimation'],
  rating: 'R - 17+',
  broadcast: 'Saturdays at 01:00 (JST)',
  startDate: '1998-04-03T00:00:00Z',
  endDate: '1999-04-24T00:00:00Z',
  titleSynonyms: ['Bebop', 'CB']
};

/** The row for a label, so a value can be asserted next to its own label. */
const row = (label: string) => screen.getByText(label).closest('.info-item') as HTMLElement;

describe('ShowInformation', () => {
  describe('a fully-populated record', () => {
    it('draws every row it has a value for', () => {
      render(ShowInformation, { props: { anime: full } });

      expect(within(row('Japanese')).getByText('カウボーイビバップ')).toBeInTheDocument();
      expect(within(row('Romaji')).getByText('Kaubōi Bibappu')).toBeInTheDocument();
      expect(within(row('Studios')).getByText('Sunrise, Bones')).toBeInTheDocument();
      expect(within(row('Source')).getByText('Original')).toBeInTheDocument();
      expect(within(row('Licensors')).getByText('Funimation')).toBeInTheDocument();
      expect(within(row('Rating')).getByText('R - 17+')).toBeInTheDocument();
      expect(within(row('Broadcast')).getByText('Saturdays at 01:00 (JST)')).toBeInTheDocument();
    });

    it('marks the Japanese title `lang="ja"` inside an English document', () => {
      render(ShowInformation, { props: { anime: full } });

      // Tells a screen reader which voice to use and a search engine which
      // language it is. Nothing else on this grid is Japanese.
      expect(screen.getByText('カウボーイビバップ')).toHaveAttribute('lang', 'ja');
      expect(screen.getByText('Kaubōi Bibappu')).not.toHaveAttribute('lang');
    });

    it('runs the synonyms across the full width as one comma list', () => {
      const { container } = render(ShowInformation, { props: { anime: full } });

      expect(within(row('Synonyms')).getByText('Bebop, CB')).toBeInTheDocument();
      // `--full` is the contract: it is what makes the row span the grid rather
      // than sit in one narrow cell. Whether it *looks* full width needs CSS.
      expect(container.querySelector('.info-item--full')).toBe(row('Synonyms'));
    });
  });

  describe('the aired row', () => {
    it('is always present, because "when did it run" is the one unconditional fact', () => {
      render(ShowInformation, { props: { anime: {} } });

      expect(within(row('Aired')).getByText('Unknown – Ongoing')).toBeInTheDocument();
    });

    it('formats both ends in UTC, so a timezone cannot shift the year', () => {
      render(ShowInformation, { props: { anime: full } });

      expect(within(row('Aired')).getByText('03 Apr 1998 – 24 Apr 1999')).toBeInTheDocument();
    });

    it('reads "Ongoing" for a show that has not finished', () => {
      render(ShowInformation, { props: { anime: { startDate: '2024-01-07T00:00:00Z' } } });

      expect(within(row('Aired')).getByText('07 Jan 2024 – Ongoing')).toBeInTheDocument();
    });
  });

  describe('the source row', () => {
    it('is a link to the work once we know which one it adapts', () => {
      render(ShowInformation, {
        props: {
          anime: {
            source: 'Manga',
            sourceWork: { urlSlug: 'berserk', titleEn: 'Berserk' }
          }
        }
      });

      const link = screen.getByRole('link', { name: 'Manga' });
      expect(link).toHaveAttribute('href', '/manga/berserk');
      // The visible value stays the category MyAnimeList recorded; the work's
      // own name is the tooltip, so the column of values stays scannable.
      expect(link).toHaveAttribute('title', 'Berserk');
    });

    it('falls back to the Japanese title for the tooltip when there is no English one', () => {
      render(ShowInformation, {
        props: {
          anime: { source: 'Light novel', sourceWork: { urlSlug: 'sao', titleJp: 'ソードアート' } }
        }
      });

      expect(screen.getByRole('link', { name: 'Light novel' })).toHaveAttribute(
        'title',
        'ソードアート'
      );
    });

    it('is plain text while the category is known but the work is not', () => {
      render(ShowInformation, { props: { anime: { source: 'Manga' } } });

      expect(within(row('Source')).getByText('Manga')).toBeInTheDocument();
      expect(screen.queryByRole('link')).not.toBeInTheDocument();
    });

    it('carries no tooltip when the work has no title at all', () => {
      render(ShowInformation, {
        props: { anime: { source: 'Manga', sourceWork: { urlSlug: 'unknown' } } }
      });

      expect(screen.getByRole('link', { name: 'Manga' })).not.toHaveAttribute('title');
    });
  });

  describe('rows with nothing to say are absent, not blank', () => {
    it.each([
      ['Japanese', 'titleJp'],
      ['Romaji', 'titleRomaji'],
      ['Source', 'source'],
      ['Rating', 'rating'],
      ['Broadcast', 'broadcast']
    ])('omits %s when the record has no %s', (label) => {
      render(ShowInformation, { props: { anime: {} } });

      expect(screen.queryByText(label)).not.toBeInTheDocument();
    });

    it('omits Studios for an empty list as well as a missing one', () => {
      render(ShowInformation, { props: { anime: { studios: [] } } });

      expect(screen.queryByText('Studios')).not.toBeInTheDocument();
    });

    it('omits Synonyms for an empty list', () => {
      render(ShowInformation, { props: { anime: { titleSynonyms: [] } } });

      expect(screen.queryByText('Synonyms')).not.toBeInTheDocument();
    });

    it('keeps only the Aired row for a bare record', () => {
      const { container } = render(ShowInformation, { props: { anime: {} } });

      expect(container.querySelectorAll('.info-item')).toHaveLength(1);
    });
  });

  describe('shapes the API sends more than one way', () => {
    it('accepts studios as an already-joined string', () => {
      render(ShowInformation, { props: { anime: { studios: 'Madhouse' } } });

      expect(within(row('Studios')).getByText('Madhouse')).toBeInTheDocument();
    });

    it('accepts licensors as an already-joined string', () => {
      render(ShowInformation, { props: { anime: { licensors: 'Crunchyroll, Aniplex' } } });

      expect(within(row('Licensors')).getByText('Crunchyroll, Aniplex')).toBeInTheDocument();
    });

    it('does not break on a value long enough to wrap the cell', () => {
      const long = Array.from({ length: 30 }, (_, i) => `Alternate title ${i}`);
      render(ShowInformation, { props: { anime: { titleSynonyms: long } } });

      expect(within(row('Synonyms')).getByText(long.join(', '))).toBeInTheDocument();
    });
  });
});
