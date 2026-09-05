import type { Meta, StoryObj } from '@storybook/svelte';
import { writable } from 'svelte/store';
import AnimeToast from '../AnimeToast.svelte';
import {
  AnimeToastBloc,
  type AnimeToastStatus,
  type DevicePort,
} from '../AnimeToast.bloc.svelte';
import StoryContainer from './StoryContainer.svelte';

/** A fixed device, so no story reads `navigator` or listens for a resize. */
function stubDevice(isCompact: boolean): DevicePort {
  return { isCompact: () => isCompact, onChange: () => () => {} };
}

const anime = {
  id: '154587',
  slug: 'sousou-no-frieren',
  titleEn: 'Frieren: Beyond Journey\'s End',
  titleJp: '葬送のフリーレン',
  imageUrl: 'https://cdn.myanimelist.net/images/anime/1015/138006.jpg',
};

const episode = {
  episodeNumber: 24,
  titleEn: 'The Height of Magic',
};

function bloc(
  status: AnimeToastStatus,
  options: { compact?: boolean; anime?: Record<string, unknown>; episode?: Record<string, unknown> } = {}
) {
  return new AnimeToastBloc(
    {
      anime: { ...anime, ...options.anime },
      episode: { ...episode, ...options.episode },
      status,
    },
    {
      preferences: writable({ titleLanguage: 'english' as const }),
      navigate: (href) => console.log('navigate', href),
      device: stubDevice(options.compact ?? false),
    }
  );
}

const meta = {
  title: 'Composites/Tracking/AnimeToast',
  component: AnimeToast,
  tags: ['autodocs'],
  decorators: [
    () => ({
      Component: StoryContainer,
      props: { width: '380px' },
    }),
  ],
} satisfies Meta<typeof AnimeToast>;

export default meta;
type Story = StoryObj<typeof meta>;

/** The common case: an episode a few minutes out. */
export const AiringSoon: Story = {
  args: {
    anime,
    episode,
    status: 'airing-soon',
    timeInfo: 'Starting in 5 minutes',
    bloc: bloc('airing-soon'),
  },
};

/** On air now: green, with the play indicator. */
export const Airing: Story = {
  args: {
    anime,
    episode,
    status: 'airing',
    timeInfo: 'Airing now',
    bloc: bloc('airing'),
  },
};

/** Done: violet, with the tick. */
export const Finished: Story = {
  args: {
    anime,
    episode,
    status: 'finished',
    timeInfo: 'Just finished',
    bloc: bloc('finished'),
  },
};

/** The last call before it starts. */
export const Warning: Story = {
  args: {
    anime,
    episode,
    status: 'warning',
    timeInfo: 'Starting in 1 minute',
    bloc: bloc('warning'),
  },
};

/**
 * A touch device. The card stops being clickable -- a tap that was really a
 * scroll must not navigate -- and an explicit arrow button appears instead.
 */
export const OnTouchDevice: Story = {
  args: {
    anime,
    episode,
    status: 'airing-soon',
    timeInfo: 'Starting in 5 minutes',
    bloc: bloc('airing-soon', { compact: true }),
  },
};

/** No poster: the thumbnail slot draws its own placeholder. */
export const WithoutImage: Story = {
  args: {
    anime,
    episode,
    status: 'airing-soon',
    timeInfo: 'Starting in 5 minutes',
    bloc: bloc('airing-soon', { anime: { imageUrl: undefined } }),
  },
};

/** Nothing known about the episode, and no time line to print. */
export const UnknownEpisode: Story = {
  args: {
    anime,
    episode: {},
    status: 'airing-soon',
    timeInfo: '',
    bloc: bloc('airing-soon', { episode: { episodeNumber: undefined, titleEn: undefined } }),
  },
};

/** Both lines long enough to ellipsise, which is the layout's real test. */
export const LongTitles: Story = {
  args: {
    anime,
    episode,
    status: 'airing',
    timeInfo: 'Airing now',
    bloc: bloc('airing', {
      anime: { titleEn: 'The Exiled Heavy Knight Knows How to Game the System' },
      episode: { titleEn: 'The Village Where the Priest and the Demon Both Came Home' },
    }),
  },
};
