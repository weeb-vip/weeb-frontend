import type { Meta, StoryObj } from '@storybook/svelte';
import ProfilePage from '../../../routes/profile/+page.svelte';
import { ProfilePageBloc, type ProfileDataPort, type ProfileConfigPort } from '../ProfilePage.bloc.svelte';
import { ANIME_COUNTS, ANIME_ENTRIES, WORK_COUNTS, WORK_ENTRIES, freshClient } from './profileFixtures';

/** The dashboard, driven entirely through the bloc's six stubbed queries. */

const DAY = 24 * 60 * 60 * 1000;
const iso = (offset: number) => new Date(Date.now() + offset).toISOString();

const USER = {
  username: 'thatcat',
  firstname: 'That',
  lastname: 'Cat',
  profileImageUrl: null,
  bannerImageUrl: null,
};

/** Two shows airing around now, each already on the viewer's list. */
const AIRING = {
  currentlyAiring: [
    {
      id: 'frieren',
      titleEn: "Frieren: Beyond Journey's End",
      broadcast: 'Fridays at 23:00 (JST)',
      duration: '24 min per episode',
      tags: ['Adventure'],
      userAnime: { id: 'ua-frieren', status: 'WATCHING' },
      episodes: [{ id: 'ep-12', episodeNumber: 12, airDate: iso(2 * DAY) }],
    },
    {
      id: 'mob',
      titleEn: 'Mob Psycho 100',
      broadcast: 'Mondays at 22:00 (JST)',
      duration: '24 min per episode',
      tags: ['Comedy'],
      userAnime: { id: 'ua-mob', status: 'PLANTOWATCH' },
      episodes: [{ id: 'ep-3', episodeNumber: 3, airDate: iso(-2 * DAY) }],
    },
  ],
};

type Shape = 'ok' | 'never' | 'bare';

function data(shape: Shape): ProfileDataPort {
  const answer = (key: string, value: any) => ({
    queryKey: [`stub-${key}`, shape],
    queryFn: async () => {
      if (shape === 'never') return new Promise(() => {});
      return value;
    },
  });
  const bare = shape === 'bare';
  return {
    user: () => answer('user', USER),
    watching: () => answer('watching', { animes: bare ? [] : ANIME_ENTRIES.slice(0, 6), total: 6 }),
    reading: () => answer('reading', { works: bare ? [] : WORK_ENTRIES, total: WORK_ENTRIES.length }),
    animeCounts: () => answer('anime-counts', bare ? {} : ANIME_COUNTS),
    workCounts: () => answer('work-counts', bare ? {} : WORK_COUNTS),
    airing: () => answer('airing', bare ? { currentlyAiring: [] } : AIRING),
  };
}

/** No config fetch in a story; the CDN base is a constant here. */
const config: ProfileConfigPort = {
  cdnUserUrl: () => 'https://cdn.weeb.vip/weeb-user-staging',
  init: async () => {},
};

function bloc(shape: Shape) {
  return new ProfilePageBloc({
    source: () => ({ ssr: null }),
    data: data(shape),
    config,
    titleLanguage: () => 'english',
    queryClient: freshClient(),
  });
}

const meta = {
  title: 'Pages/ProfilePage',
  component: ProfilePage,
  parameters: { layout: 'fullscreen' },
  tags: ['autodocs'],
  // The stories inject their own bloc; `FromServerData` is the one that puts a
  // real payload through, and it does so via the bloc's own source.
  args: { data: { ssr: null } },
} satisfies Meta<typeof ProfilePage>;

export default meta;
type Story = StoryObj<typeof meta>;

/** A used account: stats, the watching shelf, the reading row, and this week. */
export const Populated: Story = {
  args: { bloc: bloc('ok') },
};

/** Nothing has answered yet: skeleton header, skeleton shelves. */
export const Loading: Story = {
  args: { bloc: bloc('never') },
};

/**
 * A new account. Every shelf is empty, so the page leads with the one hero
 * empty state rather than three separate apologies.
 */
export const EmptyLibrary: Story = {
  args: { bloc: bloc('bare') },
};

/**
 * Rendered from the loader's payload alone -- the path a real visit takes, where
 * the markup ships filled in rather than waiting on the browser.
 */
export const FromServerData: Story = {
  args: {
    bloc: new ProfilePageBloc({
      source: () => ({
        ssr: {
          user: USER,
          watching: { animes: ANIME_ENTRIES.slice(0, 6), total: 6 },
          reading: { works: WORK_ENTRIES, total: WORK_ENTRIES.length },
          animeCounts: ANIME_COUNTS,
          workCounts: WORK_COUNTS,
          currentlyAiring: AIRING,
        },
      }),
      data: data('never'),
      config,
      titleLanguage: () => 'english',
      queryClient: freshClient(),
    }),
  },
};
