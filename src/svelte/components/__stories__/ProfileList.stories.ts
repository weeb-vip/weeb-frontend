import type { Meta, StoryObj } from '@storybook/svelte';
import ProfileList from '../../../routes/profile/anime/+page.svelte';
import { ProfileListBloc, type MediumUrlPort } from '../ProfileList.bloc.svelte';
import { createAnimeListBloc } from '../ProfileAnimeList.bloc.svelte';
import { createWorkListBloc } from '../ProfileWorkList.bloc.svelte';
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
  type StubResult,
} from './profileFixtures';

/** The medium switch, with neither the address nor the history involved. */
function mediumUrl(medium: 'anime' | 'manga'): MediumUrlPort {
  return { read: () => medium, write: () => {}, onChange: () => () => {} };
}

function animeBloc(result: StubResult = 'ok') {
  return createAnimeListBloc(() => ({ ssr: null }), {
    titleLanguage: () => 'english',
    list: stubList(result, ANIME_ENTRIES, ANIME_ENTRIES.length, 'animes'),
    counts: stubCounts(ANIME_COUNTS),
    tracking: stubTracking,
    url: noopUrl,
    viewport: fixedViewport(24),
    notify: { error: () => {} },
    queryClient: freshClient(),
  });
}

function workBloc(result: StubResult = 'ok') {
  return createWorkListBloc(() => ({ ssr: null }), {
    list: stubList(result, WORK_ENTRIES, WORK_ENTRIES.length, 'works'),
    counts: stubCounts(WORK_COUNTS),
    url: noopUrl,
    viewport: fixedViewport(24),
    notify: { error: () => {} },
    queryClient: freshClient(),
  });
}

const meta = {
  title: 'Pages/ProfileList',
  component: ProfileList,
  // The list blocs are injected, so nothing reads the server payload here.
  args: { data: { ssr: null } },
  tags: ['autodocs'],
} satisfies Meta<typeof ProfileList>;

export default meta;
type Story = StoryObj<typeof meta>;

/** The default arrival: the switch on Anime, the watchlist beneath it. */
export const AnimeMedium: Story = {
  args: {
    bloc: new ProfileListBloc({ url: mediumUrl('anime') }),
    animeBloc: animeBloc(),
    workBloc: workBloc(),
  },
};

/** ?medium=manga, which the server resolves before it fetches. */
export const MangaMedium: Story = {
  args: {
    bloc: new ProfileListBloc({ source: () => ({ ssr: { medium: 'manga' } }), url: mediumUrl('manga') }),
    animeBloc: animeBloc(),
    workBloc: workBloc(),
  },
};

/** Both shelves still loading under the switch, which is there from the start. */
export const Loading: Story = {
  args: {
    bloc: new ProfileListBloc({ url: mediumUrl('anime') }),
    animeBloc: animeBloc('never'),
    workBloc: workBloc('never'),
  },
};

/** A brand new account: the switch, and an empty watchlist under it. */
export const Empty: Story = {
  args: {
    bloc: new ProfileListBloc({ url: mediumUrl('anime') }),
    animeBloc: animeBloc('empty'),
    workBloc: workBloc('empty'),
  },
};
