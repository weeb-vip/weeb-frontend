import type { Meta, StoryObj } from '@storybook/svelte';
import ProfileWorkList from '../ProfileWorkList.svelte';
import { createWorkListBloc } from '../ProfileWorkList.bloc.svelte';
import {
  WORK_COUNTS,
  WORK_ENTRIES,
  freshClient,
  fixedViewport,
  noopUrl,
  stubCounts,
  stubList,
  urlAt,
  type StubResult,
} from './profileFixtures';
import type { MediaListUrlPort } from '../MediaList.bloc.svelte';

/**
 * The reading list entry point: the same shell as the watchlist, with the manga
 * medium config -- Reading tabs, chapter progress, /manga links.
 */
function bloc(result: StubResult, total = WORK_ENTRIES.length, url: MediaListUrlPort = noopUrl) {
  return createWorkListBloc(() => ({ ssr: null }), {
    list: stubList(result, WORK_ENTRIES, total, 'works'),
    counts: stubCounts(WORK_COUNTS),
    url,
    viewport: fixedViewport(24),
    notify: { error: () => {} },
    queryClient: freshClient(),
  });
}

const meta = {
  title: 'Profile/ProfileWorkList',
  component: ProfileWorkList,
  tags: ['autodocs'],
} satisfies Meta<typeof ProfileWorkList>;

export default meta;
type Story = StoryObj<typeof meta>;

/** The reading list: the watchlist's shell, one medium over. */
export const Populated: Story = {
  args: { bloc: bloc('ok') },
};

/** Waiting on the first page. */
export const Loading: Story = {
  args: { bloc: bloc('never') },
};

/** Nothing on this shelf, pointing at the manga browser. */
export const Empty: Story = {
  args: { bloc: bloc('empty') },
};

/** The list query failed: what happened, and a retry. */
export const FetchFailed: Story = {
  args: { bloc: bloc('fail') },
};

/** A long shelf, landed on page three. */
export const Paginated: Story = {
  args: { bloc: bloc('ok', 148, urlAt(null, 3)) },
};

/**
 * The table: chapters rather than episodes, and the reading-status select at
 * the end of each row. One fixture title is long enough to need ellipsising.
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
