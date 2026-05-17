import type { Meta, StoryObj } from '@storybook/svelte';
import PosterCard from '../PosterCard.svelte';
import StoryContainer from './StoryContainer.svelte';

const meta = {
  title: 'Design System/PosterCard',
  component: PosterCard,
  tags: ['autodocs'],
  parameters: {
    layout: 'centered',
  },
  decorators: [
    () => ({
      Component: StoryContainer,
      props: { width: '200px' },
    }),
  ],
  argTypes: {
    status: {
      control: 'select',
      options: ['airing', 'upcoming', null],
    },
  },
} satisfies Meta<PosterCard>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    id: '154587',
    title: 'Frieren: Beyond Journey\'s End',
    image: 'https://cdn.myanimelist.net/images/anime/1015/138006.jpg',
    score: 9.0,
    status: 'airing',
    genres: ['Adventure', 'Drama', 'Fantasy'],
    description: 'The adventure is over but life goes on for an elf mage just beginning to learn what living is all about. Elf mage Frieren and her courageous fellow adventurers have defeated the Demon King and brought peace to the land.',
    episodeCount: 28,
    sub: '28 ep \u00B7 Madhouse',
    href: '#',
  },
};

export const WithoutScore: Story = {
  args: {
    id: '21',
    title: 'One Punch Man Season 3',
    image: 'https://cdn.myanimelist.net/images/anime/1247/142erta.jpg',
    score: null,
    status: 'upcoming',
    genres: ['Action', 'Comedy', 'Sci-Fi'],
    description: 'The seemingly unimpressive Saitama has a rather unique hobby: being a hero. He trained so hard that he lost all his hair, and now he can defeat any enemy with a single punch.',
    episodeCount: null,
    sub: 'Upcoming \u00B7 J.C.Staff',
    href: '#',
  },
};

export const WithGenres: Story = {
  args: {
    id: '5114',
    title: 'Fullmetal Alchemist: Brotherhood',
    image: 'https://cdn.myanimelist.net/images/anime/1208/94745.jpg',
    score: 9.1,
    status: null,
    genres: ['Action', 'Adventure', 'Drama', 'Fantasy'],
    description: 'After a horrific alchemy experiment goes wrong, brothers Edward and Alphonse Elric embark on a quest to restore their bodies by finding the Philosopher\'s Stone.',
    episodeCount: 64,
    sub: '64 ep \u00B7 Bones',
    href: '#',
  },
};
