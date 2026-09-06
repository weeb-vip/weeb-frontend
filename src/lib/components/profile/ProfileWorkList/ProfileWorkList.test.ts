import { describe, it, expect } from 'vitest';
import { WorkStatus } from '../../../../gql/graphql';
import { getStatusColor } from '$lib/utils/status';
import { workHref, workListConfig } from './ProfileWorkList.bloc.svelte';

/** The manga half of the shared list: its vocabulary and its mapping rows. */
const config = workListConfig;

const ENTRY = {
  id: 'uw1',
  status: WorkStatus.Reading,
  chapters: 12,
  work: {
    id: 'w1',
    urlSlug: 'berserk',
    titleEn: 'Berserk',
    titleJp: 'ベルセルク',
    score: 9.4,
    type: 'MANGA',
    publishedFrom: '1989-08-25T00:00:00Z',
    chapters: 374
  }
};

describe('workHref', () => {
  it('links by the readable slug', () => {
    expect(workHref({ urlSlug: 'berserk' })).toBe('/manga/berserk');
  });

  it('sends a work with no slug somewhere useful rather than to a broken URL', () => {
    expect(workHref({ id: 'w1' })).toBe('/search');
    expect(workHref(null)).toBe('/search');
  });
});

describe('workListConfig', () => {
  describe('the vocabulary', () => {
    it('is the manga medium and opens on Reading', () => {
      expect(config().medium).toBe('manga');
      // What a reader is in the middle of is the shelf they check.
      expect(config().defaultStatus).toBe(WorkStatus.Reading);
    });

    it('offers every work status the schema has', () => {
      expect(new Set(config().statuses)).toEqual(new Set(Object.values(WorkStatus)));
    });

    it('labels the reading vocabulary in its own words', () => {
      expect(config().statusLabel(WorkStatus.Plantoread)).toBe('Plan to Read');
      expect(config().statusLabel(WorkStatus.Onhold)).toBe('On Hold');
    });

    it('shows an unknown status as itself rather than as blank', () => {
      expect(config().statusLabel('SOMETHING_NEW')).toBe('SOMETHING_NEW');
      expect(config().statusLabel(null)).toBe('');
      expect(config().statusLabel(undefined)).toBe('');
    });

    it('borrows the anime colours through the reading/watching equivalence', () => {
      // Reading is to a work what watching is to a show; one status map, not two.
      expect(config().statusColor(WorkStatus.Reading)).toBe(getStatusColor('WATCHING'));
      expect(config().statusColor(WorkStatus.Plantoread)).toBe(getStatusColor('PLANTOWATCH'));
      expect(config().statusColor(WorkStatus.Dropped)).toBe(getStatusColor('DROPPED'));
    });

    it('falls back to the muted colour for a status it does not know', () => {
      expect(config().statusColor('SOMETHING_NEW')).toBe(getStatusColor(null));
      expect(config().statusColor(null)).toBe(getStatusColor(null));
    });
  });

  describe('reading the payloads', () => {
    it('maps the counts payload’s own field names onto the statuses', () => {
      expect(config().counts({ reading: 2, planToRead: 5, onHold: 1 })).toEqual({
        [WorkStatus.Reading]: 2,
        [WorkStatus.Plantoread]: 5,
        [WorkStatus.Completed]: 0,
        [WorkStatus.Onhold]: 1,
        [WorkStatus.Dropped]: 0
      });
    });

    it('survives a counts payload that never arrived', () => {
      expect(Object.values(config().counts(null)).every((n) => n === 0)).toBe(true);
    });

    it('reads the rows and the grand total', () => {
      expect(config().entries({ works: [ENTRY] })).toEqual([ENTRY]);
      expect(config().entries(undefined)).toEqual([]);
      expect(config().total({ total: '7' })).toBe(7);
      expect(config().total(undefined)).toBe(0);
    });

    it('takes the loader’s list only for this medium, and its counts either way', () => {
      const ssr = { medium: 'manga', workList: { works: [] }, workCounts: { reading: 1 } };

      expect(config().ssrList(ssr)).toBe(ssr.workList);
      expect(config().ssrList({ ...ssr, medium: 'anime' })).toBeNull();
      expect(config().ssrCounts({ ...ssr, medium: 'anime' })).toBe(ssr.workCounts);
    });
  });

  describe('the row mapping', () => {
    it('prefers the English title, then the Japanese one', () => {
      expect(config().row(ENTRY).title).toBe('Berserk');
      expect(config().row({ work: { titleJp: 'ベルセルク' } }).title).toBe('ベルセルク');
    });

    it('has a title for a row with none', () => {
      expect(config().row({ work: {} }).title).toBe('Untitled');
      expect(config().row({}).title).toBe('Untitled');
    });

    it('looks covers up under the works folder', () => {
      const row = config().row(ENTRY);

      expect(row.image).toBe('w1');
      expect(row.imagePath).toBe('works');
      expect(row.card.imagePath).toBe('works');
    });

    it('badges the row with what it is and when it began', () => {
      expect(config().row(ENTRY).typeBadge).toBe('Manga · 1989');
      expect(config().row(ENTRY).card.sub).toBe('Manga · 1989');
    });

    it('reports progress in chapters', () => {
      expect(config().row(ENTRY).progress).toEqual({ current: 12, total: 374, unit: 'ch' });
    });

    it('reports zero of unknown for an entry that records neither', () => {
      expect(config().row({ work: { id: 'w2' } }).progress).toEqual({
        current: 0,
        total: null,
        unit: 'ch'
      });
    });

    it('keys off the row, then the work, then the title', () => {
      expect(config().row(ENTRY).key).toBe('uw1');
      expect(config().row({ work: { id: 'w1' } }).key).toBe('w1');
      expect(config().row({ work: { titleEn: 'Berserk' } }).key).toBe('Berserk');
    });

    it('carries the reader’s status onto both the row and the card', () => {
      const row = config().row(ENTRY);

      expect(row.status).toBe(WorkStatus.Reading);
      expect(row.card.onList).toBe(WorkStatus.Reading);
    });

    it('links the row and its card to the same place', () => {
      const row = config().row(ENTRY);

      expect(row.href).toBe('/manga/berserk');
      expect(row.card.href).toBe(row.href);
    });

    it('renders a row for an entry with no work attached at all', () => {
      const row = config().row({ id: 'uw3' });

      expect(row.title).toBe('Untitled');
      expect(row.href).toBe('/search');
      expect(row.score).toBeNull();
      expect(row.image).toBe('');
    });

    it('keeps the untouched entry for WorkStatusControl', () => {
      expect(config().row(ENTRY).entry).toBe(ENTRY);
    });
  });

  describe('the shell copy', () => {
    it('lowercases the active tab in the empty heading', () => {
      expect(config().empty.heading('Plan to Read')).toBe('No manga in plan to read');
    });

    it('invalidates both the rows and the tab numbers after a write', () => {
      expect(config().invalidateKeys).toEqual([['user-works'], ['user-work-status-counts']]);
    });
  });
});
