import { derived, fromStore, type Readable } from 'svelte/store';
import { page as pageStore } from '$app/stores';
import { goto } from '$app/navigation';
import { isFeatureEnabled } from '../../utils/analytics';
import { GetImageFromAnime, getYearUTC } from '../../services/utils';
import { getSafeImageUrl } from '../utils/image';
import type { FeatureFlagPort } from './StreamingPlatforms.bloc.svelte';

/* ── Ports ───────────────────────────────────────────────────────────────── */

export type { FeatureFlagPort };

/**
 * The address bar. Category and page live in the URL so a filtered view can be
 * shared and survives a reload, which makes reading and writing it one
 * dependency -- a story hands over a plain store and a spy and the whole cycle
 * runs with no router. Same shape as `SearchPage`'s port, for the same reason.
 */
export interface RoutePort {
  url: Readable<{ pathname: string; search: string }>;
  /** Replaces the current entry: filtering is not a new place, it is this page. */
  replace(pathAndSearch: string): void;
}

export const appRoute: RoutePort = {
  url: derived(pageStore, ($page) => ({
    pathname: $page.url.pathname,
    search: $page.url.search,
  })),
  replace: (to) => void goto(to, { replaceState: true, noScroll: true, keepFocus: true }),
};

/** What the server load hands this page. */
export interface AnimeNewsItem {
  category?: string | null;
  [key: string]: unknown;
}

export interface AnimeNewsPageData {
  anime: { id?: string; startDate?: string | null; studios?: unknown } | null;
  news: AnimeNewsItem[];
  animeTitle: string;
  animeTitleJp?: string | null;
  animeSlug: string;
  ssrError?: string | null;
}

/* ── Rules ───────────────────────────────────────────────────────────────── */

export const NEWS_FLAG = 'anime-news';

/**
 * Filters are worth showing only once there's enough to filter. Below this a
 * chip row is decoration: with three stories you can read every headline faster
 * than you can decide which chip to press.
 */
export const MIN_ITEMS_FOR_FILTERS = 8;

/**
 * Page size. Paging is a display cut, not a fetch: the gateway's `news` field
 * takes no arguments, so every story arrives in one response regardless. Real
 * server-side paging needs limit/offset on anime-api first.
 */
export const PAGE_SIZE = 10;

/** How many stories carry each category. Exported so the rule is checkable. */
export function categoryCounts(news: AnimeNewsItem[]): Record<string, number> {
  return news.reduce<Record<string, number>>((acc, item) => {
    const category = (item?.category || '').toLowerCase();
    if (category) acc[category] = (acc[category] || 0) + 1;
    return acc;
  }, {});
}

const EMPTY_DATA: AnimeNewsPageData = {
  anime: null,
  news: [],
  animeTitle: '',
  animeTitleJp: null,
  animeSlug: '',
  ssrError: null,
};

export interface AnimeNewsPageDeps {
  flags?: FeatureFlagPort;
  route?: RoutePort;
  /** How often to re-ask while the flag is still unresolved. */
  pollMs?: number;
  /** How many times to re-ask before giving up (25 x 250ms ~= 6s). */
  maxTries?: number;
}

/**
 * The news page: its feature gate, its filtering and its paging.
 *
 * The gate is the same shape as the one on the show page's streaming row, and
 * takes the same `FeatureFlagPort`: the flag is client-only, so it is empty
 * during SSR and PostHog usually has not answered by the time this mounts, and
 * `onFeatureFlags` can fire once while the flag still reads false and then
 * never fire again. Here it is tri-state rather than a boolean -- `resolved`
 * separates "flags haven't loaded" from "flag is off", without which the page
 * flashes a not-available message on every load.
 */
export class AnimeNewsPageBloc {
  readonly #flags: FeatureFlagPort;
  readonly #route: RoutePort;
  readonly #url: { current: { pathname: string; search: string } };
  readonly #pollMs: number;
  readonly #maxTries: number;

  #source: () => AnimeNewsPageData = () => EMPTY_DATA;
  #enabled = $state(false);
  #resolved = $state(false);

  constructor({
    flags = { isEnabled: isFeatureEnabled },
    route = appRoute,
    pollMs = 250,
    maxTries = 25,
  }: AnimeNewsPageDeps = {}) {
    this.#flags = flags;
    this.#route = route;
    this.#url = fromStore(route.url);
    this.#pollMs = pollMs;
    this.#maxTries = maxTries;
    // Asked once up front, so a stub that already knows the answer -- or a
    // second mount after the flags have landed -- needs no interval at all.
    this.#enabled = flags.isEnabled(NEWS_FLAG);
    this.#resolved = this.#enabled;
  }

  /**
   * Bind the page's data, which arrives as a prop and changes when you navigate
   * from one show's news to another's.
   *
   * A function rather than a value pushed in from an `$effect`: effects do not
   * run during SSR, and this page is entirely server-rendered -- the e2e suite
   * clicks chips that exist before hydration. Reading through the closure means
   * the getters see the live prop on the server and on every later render.
   */
  bindData(source: () => AnimeNewsPageData): void {
    this.#source = source;
  }

  get #data(): AnimeNewsPageData {
    return this.#source();
  }

  /* ── Gate ──────────────────────────────────────────────────────────────── */

  get newsEnabled(): boolean {
    return this.#enabled;
  }

  /** False only while PostHog still owes us an answer. */
  get flagsResolved(): boolean {
    return this.#resolved;
  }

  get hasError(): boolean {
    return Boolean(this.#data.ssrError);
  }

  /** Keep asking until the flag resolves; returns the teardown for an `$effect`. */
  watchFlag(): () => void {
    if (this.#resolved) return () => {};

    let tries = 0;
    const timer = setInterval(() => {
      this.#enabled = this.#flags.isEnabled(NEWS_FLAG);
      if (this.#enabled || ++tries >= this.#maxTries) {
        this.#resolved = true;
        clearInterval(timer);
      }
    }, this.#pollMs);

    return () => clearInterval(timer);
  }

  /* ── The show this page is about ───────────────────────────────────────── */

  get title(): string {
    return this.#data.animeTitle;
  }

  get titleJp(): string | null {
    return this.#data.animeTitleJp ?? null;
  }

  get backHref(): string {
    return `/anime/${this.#data.animeSlug}`;
  }

  /**
   * Banner candidates, same order as the show page: the tvdb artwork synced to
   * the CDN first, the poster as a fallback. Note `GetImageFromAnime` returns a
   * CDN *slug*, not a URL -- `SafeImage` resolves it. Handing it
   * `anime.imageUrl` (a MyAnimeList address) is why the image was broken.
   */
  get bannerSources(): string[] {
    const anime = this.#data.anime;
    if (!anime?.id) return [];

    return [getSafeImageUrl(anime.id, 'banners'), getSafeImageUrl(GetImageFromAnime(anime))].filter(
      Boolean,
    );
  }

  get posterSource(): string {
    return this.#data.anime ? GetImageFromAnime(this.#data.anime) : '';
  }

  get studio(): string | null {
    const studios = this.#data.anime?.studios as unknown;
    const first = Array.isArray(studios) ? studios[0] : studios;
    return first ? String(first) : null;
  }

  /** "TBA" when there is no usable start date, matching the show page. */
  get year(): string {
    return getYearUTC(this.#data.anime?.startDate);
  }

  /* ── The list ──────────────────────────────────────────────────────────── */

  get news(): AnimeNewsItem[] {
    return this.#data.news ?? [];
  }

  get total(): number {
    return this.news.length;
  }

  /** "1 story" / "4 stories" -- said in three places on the page. */
  get storyCount(): string {
    return `${this.total} ${this.total === 1 ? 'story' : 'stories'}`;
  }

  /**
   * Counts come from the FULL set, not the filtered one -- a chip reading
   * "Staff 1" has to keep saying 1 after you select it, or the numbers move as
   * you click them.
   */
  get counts(): Record<string, number> {
    return categoryCounts(this.news);
  }

  get categories(): string[] {
    const counts = this.counts;
    return Object.keys(counts).sort((a, b) => counts[b] - counts[a]);
  }

  get showFilters(): boolean {
    return this.total >= MIN_ITEMS_FOR_FILTERS && this.categories.length >= 2;
  }

  get selected(): string | null {
    return new URLSearchParams(this.#url.current?.search ?? '').get('category');
  }

  get filtered(): AnimeNewsItem[] {
    const selected = this.selected;
    if (!selected) return this.news;

    return this.news.filter((item) => (item?.category || '').toLowerCase() === selected);
  }

  get pageCount(): number {
    return Math.max(1, Math.ceil(this.filtered.length / PAGE_SIZE));
  }

  /**
   * Clamped, so ?page=99 or a page that no longer exists after filtering lands
   * on the last real page instead of rendering an empty list.
   */
  get current(): number {
    const raw = Number(new URLSearchParams(this.#url.current?.search ?? '').get('page')) || 1;
    return Math.min(Math.max(1, raw), this.pageCount);
  }

  get visible(): AnimeNewsItem[] {
    return this.filtered.slice((this.current - 1) * PAGE_SIZE, this.current * PAGE_SIZE);
  }

  get firstShown(): number {
    return this.filtered.length === 0 ? 0 : (this.current - 1) * PAGE_SIZE + 1;
  }

  get lastShown(): number {
    return Math.min(this.current * PAGE_SIZE, this.filtered.length);
  }

  get pageNumbers(): number[] {
    return Array.from({ length: this.pageCount }, (_, i) => i + 1);
  }

  /** Reachable from a shared link after the data changes, even though a zero-count chip is never rendered. */
  get isEmptyCategory(): boolean {
    return Boolean(this.selected) && this.filtered.length === 0;
  }

  label(category: string): string {
    return category.charAt(0).toUpperCase() + category.slice(1);
  }

  /* ── Intents ───────────────────────────────────────────────────────────── */

  selectCategory(category: string | null): void {
    this.#navigate({ category });
  }

  goToPage(page: number): void {
    this.#navigate({ page });
  }

  #navigate(params: { category?: string | null; page?: number | null }): void {
    const current = this.#url.current ?? { pathname: '', search: '' };
    const search = new URLSearchParams(current.search);

    if ('category' in params) {
      if (params.category) search.set('category', params.category);
      else search.delete('category');
      // Changing the filter invalidates the page number -- page 2 of "all" is
      // rarely page 2 of a category, and silently keeping it strands you on an
      // empty view.
      search.delete('page');
    }
    if ('page' in params) {
      if (params.page && params.page > 1) search.set('page', String(params.page));
      else search.delete('page');
    }

    const query = search.toString();
    this.#route.replace(`${current.pathname}${query ? `?${query}` : ''}`);
  }
}
