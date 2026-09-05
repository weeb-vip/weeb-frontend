import {
  createQuery,
  type QueryClient,
  type QueryObserverResult,
} from '@tanstack/svelte-query';
import { fromStore, toStore, type Readable } from 'svelte/store';
import { browser } from '$app/environment';
import {
  fetchHomePageData,
  fetchCurrentlyAiringWithDates,
  fetchSeasonalAnime,
} from '../../services/queries';
import { createQueryClient, getQueryClient } from '../services/query-client';
import { GetImageFromAnime, getYearUTC } from '../../services/utils';
import { parseDurationToMinutes, resolveEpisodeTiming, type EpisodeTiming } from '../../services/airTimeUtils';
import { getAnimeTitle, preferencesStore, type TitleLanguage } from '../stores/preferences';
import { isPhone, isTablet } from '../stores/viewport';
import { loggedInStore } from '../stores/auth';
import { animeNotificationService } from '../../services/animeNotifications';
import { AuthStorage } from '../../utils/auth-storage';
import { getSeasonDisplayName, getSeasonOptions } from '../../utils/seasonUtils';
import { workSubtitle } from '../../utils/workDisplay';
import { normalizeStatus } from '../utils/status';

/** How often the hero and the rail re-read the clock, together. */
const TICK_MS = 30_000;

/** How long after mount the next two seasons are warmed. */
const PREFETCH_DELAY_MS = 2_000;

/** How often the auth cookie is checked, as a fallback for the store. */
const TOKEN_POLL_MS = 5_000;

/** Recently-aired episodes stay on the rail this long after they finish. */
const RECENTLY_AIRED_MS = 30 * 60 * 1000;

/** How many recently-aired entries lead the rail. */
const RECENTLY_AIRED_SLOTS = 2;

export interface HomeAnime {
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
  episodes?: unknown[] | null;
  duration?: string | null;
  broadcast?: string | null;
  startDate?: string | null;
  imageUrl?: string | null;
  nextEpisode?: { episodeNumber?: number | null; airDate?: string | null; airTime?: string | null } | null;
  userAnime?: { status?: string | null } | null;
  [key: string]: unknown;
}

/**
 * The card-facing half of an entry. A type alias rather than an interface so
 * it carries an implicit index signature, which is what lets it be handed to
 * the title/image helpers alongside the raw query rows.
 */
export type AiringEntryAnime = {
  id: string;
  slug?: string | null;
  titleEn?: string | null;
  titleJp?: string | null;
  description?: string | null;
  tags?: string[] | null;
  episodeCount?: number | null;
  duration?: string | null;
  startDate?: string | null;
  imageUrl?: string | null;
  userAnime?: { status?: string | null } | null;
};

/** One episode of one airing show, as the hero and the rail read it. */
export interface AiringEntry {
  id: string;
  anime: AiringEntryAnime;
  airingInfo: Record<string, unknown> & {
    id: string;
    timing: EpisodeTiming;
    /** The show's own airing status, which the rebuilt `anime` above drops. */
    animeStatus?: string | null;
    nextEpisode?: { episodeNumber?: number | null; airDate?: Date | null } | null;
  };
}

export interface PublishingWork {
  id: string;
  titleEn?: string | null;
  titleJp?: string | null;
  type?: string | null;
  score?: number | null;
  publishedFrom?: string | null;
  urlSlug?: string | null;
  [key: string]: unknown;
}

type QueryOptions<T> = { queryKey: readonly unknown[]; queryFn: () => Promise<T> };

export type HomeQueryPort = () => QueryOptions<{ topRatedAnime?: HomeAnime[] | null } | null | undefined>;
export type AiringQueryPort = (
  startDate: Date,
  endDate?: Date | null,
  days?: number,
  limit?: number,
) => QueryOptions<{ currentlyAiring?: HomeAnime[] | null } | null | undefined>;
export type SeasonalQueryPort = (
  season: string,
  limit?: number,
) => QueryOptions<{ animeBySeasons?: HomeAnime[] | null } | null | undefined>;

export interface PreferencesPort extends Readable<{ titleLanguage: TitleLanguage }> {}
export interface AuthPort extends Readable<{ isLoggedIn: boolean; isAuthInitialized: boolean }> {}

/** The breakpoint tiers, as the two booleans the shelf cap depends on. */
export interface ViewportPort {
  isPhone: Readable<boolean>;
  isTablet: Readable<boolean>;
}

/** The auth token, read and cleared. Nothing else of `AuthStorage` is used. */
export interface SessionPort {
  getAuthToken(): string | null;
  getRefreshToken(): string | null;
  clearTokens(): void;
}

/** The notification worker, poked once data lands. */
export interface NotificationsPort {
  triggerImmediateUpdate(): void;
}

export type ClockPort = () => Date;

export type HomeAccessor = () => {
  homeData: { topRatedAnime?: HomeAnime[] | null } | null;
  currentlyAiringData: { currentlyAiring?: HomeAnime[] | null } | null;
  seasonalData: { animeBySeasons?: HomeAnime[] | null } | null;
  publishingWorksData: { currentlyPublishingWorks?: PublishingWork[] | null } | null;
  currentSeason: string;
  isTokenExpired: boolean;
};

export interface HomepageDeps {
  source?: HomeAccessor;
  home?: HomeQueryPort;
  airing?: AiringQueryPort;
  seasonal?: SeasonalQueryPort;
  queryClient?: QueryClient;
  preferences?: PreferencesPort;
  auth?: AuthPort;
  viewport?: ViewportPort;
  session?: SessionPort;
  notifications?: NotificationsPort;
  clock?: ClockPort;
}

function defaultQueryClient(): QueryClient {
  return browser ? getQueryClient() : createQueryClient();
}

const browserViewport: ViewportPort = { isPhone, isTablet };

const browserSession: SessionPort = {
  getAuthToken: () => AuthStorage.getAuthToken(),
  getRefreshToken: () => AuthStorage.getRefreshToken(),
  clearTokens: () => AuthStorage.clearTokens(),
};

function ratingOf(anime: HomeAnime): number {
  if (!anime.rating || anime.rating === 'N/A') return 0;
  const parsed = Number.parseFloat(anime.rating);
  return Number.isNaN(parsed) ? 0 : parsed;
}

/**
 * The homepage's state and fetching: three queries, the season the highlights
 * shelf is showing, which show the hero is pointed at, and the single clock the
 * hero and the rail both count down from.
 *
 * The clock is the reason it is one object rather than several. The hero badge
 * and the rail beside it used to derive their countdowns separately and drifted
 * apart within a minute of each other -- "18H" next to "Airing in 19h" for the
 * same episode. One tick, one resolved timing per episode, both surfaces read
 * the result.
 */
export class HomepageBloc {
  readonly #source: HomeAccessor;
  readonly #seasonal: SeasonalQueryPort;
  readonly #queryClient: QueryClient;
  readonly #prefs: { current: { titleLanguage: TitleLanguage } };
  readonly #auth: AuthPort;
  readonly #viewport: { phone: { current: boolean }; tablet: { current: boolean } };
  readonly #session: SessionPort;
  readonly #notifications: NotificationsPort;
  readonly #clock: ClockPort;

  readonly #homeQuery: {
    readonly current: QueryObserverResult<{ topRatedAnime?: HomeAnime[] | null } | null | undefined, unknown>;
  };
  readonly #airingQuery: {
    readonly current: QueryObserverResult<{ currentlyAiring?: HomeAnime[] | null } | null | undefined, unknown>;
  };
  readonly #seasonalQuery: {
    readonly current: QueryObserverResult<{ animeBySeasons?: HomeAnime[] | null } | null | undefined, unknown>;
  };

  #selectedSeason = $state('');
  /** The rail's current selection. Sticky: it survives the pointer leaving. */
  #pinnedId = $state<string | null>(null);
  #tick = $state(0);

  constructor({
    source = () => ({
      homeData: null,
      currentlyAiringData: null,
      seasonalData: null,
      publishingWorksData: null,
      currentSeason: '',
      isTokenExpired: false,
    }),
    home = fetchHomePageData as HomeQueryPort,
    airing = fetchCurrentlyAiringWithDates as AiringQueryPort,
    seasonal = fetchSeasonalAnime as SeasonalQueryPort,
    queryClient = defaultQueryClient(),
    preferences = preferencesStore,
    auth = loggedInStore as AuthPort,
    viewport = browserViewport,
    session = browserSession,
    notifications = animeNotificationService as NotificationsPort,
    clock = () => new Date(),
  }: HomepageDeps = {}) {
    this.#source = source;
    this.#seasonal = seasonal;
    this.#queryClient = queryClient;
    this.#prefs = fromStore(preferences);
    this.#auth = auth;
    this.#viewport = { phone: fromStore(viewport.isPhone), tablet: fromStore(viewport.isTablet) };
    this.#session = session;
    this.#notifications = notifications;
    this.#clock = clock;

    const {
      homeData,
      currentlyAiringData,
      seasonalData,
      currentSeason,
    } = source();
    this.#selectedSeason = currentSeason;

    this.#homeQuery = fromStore(
      createQuery(
        {
          ...home(),
          initialData: homeData ?? undefined,
          refetchOnWindowFocus: false,
          refetchOnMount: true,
          staleTime: 5 * 60 * 1000,
          gcTime: 10 * 60 * 1000,
          refetchOnReconnect: false,
        },
        queryClient,
      ),
    );

    // An hour back, so an episode that aired moments ago is still on the rail.
    const from = new Date(clock().getTime() - 60 * 60 * 1000);
    this.#airingQuery = fromStore(
      createQuery(
        {
          ...airing(from, null, 7, 10),
          initialData: currentlyAiringData ?? undefined,
          refetchOnWindowFocus: false,
          refetchOnMount: true,
          staleTime: 2 * 60 * 1000,
          gcTime: 5 * 60 * 1000,
          refetchOnReconnect: false,
        },
        queryClient,
      ),
    );

    this.#seasonalQuery = fromStore(
      createQuery(
        toStore(() => ({
          ...seasonal(this.#selectedSeason, 14),
          // Only the season the page was rendered for has a payload already.
          initialData:
            this.#selectedSeason === currentSeason ? (seasonalData ?? undefined) : undefined,
          refetchOnWindowFocus: false,
          refetchOnMount: true,
          staleTime: 10 * 60 * 1000,
          gcTime: 30 * 60 * 1000,
          refetchOnReconnect: false,
        })),
        queryClient,
      ),
    );
  }

  /**
   * Starts the clock, watches for the visitor signing in or out, and warms the
   * next two seasons. Returns one teardown for all of it -- this was four
   * separate `onMount`s, one of which leaked its interval.
   */
  init(): () => void {
    const teardowns: (() => void)[] = [];

    if (this.#source().isTokenExpired) this.#session.clearTokens();

    if (typeof setInterval === 'function') {
      const tick = setInterval(() => (this.#tick += 1), TICK_MS);
      teardowns.push(() => clearInterval(tick));
    }

    // The store is the reliable signal; the cookie poll is the fallback for a
    // sign-out that happened in another tab.
    let previous: boolean | null = null;
    teardowns.push(
      this.#auth.subscribe((state) => {
        if (!state.isAuthInitialized) return;
        if (previous !== null && previous !== state.isLoggedIn) this.refreshAll();
        previous = state.isLoggedIn;
      }),
    );

    if (typeof setInterval === 'function') {
      let lastToken = this.#session.getAuthToken();
      const poll = setInterval(() => {
        const current = this.#session.getAuthToken();
        if (Boolean(lastToken) !== Boolean(current)) {
          lastToken = current;
          this.refreshAll();
        }
      }, TOKEN_POLL_MS);
      teardowns.push(() => clearInterval(poll));
    }

    if (typeof window !== 'undefined') {
      const onAuthChange = () => this.refreshAll();
      window.addEventListener('loginSuccess', onAuthChange);
      window.addEventListener('authStateChanged', onAuthChange);
      teardowns.push(() => {
        window.removeEventListener('loginSuccess', onAuthChange);
        window.removeEventListener('authStateChanged', onAuthChange);
      });
    }

    if (typeof setTimeout === 'function') {
      const warm = setTimeout(() => {
        for (const season of this.seasonOptions.slice(1)) {
          void this.#queryClient.prefetchQuery({
            ...this.#seasonal(season),
            staleTime: 10 * 60 * 1000,
            gcTime: 30 * 60 * 1000,
          });
        }
      }, PREFETCH_DELAY_MS);
      teardowns.push(() => clearTimeout(warm));
    }

    return () => teardowns.forEach((off) => off());
  }

  /** Every shelf on the page, after a sign-in or sign-out changes what it says. */
  refreshAll(): void {
    for (const key of [['homedata'], ['currentlyAiring'], ['seasonal-anime']]) {
      void this.#queryClient.refetchQueries({ queryKey: key });
    }
  }

  // ── Season shelf ──────────────────────────────────────────────

  get selectedSeason(): string {
    return this.#selectedSeason;
  }

  /** This season and the next two, which is as far ahead as the data goes. */
  get seasonOptions(): string[] {
    return getSeasonOptions(this.#source().currentSeason);
  }

  seasonLabel(season: string): string {
    return getSeasonDisplayName(season);
  }

  selectSeason(season: string): void {
    this.#selectedSeason = season;
  }

  /**
   * Only a season the page was not rendered with can be loading; the initial
   * one always has the loader's payload behind it.
   */
  get isSeasonLoading(): boolean {
    return (
      this.#seasonalQuery.current.isLoading && this.#selectedSeason !== this.#source().currentSeason
    );
  }

  readonly seasonalAnime: HomeAnime[] = $derived.by(() => {
    const fromQuery = this.#seasonalQuery.current.data?.animeBySeasons;
    const isInitial = this.#selectedSeason === this.#source().currentSeason;
    const list = fromQuery ?? (isInitial ? this.#source().seasonalData?.animeBySeasons : null) ?? [];
    return [...list].sort((a, b) => ratingOf(b) - ratingOf(a)).slice(0, this.shelfLimit);
  });

  // ── Shelves ───────────────────────────────────────────────────

  /**
   * A grid fills its row whatever the count, so a breakpoint only changes how
   * many ROWS a shelf costs. Six keeps a phone shelf to three rows; "See all"
   * owns completeness either way.
   */
  get shelfLimit(): number {
    if (this.#viewport.phone.current) return 6;
    if (this.#viewport.tablet.current) return 12;
    return 20;
  }

  readonly topRated: HomeAnime[] = $derived.by(() => {
    const list = this.#homeQuery.current.data?.topRatedAnime ?? this.#source().homeData?.topRatedAnime ?? [];
    return list.slice(0, this.shelfLimit);
  });

  get hasTopRated(): boolean {
    return this.topRated.length > 0;
  }

  /**
   * Works without a slug are dropped rather than rendered as dead cards: the
   * scraper assigns slugs on its own schedule, and a row that cannot be clicked
   * is worse than a shorter row.
   */
  readonly publishingWorks: PublishingWork[] = $derived.by(() =>
    (this.#source().publishingWorksData?.currentlyPublishingWorks ?? [])
      .filter((work) => Boolean(work?.urlSlug))
      .slice(0, this.shelfLimit),
  );

  // ── Airing ────────────────────────────────────────────────────

  get now(): Date {
    void this.#tick;
    return this.#clock();
  }

  /**
   * The airing rail: everything that just aired, then everything coming up.
   *
   * Timing is resolved once per episode here and handed to both the hero and
   * the rail, rather than each rebuilding it from (airDate, broadcast).
   */
  readonly airingEntries: AiringEntry[] = $derived.by(() => {
    const now = this.now;
    const shows =
      this.#airingQuery.current.data?.currentlyAiring ??
      this.#source().currentlyAiringData?.currentlyAiring ??
      [];

    const entries: AiringEntry[] = [];
    for (const anime of shows) {
      const next = anime?.nextEpisode;
      if (!anime || !next || (!next.airDate && !next.airTime)) continue;

      const timing = resolveEpisodeTiming(
        next,
        anime.broadcast,
        parseDurationToMinutes(anime.duration),
        now,
      );
      if (!timing) continue;

      entries.push({
        id: `homepage-${anime.id}`,
        anime: {
          id: anime.id,
          // Rebuilt field by field, so anything omitted is lost even though the
          // query returned it -- which is how these cards once linked to
          // /anime/<uuid> while the rest of the page used /anime/<slug>.
          slug: anime.slug,
          titleEn: anime.titleEn,
          titleJp: anime.titleJp,
          description: anime.description ?? null,
          tags: anime.tags ?? [],
          episodeCount: anime.episodeCount ?? null,
          duration: anime.duration,
          startDate: anime.startDate,
          imageUrl: anime.imageUrl,
          userAnime: anime.userAnime ?? null,
        },
        airingInfo: {
          ...anime,
          id: anime.id,
          userAnime: anime.userAnime ?? null,
          timing,
          // A view onto `timing`, so consumers of the old shape read the same
          // resolved value rather than a second opinion.
          airTimeDisplay: { show: true, text: timing.label, variant: timing.variant },
          nextEpisodeDate: timing.airDateTime,
          nextEpisode: { ...next, airDate: timing.airDateTime },
          isInWatchlist: false,
        },
      });
    }

    const justAired = entries
      .filter((entry) => {
        const at = entry.airingInfo.timing.airDateTime.getTime();
        return at <= now.getTime() && at >= now.getTime() - RECENTLY_AIRED_MS;
      })
      .sort(
        (a, b) =>
          b.airingInfo.timing.airDateTime.getTime() - a.airingInfo.timing.airDateTime.getTime(),
      )
      .slice(0, RECENTLY_AIRED_SLOTS);

    const upcoming = entries
      .filter((entry) => entry.airingInfo.timing.airDateTime.getTime() > now.getTime())
      .sort(
        (a, b) =>
          a.airingInfo.timing.airDateTime.getTime() - b.airingInfo.timing.airDateTime.getTime(),
      );

    return [...justAired, ...upcoming];
  });

  get hasAiring(): boolean {
    return this.airingEntries.length > 0;
  }

  /**
   * WATCHING only. Plan to Watch is a list of intentions, not a thing you are
   * waiting on an episode of, and mixing the two turns "what is next for me"
   * into a second seasonal shelf.
   */
  readonly myAiring: AiringEntry[] = $derived.by(() =>
    this.airingEntries.filter(
      // Through `utils/status`, so the legacy spellings normalise the same way
      // they do everywhere else rather than being compared raw here.
      (entry) => normalizeStatus(entry.anime.userAnime?.status) === 'WATCHING',
    ),
  );

  /** The show the hero is pointed at: the rail's pick, else the first entry. */
  readonly bannerEntry: AiringEntry | null = $derived.by(() => {
    const pinned = this.airingEntries.find((entry) => entry.airingInfo.id === this.#pinnedId);
    return pinned ?? this.airingEntries[0] ?? null;
  });

  get bannerAnime(): Record<string, unknown> | null {
    return this.bannerEntry?.airingInfo ?? null;
  }

  get bannerTiming(): EpisodeTiming | null {
    return this.bannerEntry?.airingInfo.timing ?? null;
  }

  get bannerId(): string | null {
    return this.bannerEntry?.airingInfo.id ?? null;
  }

  /** Nothing is airing, so the hero falls back to the best-rated show we have. */
  get fallbackBannerAnime(): HomeAnime | null {
    return this.hasAiring ? null : (this.topRated[0] ?? null);
  }

  select(info: { id?: string | null } | null | undefined): void {
    if (info?.id) this.#pinnedId = info.id;
  }

  /** Nudges the notification worker once there is airing data to work from. */
  refreshNotifications(): void {
    if (this.hasAiring) this.#notifications.triggerImmediateUpdate();
  }

  // ── Per-card reads ────────────────────────────────────────────

  titleFor(anime: Record<string, unknown>): string {
    return getAnimeTitle(anime, this.#prefs.current.titleLanguage);
  }

  imageFor(anime: Record<string, unknown>): string {
    return GetImageFromAnime(anime);
  }

  /**
   * Episode and countdown, because that is what the "airing from your list"
   * shelf is for. The other shelves show episode count and studio, which say
   * nothing about when.
   */
  watchingSub(entry: AiringEntry): string {
    const timing = entry.airingInfo.timing;
    const episode = entry.airingInfo.nextEpisode?.episodeNumber;
    const parts: string[] = [];
    if (episode) parts.push(`EP ${episode}`);
    if (timing.isLive) parts.push('Airing now');
    else if (timing.countdown) parts.push(`in ${timing.countdown}`);
    else if (timing.localTime) parts.push(timing.localTime);
    return parts.join(' · ');
  }

  /**
   * "0 ep · 2026" was shipping on any show whose episode count had not landed,
   * which is a fact the card does not know stated as one it does. The part with
   * no value is dropped rather than printed as a zero.
   */
  posterSub(anime: HomeAnime): string {
    const episodes = Math.max(anime.episodeCount ?? 0, anime.episodes?.length ?? 0);
    const origin = anime.studios?.[0] || getYearUTC(anime.startDate);
    const parts: string[] = [];
    if (episodes > 0) parts.push(`${episodes} ep`);
    if (origin) parts.push(String(origin));
    return parts.join(' · ');
  }

  workSub(work: PublishingWork): string {
    return workSubtitle(work.type, work.publishedFrom);
  }
}
