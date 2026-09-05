import type { Meta, StoryObj } from '@storybook/svelte';
import { readable } from 'svelte/store';
import ShowContent from '../ShowContent.svelte';
import {
  ShowContentBloc,
  type ShowContentDeps,
  type ViewportPort,
} from '../ShowContent.bloc.svelte';
import { CHARACTERS, FULL_ANIME, MINIMAL_ANIME, TRACKED_ANIME, UNAIRED_ANIME } from './show-fixtures';

/**
 * A window that never moves and a document with no sections in it. The scroll
 * spy still runs; it simply always answers "the first one", which is what a
 * story wants.
 */
const stillViewport: ViewportPort = {
  scrollY: () => 0,
  innerWidth: () => 1440,
  sectionTop: () => null,
  scrollTo: () => {},
  cssLength: (_name, fallback) => fallback,
  setStickyOffset: () => {},
  onScroll: () => () => {},
};

/** Pinned so the countdown, the "airing now" badge and the chips never move. */
const NOW = new Date('2024-01-19T12:00:00Z');

let key = 0;

function bloc(
  ssr: { anime?: any; error?: unknown; characters?: any } = {},
  overrides: Partial<ShowContentDeps> = {},
): ShowContentBloc {
  // A unique key per story, so two stories on one page cannot share a cache
  // entry -- and a query that never settles cannot be resolved by its neighbour.
  const tag = `story-${key++}`;
  return new ShowContentBloc({
    source: () => ({
      animeId: ssr.anime?.id ?? 'a1',
      ssrAnimeData: ssr.anime ? { anime: ssr.anime } : null,
      ssrCharactersData: ssr.characters ?? CHARACTERS,
      ssrError: ssr.error ?? null,
    }),
    details: (id) => ({ queryKey: [tag, 'details', id], queryFn: () => new Promise(() => {}) }),
    watched: (id) => ({ queryKey: [tag, 'watched', id], queryFn: async () => [] }),
    tracking: { save: async () => ({}), markEpisode: async () => ({}) },
    preferences: readable({ titleLanguage: 'english' as const }),
    notifications: readable({ timingData: {}, countdowns: {} }),
    config: { init: async () => null },
    flags: { isEnabled: (flag: string) => flag === 'anime-news' },
    viewport: stillViewport,
    navigate: () => {},
    notify: { error: (message) => console.info('[toast]', message) },
    clock: () => NOW,
    imageUrl: (id, path) => `https://cdn.weeb.vip/${path ? `${path}/` : ''}${id}`,
    ...overrides,
  });
}

const meta = {
  title: 'Show/ShowContent',
  component: ShowContent,
  tags: ['autodocs'],
  parameters: { layout: 'fullscreen' },
} satisfies Meta<typeof ShowContent>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Nothing from the loader and a query still in flight: the page's own skeleton. */
export const Loading: Story = {
  args: { animeId: 'a1', bloc: bloc() },
};

/** The loader failed and the client fetch has not rescued it yet. */
export const Failed: Story = {
  args: {
    animeId: 'a1',
    bloc: bloc({ error: { message: 'Unable to reach the gateway' } }),
  },
};

/** Everything present: art, schedule, news, 28 episodes, cast, related, references. */
export const Populated: Story = {
  args: { animeId: FULL_ANIME.id, bloc: bloc({ anime: FULL_ANIME }) },
};

/** Signed in and part way through, so the score and the episode stepper are live. */
export const OnMyList: Story = {
  args: { animeId: TRACKED_ANIME.id, bloc: bloc({ anime: TRACKED_ANIME }) },
};

/**
 * What most of the catalogue looks like: no episodes scraped, no news, no
 * series and no streaming rows, so three of the four tabs never appear.
 */
export const MinimalRecord: Story = {
  args: {
    animeId: MINIMAL_ANIME.id,
    bloc: bloc({ anime: MINIMAL_ANIME, characters: { charactersAndStaffByAnimeId: [] } }),
  },
};

/** Announced but not broadcast: no end date, one unaired episode, a countdown. */
export const Unaired: Story = {
  args: { animeId: UNAIRED_ANIME.id, bloc: bloc({ anime: UNAIRED_ANIME }) },
};

/** The news flag off. The section and its tab both vanish, stories or not. */
export const NewsFlagOff: Story = {
  args: {
    animeId: FULL_ANIME.id,
    bloc: bloc({ anime: FULL_ANIME }, { flags: { isEnabled: () => false } }),
  },
};
