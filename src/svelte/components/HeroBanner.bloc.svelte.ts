import { fromStore, type Readable } from 'svelte/store';
import { getSafeImageUrl } from '../utils/image';
import type { EpisodeTiming } from '../../services/airTimeUtils';
import { configStore } from '../stores/config';
import { animeNotificationStore } from '../stores/animeNotifications';
import { getAnimeTitle, preferencesStore, type TitleLanguage } from '../stores/preferences';
import { loggedInStore } from '../stores/auth';

/** Config only has to exist before the CDN URLs are built; nothing reads it here. */
export interface ConfigPort {
  init: () => Promise<unknown>;
}

/** The worker-fed timings, as the two maps this reads. */
export interface NotificationsPort
  extends Readable<{
    timingData: Record<string, any>;
    countdowns: Record<string, any>;
  }> {}

export interface PreferencesPort extends Readable<{ titleLanguage: TitleLanguage }> {}

export interface AuthPort extends Readable<{ isLoggedIn: boolean; isAuthInitialized: boolean }> {}

/** `getSafeImageUrl`: an anime id plus a CDN folder becomes a URL. */
export type ImageUrlPort = (id: string, path?: string) => string;

/** Decodes a 2px WebP and reports whether the browser managed it. */
export type WebPProbePort = () => Promise<boolean>;

export interface MediaQueryPort {
  matches: (query: string) => boolean;
  onChange: (query: string, listener: (matches: boolean) => void) => () => void;
}

export const browserMediaQuery: MediaQueryPort = {
  matches: (query) => (typeof window === 'undefined' ? false : window.matchMedia(query).matches),
  onChange: (query, listener) => {
    if (typeof window === 'undefined') return () => {};
    const list = window.matchMedia(query);
    const handler = (event: MediaQueryListEvent) => listener(event.matches);
    list.addEventListener('change', handler);
    return () => list.removeEventListener('change', handler);
  }
};

export const browserWebPProbe: WebPProbePort = () =>
  new Promise((resolve) => {
    if (typeof Image === 'undefined') return resolve(false);
    const webP = new Image();
    webP.onload = webP.onerror = () => resolve(webP.height === 2);
    webP.src =
      'data:image/webp;base64,UklGRjoAAABXRUJQVlA4IC4AAACyAgCdASoCAAIALmk0mk0iIiIiIgBoSygABc6WWgAA/veff/0PP8bA//LwYAAA';
  });

/**
 * TheTVDB banner art is roughly 16:9 and the hero is a 100svh box, so on a
 * phone the only way to cover that shape is to crop the banner to a narrow
 * vertical strip of itself -- usually a piece of background with the subject
 * outside the frame. A poster is 2:3 and fills a tall viewport natively. From
 * a tablet up the hero is wide enough for the banner to read as composed, so
 * it keeps priority there.
 */
const PHONE_QUERY = '(max-width: 767px)';

/**
 * "Airing Soon" was attached to anything neither airing nor already aired, so
 * it shipped over an episode nineteen hours away. Soon has to mean soon; past
 * a few hours the honest label is just what the thing is.
 */
const SOON_MS = 6 * 60 * 60 * 1000;

/** The props the view feeds in. Getters, so the bloc reads them live. */
export interface HeroBannerInputs {
  readonly anime: any;
  /**
   * The episode timing resolved once in HomepageSSR.processCurrentlyAiring.
   * Null on the fallback banner (top-rated), which has no schedule at all.
   */
  readonly timing: EpisodeTiming | null;
}

export interface HeroBannerDeps {
  config?: ConfigPort;
  notifications?: NotificationsPort;
  preferences?: PreferencesPort;
  auth?: AuthPort;
  imageUrl?: ImageUrlPort;
  webPProbe?: WebPProbePort;
  mediaQuery?: MediaQueryPort;
}

/**
 * Everything the hero knows that is not markup: which artwork to try and in
 * what order, what the schedule badge should say, whether the sign-up line is
 * owed, and the state of the broadcast-slot popover.
 *
 * Five singletons hang off this component -- config, the notification worker's
 * timings, preferences, auth -- plus two browser probes. Each arrives as a
 * port, which is what lets a story render a live banner with no worker, no
 * network and no `window.matchMedia`.
 */
export class HeroBannerBloc {
  readonly #inputs: HeroBannerInputs;
  readonly #config: ConfigPort;
  readonly #imageUrl: ImageUrlPort;
  readonly #webPProbe: WebPProbePort;
  readonly #mediaQuery: MediaQueryPort;
  readonly #notifications: { current: { timingData: Record<string, any>; countdowns: Record<string, any> } };
  readonly #prefs: { current: { titleLanguage: TitleLanguage } };
  readonly #auth: { current: { isLoggedIn: boolean; isAuthInitialized: boolean } };

  #isPhone = $state(false);
  #supportsWebP = $state(false);
  /** Which anime's artwork has actually painted, so a retarget re-fades. */
  #loadedAnimeId = $state<string | null>(null);
  #showJstPopover = $state(false);

  constructor(inputs: HeroBannerInputs, deps: HeroBannerDeps = {}) {
    this.#inputs = inputs;
    this.#config = deps.config ?? configStore;
    this.#imageUrl = deps.imageUrl ?? getSafeImageUrl;
    this.#webPProbe = deps.webPProbe ?? browserWebPProbe;
    this.#mediaQuery = deps.mediaQuery ?? browserMediaQuery;
    this.#notifications = fromStore(deps.notifications ?? (animeNotificationStore as NotificationsPort));
    this.#prefs = fromStore(deps.preferences ?? preferencesStore);
    this.#auth = fromStore(deps.auth ?? loggedInStore);
    this.#isPhone = this.#mediaQuery.matches(PHONE_QUERY);
  }

  /**
   * Loads config and probes WebP, and keeps the phone breakpoint current.
   * Returns the teardown, so a rotate or a resize keeps re-picking the art
   * without leaking the listener the way two separate onMounts used to.
   */
  init(): () => void {
    void this.#config.init();
    void this.#webPProbe().then((supported) => (this.#supportsWebP = supported));
    this.#isPhone = this.#mediaQuery.matches(PHONE_QUERY);
    return this.#mediaQuery.onChange(PHONE_QUERY, (matches) => (this.#isPhone = matches));
  }

  get anime(): any {
    return this.#inputs.anime;
  }

  get timing(): EpisodeTiming | null {
    return this.#inputs.timing;
  }

  get isPhone(): boolean {
    return this.#isPhone;
  }

  /**
   * Reported for completeness; the source list does not branch on it, because
   * the CDN negotiates the format itself.
   */
  get supportsWebP(): boolean {
    return this.#supportsWebP;
  }

  /**
   * Ordered artwork candidates. Both are keyed by anime id: banners/<id> for
   * the tvdb artwork synced by thetvdb-enrichment, <id> at the root for the
   * poster. Built through the image-url port so they follow config.cdn_url --
   * hardcoding the host meant local and staging read production artwork, which
   * hid the fact that staging had no banners of its own.
   */
  get imageSources(): string[] {
    const id = this.#inputs.anime?.id;
    if (!id) return [];

    // TheTVDB's 680x1000 series poster, synced by thetvdb-enrichment.
    const tvdbPoster = this.#imageUrl(id, 'posters');
    // TheTVDB's wide background artwork.
    const banner = this.#imageUrl(id, 'banners');
    // The scraper's MyAnimeList image at the bucket root -- 225px wide, so it
    // is the last resort at hero scale rather than a peer of the other two.
    const malImage = this.#imageUrl(id);

    return this.#isPhone
      ? // Tall box: prefer tall art, and prefer the high-resolution one.
        [tvdbPoster, malImage, banner]
      : // Wide box: the banner is composed for this shape. A poster cropped to
        // a wide frame still beats a 225px image blown up to fill it.
        [banner, tvdbPoster, malImage];
  }

  /** A phone never needs 1600px of hero art. */
  get heroCdnWidth(): number {
    return this.#isPhone ? 800 : 1600;
  }

  /** False again the moment the banner retargets, so the new art fades in too. */
  get bgLoaded(): boolean {
    return this.#loadedAnimeId !== null && this.#loadedAnimeId === this.#inputs.anime?.id;
  }

  imageChosen(): void {
    this.#loadedAnimeId = this.#inputs.anime?.id ?? null;
  }

  get title(): string {
    return getAnimeTitle(this.#inputs.anime, this.#prefs.current.titleLanguage);
  }

  /**
   * Show titles range from "Chiikawa" to "The Exiled Heavy Knight Knows How to
   * Game the System". At one fixed Display size the long ones run to three lines
   * and shove the panel's top edge up by ~150px, which is visible as a jump when
   * the rail retargets the banner. Stepping the size by length keeps the panel
   * roughly one height.
   */
  get titleTier(): 'short' | 'mid' | 'long' {
    const length = this.title.length;
    return length > 40 ? 'long' : length > 18 ? 'mid' : 'short';
  }

  get description(): string {
    return this.#inputs.anime?.description ?? '';
  }

  /** Only while signed out, and only once auth has resolved. */
  get showSignUpLine(): boolean {
    const auth = this.#auth.current;
    return auth.isAuthInitialized && !auth.isLoggedIn;
  }

  get showJstPopover(): boolean {
    return this.#showJstPopover;
  }

  toggleJstPopover(): void {
    this.#showJstPopover = !this.#showJstPopover;
  }

  // ── Schedule ────────────────────────────────────────────────

  get #timingData(): any {
    return this.#notifications.current.timingData[this.#inputs.anime?.id];
  }

  get #workerCountdown(): any {
    return this.#notifications.current.countdowns[this.#inputs.anime?.id];
  }

  get #hasWorkerTiming(): boolean {
    return Boolean(this.#timingData || this.#workerCountdown);
  }

  /** There is something to say about when this airs. */
  get hasSchedule(): boolean {
    return Boolean(this.#inputs.timing) || this.#hasWorkerTiming;
  }

  /**
   * Display values come from the resolved timing when there is one. The worker
   * store is kept only for `progress`, which nothing else computes; using it for
   * the countdown too is what put "18H" in the badge while the rail beside it
   * read "Airing in 19h" for the same episode.
   */
  get liveNow(): boolean {
    if (this.#inputs.timing) return this.#inputs.timing.isLive;
    return this.#timingData?.isCurrentlyAiring || this.#workerCountdown?.isAiring || false;
  }

  get airedAlready(): boolean {
    if (this.#inputs.timing) return this.#inputs.timing.hasAired;
    return this.#timingData?.hasAlreadyAired || this.#workerCountdown?.hasAired || false;
  }

  get badgeCountdown(): string {
    if (this.#inputs.timing) return this.#inputs.timing.countdown;
    return this.#timingData?.countdown || this.#workerCountdown?.countdown || '';
  }

  /** Drives the badge's fill; only the worker computes it. */
  get progress(): number | undefined {
    return this.#timingData?.progress ?? this.#workerCountdown?.progress;
  }

  get episodeNumber(): string {
    const episode = this.#timingData?.episode;
    return episode?.episodeNumber ? `${episode.episodeNumber}` : '';
  }

  get upcomingLabel(): string {
    const timing = this.#inputs.timing;
    return timing && timing.airDateTime.getTime() - Date.now() <= SOON_MS
      ? 'Airing Soon'
      : 'Next Episode';
  }

  /** The countdown is worth printing beside "Next Episode". */
  get showUpcomingCountdown(): boolean {
    const countdown = this.badgeCountdown;
    return Boolean(countdown) && countdown !== 'AIRING NOW' && !countdown.includes('JUST');
  }
}
