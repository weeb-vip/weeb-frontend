import {
  createQuery,
  type QueryClient,
  type QueryObserverResult,
} from '@tanstack/svelte-query';
import { fromStore, type Readable } from 'svelte/store';
import { SvelteSet } from 'svelte/reactivity';
import { browser } from '$app/environment';
import { goto } from '$app/navigation';
import { fetchCurrentlyAiringWithDatesAndEpisodes } from '../../services/queries';
import { createQueryClient, getQueryClient } from '../services/query-client';
import { GetImageFromAnime, animeHref } from '../../services/utils';
import { getSafeImageUrl, resizeCdnUrl } from '../utils/image';
import { getAnimeTitle, preferencesStore, type TitleLanguage } from '../stores/preferences';
import { useAddAnimeWithToast } from '../utils/anime-actions';
import { Status } from '../../gql/graphql';
import { getCurrentSeason, getSeasonDisplayName } from '../../utils/seasonUtils';
import {
  buildCalendarGrid,
  buildDayGroups,
  countdownFor,
  dayLabel,
  entriesOnDay,
  expandEpisodes,
  formatTimeInZone,
  isOnList as entryIsOnList,
  mergeAiringPages,
  monthLabel,
  resolveTimeZone,
  timezoneOptions,
  upcomingDayGroups,
  type AiringEntry,
  type AiringShow,
  type CalendarDay,
  type Countdown,
  type DayGroup,
  type TimezoneOption,
} from './CurrentlyAiringPage.schedule';

/** The two things this page can be. */
export type AiringView = 'schedule' | 'calendar';

/** Days revealed per "show next N days" press, and shown to begin with. */
const DAY_PAGE = 7;

/** How often the countdown badges re-read the clock. */
const TICK_MS = 30_000;

function defaultQueryClient(): QueryClient {
  return browser ? getQueryClient() : createQueryClient();
}

/**
 * The airing query, narrowed to "options for this date range". A story hands
 * over a resolved, failing, or never-settling promise instead of a GraphQL
 * client.
 */
export type AiringQueryPort = (
  startDate: Date,
  endDate?: Date | null,
  days?: number,
  limit?: number,
) => {
  queryKey: readonly unknown[];
  queryFn: () => Promise<{ currentlyAiring?: AiringShow[] | null } | null | undefined>;
};

export interface PreferencesPort extends Readable<{ titleLanguage: TitleLanguage }> {}

/** Now, as a function, so a story or a test can stop time. */
export type ClockPort = () => Date;

/** The viewer's own zone. Read once; `Intl` is not available everywhere. */
export type LocalZonePort = () => string;

export type NavigatePort = (href: string) => void;

/** Adding a show to the list. The toast handling lives behind this. */
export interface AddAnimePort {
  add(animeId: string): void;
}

export function browserLocalZone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone;
  } catch {
    return 'UTC';
  }
}

/** What the view knows before the bloc exists: the loader's payload. */
export type AiringAccessor = () => { ssrData: { currentlyAiring?: AiringShow[] | null } | null };

export interface CurrentlyAiringDeps {
  source?: AiringAccessor;
  airing?: AiringQueryPort;
  queryClient?: QueryClient;
  preferences?: PreferencesPort;
  clock?: ClockPort;
  localZone?: LocalZonePort;
  navigate?: NavigatePort;
  addAnime?: AddAnimePort;
}

/**
 * Everything the airing page knows that is not markup.
 *
 * The component this came out of was the largest in the app, and the reason was
 * that all of this lived in it: two date ranges, a widening fetch for months
 * the initial query never covered, day bucketing, calendar-grid construction,
 * a timezone picker, a my-list filter and a per-day collapse state. Worse, the
 * view switch and the my-list filter were implemented by reaching into the
 * document and setting `style.display` by hand -- markup and state could
 * therefore disagree, and did.
 *
 * The pure half of it (grid, buckets, merge, countdown, zones) is in
 * `CurrentlyAiringPage.schedule.ts` where jest can reach it. What is left here
 * is the state and the fetching.
 */
export class CurrentlyAiringPageBloc {
  readonly #source: AiringAccessor;
  readonly #airing: AiringQueryPort;
  readonly #queryClient: QueryClient;
  readonly #prefs: { current: { titleLanguage: TitleLanguage } };
  readonly #clock: ClockPort;
  readonly #navigate: NavigatePort;
  readonly #addAnime: AddAnimePort;
  readonly #localZone: string;

  readonly #query: {
    readonly current: QueryObserverResult<{ currentlyAiring?: AiringShow[] | null } | null | undefined, unknown>;
  };

  /**
   * The range the main query covers. Paging the calendar outside it widens
   * these and refetches, rather than leaving the new month blank.
   */
  #rangeStart: Date;
  #rangeEnd: Date;

  /** Shows from those widening fetches, unioned with the main query's. */
  #extraShows = $state<AiringShow[]>([]);
  #calendarLoading = $state(false);

  #view = $state<AiringView>('schedule');
  #timezone = $state('local');
  #myListOnly = $state(false);
  #visibleDays = $state(DAY_PAGE);
  readonly #collapsed = new SvelteSet<string>();

  #calYear = $state(0);
  #calMonth = $state(0);
  #selectedDay = $state<string | null>(null);

  /** Advanced by `init`; every countdown reads it so they all move together. */
  #tick = $state(0);

  constructor({
    source = () => ({ ssrData: null }),
    airing = fetchCurrentlyAiringWithDatesAndEpisodes as AiringQueryPort,
    queryClient = defaultQueryClient(),
    preferences = preferencesStore,
    clock = () => new Date(),
    localZone = browserLocalZone,
    navigate = goto,
    addAnime,
  }: CurrentlyAiringDeps = {}) {
    this.#source = source;
    this.#airing = airing;
    this.#queryClient = queryClient;
    this.#prefs = fromStore(preferences);
    this.#clock = clock;
    this.#navigate = navigate;
    this.#localZone = localZone();
    this.#addAnime = addAnime ?? defaultAddAnime();

    const start = clock();
    // A whole month back and a whole month forward, so the calendar opens on
    // both the month you are in and the one you are most likely to page to.
    this.#rangeStart = new Date(start.getFullYear(), start.getMonth(), 1);
    this.#rangeEnd = new Date(start.getFullYear(), start.getMonth() + 2, 0);
    this.#calYear = start.getFullYear();
    this.#calMonth = start.getMonth();

    const { ssrData } = source();
    this.#query = fromStore(
      createQuery(
        {
          ...airing(this.#rangeStart, this.#rangeEnd, undefined, 100),
          initialData: ssrData ?? undefined,
          refetchOnWindowFocus: false,
          refetchOnMount: false,
          staleTime: 2 * 60 * 1000,
        },
        queryClient,
      ),
    );
  }

  /** Starts the shared clock. Returns the teardown. */
  init(): () => void {
    if (typeof setInterval !== 'function') return () => {};
    const id = setInterval(() => (this.#tick += 1), TICK_MS);
    return () => clearInterval(id);
  }

  // ── Query state ───────────────────────────────────────────────

  get isLoading(): boolean {
    return this.#query.current.isLoading;
  }

  get isError(): boolean {
    return this.#query.current.isError;
  }

  get errorDetail(): string {
    const error = this.#query.current.error as { message?: unknown } | null;
    return error?.message ? String(error.message) : '';
  }

  get isRetrying(): boolean {
    return this.#query.current.isFetching;
  }

  retry(): void {
    void this.#query.current.refetch();
  }

  // ── The clock, and what hangs off it ──────────────────────────

  /** Reading `#tick` is what makes every countdown recompute on the interval. */
  get now(): Date {
    void this.#tick;
    return this.#clock();
  }

  get timezones(): TimezoneOption[] {
    return timezoneOptions(this.#localZone);
  }

  get timezone(): string {
    return this.#timezone;
  }

  /** The IANA zone every day key and clock face on the page goes through. */
  get zone(): string {
    return resolveTimeZone(this.#timezone, this.#localZone);
  }

  selectTimezone(value: string): void {
    this.#timezone = value;
    // A day that no longer exists in the new zone would leave the panel stuck
    // on a heading with nothing under it.
    this.#selectedDay = null;
  }

  get seasonLabel(): string {
    return getSeasonDisplayName(getCurrentSeason(this.#clock()));
  }

  // ── The data ──────────────────────────────────────────────────

  /**
   * `.by` rather than a bare expression: the query is assigned in the
   * constructor, and a field initializer that names it directly runs before
   * that. The closure defers the read to when the derived is first pulled,
   * which is during render.
   */
  readonly #shows: AiringShow[] = $derived.by(() =>
    mergeAiringPages(this.#query.current.data?.currentlyAiring, this.#extraShows),
  );

  /** One entry per episode, in air order. */
  readonly entries: AiringEntry[] = $derived(expandEpisodes(this.#shows, this.now));

  get isEmpty(): boolean {
    return this.entries.length === 0;
  }

  // ── Schedule view ─────────────────────────────────────────────

  readonly #dayGroups: DayGroup[] = $derived(
    buildDayGroups(this.entries, this.now, this.zone, this.#myListOnly),
  );

  readonly #upcoming: DayGroup[] = $derived(
    upcomingDayGroups(this.#dayGroups, this.now, this.zone),
  );

  /** The days actually on screen. The rest are behind "show next N days". */
  get scheduleDays(): DayGroup[] {
    return this.#upcoming.slice(0, this.#visibleDays);
  }

  get hasMoreDays(): boolean {
    return this.#upcoming.length > this.#visibleDays;
  }

  /** How many the next press reveals, so the button can say so. */
  get nextDayBatch(): number {
    return Math.min(DAY_PAGE, this.#upcoming.length - this.#visibleDays);
  }

  showMoreDays(): void {
    this.#visibleDays += DAY_PAGE;
  }

  /**
   * The schedule has nothing in it *because of the filter*, which is a
   * different message from "nothing is airing" and offers a way back out.
   */
  get isFilteredOut(): boolean {
    return this.#myListOnly && this.#upcoming.length === 0 && !this.isEmpty;
  }

  isCollapsed(dayId: string): boolean {
    return this.#collapsed.has(dayId);
  }

  toggleDay(dayId: string): void {
    if (this.#collapsed.has(dayId)) this.#collapsed.delete(dayId);
    else this.#collapsed.add(dayId);
  }

  // ── View switch and filter ────────────────────────────────────

  get view(): AiringView {
    return this.#view;
  }

  selectView(view: string): void {
    this.#view = view === 'calendar' ? 'calendar' : 'schedule';
  }

  get myListOnly(): boolean {
    return this.#myListOnly;
  }

  toggleMyListOnly(): void {
    this.#myListOnly = !this.#myListOnly;
  }

  showAllAnime(): void {
    this.#myListOnly = false;
  }

  // ── Calendar view ─────────────────────────────────────────────

  get calendarLoading(): boolean {
    return this.#calendarLoading;
  }

  get monthLabel(): string {
    return monthLabel(this.#calYear, this.#calMonth);
  }

  readonly calendarDays: CalendarDay[] = $derived(
    buildCalendarGrid(this.#calYear, this.#calMonth, this.entries, {
      now: this.now,
      zone: this.zone,
      myListOnly: this.#myListOnly,
    }),
  );

  get selectedDay(): string | null {
    return this.#selectedDay;
  }

  selectDay(iso: string): void {
    this.#selectedDay = iso;
  }

  get selectedDayLabel(): string {
    return dayLabel(this.#selectedDay);
  }

  readonly selectedDayEntries: AiringEntry[] = $derived(
    this.#selectedDay
      ? entriesOnDay(this.entries, this.#selectedDay, this.zone, this.#myListOnly)
      : [],
  );

  /** The side panel's line when the chosen day has nothing on it. */
  get emptyDayMessage(): string {
    return this.#myListOnly
      ? 'No shows from your list airing this day'
      : 'No shows airing this day';
  }

  previousMonth(): void {
    if (this.#calMonth === 0) {
      this.#calMonth = 11;
      this.#calYear -= 1;
    } else {
      this.#calMonth -= 1;
    }
    this.#onMonthChanged();
  }

  nextMonth(): void {
    if (this.#calMonth === 11) {
      this.#calMonth = 0;
      this.#calYear += 1;
    } else {
      this.#calMonth += 1;
    }
    this.#onMonthChanged();
  }

  #onMonthChanged(): void {
    this.#selectedDay = null;
    void this.#fetchMonth(this.#calYear, this.#calMonth);
  }

  /**
   * Widen the fetched range to cover a month the initial two-month query never
   * asked for. The result is unioned into the main data rather than replacing
   * it, so paging away and back does not lose the months already in hand.
   */
  async #fetchMonth(year: number, month: number): Promise<void> {
    const monthStart = new Date(year, month, 1);
    const monthEnd = new Date(year, month + 1, 0);
    if (monthStart >= this.#rangeStart && monthEnd <= this.#rangeEnd) return;

    if (monthStart < this.#rangeStart) this.#rangeStart = monthStart;
    if (monthEnd > this.#rangeEnd) this.#rangeEnd = monthEnd;

    this.#calendarLoading = true;
    try {
      const result = await this.#queryClient.fetchQuery(
        this.#airing(this.#rangeStart, this.#rangeEnd, undefined, 200),
      );
      if (result?.currentlyAiring) {
        this.#extraShows = mergeAiringPages(this.#extraShows, result.currentlyAiring);
      }
    } catch {
      // The month stays as whatever is already loaded; the calendar is still
      // usable, so this is not worth an error banner over the whole page.
    } finally {
      this.#calendarLoading = false;
    }
  }

  // ── Per-entry reads ───────────────────────────────────────────

  titleFor(entry: AiringEntry): string {
    return getAnimeTitle(entry.airingInfo, this.#prefs.current.titleLanguage);
  }

  /** In the picked zone, which is the point of the picker. */
  timeFor(entry: AiringEntry): string {
    return formatTimeInZone(entry.airingInfo.nextEpisodeDate, this.zone);
  }

  episodeFor(entry: AiringEntry): string {
    const number = entry.airingInfo.nextEpisode?.episodeNumber;
    return number ? `Ep ${number}` : '';
  }

  countdownFor(entry: AiringEntry): Countdown {
    return countdownFor(entry.airingInfo.nextEpisodeDate, this.now);
  }

  isOnList(entry: AiringEntry): boolean {
    return entryIsOnList(entry);
  }

  hrefFor(entry: AiringEntry): string {
    return animeHref(entry.airingInfo as { id?: string | null; slug?: string | null });
  }

  /** `width` is the intended device-pixel width of the thumbnail. */
  imageFor(entry: AiringEntry, width: number): string {
    return resizeCdnUrl(getSafeImageUrl(GetImageFromAnime(entry.airingInfo)), width);
  }

  // ── Intents ───────────────────────────────────────────────────

  open(entry: AiringEntry): void {
    this.#navigate(this.hrefFor(entry));
  }

  addToList(entry: AiringEntry): void {
    const id = entry.airingInfo.id;
    if (id) this.#addAnime.add(id);
  }
}

/**
 * The real mutation. `createMutation` reads the QueryClient out of Svelte
 * context, so this only works while a component is initialising -- which is
 * exactly when the view's `$props()` fallback builds the bloc.
 */
function defaultAddAnime(): AddAnimePort {
  try {
    const mutation = fromStore(useAddAnimeWithToast());
    return {
      add: (animeId) =>
        mutation.current.mutate({ input: { animeID: animeId, status: Status.Plantowatch } }),
    };
  } catch {
    // Constructed outside a component (a story, a test): adding is a no-op
    // rather than a crash on the way to first paint.
    return { add: () => {} };
  }
}
