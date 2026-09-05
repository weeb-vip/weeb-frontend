import { browser } from '$app/environment';
import {
  createMutation,
  createQuery,
  type CreateBaseMutationResult,
  type QueryClient,
  type QueryObserverResult,
} from '@tanstack/svelte-query';
import { fromStore, toStore } from 'svelte/store';
import { toast } from 'svelte-sonner';
import { createQueryClient, getQueryClient } from '../services/query-client';

/*
  One list, two media.

  ProfileAnimeList and ProfileWorkList were built as deliberate twins -- the same
  status tabs, counts, pagination, grid/list toggle and empty shell, once for
  anime and once for manga -- and had drifted into ~1500 lines that said the same
  thing twice. Everything that was actually shared lives here; everything that is
  genuinely per-medium (status vocabulary, chapters vs episodes, hrefs, copy)
  arrives as a `MediaListMediumConfig` rather than as `{#if medium === ...}`
  branches through the markup.
*/

export type Medium = 'anime' | 'manga';

/** Poster wall or table. A viewer's choice, not a per-medium one. */
export type MediaListView = 'grid' | 'list';

/** The page sizes the per-page select offers. */
export const PAGE_SIZE_OPTIONS = [24, 48, 72, 100];

/** Exactly the PosterCard props a list card sets. Spread onto the card. */
export interface MediaListCard {
  id: string;
  slug?: string | null;
  title: string;
  image: string;
  imagePath?: string;
  score?: number | null;
  status?: string | null;
  sub?: string;
  href?: string;
  genres?: string[];
  description?: string;
  episodeCount?: number | null;
  onList?: string | null;
}

/**
 * One entry, with every medium difference already resolved: the row and the
 * card both read this, so neither view has to know which medium it is drawing.
 */
export interface MediaListRow {
  /** Stable key for the keyed each-block. */
  key: string;
  href: string;
  title: string;
  /** CDN object key plus its folder -- never a pre-built URL. */
  image: string;
  imagePath: string;
  score: number | null;
  /** The small badge on the sub-line: a format, or a format and year. */
  typeBadge: string;
  /** The viewer's status for this entry, which tints the row. */
  status: string | null;
  progress: { current: number; total: number | null; unit: string };
  card: MediaListCard;
  /** The untouched entry, for the medium's own row control. */
  entry: any;
}

/** Query options for one page of the list. */
export type MediaListQueryPort = (input: { status: string; limit: number; page: number }) => {
  queryKey: readonly unknown[];
  queryFn: () => Promise<any>;
};

/** Query options for every tab's count in one request. */
export type MediaListCountsPort = () => {
  queryKey: readonly unknown[];
  queryFn: () => Promise<any>;
};

/**
 * The two writes a list row can make. Narrowed to verbs so a story can hand
 * over a promise that never settles, or one that rejects, without a network.
 */
export interface MediaListTrackingPort {
  setStatus(id: string, status: string): Promise<unknown>;
  remove(id: string): Promise<unknown>;
}

/**
 * Status and page live in the URL, so a shared or reloaded link lands on the
 * same shelf. A port because Storybook must not push history entries.
 */
export interface MediaListUrlPort {
  /** Raw params; the bloc decides whether a status belongs to this medium. */
  read(): { status: string | null; page: string | null };
  write(state: { status: string; page: number }): void;
  /** Back/forward. Returns its own teardown. */
  onChange(listener: () => void): () => void;
}

/** Only the failure channel -- the list never announces a success. */
export interface NotifyPort {
  error(message: string): void;
}

/** How many cards fit. A port so a story is not sized by the Storybook frame. */
export interface ViewportPort {
  defaultPageSize(): number;
}

/** What the view knows and the bloc needs: the loader's payload, if any. */
export type MediaListSource = () => { ssr: any | null };

/**
 * Everything that differs between the watchlist and the reading list.
 *
 * Data mapping rather than markup: the medium turns its own payloads into rows
 * and cards, and the shared shell renders them.
 */
export interface MediaListMediumConfig {
  medium: Medium;
  /** Tab order, left to right. */
  statuses: string[];
  /** The shelf the list opens on when the URL names none. */
  defaultStatus: string;
  statusLabel(status: string | null | undefined): string;
  statusColor(status: string | null | undefined): string;
  /** The counts payload, keyed by status value. */
  counts(data: any): Record<string, number>;
  /** The list payload's rows and its grand total. */
  entries(data: any): any[];
  total(data: any): number;
  row(entry: any): MediaListRow;
  /** Empty-state copy. The heading takes the active tab's label, lowercased. */
  empty: {
    heading(statusLabel: string): string;
    message: string;
    actionLabel: string;
    actionHref: string;
  };
  /** Names the tab strip for a screen reader. */
  tabsLabel: string;
  /** What a failed page fetch says. */
  errorMessage: string;
  /** Invalidated after a row write, so the grid and the tab numbers move together. */
  invalidateKeys: readonly (readonly unknown[])[];
  /** The loader's list payload, but only when the server rendered THIS medium. */
  ssrList(ssr: any | null): any | null;
  /** The loader's counts payload. Fetched for both media, so it seeds either way. */
  ssrCounts(ssr: any | null): any | null;
}

export interface MediaListDeps {
  source?: MediaListSource;
  config: MediaListMediumConfig;
  list: MediaListQueryPort;
  counts: MediaListCountsPort;
  /** Omitted when the medium's own row control owns its writes (manga does). */
  tracking?: MediaListTrackingPort | null;
  url?: MediaListUrlPort;
  viewport?: ViewportPort;
  notify?: NotifyPort;
  queryClient?: QueryClient;
}

type WriteVariables =
  | { kind: 'status'; id: string; status: string }
  | { kind: 'remove'; id: string };

type MutationView<TVariables> = {
  readonly current: CreateBaseMutationResult<unknown, unknown, TVariables>;
};

/**
 * The browser shares one client; a server render gets its own, so per-user data
 * never leaks between concurrent requests. Same rule as the root layout.
 */
export function defaultQueryClient(): QueryClient {
  return browser ? getQueryClient() : createQueryClient();
}

/** Pushes status and page onto the real history stack. */
export const browserUrlState: MediaListUrlPort = {
  read() {
    if (typeof window === 'undefined') return { status: null, page: null };
    const params = new URLSearchParams(window.location.search);
    return { status: params.get('status'), page: params.get('page') };
  },
  write({ status, page }) {
    if (typeof window === 'undefined') return;
    const url = new URL(window.location.href);
    url.searchParams.set('status', status);
    // Page one is the address without a page, so the canonical link to a shelf
    // is the short one.
    if (page > 0) url.searchParams.set('page', String(page + 1));
    else url.searchParams.delete('page');
    window.history.pushState({}, '', url.toString());
  },
  onChange(listener) {
    if (typeof window === 'undefined') return () => {};
    window.addEventListener('popstate', listener);
    return () => window.removeEventListener('popstate', listener);
  },
};

/** Wider screens get more cards, because more of them fit above the fold. */
export const realViewport: ViewportPort = {
  defaultPageSize() {
    if (typeof window === 'undefined') return 48;
    const w = window.innerWidth;
    if (w >= 1920) return 72;
    if (w >= 1440) return 48;
    return 24;
  },
};

const realNotify: NotifyPort = { error: (message) => toast.error(message) };

/**
 * The list behind /profile/anime, for whichever medium it was handed.
 *
 * It owns which tab is open, which page of it, how many per page, whether the
 * grid or the table is showing, and the two writes a row can make. The view
 * renders what it exposes.
 */
export class MediaListBloc {
  readonly config: MediaListMediumConfig;
  readonly perPageOptions = PAGE_SIZE_OPTIONS;

  readonly #source: MediaListSource;
  readonly #url: MediaListUrlPort;
  readonly #tracking: MediaListTrackingPort | null;
  readonly #notify: NotifyPort;

  readonly #list: { readonly current: QueryObserverResult<any, unknown> };
  readonly #counts: { readonly current: QueryObserverResult<any, unknown> };
  readonly #write: MutationView<WriteVariables>;

  #status = $state('');
  #page = $state(0);
  #perPage = $state(24);
  #view = $state<MediaListView>('grid');

  constructor({
    source = () => ({ ssr: null }),
    config,
    list,
    counts,
    tracking = null,
    url = browserUrlState,
    viewport = realViewport,
    notify = realNotify,
    queryClient = defaultQueryClient(),
  }: MediaListDeps) {
    this.config = config;
    this.#source = source;
    this.#url = url;
    this.#tracking = tracking;
    this.#notify = notify;

    // Seeded from what the server resolved and fetched, so the first client
    // render matches the SSR'd markup and its query key rather than defaulting
    // and refetching immediately.
    const ssr = source().ssr;
    const ssrMine = ssr?.medium === config.medium ? ssr : null;
    this.#status = (ssrMine?.status as string) ?? config.defaultStatus;
    this.#page = ssrMine?.page ?? 0;
    this.#perPage = ssr?.perPage ?? viewport.defaultPageSize();

    // Every tab's count in one query, seeded from the server so the numbers are
    // there on first paint. Created once -- they do not move with the visible
    // tab -- and refreshed by the write invalidations below.
    this.#counts = fromStore(
      createQuery(
        { ...counts(), initialData: config.ssrCounts(ssr) ?? undefined },
        queryClient,
      ),
    );

    // A store rather than a plain object, because the options carry the status
    // and page: this is what makes the query follow the tabs.
    const listOptions = toStore(() => {
      const seed = config.ssrList(ssr);
      // initialData only applies to the key the server actually fetched;
      // anywhere else it would show one shelf's rows under another's heading.
      const matches =
        !!seed &&
        this.#status === ssrMine?.status &&
        this.#page === (ssrMine?.page ?? 0) &&
        this.#perPage === (ssrMine?.perPage ?? this.#perPage);
      return {
        ...list({
          status: this.#status,
          limit: this.#perPage,
          page: this.#page + 1, // list-service pages are 1-based
        }),
        initialData: matches ? seed : undefined,
      };
    });
    this.#list = fromStore(createQuery(listOptions, queryClient));

    this.#write = fromStore(
      createMutation(
        {
          mutationFn: async (variables: WriteVariables) => {
            if (!this.#tracking) return;
            return variables.kind === 'status'
              ? this.#tracking.setStatus(variables.id, variables.status)
              : this.#tracking.remove(variables.id);
          },
          onSuccess: () => {
            for (const key of config.invalidateKeys) {
              queryClient.invalidateQueries({ queryKey: key });
            }
          },
          onError: (error: unknown) => {
            this.#notify.error(
              String((error as { message?: unknown })?.message ?? 'Could not update your list'),
            );
          },
        },
        queryClient,
      ),
    );
  }

  // ── what is on screen ───────────────────────────────────────

  get status(): string {
    return this.#status;
  }

  get page(): number {
    return this.#page;
  }

  get perPage(): number {
    return this.#perPage;
  }

  get view(): MediaListView {
    return this.#view;
  }

  /** The tab strip: every status, its label, and how many entries it holds. */
  get tabs(): { value: string; label: string; count: number }[] {
    const counts = this.config.counts(this.#counts.current.data);
    return this.config.statuses.map((status) => ({
      value: status,
      label: this.config.statusLabel(status),
      count: counts[status] ?? 0,
    }));
  }

  /** The active tab's label, lowercased, for the empty state's heading. */
  get statusLabel(): string {
    return this.config.statusLabel(this.#status);
  }

  get rows(): MediaListRow[] {
    return this.config.entries(this.#list.current.data).map((entry) => this.config.row(entry));
  }

  get total(): number {
    return this.config.total(this.#list.current.data);
  }

  get totalPages(): number {
    return Math.ceil(this.total / this.#perPage);
  }

  get isLoading(): boolean {
    return this.#list.current.isLoading;
  }

  get isError(): boolean {
    return this.#list.current.isError;
  }

  /** The cause, for the banner's second line. Empty when there is nothing to add. */
  get errorDetail(): string {
    const error = this.#list.current.error as { message?: unknown } | null;
    return error?.message ? String(error.message) : '';
  }

  get isRetrying(): boolean {
    return this.#list.current.isFetching;
  }

  /** This shelf is empty -- as opposed to still loading, or failed. */
  get isEmpty(): boolean {
    return !this.isLoading && !this.isError && this.rows.length === 0;
  }

  /** A row write is in flight, so the grid is dimmed rather than swapped out. */
  get isMutating(): boolean {
    return this.#write.current.isPending;
  }

  statusColor(status: string | null | undefined): string {
    return this.config.statusColor(status);
  }

  // ── intents ─────────────────────────────────────────────────

  /** A different shelf. Always back to its first page. */
  selectStatus(status: string): void {
    if (!this.config.statuses.includes(status) || status === this.#status) return;
    this.#status = status;
    this.#page = 0;
    this.#url.write({ status: this.#status, page: this.#page });
  }

  goToPage(page: number): void {
    const last = Math.max(this.totalPages - 1, 0);
    const next = Math.min(Math.max(page, 0), last);
    if (next === this.#page) return;
    this.#page = next;
    this.#url.write({ status: this.#status, page: this.#page });
  }

  /** More cards per page puts the viewer somewhere else entirely, so page one. */
  setPerPage(perPage: number): void {
    if (!Number.isFinite(perPage) || perPage <= 0 || perPage === this.#perPage) return;
    this.#perPage = perPage;
    this.#page = 0;
    this.#url.write({ status: this.#status, page: this.#page });
  }

  setView(view: MediaListView): void {
    this.#view = view;
  }

  changeStatus(id: string, status: string): void {
    if (!this.#tracking || !id) return;
    this.#write.current.mutate({ kind: 'status', id, status });
  }

  remove(id: string): void {
    if (!this.#tracking || !id) return;
    this.#write.current.mutate({ kind: 'remove', id });
  }

  retry(): void {
    void this.#list.current.refetch();
  }

  /**
   * Adopt the address, then follow it. Called from the view on mount: the
   * constructor already seeded from the server's resolution, and re-reading it
   * here is what makes back and forward work.
   *
   * Returns its own teardown, so the view can hand it straight to `$effect`.
   */
  start(): () => void {
    this.#readFromUrl();
    return this.#url.onChange(() => this.#readFromUrl());
  }

  #readFromUrl(): void {
    const { status, page } = this.#url.read();
    if (status && this.config.statuses.includes(status)) this.#status = status;
    const parsed = page ? parseInt(page, 10) : NaN;
    // An absent or unreadable page param means the first page, which is what
    // the short form of the URL says.
    this.#page = !Number.isNaN(parsed) && parsed > 0 ? parsed - 1 : 0;
  }
}
