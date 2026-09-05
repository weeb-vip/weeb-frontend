import { goto } from '$app/navigation';
import {
  createMutation,
  createQuery,
  type CreateBaseMutationResult,
  type QueryClient,
  type QueryObserverResult,
} from '@tanstack/svelte-query';
import { fromStore, toStore, type Readable } from 'svelte/store';
import { toast } from 'svelte-sonner';
import type { UserAnimeInput } from '../../gql/graphql';
import {
  fetchDetails,
  markEpisodeWatched,
  unmarkEpisodeWatched,
  upsertAnime,
  watchedEpisodes,
} from '../../services/queries';
import {
  findNextEpisode,
  getCurrentTime,
  parseDurationToMinutes,
  resolveEpisodeTiming,
  type EpisodeTiming,
} from '../../services/airTimeUtils';
import { animeHref, seasonLabel, seriesLinkFor } from '../../services/utils';
import { isFeatureEnabled } from '../../utils/analytics';
import { animeNotificationStore } from '../stores/animeNotifications';
import { configStore } from '../stores/config';
import { getAnimeTitle, preferencesStore, type TitleLanguage } from '../stores/preferences';
import { getSafeImageUrl } from '../utils/image';
import { defaultQueryClient } from './WorkStatusControl.bloc.svelte';
import type { ConfigPort, NotificationsPort } from './HeroBanner.bloc.svelte';
import type { FeatureFlagPort } from './StreamingPlatforms.bloc.svelte';
import type { WatchIntent } from './Episodes.bloc.svelte';
import {
  CHARACTERS,
  EPISODES,
  NEWS,
  SYNOPSIS,
  activeSection,
  airingChip,
  allStudios,
  clampEpisodeCount,
  episodeTotal,
  firstStudio,
  heroImageSources,
  nextEpisodeChip,
  resolveShow,
  scheduleLabel,
  sectionElementId,
  sectionScrollTop,
  sectionTabs,
  stickyStackHeight,
  tabBarTop,
  trackingInput,
  watchedNumbersFrom,
  type SectionTab,
  type ShowStatus,
} from './ShowContent.rules';

export const NEWS_FLAG = 'anime-news';

/** How many news items the section shows before deferring to /anime/<slug>/news. */
export const NEWS_LIMIT = 5;

/** The props the view feeds in, read live so the bloc always sees the current payload. */
export type ShowSourceAccessor = () => {
  animeId: string;
  ssrAnimeData: { anime?: any } | null;
  ssrCharactersData: any;
  ssrError: unknown;
};

/** The show record, as query options. Narrowed to the one call. */
export type DetailsQueryPort = (animeId: string) => Record<string, unknown>;

/** The viewer's per-episode rows, as query options. */
export type WatchedQueryPort = (animeId: string) => Record<string, unknown>;

/**
 * The two writes this page makes. Verbs rather than GraphQL shapes, so a story
 * can hand over a promise that never settles or one that rejects.
 */
export interface ShowTrackingPort {
  save(input: UserAnimeInput): Promise<unknown>;
  markEpisode(animeId: string, episodeNumber: number, watched: boolean): Promise<unknown>;
}

export interface PreferencesPort extends Readable<{ titleLanguage: TitleLanguage }> {}

/** Only the failure channel — a successful tick announces itself by ticking. */
export interface NotifyPort {
  error(message: string): void;
}

/** Same-page navigation. Used for the section deep link, so a tab is shareable. */
export type NavigatePort = (href: string) => void;

/**
 * Everything the scroll spy and the sticky stack need from the window and the
 * document, as one seam. Nine `window.` and `document.` reads used to sit
 * inline in the component, which is exactly why none of this was testable.
 */
export interface ViewportPort {
  scrollY(): number;
  innerWidth(): number;
  /** The section element's top edge relative to the viewport, or null when absent. */
  sectionTop(elementId: string): number | null;
  scrollTo(top: number): void;
  /** A `--weeb-*` length off `documentElement`, as a number. */
  cssLength(name: string, fallback: number): number;
  /** Publishes the measured sticky stack; `null` removes it again. */
  setStickyOffset(px: number | null): void;
  /** Scroll and resize together. Returns the teardown. */
  onScroll(listener: () => void): () => void;
}

export const browserViewport: ViewportPort = {
  scrollY: () => (typeof window === 'undefined' ? 0 : window.scrollY),
  innerWidth: () => (typeof window === 'undefined' ? 1280 : window.innerWidth),
  sectionTop: (elementId) => {
    if (typeof document === 'undefined') return null;
    const el = document.getElementById(elementId);
    return el ? el.getBoundingClientRect().top : null;
  },
  scrollTo: (top) => {
    if (typeof window !== 'undefined') window.scrollTo({ top, behavior: 'smooth' });
  },
  cssLength: (name, fallback) => {
    if (typeof document === 'undefined') return fallback;
    const raw = getComputedStyle(document.documentElement).getPropertyValue(name);
    const parsed = parseInt(raw, 10);
    return Number.isNaN(parsed) ? fallback : parsed;
  },
  setStickyOffset: (px) => {
    if (typeof document === 'undefined') return;
    // The property lives on documentElement, which outlives this page. Left
    // set, every other route would scroll as though it had this page's sticky
    // stack under its nav.
    if (px === null) document.documentElement.style.removeProperty('--weeb-sticky-offset');
    else document.documentElement.style.setProperty('--weeb-sticky-offset', `${px}px`);
  },
  onScroll: (listener) => {
    if (typeof window === 'undefined') return () => {};
    window.addEventListener('scroll', listener, { passive: true });
    window.addEventListener('resize', listener, { passive: true });
    return () => {
      window.removeEventListener('scroll', listener);
      window.removeEventListener('resize', listener);
    };
  },
};

const realTracking: ShowTrackingPort = {
  save: (input) => upsertAnime().mutationFn({ input }),
  markEpisode: (animeID, episodeNumber, watched) =>
    watched
      ? markEpisodeWatched().mutationFn({ input: { animeID, episodeNumber } })
      : unmarkEpisodeWatched().mutationFn({ input: { animeID, episodeNumber } }),
};

/**
 * The auth-aware failure toast the tracking controls have always shown: a
 * signed-out viewer gets a Login button rather than a message they cannot act
 * on. Kept as the port's default so a story can silence it entirely.
 */
export const trackingNotify: NotifyPort = {
  error(message) {
    const text = message.toLowerCase();
    const isAuth =
      text.includes('unauthorized') ||
      text.includes('forbidden') ||
      text.includes('access denied') ||
      text.includes('authentication') ||
      text.includes('not authenticated') ||
      text.includes('not logged in') ||
      text.includes('login required');

    if (!isAuth) {
      toast.error(message.length < 80 ? message : 'Could not save your progress');
      return;
    }

    const w = typeof window === 'undefined' ? undefined : (window as any);
    if (w && !w.loggedInStoreValue?.isLoggedIn) {
      toast.error('Please log in to track this anime', {
        action: { label: 'Login', onClick: () => w.loginModalStore?.openLogin() },
        duration: 8000,
      });
      return;
    }
    toast.error('Authentication error. Please try again.');
  },
};

export interface ShowContentDeps {
  source?: ShowSourceAccessor;
  details?: DetailsQueryPort;
  watched?: WatchedQueryPort;
  tracking?: ShowTrackingPort;
  preferences?: PreferencesPort;
  notifications?: NotificationsPort;
  config?: ConfigPort;
  flags?: FeatureFlagPort;
  viewport?: ViewportPort;
  navigate?: NavigatePort;
  notify?: NotifyPort;
  /** "Now", for the schedule. Injected so a story pins a date and stays put. */
  clock?: () => Date;
  imageUrl?: (id: string, path?: string) => string;
  queryClient?: QueryClient;
  /** How often to re-ask an unresolved feature flag, and how many times. */
  flagPollMs?: number;
  flagMaxTries?: number;
}

type MutationView<TVariables> = {
  readonly current: CreateBaseMutationResult<unknown, unknown, TVariables>;
};

const EMPTY_SOURCE = () => ({
  animeId: '',
  ssrAnimeData: null,
  ssrCharactersData: null,
  ssrError: null,
});

/**
 * The anime detail page, minus its markup.
 *
 * Eighteen `let`s, four reactive blocks that wrote to each other, two query
 * stores, two mutations, a scroll listener pair and a hand-measured sticky
 * stack lived in the view. All of it is here, behind ports, because the parts
 * worth being sure about — which record wins when SSR and the query disagree,
 * which section the reader is looking at, what a ± step clamps to — are pure
 * once the window and the network are seams rather than imports.
 */
export class ShowContentBloc {
  readonly #source: ShowSourceAccessor;
  readonly #tracking: ShowTrackingPort;
  readonly #viewport: ViewportPort;
  readonly #navigate: NavigatePort;
  readonly #notify: NotifyPort;
  readonly #config: ConfigPort;
  readonly #flags: FeatureFlagPort;
  readonly #clock: () => Date;
  readonly #imageUrl: (id: string, path?: string) => string;
  readonly #flagPollMs: number;
  readonly #flagMaxTries: number;

  readonly #details: { readonly current: QueryObserverResult<{ anime?: any }, unknown> };
  readonly #watched: { readonly current: QueryObserverResult<{ episodeNumber: number }[], unknown> };
  readonly #save: MutationView<UserAnimeInput>;
  readonly #mark: MutationView<WatchIntent>;
  readonly #prefs: { current: { titleLanguage: TitleLanguage } };
  readonly #notifications: {
    current: { timingData: Record<string, any>; countdowns: Record<string, any> };
  };

  /**
   * Memoised, not recomputed per read. Several getters hang off each of these,
   * and `anime` and `imageSources` are handed straight to child components as
   * props -- a fresh object or array on every read would re-trigger every
   * `$effect` downstream, which for `SafeImage` means restarting the image
   * loader on every render.
   */
  readonly #resolved = $derived.by(() => {
    const { ssrAnimeData, ssrError } = this.#source();
    return resolveShow(
      { animeData: ssrAnimeData, error: ssrError },
      this.#details.current ?? { isLoading: true, isError: false },
    );
  });

  readonly #sources = $derived.by(() => heroImageSources(this.#resolved.anime?.id, this.#imageUrl));

  readonly #next = $derived.by(() => {
    const anime = this.#resolved.anime;
    return anime ? findNextEpisode(anime.episodes, anime.broadcast, this.#clock()) : null;
  });

  readonly #timing = $derived.by(() => {
    const anime = this.#resolved.anime;
    if (!anime) return null;
    return resolveEpisodeTiming(
      this.#next?.episode,
      anime.broadcast,
      parseDurationToMinutes(anime.duration),
      this.#clock(),
    );
  });

  readonly #watchedNumbers = $derived.by(() => watchedNumbersFrom(this.#watched.current?.data));

  readonly #sections = $derived.by(() =>
    sectionTabs({
      newsEnabled: this.#newsEnabled,
      newsCount: this.#resolved.anime?.news?.length ?? 0,
      episodeCount: this.#resolved.anime?.episodes?.length ?? 0,
    }),
  );

  #newsEnabled = $state(false);
  #activeSection = $state<string>(SYNOPSIS);
  #stickyVisible = $state(false);
  #stickyHeight = $state(0);
  #tabBarHeight = $state(0);
  #artLoaded = $state(false);
  #jstOpen = $state(false);

  constructor({
    source = EMPTY_SOURCE,
    details = fetchDetails as DetailsQueryPort,
    watched = watchedEpisodes as WatchedQueryPort,
    tracking = realTracking,
    preferences = preferencesStore,
    notifications = animeNotificationStore as NotificationsPort,
    config = configStore,
    flags = { isEnabled: isFeatureEnabled },
    viewport = browserViewport,
    navigate = (href) => void goto(href, { replaceState: true, noScroll: true, keepFocus: true }),
    notify = trackingNotify,
    clock = getCurrentTime,
    imageUrl = getSafeImageUrl,
    queryClient = defaultQueryClient(),
    flagPollMs = 250,
    flagMaxTries = 25,
  }: ShowContentDeps = {}) {
    this.#source = source;
    this.#tracking = tracking;
    this.#viewport = viewport;
    this.#navigate = navigate;
    this.#notify = notify;
    this.#config = config;
    this.#flags = flags;
    this.#clock = clock;
    this.#imageUrl = imageUrl;
    this.#flagPollMs = flagPollMs;
    this.#flagMaxTries = flagMaxTries;
    this.#newsEnabled = flags.isEnabled(NEWS_FLAG);

    this.#prefs = fromStore(preferences);
    this.#notifications = fromStore(notifications);

    const { animeId, ssrAnimeData } = source();

    this.#details = fromStore(
      createQuery(
        {
          ...details(animeId),
          // Skip the client fetch when the loader already provided the details
          // — otherwise this refetches the heaviest document in the app on
          // every show view.
          enabled: !ssrAnimeData,
        } as any,
        queryClient,
      ),
    ) as any;

    // A store of options rather than a fresh query per invalidation: building
    // this inside a reactive statement made a new query store every time, so
    // `data` was read from one that had not resolved and the episode list drew
    // every row unwatched while the rows existed in the database. `enabled` has
    // to follow the viewer's row appearing, since the field is authenticated.
    this.#watched = fromStore(
      createQuery(
        toStore(() => ({
          ...watched(this.anime?.id ?? ''),
          enabled: Boolean(this.anime?.id) && Boolean(this.anime?.userAnime),
        })) as any,
        queryClient,
      ),
    ) as any;

    this.#save = fromStore(
      createMutation(
        {
          mutationFn: (input: UserAnimeInput) => this.#tracking.save(input),
          onSuccess: () => queryClient.invalidateQueries(),
          onError: (error: unknown) =>
            this.#notify.error(
              String((error as { message?: unknown })?.message ?? 'Failed to update your list'),
            ),
        },
        queryClient,
      ),
    );

    this.#mark = fromStore(
      createMutation(
        {
          mutationFn: (intent: WatchIntent) =>
            this.#tracking.markEpisode(this.anime?.id ?? '', intent.episodeNumber, intent.watched),
          // Both the episode list and the aggregate count move: list-service
          // derives userAnime.episodes from these rows, so the show's own query
          // is stale too.
          onSuccess: () => queryClient.invalidateQueries(),
          onError: (error: unknown) =>
            this.#notify.error(
              String((error as { message?: unknown })?.message ?? 'Failed to mark that episode'),
            ),
        },
        queryClient,
      ),
    );
  }

  // ── Lifecycle ─────────────────────────────────────────────

  /**
   * Loads config and starts the scroll spy. Returns the teardown, so the view
   * hands it straight back from an `$effect` and the listeners can never
   * outlive the page the way the old `scrollListenerAttached` latch allowed.
   */
  init(): () => void {
    void this.#config.init();
    this.syncScroll();
    const stopScroll = this.#viewport.onScroll(() => this.syncScroll());
    const stopFlag = this.#watchNewsFlag();
    return () => {
      stopScroll();
      stopFlag();
      this.#viewport.setStickyOffset(null);
    };
  }

  /**
   * The news section is behind a flag while the research pipeline's quality
   * gate is settled. The flag is unavailable during SSR, and PostHog's
   * `onFeatureFlags` can fire once while it still reads false and never fire
   * again — so re-ask briefly until it resolves.
   */
  #watchNewsFlag(): () => void {
    if (this.#newsEnabled) return () => {};
    let tries = 0;
    const timer = setInterval(() => {
      this.#newsEnabled = this.#flags.isEnabled(NEWS_FLAG);
      if (this.#newsEnabled || ++tries >= this.#flagMaxTries) clearInterval(timer);
    }, this.#flagPollMs);
    return () => clearInterval(timer);
  }

  /** Re-reads the scroll position: which section is in view, and whether the compact header shows. */
  syncScroll(): void {
    this.#stickyVisible = this.#viewport.scrollY() > 350;
    const navHeight = this.#viewport.cssLength('--weeb-nav-height', 60);
    this.#activeSection = activeSection(
      this.sections.map((tab) => tab.value),
      (section) => this.#viewport.sectionTop(sectionElementId(section)),
      navHeight + 160,
    );
  }

  /**
   * Publishes the measured sticky stack, and clears it on teardown. Reads
   * `stickyOffset`, so the view's `$effect` re-runs whenever a bar appears,
   * disappears or is re-measured.
   */
  publishStickyOffset(): () => void {
    this.#viewport.setStickyOffset(this.stickyOffset);
    return () => this.#viewport.setStickyOffset(null);
  }

  /** The view measures the two pinned bars with `bind:clientHeight`. */
  measureChrome(sticky: number, tabBar: number): void {
    this.#stickyHeight = sticky;
    this.#tabBarHeight = tabBar;
  }

  // ── The record ────────────────────────────────────────────

  get status(): ShowStatus {
    return this.#resolved.status;
  }

  get anime(): any {
    return this.#resolved.anime;
  }

  get ssrCharactersData(): any {
    return this.#source().ssrCharactersData;
  }

  /** The cause, for the error banner's second line. Empty when there is nothing useful to say. */
  get errorDetail(): string {
    const { ssrError } = this.#source();
    const cause = (this.#details.current?.error as { message?: unknown } | null) ?? ssrError;
    const message = (cause as { message?: unknown })?.message ?? cause;
    return typeof message === 'string' ? message : '';
  }

  get isRetrying(): boolean {
    return Boolean(this.#details.current?.isFetching);
  }

  /** Ask the server again. The only recovery the page can offer itself. */
  retry(): void {
    void this.#details.current?.refetch?.();
  }

  // ── Identity ──────────────────────────────────────────────

  get title(): string {
    return this.anime ? getAnimeTitle(this.anime, this.#prefs.current.titleLanguage) : '';
  }

  /** "Season 2", or "Special" for TheTVDB's season 0. Empty when unknown. */
  get seasonText(): string {
    return seasonLabel(this.anime?.seasonNumber);
  }

  /** Where the season label points, when the series has a page of its own. */
  get seriesLink(): string {
    return seriesLinkFor(this.anime);
  }

  get newsHref(): string {
    return animeHref(this.anime, '/news');
  }

  get imageSources(): string[] {
    return this.#sources;
  }

  /** The first candidate, blurred behind the compact header. */
  get stickyBackground(): string {
    return this.imageSources[0] ?? '';
  }

  get artLoaded(): boolean {
    return this.#artLoaded;
  }

  artChosen(): void {
    this.#artLoaded = true;
  }

  get studio(): string | null {
    return firstStudio(this.anime?.studios);
  }

  get studios(): string | null {
    return allStudios(this.anime?.studios);
  }

  get airing(): { label: string; airing: boolean } {
    return airingChip(this.anime);
  }

  // ── Sections ──────────────────────────────────────────────

  get newsEnabled(): boolean {
    return this.#newsEnabled;
  }

  get news(): any[] {
    return this.#newsEnabled ? (this.anime?.news ?? []) : [];
  }

  get episodes(): any[] {
    return this.anime?.episodes ?? [];
  }

  get relatedAnime(): any[] {
    return this.anime?.relatedAnime ?? [];
  }

  get sections(): SectionTab[] {
    return this.#sections;
  }

  get activeSection(): string {
    return this.#activeSection;
  }

  get showsNews(): boolean {
    return this.sections.some((tab) => tab.value === NEWS);
  }

  get showsEpisodes(): boolean {
    return this.sections.some((tab) => tab.value === EPISODES);
  }

  readonly sectionIds = { SYNOPSIS, NEWS, EPISODES, CHARACTERS };

  elementIdFor(section: string): string {
    return sectionElementId(section);
  }

  /**
   * Take the reader to a section, and leave the hash behind so the position is
   * shareable. `replaceState` rather than a push: a tab strip is not history.
   */
  selectSection(section: string): void {
    this.#activeSection = section;
    const top = this.#viewport.sectionTop(sectionElementId(section));
    if (top !== null) {
      this.#viewport.scrollTo(
        sectionScrollTop(
          top,
          this.#viewport.scrollY(),
          this.#viewport.cssLength('--weeb-nav-height', 60),
          this.stickyOffset,
        ),
      );
    }
    this.#navigate(`#${sectionElementId(section)}`);
  }

  // ── The pinned bars ───────────────────────────────────────

  get stickyVisible(): boolean {
    return this.#stickyVisible;
  }

  get stickyOffset(): number {
    return stickyStackHeight(this.#stickyVisible, this.#stickyHeight, this.#tabBarHeight);
  }

  get tabBarTop(): string {
    return tabBarTop(this.#stickyVisible, this.#stickyHeight);
  }

  // ── Schedule ──────────────────────────────────────────────

  /**
   * The next episode's timing, resolved once through the shared helper so this
   * page and the homepage banner can never disagree about the same episode.
   */
  get timing(): EpisodeTiming | null {
    return this.#timing;
  }

  get #timingData(): any {
    return this.#notifications.current.timingData[this.anime?.id];
  }

  get #workerCountdown(): any {
    return this.#notifications.current.countdowns[this.anime?.id];
  }

  get hasSchedule(): boolean {
    return Boolean(this.timing || this.#timingData || this.#workerCountdown);
  }

  get live(): boolean {
    if (this.timing) return this.timing.isLive;
    return Boolean(this.#timingData?.isCurrentlyAiring || this.#workerCountdown?.isAiring);
  }

  get aired(): boolean {
    if (this.timing) return this.timing.hasAired;
    return Boolean(this.#timingData?.hasAlreadyAired || this.#workerCountdown?.hasAired);
  }

  get countdown(): string {
    return this.timing?.countdown || this.#timingData?.countdown || this.#workerCountdown?.countdown || '';
  }

  get episodeNumber(): string {
    const number = this.#timingData?.episode?.episodeNumber ?? this.#next?.episode.episodeNumber;
    return number ? String(number) : '';
  }

  get scheduleLabel(): string {
    return scheduleLabel(this.live, this.aired);
  }

  /** "Thu 6:40 PM" in the viewer's zone, with the zone marker beside it. */
  get localTime(): string {
    return this.timing?.localTime ?? '';
  }

  get localZone(): string {
    return this.timing?.localZone ?? '';
  }

  /** The raw slot the API gave — "Wednesdays at 01:29 (JST)" — or null. */
  get broadcastSlot(): string | null {
    return this.timing?.broadcastSlot ?? this.anime?.broadcast ?? null;
  }

  get nextChip(): string | null {
    return nextEpisodeChip({
      hasSchedule: this.hasSchedule,
      live: this.live,
      aired: this.aired,
      countdown: this.countdown,
      episodeNumber: this.episodeNumber,
    });
  }

  get jstOpen(): boolean {
    return this.#jstOpen;
  }

  toggleJst(): void {
    this.#jstOpen = !this.#jstOpen;
  }

  closeJst(): void {
    this.#jstOpen = false;
  }

  // ── Tracking ──────────────────────────────────────────────

  get canTrack(): boolean {
    return Boolean(this.anime?.userAnime);
  }

  get pending(): boolean {
    return this.#save.current.isPending || this.#mark.current.isPending;
  }

  get score(): number | '' {
    return this.anime?.userAnime?.score || '';
  }

  get watchedCount(): number {
    return this.anime?.userAnime?.episodes ?? 0;
  }

  get episodeTotal(): number | null {
    return episodeTotal(this.anime);
  }

  get watchedNumbers(): Set<number> | null {
    return this.#watchedNumbers;
  }

  setScore(raw: string): void {
    if (!this.canTrack || raw === '') return;
    this.#save.current.mutate(trackingInput(this.anime, { score: Number(raw) }) as UserAnimeInput);
  }

  stepEpisodes(delta: number): void {
    if (!this.canTrack) return;
    const next = clampEpisodeCount(this.watchedCount, delta, this.episodeTotal);
    if (next === this.watchedCount) return;
    this.#save.current.mutate(trackingInput(this.anime, { episodes: next }) as UserAnimeInput);
  }

  markEpisode(intent: WatchIntent): void {
    this.#mark.current.mutate(intent);
  }
}
