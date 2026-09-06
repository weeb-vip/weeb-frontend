import { describe, it, expect } from 'vitest';
import { Status } from '../../../../gql/graphql';
import { getStatusColor, getStatusLabel } from '$lib/utils/status';
import { animeListConfig } from './ProfileAnimeList.bloc.svelte';

/** The anime half of the shared list: its vocabulary and its mapping rows. */
const config = (language: () => 'english' | 'japanese' = () => 'english') =>
  animeListConfig(language);

const ENTRY = {
  id: 'ua1',
  status: Status.Watching,
  watchedEpisodes: 4,
  anime: {
    id: 'a1',
    slug: 'frieren',
    titleEn: 'Frieren',
    titleJp: '葬送のフリーレン',
    rating: '8.94',
    type: 'TV',
    episodeCount: 28,
    tags: ['Adventure'],
    description: 'A long walk.'
  }
};

describe('animeListConfig', () => {
  describe('the vocabulary', () => {
    it('is the anime medium', () => {
      expect(config().medium).toBe('anime');
    });

    it('opens on plan-to-watch, the shelf a viewer comes here to work through', () => {
      expect(config().defaultStatus).toBe(Status.Plantowatch);
    });

    it('offers every status the schema has', () => {
      expect(new Set(config().statuses)).toEqual(new Set(Object.values(Status)));
    });

    it('takes its labels and colours from the canonical maps, not a fourth copy', () => {
      const c = config();

      expect(c.statusLabel(Status.Watching)).toBe(getStatusLabel(Status.Watching));
      expect(c.statusColor(Status.Dropped)).toBe(getStatusColor(Status.Dropped));
    });
  });

  describe('reading the payloads', () => {
    it('maps every count, defaulting a missing one to zero', () => {
      expect(config().counts({ watching: 3, planToWatch: 2 })).toEqual({
        [Status.Watching]: 3,
        [Status.Plantowatch]: 2,
        [Status.Completed]: 0,
        [Status.Onhold]: 0,
        [Status.Dropped]: 0
      });
    });

    it('survives a counts payload that never arrived', () => {
      expect(Object.values(config().counts(undefined)).every((n) => n === 0)).toBe(true);
    });

    it('reads the rows and the grand total, and copes with neither being there', () => {
      expect(config().entries({ animes: [ENTRY] })).toEqual([ENTRY]);
      expect(config().entries(undefined)).toEqual([]);
      expect(config().total({ total: '42' })).toBe(42);
      expect(config().total(undefined)).toBe(0);
    });

    it('takes the loader’s payload only when the server rendered THIS medium', () => {
      const ssr = { medium: 'anime', animeList: { animes: [] }, animeCounts: { watching: 1 } };

      expect(config().ssrList(ssr)).toBe(ssr.animeList);
      expect(config().ssrList({ ...ssr, medium: 'manga' })).toBeNull();
      // Counts are fetched for both media, so they seed either way.
      expect(config().ssrCounts({ ...ssr, medium: 'manga' })).toBe(ssr.animeCounts);
      expect(config().ssrList(null)).toBeNull();
    });
  });

  describe('the row mapping', () => {
    it('titles the row in the reader’s language, live', () => {
      expect(config(() => 'english').row(ENTRY).title).toBe('Frieren');
      expect(config(() => 'japanese').row(ENTRY).title).toBe('葬送のフリーレン');
    });

    it('hands the card the CDN object key, not a URL', () => {
      const row = config().row(ENTRY);

      // The row used to put this straight into an <img src>, where it resolved
      // as a relative path and rendered nothing.
      expect(row.image).toBe('a1');
      expect(row.imagePath).toBe('posters');
      expect(row.card.image).toBe('a1');
    });

    it('links by slug', () => {
      expect(config().row(ENTRY).href).toBe('/anime/frieren');
    });

    it('reads the rating as a number', () => {
      expect(config().row(ENTRY).score).toBe(8.94);
    });

    it('has no score for an unrated show', () => {
      for (const rating of ['N/A', '', null, undefined, 'R - 17+ (violence)']) {
        const row = config().row({ ...ENTRY, anime: { ...ENTRY.anime, rating } });

        expect(row.score).toBeNull();
      }
    });

    it('gives the card the same score as the row', () => {
      for (const rating of ['8.94', 'N/A', '', null, undefined]) {
        const row = config().row({ ...ENTRY, anime: { ...ENTRY.anime, rating } });

        expect(row.card.score).toBe(row.score);
      }
    });

    // `score` used to be parsed once and then guarded twice differently: the row
    // read `Number.isFinite(score) ? score : null` while the card was handed the
    // raw `parseFloat` result. A rating that is a non-empty, non-"N/A" string
    // which does not parse -- MyAnimeList's content ratings are exactly this
    // shape -- made `parseFloat` return NaN, so `row.score` was null while
    // `row.card.score` was NaN; `Score.hasScore(NaN)` is true and
    // `Score.scoreText(NaN)` is "NaN", so the card drew a chip reading "NaN".
    it('gives the card no score for a rating that is not a number', () => {
      const row = config().row({
        ...ENTRY,
        anime: { ...ENTRY.anime, rating: 'R - 17+ (violence)' }
      });

      expect(row.card.score).toBeNull();
    });

    it('treats every shape of absent rating as no score at all, on row and card', () => {
      // Null and undefined are the API's two ways of not saying; '' is the
      // empty column; 'abc' is a string that simply is not a number. None of
      // them is a score, and none may reach the card as NaN.
      for (const rating of [null, undefined, '', 'abc', 'N/A', 'R - 17+ (violence)']) {
        const row = config().row({ ...ENTRY, anime: { ...ENTRY.anime, rating } });

        expect(row.score, `row score for ${JSON.stringify(rating)}`).toBeNull();
        expect(row.card.score, `card score for ${JSON.stringify(rating)}`).toBeNull();
        expect(Number.isNaN(row.card.score as unknown as number)).toBe(false);
      }
    });

    it('still passes a real score straight through to the card', () => {
      // The guard must not swallow the values it exists to protect.
      for (const [rating, expected] of [['8.94', 8.94], ['0', 0], ['10', 10]] as const) {
        const row = config().row({ ...ENTRY, anime: { ...ENTRY.anime, rating } });

        expect(row.score).toBe(expected);
        expect(row.card.score).toBe(expected);
      }
    });

    it('reports progress in episodes', () => {
      expect(config().row(ENTRY).progress).toEqual({ current: 4, total: 28, unit: 'ep' });
    });

    it('reports zero of unknown for an entry that records neither', () => {
      expect(config().row({ id: 'ua2', anime: { id: 'a2' } }).progress).toEqual({
        current: 0,
        total: null,
        unit: 'ep'
      });
    });

    it('keys off the row, then the anime, then the title', () => {
      expect(config().row(ENTRY).key).toBe('ua1');
      expect(config().row({ anime: { id: 'a1', titleEn: 'Frieren' } }).key).toBe('a1');
      expect(config().row({ anime: { titleEn: 'Frieren' } }).key).toBe('Frieren');
    });

    it('carries the viewer’s status onto both the row and the card', () => {
      const row = config().row(ENTRY);

      expect(row.status).toBe(Status.Watching);
      expect(row.card.onList).toBe(Status.Watching);
    });

    it('subtitles the card with its episode count, or with nothing', () => {
      expect(config().row(ENTRY).card.sub).toBe('28 episodes');
      expect(config().row({ anime: { id: 'a2' } }).card.sub).toBe('');
    });

    it('renders a row for an entry with no anime attached at all', () => {
      const row = config().row({ id: 'ua3' });

      expect(row.title).toBe('Unknown');
      expect(row.href).toBe('/');
      expect(row.typeBadge).toBe('');
      expect(row.card.genres).toEqual([]);
    });

    it('keeps the untouched entry for the medium’s own row control', () => {
      expect(config().row(ENTRY).entry).toBe(ENTRY);
    });
  });

  describe('the shell copy', () => {
    it('lowercases the active tab in the empty heading', () => {
      expect(config().empty.heading('Plan to Watch')).toBe('No anime in plan to watch');
    });

    it('sends an empty shelf somewhere to fill it', () => {
      expect(config().empty.actionHref).toBe('/');
      expect(config().empty.actionLabel).toBe('Browse Anime');
    });

    it('invalidates both the rows and the tab numbers after a write', () => {
      expect(config().invalidateKeys).toEqual([['user-animes'], ['user-anime-status-counts']]);
    });
  });
});
