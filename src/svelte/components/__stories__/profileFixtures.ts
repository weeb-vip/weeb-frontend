/**
 * Fixtures and stubbed ports for the profile stories.
 *
 * Not a story file: it exports helpers, and Storybook treats every export of a
 * `*.stories.ts` as a story.
 */

import { createQueryClient } from '../../services/query-client';
import { Status, WorkStatus } from '../../../gql/graphql';
import type {
  MediaListCountsPort,
  MediaListQueryPort,
  MediaListTrackingPort,
  MediaListUrlPort,
  ViewportPort,
} from '../MediaList.bloc.svelte';

/** How a stubbed query answers. */
export type StubResult = 'ok' | 'empty' | 'never' | 'fail';

export const LONG_TITLE =
  'The Unbelievably Long Light Novel Title That Explains Its Entire Premise Before The Colon: And Then Keeps Going Season 2';

export function animeEntry(
  id: string,
  title: string,
  overrides: Record<string, any> = {},
): any {
  return {
    id: `ua-${id}`,
    status: Status.Watching,
    watchedEpisodes: 7,
    anime: {
      id,
      slug: `${id}-slug`,
      titleEn: title,
      titleJp: `${title} (JP)`,
      rating: '8.42',
      episodeCount: 12,
      type: 'TV',
      tags: ['Action', 'Fantasy'],
      description: 'A show about something.',
      status: 'FINISHED',
      ...(overrides.anime ?? {}),
    },
    ...overrides,
  };
}

export function workEntry(id: string, title: string, overrides: Record<string, any> = {}): any {
  return {
    id: `uw-${id}`,
    workID: id,
    status: WorkStatus.Reading,
    chapters: 42,
    work: {
      id,
      titleEn: title,
      titleJp: `${title} (JP)`,
      score: 8.1,
      chapters: 120,
      type: 'MANGA',
      publishedFrom: '2016-04-01T00:00:00Z',
      urlSlug: `${id}-slug`,
      ...(overrides.work ?? {}),
    },
    ...overrides,
  };
}

export const ANIME_ENTRIES: any[] = [
  animeEntry('frieren', 'Frieren: Beyond Journey\'s End'),
  animeEntry('mob', 'Mob Psycho 100', { watchedEpisodes: 12 }),
  animeEntry('bebop', 'Cowboy Bebop', { status: Status.Completed, watchedEpisodes: 26 }),
  animeEntry('longtitle', LONG_TITLE, { watchedEpisodes: 1 }),
  animeEntry('noscore', 'A Show With No Rating', { anime: { rating: 'N/A', episodeCount: 0 } }),
  animeEntry('onhold', 'Paused Halfway', { status: Status.Onhold, watchedEpisodes: 3 }),
];

export const WORK_ENTRIES: any[] = [
  workEntry('vinland', 'Vinland Saga'),
  workEntry('berserk', 'Berserk', { chapters: 364 }),
  workEntry('long', LONG_TITLE, { chapters: 2 }),
  workEntry('done', 'Finished Series', { status: WorkStatus.Completed, chapters: 120 }),
  workEntry('noscore', 'Unrated Work', { work: { score: null, chapters: null } }),
];

export const ANIME_COUNTS = {
  watching: 6,
  planToWatch: 128,
  completed: 294,
  onHold: 3,
  dropped: 11,
};

export const WORK_COUNTS = {
  reading: 5,
  planToRead: 22,
  completed: 61,
  onHold: 1,
  dropped: 4,
};

/** A list port that answers the way the story needs it to, and never fetches. */
export function stubList(
  result: StubResult,
  entries: any[],
  total: number,
  key: 'animes' | 'works',
): MediaListQueryPort {
  return (input) => ({
    queryKey: ['stub-list', key, result, input.status, input.page, input.limit],
    queryFn: async () => {
      if (result === 'never') return new Promise(() => {});
      if (result === 'fail') throw new Error('list-service returned 503');
      if (result === 'empty') return { [key]: [], total: 0 };
      return { [key]: entries, total };
    },
  });
}

export function stubCounts(counts: Record<string, number>): MediaListCountsPort {
  return () => ({
    queryKey: ['stub-counts', JSON.stringify(counts)],
    queryFn: async () => counts,
  });
}

/** Storybook must not push history entries, so the URL port does nothing. */
export const noopUrl: MediaListUrlPort = {
  read: () => ({ status: null, page: null }),
  write: () => {},
  onChange: () => () => {},
};

/** A URL the story pretends to have landed on -- 1-based page, as in the address. */
export function urlAt(status: string | null, page: number | null): MediaListUrlPort {
  return {
    read: () => ({ status, page: page ? String(page) : null }),
    write: () => {},
    onChange: () => () => {},
  };
}

export function fixedViewport(perPage = 24): ViewportPort {
  return { defaultPageSize: () => perPage };
}

/** Writes that resolve without a network, so the row controls are live. */
export const stubTracking: MediaListTrackingPort = {
  setStatus: async () => {},
  remove: async () => {},
};

/** Each story gets its own client, so a loading story is not served a cache. */
export const freshClient = () => createQueryClient();
