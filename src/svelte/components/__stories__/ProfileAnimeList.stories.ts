import type { Meta, StoryObj } from '@storybook/svelte';
import ProfileAnimeList from '../ProfileAnimeList.svelte';
import { createAnimeListBloc } from '../ProfileAnimeList.bloc.svelte';
import {
  ANIME_COUNTS,
  ANIME_ENTRIES,
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
 * The watchlist entry point: the shared shell, the anime medium config, and the
 * status dropdown each row carries.
 */
function bloc(result: StubResult, total = ANIME_ENTRIES.length, url: MediaListUrlPort = noopUrl) {
  return createAnimeListBloc(() => ({ ssr: null }), {
    titleLanguage: () => 'english',
    list: stubList(result, ANIME_ENTRIES, total, 'animes'),
    counts: stubCounts(ANIME_COUNTS),
    tracking: stubTracking,
    url,
    viewport: fixedViewport(24),
    notify: { error: () => {} },
    queryClient: freshClient(),
  });
}

const meta = {
  title: 'Composites/Profile/ProfileAnimeList',
  component: ProfileAnimeList,
  tags: ['autodocs'],
} satisfies Meta<typeof ProfileAnimeList>;

export default meta;
type Story = StoryObj<typeof meta>;

/** The watchlist as it usually looks: tabs with counts over a poster grid. */
export const Populated: Story = {
  args: { bloc: bloc('ok') },
};

/** Waiting on the first page. */
export const Loading: Story = {
  args: { bloc: bloc('never') },
};

/** Nothing on this shelf yet, and the way to start filling it. */
export const Empty: Story = {
  args: { bloc: bloc('empty') },
};

/** The list query failed: what happened, and a retry. */
export const FetchFailed: Story = {
  args: { bloc: bloc('fail') },
};

/** Long enough to page, landed midway -- the shape a shared link produces. */
export const Paginated: Story = {
  args: { bloc: bloc('ok', 212, urlAt(null, 5)) },
};

/**
 * The table, where each row carries its own status dropdown -- and a title long
 * enough to prove the row ellipsises rather than reflowing.
 */
export const ListView: Story = {
  args: {
    bloc: (() => {
      const list = bloc('ok');
      list.setView('list');
      return list;
    })(),
  },
};
