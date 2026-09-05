import { fromStore } from 'svelte/store';
import { Status, type UserAnimesInput } from '../../gql/graphql';
import { GetImageFromAnime, animeHref } from '../../services/utils';
import {
  fetchUserAnimes,
  fetchUserAnimeStatusCounts,
  upsertAnime,
  deleteAnime,
} from '../../services/queries';
import { preferencesStore, getAnimeTitle, type TitleLanguage } from '../stores/preferences';
import { getStatusColor, getStatusLabel } from '../utils/status';
import {
  MediaListBloc,
  type MediaListCountsPort,
  type MediaListDeps,
  type MediaListMediumConfig,
  type MediaListQueryPort,
  type MediaListRow,
  type MediaListSource,
  type MediaListTrackingPort,
} from './MediaList.bloc.svelte';

/**
 * The anime half of the shared list: the watchlist's status vocabulary, its
 * episode progress, its cards and its writes. Everything else -- tabs, paging,
 * view mode, the shell -- is MediaListBloc.
 */

/** Which title a row shows. A function so the toggle keeps working live. */
export type TitleLanguagePort = () => TitleLanguage;

const preferences = fromStore(preferencesStore);

const realTitleLanguage: TitleLanguagePort = () => preferences.current.titleLanguage;

/**
 * The list's own writes. WorkStatusControl owns the reading list's, which is
 * why only this medium hands the bloc a tracking port.
 */
export const realAnimeTracking: MediaListTrackingPort = {
  setStatus: (animeId, status) => upsertAnime().mutationFn({ input: { animeID: animeId, status: status as Status } }),
  remove: (animeId) => deleteAnime().mutationFn(animeId),
};

/** Plan to Watch first: it is the shelf a viewer comes here to work through. */
const STATUSES: string[] = [
  Status.Completed,
  Status.Dropped,
  Status.Onhold,
  Status.Plantowatch,
  Status.Watching,
];

export function animeListConfig(
  titleLanguage: TitleLanguagePort = realTitleLanguage,
): MediaListMediumConfig {
  return {
    medium: 'anime',
    statuses: STATUSES,
    defaultStatus: Status.Plantowatch,
    // The canonical label and colour maps, rather than a fourth private copy of
    // them -- these are the same words and colours the cards and the dropdown use.
    statusLabel: getStatusLabel,
    statusColor: getStatusColor,
    counts: (data) => ({
      [Status.Watching]: Number(data?.watching ?? 0),
      [Status.Plantowatch]: Number(data?.planToWatch ?? 0),
      [Status.Completed]: Number(data?.completed ?? 0),
      [Status.Onhold]: Number(data?.onHold ?? 0),
      [Status.Dropped]: Number(data?.dropped ?? 0),
    }),
    entries: (data) => data?.animes ?? [],
    total: (data) => Number(data?.total ?? 0),
    row: (entry): MediaListRow => {
      const anime = entry?.anime;
      const title = getAnimeTitle(anime, titleLanguage());
      const rating = anime?.rating;
      const score = rating && rating !== 'N/A' ? parseFloat(rating) : null;
      return {
        key: String(entry?.id ?? anime?.id ?? title),
        href: animeHref(anime),
        title,
        // The id, which is the CDN object key. The row used to put this
        // straight into an <img src>, where it resolved as a relative path and
        // rendered nothing.
        image: GetImageFromAnime(anime),
        imagePath: 'posters',
        score: score != null && Number.isFinite(score) ? score : null,
        typeBadge: anime?.type ?? '',
        status: entry?.status ?? null,
        progress: {
          current: entry?.watchedEpisodes ?? 0,
          total: anime?.episodeCount ?? null,
          unit: 'ep',
        },
        card: {
          id: anime?.id ?? '',
          slug: anime?.slug,
          title,
          image: GetImageFromAnime(anime),
          score,
          status: anime?.status ?? null,
          sub: anime?.episodeCount ? `${anime.episodeCount} episodes` : '',
          genres: anime?.tags ?? [],
          description: anime?.description ?? '',
          episodeCount: anime?.episodeCount,
          onList: entry?.status ?? null,
        },
        entry,
      };
    },
    empty: {
      heading: (label) => `No anime in ${label.toLowerCase()}`,
      message: 'Start building your list by browsing anime and adding them to your watchlist.',
      actionLabel: 'Browse Anime',
      actionHref: '/',
    },
    tabsLabel: 'Watchlist status',
    errorMessage: "Couldn't load your watchlist.",
    invalidateKeys: [['user-animes'], ['user-anime-status-counts']],
    ssrList: (ssr) => (ssr?.medium === 'anime' ? ssr?.animeList ?? null : null),
    ssrCounts: (ssr) => ssr?.animeCounts ?? null,
  };
}

/** The bloc ProfileAnimeList constructs by default. */
export function createAnimeListBloc(
  source: MediaListSource,
  overrides: Partial<Omit<MediaListDeps, 'source' | 'config'>> & {
    titleLanguage?: TitleLanguagePort;
  } = {},
): MediaListBloc {
  const { titleLanguage, ...deps } = overrides;
  return new MediaListBloc({
    source,
    config: animeListConfig(titleLanguage),
    list: ((input) => fetchUserAnimes({ input: input as UserAnimesInput })) as MediaListQueryPort,
    counts: fetchUserAnimeStatusCounts as MediaListCountsPort,
    tracking: realAnimeTracking,
    ...deps,
  });
}
