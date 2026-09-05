import { createQuery, type QueryClient, type QueryObserverResult } from '@tanstack/svelte-query';
import { fromStore } from 'svelte/store';
import { format } from 'date-fns';
import {
  getUser,
  fetchUserAnimes,
  fetchUserAnimeStatusCounts,
  fetchUserWorkStatusCounts,
  fetchUserWorks,
  fetchCurrentlyAiringWithDatesAndEpisodes,
} from '../../services/queries';
import { GetImageFromAnime } from '../../services/utils';
import { getAirTimeDisplay, findNextEpisode, getCurrentTime, parseAirTime } from '../../services/airTimeUtils';
import { Status, WorkStatus } from '../../gql/graphql';
import { workSubtitle } from '../../utils/workDisplay';
import { configStore } from '../stores/config';
import { preferencesStore, getAnimeTitle, type TitleLanguage } from '../stores/preferences';
import { defaultQueryClient, type MediaListCard } from './MediaList.bloc.svelte';

/*
  The dashboard at /profile: who you are, what your library adds up to, and the
  three shelves built out of it -- what you are watching, what airs this week,
  and what aired lately.

  All six queries are created here rather than in onMount. onMount does not run
  during SSR, so every one of them used to start only after hydration; with
  initialData from the server load they resolve immediately and the markup ships
  filled in. The queryFn stays, so a client-side navigation still fetches.
*/

const WEEK = 7 * 24 * 60 * 60 * 1000;

/** One tile in the stats strip. */
export interface ProfileStat {
  label: string;
  value: number;
  href: string;
  /** The dot and numeral colour. Omitted for the total, which stays neutral. */
  color?: string;
  dotColor?: string;
  /** The total tile, which reads as the current page. */
  active?: boolean;
}

/** A card on one of the three shelves, plus the copy under it. */
export interface ProfileShelfCard extends MediaListCard {
  key: string;
}

/** Every query the dashboard makes, narrowed to option factories. */
export interface ProfileDataPort {
  user(): any;
  watching(): any;
  reading(): any;
  animeCounts(): any;
  workCounts(): any;
  airing(start: Date, end: Date): any;
}

/** The CDN base the banner and avatar are built from. */
export interface ProfileConfigPort {
  cdnUserUrl(): string;
  init(): Promise<void>;
}

export type ProfilePageSource = () => { ssr: any | null };

export interface ProfilePageDeps {
  source?: ProfilePageSource;
  data?: ProfileDataPort;
  config?: ProfileConfigPort;
  titleLanguage?: () => TitleLanguage;
  queryClient?: QueryClient;
}

export const realProfileData: ProfileDataPort = {
  user: () => getUser(),
  // Six, because six cards are rendered. These are the only entries whose
  // episodes are read -- for the next-episode line on each card.
  watching: () => fetchUserAnimes({ input: { status: Status.Watching, limit: 6, page: 1 } }),
  // Twelve, matching the Currently Reading row.
  reading: () => fetchUserWorks({ input: { status: WorkStatus.Reading, limit: 12, page: 1 } }),
  animeCounts: () => fetchUserAnimeStatusCounts(),
  workCounts: () => fetchUserWorkStatusCounts(),
  airing: (start, end) => fetchCurrentlyAiringWithDatesAndEpisodes(start, end),
};

export const realProfileConfig: ProfileConfigPort = {
  cdnUserUrl: () => configStore.get()?.cdn_user_url || 'https://cdn.weeb.vip/weeb-user-staging',
  init: async () => {
    await configStore.init();
  },
};

type QueryView = { readonly current: QueryObserverResult<any, unknown> };

export class ProfilePageBloc {
  readonly queryClient: QueryClient;

  readonly #config: ProfileConfigPort;
  readonly #titleLanguage: () => TitleLanguage;

  readonly #user: QueryView;
  readonly #watching: QueryView;
  readonly #reading: QueryView;
  readonly #animeCounts: QueryView;
  readonly #workCounts: QueryView;
  readonly #airing: QueryView;

  #uploadOpen = $state(false);
  #bannerOpen = $state(false);
  /** Set when the banner image fails, so the gradient behind it stands alone. */
  #bannerFailed = $state(false);

  constructor({
    source = () => ({ ssr: null }),
    data = realProfileData,
    config = realProfileConfig,
    titleLanguage,
    queryClient = defaultQueryClient(),
  }: ProfilePageDeps = {}) {
    this.queryClient = queryClient;
    this.#config = config;

    const preferences = fromStore(preferencesStore);
    this.#titleLanguage = titleLanguage ?? (() => preferences.current.titleLanguage);

    const ssr = source().ssr;
    const airingStart = ssr?.startDate ? new Date(ssr.startDate) : new Date(Date.now() - WEEK);
    const airingEnd = ssr?.endDate ? new Date(ssr.endDate) : new Date(Date.now() + WEEK);

    this.#user = fromStore(
      createQuery({ ...data.user(), initialData: ssr?.user ?? undefined }, queryClient),
    );
    this.#watching = fromStore(
      createQuery({ ...data.watching(), initialData: ssr?.watching ?? undefined }, queryClient),
    );
    this.#reading = fromStore(
      createQuery({ ...data.reading(), initialData: ssr?.reading ?? undefined }, queryClient),
    );
    // Every status in one request each. The lists behind these numbers are not
    // fetched: a dashboard showing "412 completed" has no use for 412 rows, and
    // the rows are expensive -- every entry carries its anime and every episode
    // of it, synopses included.
    this.#animeCounts = fromStore(
      createQuery({ ...data.animeCounts(), initialData: ssr?.animeCounts ?? undefined }, queryClient),
    );
    this.#workCounts = fromStore(
      createQuery({ ...data.workCounts(), initialData: ssr?.workCounts ?? undefined }, queryClient),
    );
    this.#airing = fromStore(
      createQuery(
        {
          ...data.airing(airingStart, airingEnd),
          initialData: ssr?.currentlyAiring ?? undefined,
        },
        queryClient,
      ),
    );
  }

  /** Still needed for the upload widget and the CDN base -- nothing waits on it. */
  async init(): Promise<void> {
    await this.#config.init();
  }

  // ── identity ────────────────────────────────────────────────

  get user(): any {
    return this.#user.current.data ?? null;
  }

  get isUserLoading(): boolean {
    return this.#user.current.isLoading && !this.#user.current.data;
  }

  get username(): string {
    return this.user?.username ?? '';
  }

  get fullName(): string {
    return [this.user?.firstname, this.user?.lastname].filter(Boolean).join(' ').trim();
  }

  /** The hero avatar is shown large, so it uses the full-quality original. */
  get avatarUrl(): string | null {
    const name = this.user?.profileImageUrl;
    return name ? `${this.#config.cdnUserUrl()}/${name}` : null;
  }

  /** Banners are shown at one large size, so always the full-quality original. */
  get bannerUrl(): string | null {
    const name = this.user?.bannerImageUrl;
    if (!name || this.#bannerFailed) return null;
    return `${this.#config.cdnUserUrl()}/${name}`;
  }

  get isUploadOpen(): boolean {
    return this.#uploadOpen;
  }

  get isBannerOpen(): boolean {
    return this.#bannerOpen;
  }

  openUpload(): void {
    this.#uploadOpen = true;
  }

  closeUpload(): void {
    this.#uploadOpen = false;
  }

  openBanner(): void {
    // Re-armed on open: a fresh upload deserves a fresh attempt at loading it.
    this.#bannerFailed = false;
    this.#bannerOpen = true;
  }

  closeBanner(): void {
    this.#bannerOpen = false;
  }

  bannerFailed(): void {
    this.#bannerFailed = true;
  }

  // ── the numbers ─────────────────────────────────────────────

  /*
    Number(), because total is Int64 in the schema and gqlgen marshals that to a
    JSON string to stay clear of JavaScript's 53-bit integer limit. Left as
    strings, the summed TOTAL tile concatenates instead of adding: 6, 53, 294,
    1, 1 rendered as 65329411. Codegen types Int64 as `any`, so nothing catches
    this.
  */
  readonly #counts = $derived.by(() => {
    const data = this.#animeCounts.current.data;
    const watchingRows = this.#watching.current.data?.animes ?? [];
    return {
      watching: Number(data?.watching ?? watchingRows.length),
      planToWatch: Number(data?.planToWatch ?? 0),
      completed: Number(data?.completed ?? 0),
      dropped: Number(data?.dropped ?? 0),
      onHold: Number(data?.onHold ?? 0),
    };
  });

  /** Works without a slug are dropped -- an unlinkable card is worse than a shorter row. */
  readonly #readingWorks = $derived.by(() =>
    (this.#reading.current.data?.works ?? []).filter((entry: any) => entry?.work?.urlSlug),
  );

  get readingTotal(): number {
    return Number(
      this.#workCounts.current.data?.reading ??
        this.#reading.current.data?.total ??
        this.#readingWorks.length,
    );
  }

  get stats(): ProfileStat[] {
    const c = this.#counts;
    const total = c.watching + c.completed + c.planToWatch + c.onHold + c.dropped;
    return [
      { label: 'Total', value: total, href: '/profile/anime', active: true },
      {
        label: 'Watching',
        value: c.watching,
        href: '/profile/anime?status=WATCHING',
        color: 'var(--weeb-green)',
        dotColor: 'var(--weeb-green)',
      },
      {
        label: 'Completed',
        value: c.completed,
        href: '/profile/anime?status=COMPLETED',
        color: 'var(--weeb-accent)',
        dotColor: 'var(--weeb-accent)',
      },
      {
        label: 'Reading',
        value: this.readingTotal,
        href: '/profile/anime?medium=manga&status=READING',
        color: 'var(--weeb-purple, var(--weeb-accent))',
        dotColor: 'var(--weeb-purple, var(--weeb-accent))',
      },
      {
        label: 'Plan to Watch',
        value: c.planToWatch,
        href: '/profile/anime?status=PLANTOWATCH',
        color: 'var(--weeb-fg-secondary)',
        dotColor: 'var(--weeb-fg-muted)',
      },
      {
        label: 'On Hold',
        value: c.onHold,
        href: '/profile/anime?status=ONHOLD',
        color: 'var(--weeb-amber)',
        dotColor: 'var(--weeb-amber)',
      },
      {
        label: 'Dropped',
        value: c.dropped,
        href: '/profile/anime?status=DROPPED',
        color: 'var(--weeb-red)',
        dotColor: 'var(--weeb-red)',
      },
    ];
  }

  // ── the three shelves ───────────────────────────────────────

  get isShelvesLoading(): boolean {
    return this.#watching.current.isLoading || this.#airing.current.isLoading;
  }

  /**
   * The watchlist entries among the shows airing in this window, built from the
   * airing payload rather than from the watchlist.
   *
   * currentlyAiring already carries userAnime per show, so the intersection is a
   * filter over 25 rows rather than a Set built from a thousand -- the same
   * trick the homepage uses for "airing from your list".
   */
  readonly #analysis = $derived.by(() => {
    const airingShows: any[] = this.#airing.current.data?.currentlyAiring ?? [];
    const watching: any[] = this.#watching.current.data?.animes ?? [];

    const airingMap = new Map<string, any>();
    for (const anime of airingShows) if (anime) airingMap.set(anime.id, anime);

    // Watching and plan-to-watch only: a completed or dropped show airing this
    // week is not something the dashboard was ever surfacing.
    const ON_LIST = new Set(['WATCHING', 'PLANTOWATCH']);
    const onList = airingShows
      .filter((anime: any) => anime?.userAnime && ON_LIST.has(String(anime.userAnime.status).toUpperCase()))
      .map((anime: any) => ({ ...anime.userAnime, anime }));

    const airingSoon: any[] = [];
    const recentlyAired: any[] = [];
    const now = getCurrentTime();
    const sevenDaysFromNow = new Date(now.getTime() + WEEK);
    const twoWeeksAgo = new Date(now.getTime() - 2 * WEEK);
    const onListIds = new Set(onList.map((entry: any) => entry.anime?.id).filter(Boolean));

    for (const airingInfo of airingShows) {
      if (!airingInfo?.episodes?.length) continue;
      if (!onListIds.has(airingInfo.id)) continue;

      const next = findNextEpisode(airingInfo.episodes, airingInfo.broadcast, now);
      if (!next) continue;
      const { episode: nextEpisode, airTime } = next;

      // Only within the next seven days, or freshly aired.
      const durationMs = airingInfo.duration ? parseInt(airingInfo.duration) * 60 * 1000 : 30 * 60 * 1000;
      const justAired = new Date(now.getTime() - durationMs);
      if (airTime > sevenDaysFromNow || airTime < justAired) continue;

      const airTimeInfo = getAirTimeDisplay(nextEpisode.airDate, airingInfo.broadcast) || {
        show: true,
        text:
          airTime <= now
            ? 'Recently aired'
            : `${format(airTime, 'EEE')} at ${format(airTime, 'h:mm a')}`,
        variant: airTime <= now ? 'aired' : 'scheduled',
      };

      const entry = onList.find((candidate: any) => candidate.anime?.id === airingInfo.id);
      const enhanced = {
        ...entry,
        airingInfo: {
          ...airingInfo,
          airTimeDisplay: airTimeInfo,
          nextEpisodeDate: airTime,
          nextEpisode: { ...nextEpisode, airDate: airTime },
          isInWatchlist: true,
        },
      };

      if (airTime <= now) recentlyAired.push(enhanced);
      else airingSoon.push(enhanced);
    }

    // Cross-reference the list with the airing shows for recently aired episodes.
    for (const entry of onList) {
      const anime = entry.anime;
      const airingInfo = anime ? airingMap.get(anime.id) : undefined;
      if (!airingInfo?.episodes?.length) continue;

      const recent = airingInfo.episodes
        .filter((ep: any) => ep.airDate)
        .map((ep: any) => {
          // parseAirTime, for the timezone conversion.
          const parsed = parseAirTime(ep.airDate, airingInfo.broadcast);
          return parsed ? { ...ep, airDate: parsed } : null;
        })
        .filter((ep: any) => ep !== null)
        .filter((ep: any) => {
          const at = ep.airDate.getTime();
          return at < now.getTime() && at >= twoWeeksAgo.getTime();
        })
        .sort((a: any, b: any) => b.airDate.getTime() - a.airDate.getTime());

      if (recent.length === 0) continue;
      const mostRecent = recent[0];

      // Compared by date parts, to avoid timezone issues.
      const airDate = mostRecent.airDate;
      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const yesterday = new Date(today.getTime() - 24 * 60 * 60 * 1000);
      const episodeDate = new Date(airDate.getFullYear(), airDate.getMonth(), airDate.getDate());
      const daysDiff = Math.floor((today.getTime() - episodeDate.getTime()) / (1000 * 60 * 60 * 24));

      const since =
        episodeDate.getTime() === today.getTime()
          ? 'Today'
          : episodeDate.getTime() === yesterday.getTime()
            ? 'Yesterday'
            : `${daysDiff} days ago`;

      recentlyAired.push({
        ...entry,
        airingInfo: {
          ...airingInfo,
          airTimeDisplay: {
            show: true,
            text: `Aired ${since} (${format(airDate, 'EEE')} at ${format(airDate, 'h:mm a')})`,
            variant: 'aired',
          },
          recentEpisode: mostRecent,
          nextEpisode: mostRecent,
          nextEpisodeDate: airDate,
          daysSinceAired: daysDiff,
        },
      });
    }

    // Soonest first.
    airingSoon.sort(
      (a, b) =>
        (a.airingInfo?.nextEpisodeDate ?? new Date()).getTime() -
        (b.airingInfo?.nextEpisodeDate ?? new Date()).getTime(),
    );
    // Most recent first, by actual air time.
    recentlyAired.sort((a, b) => {
      const at = (entry: any) => {
        const ep = entry.airingInfo?.recentEpisode;
        const broadcast = entry.airingInfo?.broadcast;
        return ep?.airDate && broadcast ? parseAirTime(ep.airDate, broadcast)?.getTime() || 0 : 0;
      };
      return at(b) - at(a);
    });

    return {
      airingSoon: airingSoon.slice(0, 12),
      recentlyAired: recentlyAired.slice(0, 6),
      currentlyWatching: watching.slice(0, 6),
    };
  });

  #animeCard(entry: any, key: string): ProfileShelfCard {
    const anime = entry?.anime ?? entry?.airingInfo;
    const rating = anime?.rating;
    return {
      key,
      id: anime?.id ?? '',
      slug: anime?.slug,
      title: getAnimeTitle(anime, this.#titleLanguage()),
      image: GetImageFromAnime(anime),
      score: rating && rating !== 'N/A' ? parseFloat(rating) : null,
      status: anime?.status ?? null,
      sub: anime?.episodeCount ? `${anime.episodeCount} episodes` : '',
      genres: anime?.tags ?? entry?.airingInfo?.tags ?? [],
      description: anime?.description ?? '',
      episodeCount: anime?.episodeCount,
      onList: entry?.status ?? 'watching',
    };
  }

  get currentlyWatching(): ProfileShelfCard[] {
    return this.#analysis.currentlyWatching.map((entry: any, i: number) =>
      this.#animeCard(entry, String(entry?.id ?? entry?.anime?.id ?? i)),
    );
  }

  get airingSoon(): ProfileShelfCard[] {
    return this.#analysis.airingSoon.map((entry: any, i: number) =>
      this.#animeCard(entry, String(entry?.anime?.id ?? entry?.airingInfo?.id ?? i)),
    );
  }

  get recentlyAired(): ProfileShelfCard[] {
    return this.#analysis.recentlyAired.map((entry: any, i: number) =>
      this.#animeCard(entry, String(entry?.anime?.id ?? entry?.airingInfo?.id ?? i)),
    );
  }

  get readingCards(): ProfileShelfCard[] {
    return this.#readingWorks.slice(0, 12).map((entry: any) => {
      const work = entry.work;
      return {
        key: String(entry.id),
        id: work?.id ?? '',
        title: work?.titleEn || work?.titleJp || 'Untitled',
        image: work?.id ?? '',
        imagePath: 'works',
        score: work?.score ?? null,
        sub: workSubtitle(work?.type, work?.publishedFrom),
        href: work?.urlSlug ? `/manga/${work.urlSlug}` : '/search',
        onList: entry.status ?? null,
      };
    });
  }

  get hasReading(): boolean {
    return this.#readingWorks.length > 0;
  }

  /** Nothing on any shelf: the one hero empty state the page can show. */
  get isLibraryEmpty(): boolean {
    return (
      this.#analysis.airingSoon.length === 0 &&
      this.#analysis.recentlyAired.length === 0 &&
      this.#analysis.currentlyWatching.length === 0
    );
  }
}
