import {
  createQuery,
  type QueryClient,
  type QueryObserverResult,
} from '@tanstack/svelte-query';
import { fromStore, toStore, type Readable } from 'svelte/store';
import { SvelteSet } from 'svelte/reactivity';
import { browser } from '$app/environment';
import { goto } from '$app/navigation';
import { fetchSeasonalAnime } from '../../services/queries';
import { createQueryClient, getQueryClient } from '../services/query-client';
import { GetImageFromAnime, getYearUTC, animeHref } from '../../services/utils';
import { getAnimeTitle, preferencesStore, type TitleLanguage } from '../stores/preferences';
import { getCurrentSeason, getSeasonDisplayName } from '../../utils/seasonUtils';

/** Season order, and the wheel the arrows turn. */
const SEASONS = ['WINTER', 'SPRING', 'SUMMER', 'FALL'] as const;
export type SeasonName = (typeof SEASONS)[number];

/** Tags past this are behind "+N more"; a season has well over a hundred. */
const TAG_PREVIEW = 12;

/** How many titles a season page asks for. Seasons run to a few hundred. */
const SEASON_LIMIT = 500;

export interface SeasonalAnime {
  id: string;
  slug?: string | null;
  titleEn?: string | null;
  titleJp?: string | null;
  description?: string | null;
  rating?: string | null;
  status?: string | null;
  tags?: string[] | null;
  studios?: string[] | null;
  episodeCount?: number | null;
  startDate?: string | null;
  imageUrl?: string | null;
  userAnime?: { status?: string | null } | null;
  [key: string]: unknown;
}

export type SeasonalQueryPort = (
  season: string,
  limit?: number,
) => {
  queryKey: readonly unknown[];
  queryFn: () => Promise<{ animeBySeasons?: SeasonalAnime[] | null } | null | undefined>;
};

export interface PreferencesPort extends Readable<{ titleLanguage: TitleLanguage }> {}

export type ClockPort = () => Date;
export type NavigatePort = (href: string) => void;

/** What the route hands over: the season, its payload, and any loader failure. */
export type SeasonAccessor = () => {
  season: string;
  seasonalData: { animeBySeasons?: SeasonalAnime[] | null } | null;
  ssrError: string | null;
};

export interface SeasonPageDeps {
  source?: SeasonAccessor;
  seasonal?: SeasonalQueryPort;
  queryClient?: QueryClient;
  preferences?: PreferencesPort;
  clock?: ClockPort;
  navigate?: NavigatePort;
}

export interface TagFacet {
  tag: string;
  count: number;
}

export interface SeasonTab {
  season: SeasonName;
  key: string;
  label: string;
  icon: string;
  active: boolean;
}

function defaultQueryClient(): QueryClient {
  return browser ? getQueryClient() : createQueryClient();
}

function parseSeason(value: string): { name: SeasonName; year: number } {
  const [name, year] = value.split('_');
  return { name: name as SeasonName, year: Number.parseInt(year, 10) };
}

/** One step around the wheel, rolling the year at the ends. */
function adjacentSeason(value: string, direction: -1 | 1): string {
  const { name, year } = parseSeason(value);
  let index = SEASONS.indexOf(name) + direction;
  let rolled = year;
  if (index < 0) {
    index = SEASONS.length - 1;
    rolled -= 1;
  }
  if (index >= SEASONS.length) {
    index = 0;
    rolled += 1;
  }
  return `${SEASONS[index]}_${rolled}`;
}

/** "N/A" and nulls sort as zero rather than as NaN, which sorts nowhere. */
function ratingOf(anime: SeasonalAnime): number {
  if (!anime.rating || anime.rating === 'N/A') return 0;
  const parsed = Number.parseFloat(anime.rating);
  return Number.isNaN(parsed) ? 0 : parsed;
}

const SEASON_ICONS: Record<SeasonName, string> = {
  WINTER: '❄',
  SPRING: '\u2698',
  SUMMER: '☀',
  FALL: '\u{1F342}',
};

/**
 * One season's worth of anime: where the list comes from, how it is ordered,
 * which tags are on offer, and which of them are filtering it.
 *
 * Season switching goes through the router rather than local state -- the route
 * has a server load and a `{#key}` remount, so params, loader data and the SEO
 * meta all stay in step. A `history.pushState` left all three stale.
 */
export class SeasonPageBloc {
  readonly #source: SeasonAccessor;
  readonly #seasonal: SeasonalQueryPort;
  readonly #queryClient: QueryClient;
  readonly #prefs: { current: { titleLanguage: TitleLanguage } };
  readonly #clock: ClockPort;
  readonly #navigate: NavigatePort;
  readonly #query: {
    readonly current: QueryObserverResult<
      { animeBySeasons?: SeasonalAnime[] | null } | null | undefined,
      unknown
    >;
  };

  readonly #selectedTags = new SvelteSet<string>();
  #showAllTags = $state(false);

  constructor({
    source = () => ({ season: '', seasonalData: null, ssrError: null }),
    seasonal = fetchSeasonalAnime as SeasonalQueryPort,
    queryClient = defaultQueryClient(),
    preferences = preferencesStore,
    clock = () => new Date(),
    navigate = goto,
  }: SeasonPageDeps = {}) {
    this.#source = source;
    this.#seasonal = seasonal;
    this.#queryClient = queryClient;
    this.#prefs = fromStore(preferences);
    this.#clock = clock;
    this.#navigate = navigate;

    const { season, seasonalData } = source();

    // Seed the loader's payload into the cache under the key the query will
    // use, so a client-side refetch that fails still has something to render
    // rather than emptying a page that arrived populated.
    if (seasonalData) {
      queryClient.setQueryData(seasonal(season, SEASON_LIMIT).queryKey, seasonalData);
    }

    this.#query = fromStore(
      createQuery(
        toStore(() => ({
          ...seasonal(this.season, SEASON_LIMIT),
          refetchOnWindowFocus: false,
          staleTime: 10 * 60 * 1000,
          gcTime: 30 * 60 * 1000,
        })),
        queryClient,
      ),
    );
  }

  /** Warms the seasons either side, so the arrows land instantly. */
  init(): () => void {
    for (const season of [this.previousSeason, this.nextSeason]) {
      void this.#queryClient.prefetchQuery({
        ...this.#seasonal(season, SEASON_LIMIT),
        staleTime: 10 * 60 * 1000,
      });
    }
    return () => {};
  }

  // ── Which season ──────────────────────────────────────────────

  get season(): string {
    return this.#source().season;
  }

  get seasonName(): string {
    const { name } = parseSeason(this.season);
    return name.charAt(0) + name.slice(1).toLowerCase();
  }

  get year(): number {
    return parseSeason(this.season).year;
  }

  get displayName(): string {
    return getSeasonDisplayName(this.season);
  }

  get previousSeason(): string {
    return adjacentSeason(this.season, -1);
  }

  get nextSeason(): string {
    return adjacentSeason(this.season, 1);
  }

  get currentSeason(): string {
    return getCurrentSeason(this.#clock());
  }

  /** The "jump to current season" shortcut is only worth offering elsewhere. */
  get isCurrentSeason(): boolean {
    return this.season === this.currentSeason;
  }

  get seasonTabs(): SeasonTab[] {
    const { name, year } = parseSeason(this.season);
    return SEASONS.map((season) => ({
      season,
      key: `${season}_${year}`,
      label: season.charAt(0) + season.slice(1).toLowerCase(),
      icon: SEASON_ICONS[season],
      active: season === name,
    }));
  }

  /** The year strip: last year, this one, next. */
  get yearOptions(): { year: number; key: string; active: boolean }[] {
    const { name, year } = parseSeason(this.season);
    return [year - 1, year, year + 1].map((option) => ({
      year: option,
      key: `${name}_${option}`,
      active: option === year,
    }));
  }

  goToSeason(season: string): void {
    this.#navigate(`/season/${season}`);
  }

  // ── The list ──────────────────────────────────────────────────

  get isLoading(): boolean {
    // The loader's payload counts as loaded; only a page with nothing at all
    // shows skeletons.
    return this.#query.current.isLoading && !this.#source().seasonalData;
  }

  /** A background refetch over a populated grid: dim it, do not empty it. */
  get isRefreshing(): boolean {
    return this.#query.current.isFetching && this.animeList.length > 0;
  }

  get isError(): boolean {
    return this.#query.current.isError || Boolean(this.#source().ssrError);
  }

  get errorDetail(): string {
    const error = this.#query.current.error as { message?: unknown } | null;
    if (error?.message) return String(error.message);
    return this.#source().ssrError ?? '';
  }

  get isRetrying(): boolean {
    return this.#query.current.isFetching;
  }

  retry(): void {
    void this.#query.current.refetch();
  }

  readonly animeList: SeasonalAnime[] = $derived.by(() => {
    const fromQuery = this.#query.current.data?.animeBySeasons;
    const list = fromQuery ?? this.#source().seasonalData?.animeBySeasons ?? [];
    return [...list].sort((a, b) => ratingOf(b) - ratingOf(a));
  });

  /** The compact "top five" strip, which is only worth drawing over a few. */
  get topOfSeason(): SeasonalAnime[] {
    return this.animeList.length >= 3 ? this.animeList.slice(0, 5) : [];
  }

  // ── Tag filter ────────────────────────────────────────────────

  readonly #facets: TagFacet[] = $derived.by(() => {
    const counts = new Map<string, number>();
    for (const anime of this.animeList) {
      for (const tag of anime.tags ?? []) {
        counts.set(tag, (counts.get(tag) ?? 0) + 1);
      }
    }
    return [...counts.entries()]
      .sort((a, b) => b[1] - a[1])
      .map(([tag, count]) => ({ tag, count }));
  });

  get allTags(): TagFacet[] {
    return this.#facets;
  }

  get visibleTags(): TagFacet[] {
    return this.#showAllTags ? this.#facets : this.#facets.slice(0, TAG_PREVIEW);
  }

  get hasHiddenTags(): boolean {
    return this.#facets.length > TAG_PREVIEW;
  }

  get hiddenTagCount(): number {
    return Math.max(this.#facets.length - TAG_PREVIEW, 0);
  }

  get showAllTags(): boolean {
    return this.#showAllTags;
  }

  toggleShowAllTags(): void {
    this.#showAllTags = !this.#showAllTags;
  }

  isTagSelected(tag: string): boolean {
    return this.#selectedTags.has(tag);
  }

  get selectedTagCount(): number {
    return this.#selectedTags.size;
  }

  get hasTagFilter(): boolean {
    return this.#selectedTags.size > 0;
  }

  toggleTag(tag: string): void {
    if (this.#selectedTags.has(tag)) this.#selectedTags.delete(tag);
    else this.#selectedTags.add(tag);
  }

  clearTags(): void {
    this.#selectedTags.clear();
  }

  /** Every selected tag has to match -- tags narrow, they do not widen. */
  readonly filtered: SeasonalAnime[] = $derived.by(() => {
    if (this.#selectedTags.size === 0) return this.animeList;
    const wanted = [...this.#selectedTags];
    return this.animeList.filter((anime) => wanted.every((tag) => anime.tags?.includes(tag)));
  });

  /** The season has titles, but this combination of tags matches none of them. */
  get isFilteredOut(): boolean {
    return this.animeList.length > 0 && this.filtered.length === 0;
  }

  get isEmpty(): boolean {
    return this.animeList.length === 0;
  }

  /** "Showing 12 / 240 titles" -- the denominator only when it differs. */
  get countLabel(): string {
    const shown = this.filtered.length;
    return this.hasTagFilter ? `${shown} / ${this.animeList.length}` : `${shown}`;
  }

  get statsLabel(): string {
    if (this.isLoading) return 'Loading...';
    if (this.animeList.length === 0) return 'No titles';
    return `Showing ${this.countLabel} titles`;
  }

  get emptyMessage(): string {
    return this.hasTagFilter
      ? 'No anime match the selected tags.'
      : `There are no anime listed for ${this.displayName} yet.`;
  }

  // ── Per-card reads ────────────────────────────────────────────

  titleFor(anime: SeasonalAnime): string {
    return getAnimeTitle(anime, this.#prefs.current.titleLanguage);
  }

  imageFor(anime: SeasonalAnime): string {
    return GetImageFromAnime(anime);
  }

  hrefFor(anime: SeasonalAnime): string {
    return animeHref(anime);
  }

  scoreFor(anime: SeasonalAnime): number | null {
    const score = ratingOf(anime);
    return score > 0 ? score : null;
  }

  /** Studio if we have one; the year and episode count are the fallback. */
  subFor(anime: SeasonalAnime): string {
    return anime.studios?.[0] || `${getYearUTC(anime.startDate)} · ${anime.episodeCount || '?'} ep`;
  }

  /** The strip's second line: score and studio, whichever exist. */
  stripMetaFor(anime: SeasonalAnime): string {
    const parts: string[] = [];
    const score = this.scoreFor(anime);
    if (score) parts.push(`★ ${anime.rating}`);
    if (anime.studios?.[0]) parts.push(String(anime.studios[0]));
    return parts.join(' · ');
  }
}
