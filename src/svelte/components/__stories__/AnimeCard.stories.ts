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
} satisfies Meta<AnimeCard>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    id: '154587',
    title: 'Frieren: Beyond Journey\'s End',
    description: 'The adventure is over but life goes on for an elf mage just beginning to learn what living is all about.',
    episodes: 28,
    episodeLength: '24 min',
    year: '2023',
    image: 'https://cdn.myanimelist.net/images/anime/1015/138006.jpg',
    style: 'default',
    tags: ['Adventure', 'Drama', 'Fantasy'],
  },
};

export const DetailStyle: Story = {
  args: {
    id: '5114',
    title: 'Fullmetal Alchemist: Brotherhood',
    description: 'Two brothers search for a Philosopher\'s Stone after an pointless transmutation leaves them in damaged physical forms.',
    episodes: 64,
    episodeLength: '24 min',
    year: '2009',
    image: 'https://cdn.myanimelist.net/images/anime/1208/94745.jpg',
    style: 'detail',
    tags: ['Action', 'Adventure', 'Drama', 'Fantasy'],
  },
};

export const EpisodeStyle: Story = {
  args: {
    id: '52991',
    title: 'Sousou no Frieren',
    description: '',
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

export const WithWatchlistStatus: Story = {
  args: {
    id: '1735',
    title: 'Naruto: Shippuuden',
    description: '',
    episodes: 500,
    episodeLength: '24 min',
    year: '2007',
    image: 'https://cdn.myanimelist.net/images/anime/1565/111305.jpg',
    style: 'detail',
    entry: { status: 'WATCHING' },
    tags: ['Action', 'Adventure'],
  },
};

export const WithAiringBadge: Story = {
  args: {
    id: '21',
    title: 'One Punch Man Season 3',
    description: '',
    episodes: 0,
    episodeLength: '',
    year: '2025',
    image: 'https://cdn.myanimelist.net/images/anime/1247/142erta.jpg',
    style: 'detail',
    airTime: { show: true, text: 'Airing Now', variant: 'airing' },
    tags: ['Action', 'Comedy', 'Sci-Fi'],
  },
};
