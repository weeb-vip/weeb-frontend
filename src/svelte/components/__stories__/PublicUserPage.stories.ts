import type { Meta, StoryObj } from '@storybook/svelte';
import { readable } from 'svelte/store';
import PublicUserPage from '../PublicUserPage.svelte';
import { PublicUserPageBloc } from '../PublicUserPage.bloc.svelte';
import { ANIME_COUNTS, ANIME_ENTRIES, LONG_TITLE, WORK_COUNTS, WORK_ENTRIES, animeEntry } from './profileFixtures';

/** Someone else's profile: header always public, lists only when they opted in. */

const config = readable({ cdn_user_url: 'https://cdn.weeb.vip/weeb-user-staging' });

const USER = {
  id: 'u1',
  username: 'thatcat',
  firstname: 'That',
  lastname: 'Cat',
  bio: 'Watching too much, reading more. Ask me about Frieren.',
  accentColor: 'cyan',
  listsPublic: true,
  profileImageUrl: null,
  bannerImageUrl: null,
};

const LISTS = {
  watching: { animes: ANIME_ENTRIES.slice(0, 4) },
  reading: { works: WORK_ENTRIES.slice(0, 4) },
  animeCounts: ANIME_COUNTS,
  workCounts: WORK_COUNTS,
};

function bloc(user: any, lists: any) {
  return new PublicUserPageBloc({ source: () => ({ user, lists }), config });
}

const meta = {
  title: 'Profile/PublicUserPage',
  component: PublicUserPage,
  parameters: { layout: 'fullscreen' },
  tags: ['autodocs'],
} satisfies Meta<typeof PublicUserPage>;

export default meta;
type Story = StoryObj<typeof meta>;

/** A public profile with both shelves filled and the viewer's chosen accent. */
export const Populated: Story = {
  args: { user: USER, lists: LISTS, bloc: bloc(USER, LISTS) },
};

/** Lists kept private: the header still renders, the shelves do not. */
export const PrivateLists: Story = {
  args: {
    user: { ...USER, listsPublic: false },
    lists: null,
    bloc: bloc({ ...USER, listsPublic: false }, null),
  },
};

/** Public, but nothing on either shelf yet. */
export const EmptyLists: Story = {
  args: {
    user: USER,
    lists: { watching: { animes: [] }, reading: { works: [] }, animeCounts: {}, workCounts: {} },
    bloc: bloc(USER, { watching: { animes: [] }, reading: { works: [] }, animeCounts: {}, workCounts: {} }),
  },
};

/** No picture, no banner, no bio, no accent: the initials and the default hero. */
export const BareProfile: Story = {
  args: {
    user: { username: 'newcomer', listsPublic: true },
    lists: { watching: { animes: [] }, reading: { works: [] } },
    bloc: bloc({ username: 'newcomer', listsPublic: true }, { watching: { animes: [] }, reading: { works: [] } }),
  },
};

/** Titles long enough to wrap a card, and a bio that runs to the limit. */
export const LongText: Story = {
  args: {
    user: { ...USER, bio: `${LONG_TITLE} -- and that is only the first one.` },
    lists: { ...LISTS, watching: { animes: [animeEntry('long', LONG_TITLE)] } },
    bloc: bloc(
      { ...USER, bio: `${LONG_TITLE} -- and that is only the first one.` },
      { ...LISTS, watching: { animes: [animeEntry('long', LONG_TITLE)] } },
    ),
  },
};
