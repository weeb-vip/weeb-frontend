import { goto } from '$app/navigation';
import { configStore } from '../stores/config';
import { analytics } from '../../utils/analytics';
import { animeHref } from '../../services/utils';

/** One Algolia hit. Deliberately loose -- two indices with different shapes. */
export type SearchHit = any;

export interface SearchCollection {
  source?: { sourceId?: string };
  items?: SearchHit[];
}

/** The slice of autocomplete-core's state this component ever reads. */
export interface SearchState {
  query: string;
  isOpen: boolean;
  collections: SearchCollection[];
}

/** A live search, driven by the bloc and pushing state back to it. */
export interface SearchSession {
  setQuery(query: string): void;
  refresh(): void | Promise<void>;
  setIsOpen(open: boolean): void;
}

/**
 * Where results come from.
 *
 * The whole Algolia stack -- the lazily imported client, the two indices, the
 * autocomplete-core instance -- sits behind this one method, so the bloc holds
 * query/highlight/selection logic and nothing about how a hit is fetched. A
 * story hands over a stub that resolves canned hits.
 */
export interface SearchPort {
  /** Null means search is unavailable; the view degrades to a plain input. */
  connect(onState: (state: SearchState) => void): Promise<SearchSession | null>;
}

/** Anime is what people come here for; works answer "where did this come from". */
const ANIME_HITS_PER_PAGE = 20;
const WORKS_HITS_PER_PAGE = 4;

export const algoliaSearchPort: SearchPort = {
  async connect(onState) {
    if (typeof window === 'undefined') return null;

    try {
      // Config first: the index names live in it, and getItems reads it
      // synchronously on every keystroke.
      await configStore.init();
    } catch (error) {
      console.error('Failed to initialize config store:', error);
    }

    try {
      const algoliasearchModule: any = await import('algoliasearch/lite');
      const autocompleteModule = await import('@algolia/autocomplete-core');
      const presetModule = await import('@algolia/autocomplete-preset-algolia');

      // Handle both default and named exports for algoliasearch
      const algoliasearch =
        typeof algoliasearchModule?.default === 'function'
          ? algoliasearchModule.default
          : typeof algoliasearchModule === 'function'
            ? algoliasearchModule
            : algoliasearchModule?.liteClient;

      if (typeof algoliasearch !== 'function') {
        throw new Error('Unable to find algoliasearch function in module');
      }

      const { createAutocomplete } = autocompleteModule;
      const { getAlgoliaResults } = presetModule;
      const searchClient = algoliasearch('A2HF2P5C6X', '45216ed5ac3f9e0a478d3c354d353d58');

      const instance = createAutocomplete<SearchHit>({
        onStateChange({ state }: any) {
          onState(state as SearchState);
        },
        getSources() {
          return [
            {
              sourceId: 'data',
              getItemInputValue({ item }: any) {
                return item.title_en;
              },
              getItems({ query }: any) {
                if (!query) return [];

                const config = configStore.get();
                const indexName = config?.algolia_index || 'anime-staging';

                return getAlgoliaResults({
                  searchClient,
                  // The lite client types only describe its own newer query
                  // shape; getAlgoliaResults takes the legacy one.
                  queries: [{ indexName, query, params: { hitsPerPage: ANIME_HITS_PER_PAGE } }] as any
                });
              }
            },
            {
              sourceId: 'works',
              getItemInputValue({ item }: any) {
                return item.title_en;
              },
              getItems({ query }: any) {
                if (!query) return [];

                const worksIndex = configStore.get()?.algolia_works_index;
                // No works index configured means anything running an older
                // config just keeps getting anime results, rather than erroring
                // on an index that does not exist.
                if (!worksIndex) return [];

                return getAlgoliaResults({
                  searchClient,
                  queries: [
                    { indexName: worksIndex, query, params: { hitsPerPage: WORKS_HITS_PER_PAGE } }
                  ] as any,
                  // Tagged here rather than inferred from the fields, so the
                  // item component never has to guess which index a hit came
                  // from to decide where it links.
                  transformResponse({ hits }: any) {
                    return (hits[0] || []).map((hit: any) => ({ ...hit, __kind: 'work' }));
                  }
                });
              }
            }
          ] as any;
        }
      } as any);

      return {
        setQuery: (query) => instance.setQuery(query),
        refresh: () => instance.refresh(),
        setIsOpen: (open) => instance.setIsOpen(open)
      };
    } catch (error) {
      console.error('Failed to initialize Algolia (Svelte):', error);
      return null;
    }
  }
};

export interface AnalyticsPort {
  searchPerformed(query: string, resultCount: number): void;
}

export type NavigatePort = (url: string) => void;

/** A header row or a result row, in the order the panel renders them. */
export type PanelRow =
  | { kind: 'header'; sourceId: string }
  | { kind: 'item'; item: SearchHit; index: number };

export interface SearchGroup {
  sourceId: string;
  items: SearchHit[];
}

const GROUP_LABELS: Record<string, string> = {
  data: 'Anime',
  works: 'Manga & light novels'
};

/**
 * Where a chosen hit sends you. Pure, and the one rule with a real edge case:
 * a work has no id-based route to fall back on -- workBySlug is the only
 * lookup the schema exposes -- so a work with no slug has nowhere to go and is
 * left alone rather than sent to a certain 404.
 */
export function hrefForHit(item: SearchHit): string | null {
  // url_slug: algolia stores the CDC payload verbatim, not camelCase.
  const slug = item?.url_slug ?? item?.slug;
  if (item?.__kind === 'work') {
    return slug ? `/manga/${slug}` : null;
  }

  return animeHref({ id: item?.id, slug });
}

export function searchHref(query: string): string {
  return `/search?query=${encodeURIComponent(query)}`;
}

export interface AutocompleteAdvancedDeps {
  search?: SearchPort;
  navigate?: NavigatePort;
  analytics?: AnalyticsPort;
  /**
   * A blur must not close the panel before the click that caused it lands on a
   * result. Stories set 0 so the open panel is not on a timer.
   */
  dismissDelayMs?: number;
}

/** What a keystroke did, so the view knows whether to swallow it. */
export type KeyOutcome = 'moved' | 'submitted' | 'dismissed' | 'ignored';

/**
 * The header search: connecting to Algolia, the query, the grouped results,
 * the keyboard highlight, and what choosing a result does.
 *
 * The view renders `rows`, forwards keystrokes, and owns the animations.
 */
export class AutocompleteAdvancedBloc {
  readonly #search: SearchPort;
  readonly #navigate: NavigatePort;
  readonly #analytics: AnalyticsPort;
  readonly #dismissDelayMs: number;

  #session: SearchSession | null = null;
  #status: 'loading' | 'ready' | 'unavailable' = $state('loading');
  #state: SearchState = $state({ query: '', isOpen: false, collections: [] });
  #isFocused = $state(false);
  #activeIndex = $state(-1);
  #dismissTimer: ReturnType<typeof setTimeout> | null = null;

  constructor({
    search = algoliaSearchPort,
    navigate = goto,
    analytics: analyticsPort = analytics,
    dismissDelayMs = 200
  }: AutocompleteAdvancedDeps = {}) {
    this.#search = search;
    this.#navigate = navigate;
    this.#analytics = analyticsPort;
    this.#dismissDelayMs = dismissDelayMs;
  }

  /** `loading` draws the skeleton, `unavailable` the plain non-search input. */
  get status(): 'loading' | 'ready' | 'unavailable' {
    return this.#status;
  }

  get isFocused(): boolean {
    return this.#isFocused;
  }

  get query(): string {
    return this.#state.query ?? '';
  }

  /** The panel is showing: focused, open, and there is something in it. */
  get isPanelOpen(): boolean {
    return this.#isFocused && Boolean(this.#state.isOpen);
  }

  /**
   * Clamped on read: results change under the user while they arrow through
   * them, and a highlight left pointing past the end of a shorter list would
   * open nothing (or, worse, the wrong row after a re-render).
   */
  get activeIndex(): number {
    return Math.min(this.#activeIndex, this.#flatItems.length - 1);
  }

  /**
   * Anime and works are separate indices, so Algolia ranks each on its own and
   * the two scores are not comparable. Blending them into one list would mean
   * inventing an order; they stay grouped in the order the sources are
   * declared, each internally ranked by Algolia.
   */
  readonly #groups: SearchGroup[] = $derived(
    (this.#state.collections || [])
      .map((collection) => ({
        sourceId: collection?.source?.sourceId ?? '',
        items: (collection?.items || []).filter((item) => item != null)
      }))
      .filter((group) => group.items.length > 0)
  );

  /**
   * Still one flat index across every group, because the highlight moves
   * through the whole panel rather than restarting per section.
   */
  readonly #flatItems: SearchHit[] = $derived(this.#groups.flatMap((group) => group.items));

  /**
   * Headings only once there is more than one group, so a query that matches
   * no works looks exactly as it did before works were searchable.
   */
  readonly #rows: PanelRow[] = $derived.by(() => {
    const out: PanelRow[] = [];
    let index = 0;
    for (const group of this.#groups) {
      if (this.#groups.length > 1) {
        out.push({ kind: 'header', sourceId: group.sourceId });
      }
      for (const item of group.items) {
        out.push({ kind: 'item', item, index: index++ });
      }
    }

    return out;
  });

  get groups(): SearchGroup[] {
    return this.#groups;
  }

  get flatItems(): SearchHit[] {
    return this.#flatItems;
  }

  get rows(): PanelRow[] {
    return this.#rows;
  }

  get hasResults(): boolean {
    return this.#flatItems.length > 0;
  }

  /** A query that came back with nothing -- the panel's empty state. */
  get isEmptyResult(): boolean {
    return this.isPanelOpen && !this.hasResults && Boolean(this.query);
  }

  groupLabel(sourceId: string): string {
    return GROUP_LABELS[sourceId] ?? sourceId;
  }

  get searchAllHref(): string {
    return searchHref(this.query);
  }

  /** Connect to the search backend. Idempotent; called once from the view. */
  async init(): Promise<void> {
    if (this.#session) return;
    const session = await this.#search.connect((state) => {
      this.#state = state;
    });
    this.#session = session;
    this.#status = session ? 'ready' : 'unavailable';
  }

  focus(): void {
    this.#clearDismissTimer();
    this.#isFocused = true;
    this.#session?.setIsOpen(true);
  }

  /**
   * Delayed, because the blur fires before the click on the result that caused
   * it. Escape uses the same delay so the view can animate the panel out.
   */
  blur(): void {
    this.#scheduleDismiss();
  }

  input(value: string): void {
    // Results are about to change; drop the highlight so it cannot point at a
    // stale row (Enter would otherwise open the wrong show).
    this.#activeIndex = -1;
    this.#session?.setQuery(value);
    this.#session?.refresh();
  }

  /** Enter, arrows and Escape; the view only reports the key. */
  keydown(key: string): KeyOutcome {
    if (key === 'ArrowDown' || key === 'ArrowUp') {
      if (!this.#state.isOpen) return 'ignored';
      this.#move(key === 'ArrowDown' ? 1 : -1);
      return 'moved';
    }

    if (key === 'Enter') return this.submit();

    if (key === 'Escape') {
      this.#activeIndex = -1;
      this.#scheduleDismiss();
      return 'dismissed';
    }

    return 'ignored';
  }

  /** A highlighted result wins; otherwise fall through to a full search. */
  submit(): KeyOutcome {
    const highlighted = this.activeIndex >= 0 ? this.#flatItems[this.activeIndex] : undefined;
    if (highlighted) {
      this.select(highlighted);
      return 'submitted';
    }

    const query = this.query;
    if (!query) return 'ignored';

    this.#analytics.searchPerformed(query.trim(), this.#flatItems.length);
    this.#reset();
    this.#navigate(searchHref(query));

    return 'submitted';
  }

  /** Choosing a result: close, clear, and go -- unless there is nowhere to go. */
  select(item: SearchHit): void {
    const href = hrefForHit(item);
    this.#reset();
    if (href) this.#navigate(href);
  }

  /**
   * The panel footer's "search for ..." link. It is a real href as well, so
   * this only has to close the panel and take over the navigation.
   */
  searchAll(): void {
    const query = this.query;
    if (!query) return;
    this.#reset();
    this.#navigate(searchHref(query));
  }

  /**
   * Run a full search for text the bloc does not own -- the plain input the
   * view falls back to when Algolia could not be reached.
   */
  searchFor(text: string): void {
    const query = text.trim();
    if (!query) return;
    this.#analytics.searchPerformed(query, this.#flatItems.length);
    this.#navigate(searchHref(query));
  }

  destroy(): void {
    this.#clearDismissTimer();
  }

  #move(direction: 1 | -1): void {
    const length = this.#flatItems.length;
    if (length === 0) {
      this.#activeIndex = -1;
      return;
    }
    const from = this.activeIndex;
    this.#activeIndex =
      direction === 1 ? (from + 1) % length : from <= 0 ? length - 1 : from - 1;
  }

  #reset(): void {
    this.#clearDismissTimer();
    this.#activeIndex = -1;
    this.#isFocused = false;
    this.#session?.setIsOpen(false);
    this.#session?.setQuery('');
  }

  #scheduleDismiss(): void {
    this.#clearDismissTimer();
    const close = () => {
      this.#dismissTimer = null;
      this.#isFocused = false;
      this.#activeIndex = -1;
      this.#session?.setIsOpen(false);
    };
    if (this.#dismissDelayMs <= 0) {
      close();
      return;
    }
    this.#dismissTimer = setTimeout(close, this.#dismissDelayMs);
  }

  #clearDismissTimer(): void {
    if (this.#dismissTimer) {
      clearTimeout(this.#dismissTimer);
      this.#dismissTimer = null;
    }
  }
}
