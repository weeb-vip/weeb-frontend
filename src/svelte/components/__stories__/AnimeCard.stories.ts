import type { Meta, StoryObj } from '@storybook/svelte';
import AnimeCard from '../AnimeCard.svelte';
import StoryContainer from './StoryContainer.svelte';

const meta = {
  title: 'Design System/AnimeCard',
  component: AnimeCard,
  tags: ['autodocs'],
  parameters: {
    layout: 'centered',
  },
  decorators: [
    () => ({
      Component: StoryContainer,
      props: { width: '320px' },
    }),
  ],
  argTypes: {
    style: {
      control: 'select',
      options: ['default', 'hover', 'hover-transparent', 'transparent', 'long', 'detail', 'episode'],
    },
  },
} satisfies Meta<typeof AnimeCard>;

export default meta;
type Story = StoryObj<typeof meta>;

/** The bare poster tile: artwork and nothing else. */
export const Default: Story = {
  args: {
    id: '154587',
    title: 'Frieren: Beyond Journey\'s End',
    episodes: 28,
    episodeLength: '24 min',
    year: '2023',
    image: 'https://cdn.myanimelist.net/images/anime/1015/138006.jpg',
    style: 'default',
    tags: ['Adventure', 'Drama', 'Fantasy'],
  },
};

/** The metadata card: episode count, duration and year beside the poster. */
export const DetailStyle: Story = {
  args: {
    id: '5114',
    title: 'Fullmetal Alchemist: Brotherhood',
    episodes: 64,
    episodeLength: '24 min',
    year: '2009',
    image: 'https://cdn.myanimelist.net/images/anime/1208/94745.jpg',
    style: 'detail',
    tags: ['Action', 'Adventure', 'Drama', 'Fantasy'],
  },
};

/** The episode card the calendar popover renders, with a countdown. */
export const EpisodeStyle: Story = {
  args: {
    id: '52991',
    title: 'Sousou no Frieren',
    episodes: 28,
    episodeLength: '24 min',
    year: '2023',
    image: 'https://cdn.myanimelist.net/images/anime/1015/138006.jpg',
    style: 'episode',
    episodeTitle: 'The Height of Magic',
    episodeNumber: '24',
    airdate: 'Fri Mar 22nd',
    airTime: { show: true, text: 'Airing in 2h 30m', variant: 'countdown' },
    tags: ['Adventure', 'Drama', 'Fantasy'],
  },
};

/** Already on the viewer's list, so the card wears its status badge. */
export const WithWatchlistStatus: Story = {
  args: {
    id: '1735',
    title: 'Naruto: Shippuuden',
    episodes: 500,
    episodeLength: '24 min',
    year: '2007',
    image: 'https://cdn.myanimelist.net/images/anime/1565/111305.jpg',
    style: 'detail',
    entry: { status: 'WATCHING' },
    tags: ['Action', 'Adventure'],
  },
};

/** Airing right now: the broadcast line turns amber. */
export const WithAiringBadge: Story = {
  args: {
    id: '21',
    title: 'One Punch Man Season 3',
    episodes: 0,
    episodeLength: '',
    year: '2025',
    image: 'https://cdn.myanimelist.net/images/anime/1247/142erta.jpg',
    style: 'detail',
    airTime: { show: true, text: 'Airing Now', variant: 'airing' },
    tags: ['Action', 'Comedy', 'Sci-Fi'],
  },
};

/**
 * Nothing announced yet: episodes fall back to TBA and the duration is the
 * muted, italic estimate rather than a measured figure.
 */
export const UnknownCounts: Story = {
  args: {
    id: '58567',
    title: 'Kaijuu 8-gou Season 3',
    episodes: 0,
    episodeLength: '',
    year: '',
    image: 'https://cdn.myanimelist.net/images/anime/1975/143867.jpg',
    style: 'detail',
    tags: ['Action', 'Sci-Fi'],
  },
};

/** A title that outruns its column, so ScrollingText has something to do. */
export const LongTitle: Story = {
  args: {
    id: '52347',
    title: 'The Exiled Heavy Knight Knows How to Game the System and Will Not Be Returning to the Capital',
    episodes: 12,
    episodeLength: '24 min',
    year: '2024',
    image: 'https://cdn.myanimelist.net/images/anime/1015/138006.jpg',
    style: 'detail',
    tags: ['Action', 'Adventure', 'Comedy', 'Fantasy', 'Isekai'],
  },
};

/** No artwork at all: SafeImage falls through to its own placeholder. */
export const MissingImage: Story = {
  args: {
    id: '0',
    title: 'A Show With No Poster',
    episodes: 12,
    episodeLength: '24 min',
    year: '2024',
    image: '',
    style: 'detail',
    tags: ['Drama'],
  },
};

/** The list layout the calendar popover uses: poster left, text right, always. */
export const ForcedListLayout: Story = {
  args: {
    ...EpisodeStyle.args,
    forceListLayout: true,
  },
};
