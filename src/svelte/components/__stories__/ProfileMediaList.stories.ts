import type { Meta, StoryObj } from '@storybook/svelte';
import ProfileMediaList from '../ProfileMediaList.svelte';
import { MediaListBloc } from '../MediaList.bloc.svelte';
import { animeListConfig } from '../ProfileAnimeList.bloc.svelte';
import { workListConfig } from '../ProfileWorkList.bloc.svelte';
import {
  ANIME_COUNTS,
  ANIME_ENTRIES,
  WORK_COUNTS,
  WORK_ENTRIES,
  freshClient,
  fixedViewport,
  noopUrl,
  stubCounts,
  stubList,
  stubTracking,
  urlAt,
  type StubResult,
} from './profileFixtures';
import type { MediaListUrlPort } from '../MediaList.bloc.svelte';

/**
 * The shell both profile lists render. Every story drives it through the same
 * bloc the pages use, with the queries stubbed -- which is the point of the
 * consolidation: one set of states to check rather than two.
 */
function animeBloc(
  result: StubResult,
  total = ANIME_ENTRIES.length,
  url: MediaListUrlPort = noopUrl,
  perPage = 24,
) {
  return new MediaListBloc({
    source: () => ({ ssr: null }),
    config: animeListConfig(() => 'english'),
    list: stubList(result, ANIME_ENTRIES, total, 'animes'),
    counts: stubCounts(ANIME_COUNTS),
    tracking: stubTracking,
    url,
    viewport: fixedViewport(perPage),
    notify: { error: () => {} },
    queryClient: freshClient(),
  });
}

function mangaBloc(result: StubResult, total = WORK_ENTRIES.length) {
  return new MediaListBloc({
    source: () => ({ ssr: null }),
    config: workListConfig(),
    list: stubList(result, WORK_ENTRIES, total, 'works'),
    counts: stubCounts(WORK_COUNTS),
    url: noopUrl,
    viewport: fixedViewport(24),
    notify: { error: () => {} },
    queryClient: freshClient(),
  });
}

const meta = {
  title: 'Profile/ProfileMediaList',
  component: ProfileMediaList,
  tags: ['autodocs'],
} satisfies Meta<typeof ProfileMediaList>;

export default meta;
type Story = StoryObj<typeof meta>;

/** A full shelf of anime: tabs with counts, the poster grid, the pager. */
export const Populated: Story = {
  args: { bloc: animeBloc('ok') },
};

/** The same shell driven by the manga config -- chapters, /manga links, Reading. */
export const MangaMedium: Story = {
  args: { bloc: mangaBloc('ok') },
};

/** Waiting on the first page: a tab row and a wall of card skeletons. */
export const Loading: Story = {
  args: { bloc: animeBloc('never') },
};

/** This shelf is genuinely empty, and the empty state says how to fill it. */
export const Empty: Story = {
  args: { bloc: animeBloc('empty') },
};

/**
 * The fetch failed. A banner with a retry, rather than an empty state claiming
 * the viewer has nothing on this shelf.
 */
export const FetchFailed: Story = {
  args: { bloc: animeBloc('fail') },
};

/** Enough entries for a real pager: page one of nine. */
export const Paginated: Story = {
  args: { bloc: animeBloc('ok', 212) },
};

/**
 * Landed on page five of a long list, the way a shared link does, so both
 * directions of the pager are live.
 */
export const MidPage: Story = {
  args: { bloc: animeBloc('ok', 212, urlAt(null, 5)) },
};

/** The table: poster, title, score, progress and the row's tracking control. */
export const ListView: Story = {
  args: {
    bloc: (() => {
      const bloc = animeBloc('ok');
      bloc.setView('list');
      return bloc;
    })(),
  },
};

/** The manga table, where progress counts chapters rather than episodes. */
export const MangaListView: Story = {
  args: {
    bloc: (() => {
      const bloc = mangaBloc('ok');
      bloc.setView('list');
      return bloc;
    })(),
  },
};

/**
 * A title long enough to break a row. The fixture set carries one, so both the
 * card and the row show what they do with it -- the row ellipsises.
 */
export const LongTitles: Story = {
  args: {
    bloc: (() => {
      const bloc = animeBloc('ok');
      bloc.setView('list');
      return bloc;
    })(),
  },
};
