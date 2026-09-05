import type { Meta, StoryObj } from '@storybook/svelte';
import AiringStripCard from '../AiringStripCard.svelte';

const meta = {
  title: 'Design System/AiringStripCard',
  component: AiringStripCard,
  tags: ['autodocs'],
  argTypes: {
    isLive: { control: 'boolean' },
  },
} satisfies Meta<typeof AiringStripCard>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Mid-season: a progress bar under the title and the next slot on the right. */
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

/** On air now: the LIVE flag replaces the countdown. */
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

/** Halfway, and carrying the viewer's own local air time. */
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

/** Episode count unannounced: no denominator, so the progress bar is dropped. */
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

/** A title wider than the card, which ellipsises on one line. */
export const LongTitle: Story = {
  args: {
    ...Default.args,
    title: 'The Exiled Heavy Knight Knows How to Game the System',
  },
};

/** No artwork: the poster slot keeps its gradient rather than collapsing. */
export const MissingImage: Story = {
  args: {
    ...Default.args,
    id: '0',
    title: 'A Show With No Poster',
    image: '',
  },
};

/**
 * The hover callbacks that replaced the forwarded `on:mouseenter` /
 * `on:mouseleave` directives -- a runes component cannot forward a bare DOM
 * event, so the parent gets props instead.
 */
export const WithHoverCallbacks: Story = {
  args: {
    ...Default.args,
    onMouseEnter: () => console.log('pointer entered the card'),
    onMouseLeave: () => console.log('pointer left the card'),
  },
};
