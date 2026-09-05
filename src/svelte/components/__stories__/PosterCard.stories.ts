import type { Meta, StoryObj } from '@storybook/svelte';
import PosterCard from '../PosterCard.svelte';
import { noCardTracking } from '../Card.bloc.svelte';
import StoryContainer from './StoryContainer.svelte';

const meta = {
  title: 'Composites/Cards/PosterCard',
  component: PosterCard,
  tags: ['autodocs'],
  args: {
    track: noCardTracking,
  },
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
    onList: {
      control: 'select',
      options: ['watching', 'completed', 'plan_to_watch', 'dropped', 'on_hold', null],
    },
  },
} satisfies Meta<typeof PosterCard>;

export default meta;
type Story = StoryObj<typeof meta>;

/** The full card: score, airing dot, and the hover panel behind it. */
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

/** Nothing rated yet, so the score badge is absent and the dot reads upcoming. */
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

/** Finished airing: no status dot, and three genres in the hover panel. */
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

/** On the viewer's list as watching -- the green corner tab wins over the dot. */
export const Watching: Story = {
  args: {
    ...Default.args,
    onList: 'watching',
  },
};

/** Completed: the accent tab, with a tick. */
export const Completed: Story = {
  args: {
    id: '5114',
    title: 'Fullmetal Alchemist: Brotherhood',
    image: 'https://cdn.myanimelist.net/images/anime/1208/94745.jpg',
    score: 9.1,
    status: null,
    sub: '64 ep \u00B7 Bones',
    href: '#',
    onList: 'completed',
  },
};

/** Planned: the amber tab, with a bookmark. */
export const PlanToWatch: Story = {
  args: {
    ...Default.args,
    title: 'Chainsaw Man Season 2',
    onList: 'plan_to_watch',
  },
};

/** Dropped: the red tab, with a cross. */
export const Dropped: Story = {
  args: {
    ...Default.args,
    title: 'Some Dropped Anime',
    onList: 'dropped',
  },
};

/** On hold: the muted tab, with a pause. */
export const OnHold: Story = {
  args: {
    ...Default.args,
    title: 'On Hold Anime',
    onList: 'on_hold',
  },
};

/** A title long enough to clamp to two lines, which is the card's fixed budget. */
export const LongTitle: Story = {
  args: {
    ...Default.args,
    title: 'The Exiled Heavy Knight Knows How to Game the System and Will Not Be Returning to the Capital',
    sub: '12 ep \u00B7 Studio Deen',
  },
};

/**
 * No artwork: `placeholderTitle` means SafeImage draws a titled panel rather
 * than the bright not-found illustration, which would out-shout the real
 * posters beside it.
 */
export const MissingImage: Story = {
  args: {
    id: '0',
    title: 'A Show With No Poster',
    image: '',
    score: null,
    status: null,
    sub: 'TBA',
    href: '#',
  },
};

/** Bare metadata: no score, no genres, no synopsis -- the hover panel is empty. */
export const Minimal: Story = {
  args: {
    id: '9253',
    title: 'Steins;Gate',
    image: 'https://cdn.myanimelist.net/images/anime/1935/127974.jpg',
    href: '#',
  },
};

/**
 * A work rather than an anime: `imagePath` points the CDN at works/, since the
 * same id under posters/ would be a poster that does not exist.
 */
export const WorkPoster: Story = {
  args: {
    id: 'work-1',
    title: 'Chainsaw Man, Vol. 1',
    image: 'work-1',
    imagePath: 'works',
    sub: '11 volumes',
    href: '#',
  },
};
