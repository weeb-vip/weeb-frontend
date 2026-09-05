import {
  createQuery,
  type QueryClient,
  type QueryObserverResult,
} from '@tanstack/svelte-query';
import { fromStore, toStore } from 'svelte/store';
import {
  addMonths,
  addWeeks,
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  startOfMonth,
  startOfWeek,
  subMonths,
  subWeeks,
} from 'date-fns';
import { browser } from '$app/environment';
import { fetchCurrentlyAiringWithDatesAndEpisodes } from '../../services/queries';
import { createQueryClient, getQueryClient } from '../services/query-client';
import {
  groupShowsByDay,
  isoDayInZone,
  type AiringShow,
} from './CurrentlyAiringPage.schedule';
import {
  browserLocalZone,
  type AiringQueryPort,
  type ClockPort,
  type LocalZonePort,
} from './CurrentlyAiringPage.bloc.svelte';

export type CalendarViewMode = 'month' | 'week';

/** A day cell, with everything airing on it already resolved. */
export interface CalendarCell {
  iso: string;
  date: Date;
  dayNumber: string;
  weekdayShort: string;
  isToday: boolean;
  entries: (AiringShow & { episodeAirTime: Date })[];
}

function defaultQueryClient(): QueryClient {
  return browser ? getQueryClient() : createQueryClient();
}

/** What the loader already fetched, and whether that fetch went wrong. */
export type CalendarAccessor = () => {
  ssrData: { currentlyAiring?: AiringShow[] | null } | null;
  ssrError: string | null;
};

export interface AiringCalendarDeps {
  source?: CalendarAccessor;
  airing?: AiringQueryPort;
  queryClient?: QueryClient;
  clock?: ClockPort;
  localZone?: LocalZonePort;
}

/** Weeks start on Sunday here, matching the column headings. */
const WEEK_OPTIONS = { weekStartsOn: 0 } as const;

/**
 * The month/week calendar behind `/airing/calendar`.
 *
 * The range, the fetch keyed to it, and the per-day bucketing were all inline
 * reactive statements in the view, including a re-`createQuery` on every range
 * change. Here the options are a store, so paging re-keys one query instead of
 * building a new one each time, and the bucketing goes through the same day
 * rule the rest of the airing pages use.
 */
export class AiringCalendarBloc {
  readonly #source: CalendarAccessor;
  readonly #airing: AiringQueryPort;
  readonly #queryClient: QueryClient;
  readonly #clock: ClockPort;
  readonly #zone: string;
  readonly #query: {
    readonly current: QueryObserverResult<
      { currentlyAiring?: AiringShow[] | null } | null | undefined,
      unknown
    >;
  };

  #currentDate = $state(new Date());
  #viewMode = $state<CalendarViewMode>('month');

  constructor({
    source = () => ({ ssrData: null, ssrError: null }),
    airing = fetchCurrentlyAiringWithDatesAndEpisodes as AiringQueryPort,
    queryClient = defaultQueryClient(),
    clock = () => new Date(),
    localZone = browserLocalZone,
  }: AiringCalendarDeps = {}) {
    this.#source = source;
    this.#airing = airing;
    this.#queryClient = queryClient;
    this.#clock = clock;
    this.#zone = localZone();
    this.#currentDate = clock();

    const { ssrData } = source();

    this.#query = fromStore(
      createQuery(
        toStore(() => ({
          ...airing(this.rangeStart, null, 32, 300),
          // The loader already fetched exactly this range for the month the
          // page opens on, so that first render costs no request at all.
          ...(this.isDefaultMonth && ssrData
            ? {
                initialData: ssrData,
                staleTime: Infinity,
                refetchOnMount: false,
                refetchOnWindowFocus: false,
                refetchOnReconnect: false,
              }
            : {}),
        })),
        queryClient,
      ),
    );
  }

  /**
   * Warms the ranges either side once the first paint is done, so paging is
   * instant. Delayed rather than immediate: prefetching three ranges at once
   * is what made the first one slow. Returns the teardown.
   */
  init(delayMs = 1000): () => void {
    if (typeof setTimeout !== 'function') return () => {};
    const id = setTimeout(() => {
      for (const direction of [-1, 1] as const) {
        void this.#queryClient.prefetchQuery(
          this.#airing(this.#startOf(this.#step(direction)), null, 32, 300),
        );
      }
    }, delayMs);
    return () => clearTimeout(id);
  }

  get viewMode(): CalendarViewMode {
    return this.#viewMode;
  }

  selectViewMode(mode: string): void {
    this.#viewMode = mode === 'week' ? 'week' : 'month';
  }

  get isMonthView(): boolean {
    return this.#viewMode === 'month';
  }

  get rangeStart(): Date {
    return this.#startOf(this.#currentDate);
  }

  get rangeEnd(): Date {
    return this.#viewMode === 'month'
      ? endOfMonth(this.#currentDate)
      : endOfWeek(this.#currentDate, WEEK_OPTIONS);
  }

  /** "March 2026", or "Week of Mar 8". */
  get title(): string {
    return this.#viewMode === 'month'
      ? format(this.#currentDate, 'MMMM yyyy')
      : `Week of ${format(this.rangeStart, 'MMM d')}`;
  }

  /** The range the page loader's payload covers. */
  get isDefaultMonth(): boolean {
    return (
      this.#viewMode === 'month' &&
      startOfMonth(this.#currentDate).getTime() === startOfMonth(this.#clock()).getTime()
    );
  }

  get ssrError(): string | null {
    return this.#source().ssrError;
  }

  get isLoading(): boolean {
    return this.#query.current.isLoading;
  }

  get isError(): boolean {
    return this.#query.current.isError;
  }

  get errorDetail(): string {
    const error = this.#query.current.error as { message?: unknown } | null;
    return error?.message ? String(error.message) : (this.ssrError ?? '');
  }

  get isRetrying(): boolean {
    return this.#query.current.isFetching;
  }

  retry(): void {
    void this.#query.current.refetch();
  }

  readonly #byDay: Record<string, (AiringShow & { episodeAirTime: Date })[]> = $derived.by(() =>
    groupShowsByDay(this.#query.current.data?.currentlyAiring ?? [], this.#zone),
  );

  /** Every cell in the visible range, with its shows already attached. */
  readonly cells: CalendarCell[] = $derived.by(() => {
    const todayIso = isoDayInZone(this.#clock(), this.#zone);
    return eachDayOfInterval({ start: this.rangeStart, end: this.rangeEnd }).map((date) => {
      const iso = isoDayInZone(date, this.#zone);
      return {
        iso,
        date,
        dayNumber: format(date, 'd'),
        weekdayShort: format(date, 'EEE'),
        isToday: iso === todayIso,
        entries: this.#byDay[iso] ?? [],
      };
    });
  });

  /** Nothing at all in this month or week -- not merely a quiet day. */
  get isEmpty(): boolean {
    return this.cells.every((cell) => cell.entries.length === 0);
  }

  /** Cells in a month grid, so the skeleton reserves the same height. */
  get skeletonCellCount(): number {
    return this.#viewMode === 'month' ? 35 : 7;
  }

  previous(): void {
    this.#currentDate = this.#step(-1);
  }

  next(): void {
    this.#currentDate = this.#step(1);
  }

  #step(direction: -1 | 1): Date {
    if (this.#viewMode === 'month') {
      return direction === 1
        ? addMonths(this.#currentDate, 1)
        : subMonths(this.#currentDate, 1);
    }
    return direction === 1 ? addWeeks(this.#currentDate, 1) : subWeeks(this.#currentDate, 1);
  }

  #startOf(date: Date): Date {
    return this.#viewMode === 'month' ? startOfMonth(date) : startOfWeek(date, WEEK_OPTIONS);
  }
}
