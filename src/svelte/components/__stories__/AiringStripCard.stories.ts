import type { Meta, StoryObj } from '@storybook/svelte';
import AiringStripCard from '../AiringStripCard.svelte';

const meta = {
  title: 'Design System/AiringStripCard',
  component: AiringStripCard,
  tags: ['autodocs'],
  argTypes: {
    isLive: { control: 'boolean' },
  },
} satisfies Meta<AiringStripCard>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    id: '154587',
    title: 'Frieren: Beyond Journey\'s End',
    image: 'https://cdn.myanimelist.net/images/anime/1015/138006.jpg',
    episodeText: 'Episode 8',
    timeText: 'Fri 23:00',
    isLive: false,
    currentEpisode: 8,
    totalEpisodes: 28,
  },
};

export const Live: Story = {
  args: {
    id: '52991',
    title: 'Sousou no Frieren',
    image: 'https://cdn.myanimelist.net/images/anime/1015/138006.jpg',
    episodeText: 'Episode 28 · Season Finale',
    timeText: 'Airing Now',
    isLive: true,
    currentEpisode: 28,
    totalEpisodes: 28,
  },
};

export const HalfwayThrough: Story = {
  args: {
    id: '21',
    title: 'One Punch Man Season 3',
    image: 'https://cdn.myanimelist.net/images/anime/1792/138022.jpg',
    episodeText: 'Episode 6',
    timeText: 'Thu 01:05',
    localTime: 'Wed 12:05 PM',
    isLive: false,
    currentEpisode: 6,
    totalEpisodes: 12,
  },
};

export const WithoutTotal: Story = {
  args: {
    id: '51009',
    title: 'Jujutsu Kaisen Season 3',
    image: 'https://cdn.myanimelist.net/images/anime/1792/138022.jpg',
    episodeText: 'Episode 1',
    timeText: '',
    isLive: false,
    currentEpisode: 1,
    totalEpisodes: 0,
  },
};
