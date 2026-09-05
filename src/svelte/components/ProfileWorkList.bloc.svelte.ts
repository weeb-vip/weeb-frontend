import { WorkStatus, type UserWorksInput } from '../../gql/graphql';
import { fetchUserWorks, fetchUserWorkStatusCounts } from '../../services/queries';
import { workSubtitle } from '../../utils/workDisplay';
import { getStatusColor } from '../utils/status';
import {
  MediaListBloc,
  type MediaListCountsPort,
  type MediaListDeps,
  type MediaListMediumConfig,
  type MediaListQueryPort,
  type MediaListRow,
  type MediaListSource,
} from './MediaList.bloc.svelte';

/**
 * The manga half of the shared list: the reading vocabulary, chapter progress,
 * /manga hrefs and work covers. No tracking port -- WorkStatusControl, which
 * the row renders, owns its own writes and invalidates this list itself.
 */

/** Reading first: what a reader is in the middle of is the shelf they check. */
const STATUSES: string[] = [
  WorkStatus.Completed,
  WorkStatus.Dropped,
  WorkStatus.Onhold,
  WorkStatus.Plantoread,
  WorkStatus.Reading,
];

const LABELS: Record<string, string> = {
  [WorkStatus.Completed]: 'Completed',
  [WorkStatus.Dropped]: 'Dropped',
  [WorkStatus.Onhold]: 'On Hold',
  [WorkStatus.Plantoread]: 'Plan to Read',
  [WorkStatus.Reading]: 'Reading',
};

/**
 * Reading is to a work what watching is to a show, so the colours come from the
 * one status map through this equivalence rather than from a second copy of it.
 */
const AS_ANIME_STATUS: Record<string, string> = {
  [WorkStatus.Reading]: 'WATCHING',
  [WorkStatus.Plantoread]: 'PLANTOWATCH',
  [WorkStatus.Completed]: 'COMPLETED',
  [WorkStatus.Onhold]: 'ONHOLD',
  [WorkStatus.Dropped]: 'DROPPED',
};

export function workHref(work: any): string {
  return work?.urlSlug ? `/manga/${work.urlSlug}` : '/search';
}

export function workListConfig(): MediaListMediumConfig {
  return {
    medium: 'manga',
    statuses: STATUSES,
    defaultStatus: WorkStatus.Reading,
    statusLabel: (status) => (status ? LABELS[status] ?? status : ''),
    statusColor: (status) => getStatusColor(status ? AS_ANIME_STATUS[status] ?? null : null),
    counts: (data) => ({
      [WorkStatus.Reading]: Number(data?.reading ?? 0),
      [WorkStatus.Plantoread]: Number(data?.planToRead ?? 0),
      [WorkStatus.Completed]: Number(data?.completed ?? 0),
      [WorkStatus.Onhold]: Number(data?.onHold ?? 0),
      [WorkStatus.Dropped]: Number(data?.dropped ?? 0),
    }),
    entries: (data) => data?.works ?? [],
    total: (data) => Number(data?.total ?? 0),
    row: (entry): MediaListRow => {
      const work = entry?.work;
      const title = work?.titleEn || work?.titleJp || 'Untitled';
      const score = work?.score ?? null;
      const href = workHref(work);
      return {
        key: String(entry?.id ?? work?.id ?? title),
        href,
        title,
        image: work?.id ?? '',
        imagePath: 'works',
        score,
        typeBadge: workSubtitle(work?.type, work?.publishedFrom),
        status: entry?.status ?? null,
        progress: {
          current: entry?.chapters ?? 0,
          total: work?.chapters ?? null,
          unit: 'ch',
        },
        card: {
          id: work?.id ?? '',
          title,
          image: work?.id ?? '',
          imagePath: 'works',
          score,
          sub: workSubtitle(work?.type, work?.publishedFrom),
          href,
          onList: entry?.status ?? null,
        },
        entry,
      };
    },
    empty: {
      heading: (label) => `No manga in ${label.toLowerCase()}`,
      message: 'Start building your reading list by browsing manga and adding them to your shelf.',
      actionLabel: 'Browse Manga',
      actionHref: '/search',
    },
    tabsLabel: 'Reading list status',
    errorMessage: "Couldn't load your reading list.",
    invalidateKeys: [['user-works'], ['user-work-status-counts']],
    ssrList: (ssr) => (ssr?.medium === 'manga' ? ssr?.workList ?? null : null),
    ssrCounts: (ssr) => ssr?.workCounts ?? null,
  };
}

/** The bloc ProfileWorkList constructs by default. */
export function createWorkListBloc(
  source: MediaListSource,
  overrides: Partial<Omit<MediaListDeps, 'source' | 'config'>> = {},
): MediaListBloc {
  return new MediaListBloc({
    source,
    config: workListConfig(),
    list: ((input) => fetchUserWorks({ input: input as UserWorksInput })) as MediaListQueryPort,
    counts: fetchUserWorkStatusCounts as MediaListCountsPort,
    ...overrides,
  });
}
