import { fromStore, type Readable } from 'svelte/store';
import { preferencesStore, getAnimeTitle, type TitleLanguage } from '../stores/preferences';
import { collapseSeasonParts, getYearUTC } from '../../services/utils';

/** One anime in the series, as this page reads one. */
export type SeriesEntry = {
  id?: string | null;
  slug?: string | null;
  seasonNumber?: number | null;
  startDate?: string | null;
  type?: string | null;
  /** The rest of the anime record. Loose because the page renders it verbatim. */
  [key: string]: any;
};

/** A heading and the entries under it. `key` is stable, so `{#each}` can key on it. */
export interface SeriesGroup {
  key: string;
  heading: string;
  items: SeriesEntry[];
}

/** The slice of the preferences store this page reads: which title to print. */
export interface TitleLanguagePort extends Readable<{ titleLanguage: TitleLanguage }> {}

/** What the view knows: the entries the loader fetched, and what to call them. */
export type SeriesAccessor = () => {
  entries: SeriesEntry[];
  seriesTitle: string;
  ssrError: string | null;
};

export interface SeriesPageDeps {
  source?: SeriesAccessor;
  preferences?: TitleLanguagePort;
}

/** Oldest first, undated last -- the order a series is watched in. */
function byDate(a: SeriesEntry, b: SeriesEntry): number {
  if (!a.startDate && !b.startDate) return 0;
  if (!a.startDate) return 1;
  if (!b.startDate) return -1;
  return new Date(a.startDate).getTime() - new Date(b.startDate).getTime();
}

/**
 * One group per season, then everything the derivation could not place.
 *
 * Three buckets rather than one list, because they answer different questions.
 * The numbered seasons are the show in order -- what someone arriving from
 * "Season 4" came to see. Season 0 is TheTVDB's specials, which belong to the
 * series but not to its run. And the unplaced entries are the honest remainder:
 * most of the catalogue has no derived season, and a page that quietly dropped
 * them would claim a series is smaller than it is.
 */
export function groupBySeason(entries: SeriesEntry[]): SeriesGroup[] {
  const numbered = new Map<number, SeriesEntry[]>();
  const specials: SeriesEntry[] = [];
  const unplaced: SeriesEntry[] = [];

  for (const entry of entries) {
    const season = entry?.seasonNumber;
    if (season === null || season === undefined) {
      unplaced.push(entry);
    } else if (season === 0) {
      specials.push(entry);
    } else {
      if (!numbered.has(season)) numbered.set(season, []);
      numbered.get(season)!.push(entry);
    }
  }

  const out: SeriesGroup[] = [...numbered.keys()]
    .sort((a, b) => a - b)
    .map((season) => ({
      key: `s${season}`,
      heading: `Season ${season}`,
      items: numbered.get(season)!.slice().sort(byDate),
    }));

  if (specials.length) {
    out.push({ key: 'specials', heading: 'Specials', items: specials.slice().sort(byDate) });
  }
  if (unplaced.length) {
    // Not "Unknown". The season is unknown; these entries are not, and most of
    // them are films and shorts that never belonged to a numbered run.
    out.push({ key: 'other', heading: 'Other entries', items: unplaced.slice().sort(byDate) });
  }

  return out;
}

/**
 * The span the series covers, from the entries we can date. One year when
 * everything landed in the same one, rather than "2016 – 2016".
 */
export function seriesYears(entries: SeriesEntry[]): string {
  const all = entries
    .map((entry) => getYearUTC(entry.startDate))
    .filter((year) => year && year !== 'TBA')
    .sort();
  if (all.length === 0) return '';
  return all[0] === all[all.length - 1] ? all[0] : `${all[0]} – ${all[all.length - 1]}`;
}

/**
 * Assembled here rather than from inline `{#if}` blocks in the markup, which
 * swallowed the spaces around them and rendered "13 entriesacross 5 seasons".
 */
export function seriesSummary(count: number, seasonCount: number, years: string): string {
  const head = [
    `${count} ${count === 1 ? 'entry' : 'entries'}`,
    seasonCount > 0 ? `across ${seasonCount} ${seasonCount === 1 ? 'season' : 'seasons'}` : '',
  ]
    .filter(Boolean)
    .join(' ');

  return years ? `${head} · ${years}` : head;
}

/**
 * The entry whose artwork stands for the series: its first season.
 *
 * The earliest TV entry, which is also the one that names the series -- the
 * same anchor the URL and the page title use, so the banner cannot end up
 * showing one thing while the heading says another. Falls back to the earliest
 * of anything for series that never had a TV run.
 */
export function pickAnchor(entries: SeriesEntry[]): SeriesEntry | undefined {
  const ordered = [...entries].sort(byDate);
  return ordered.find((entry) => (entry.type || '').toLowerCase() === 'tv') || ordered[0];
}

/** The line under a card: year, then what kind of entry it is. */
export function entrySubtitle(entry: SeriesEntry): string {
  return [getYearUTC(entry.startDate), entry.type || ''].filter(Boolean).join(' · ');
}

/**
 * A series page: which entries belong to which season, how the whole run
 * summarises, and which entry's key art stands for it.
 *
 * The bloc exists for the preferences store -- card titles follow the reader's
 * language -- and to keep the grouping out of the markup, where it was four
 * chained `$:` blocks that had to be read in declaration order to make sense.
 */
export class SeriesPageBloc {
  // Initialised at declaration, not only in the constructor: the `$derived`
  // fields below are declared after it and TypeScript reads that as a use
  // before initialisation, even though a derived is lazy.
  readonly #source: SeriesAccessor = () => ({ entries: [], seriesTitle: 'Series', ssrError: null });
  readonly #prefs: { current: { titleLanguage: TitleLanguage } };

  constructor({
    source = () => ({ entries: [], seriesTitle: 'Series', ssrError: null }),
    preferences = preferencesStore,
  }: SeriesPageDeps = {}) {
    this.#source = source;
    this.#prefs = fromStore(preferences);
  }

  get ssrError(): string | null {
    return this.#source().ssrError;
  }

  get seriesTitle(): string {
    return this.#source().seriesTitle;
  }

  /**
   * A season split across two cours is one season, so only the original of
   * each is listed. See collapseSeasonParts for why the rule is the TheTVDB
   * season rather than the title.
   */
  readonly #shown: SeriesEntry[] = $derived(collapseSeasonParts(this.#source().entries ?? []));

  readonly #groups: SeriesGroup[] = $derived(groupBySeason(this.#shown));

  get groups(): SeriesGroup[] {
    return this.#groups;
  }

  get seasonCount(): number {
    return this.#groups.filter((group) => group.key.startsWith('s')).length;
  }

  get summary(): string {
    return seriesSummary(this.#shown.length, this.seasonCount, seriesYears(this.#shown));
  }

  get anchorImageId(): string | undefined {
    return pickAnchor(this.#shown)?.id ?? undefined;
  }

  /** The title as this reader wants to see it -- English or Japanese. */
  titleFor(entry: SeriesEntry): string {
    return getAnimeTitle(entry, this.#prefs.current.titleLanguage);
  }

  subtitleFor(entry: SeriesEntry): string {
    return entrySubtitle(entry);
  }
}
