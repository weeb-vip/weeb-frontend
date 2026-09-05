import type { Meta, StoryObj } from '@storybook/svelte';
import ProfileAvatar from '../ProfileAvatar.svelte';
import StoryContainer from './StoryContainer.svelte';

/**
 * Presentational, so the stories are just props. The image URLs point at a
 * host that will not answer here, which is deliberate: it exercises the
 * fallback the component falls back to in production.
 *
 * Four sizes, and `xl` is the one that used to be a separate component
 * (ProfileHeroAvatar). It has no fixed dimensions -- the profile hero sizes its
 * own wrapper -- so its stories supply one.
 */
const meta = {
  title: 'Composites/Profile/ProfileAvatar',
  component: ProfileAvatar,
  tags: ['autodocs'],
  argTypes: {
    size: {
      control: 'select',
      options: ['sm', 'md', 'lg', 'xl'],
    },
  },
} satisfies Meta<typeof ProfileAvatar>;

export default meta;
type Story = StoryObj<typeof meta>;

/** The 120px box ProfilePage draws the hero avatar in. */
const heroBox = [
  () => ({
    Component: StoryContainer,
    props: { width: '120px', height: '120px' },
  }),
];

/** No uploaded image: the initial in the gradient disc, which is the common case. */
export const Initial: Story = {
  args: {
    username: 'sakura',
    linkToProfile: false,
  },
};

/** The 32px face: the mobile header and the drawer. */
export const Small: Story = {
  args: {
    username: 'sakura',
    size: 'sm',
    linkToProfile: false,
  },
};

/** The 64px disc. */
export const Large: Story = {
  args: {
    username: 'sakura',
    size: 'lg',
    linkToProfile: false,
  },
};

/** No username at all -- a user query that has not resolved yet still gets a circle. */
export const Unknown: Story = {
  args: {
    username: '',
    linkToProfile: false,
  },
};

/** An image that fails to load falls back to the initial rather than a broken tile. */
export const BrokenImage: Story = {
  args: {
    username: 'sakura',
    profileImageUrl: 'does-not-exist.png',
    linkToProfile: false,
  },
};

/** Wrapped in the /profile link, which is how the header and drawer render it. */
export const LinkedToProfile: Story = {
  args: {
    username: 'sakura',
    linkToProfile: true,
  },
};

/**
 * The profile hero: fills its wrapper, takes the accent gradient and the ring
 * of page background that separates it from the banner behind it.
 */
export const Hero: Story = {
  decorators: heroBox,
  args: {
    username: 'thatcat',
    size: 'xl',
    linkToProfile: false,
  },
};

/** Two initials, which is what a first and last name gives the public page. */
export const HeroTwoInitials: Story = {
  decorators: heroBox,
  args: {
    username: 'thatcat',
    initials: 'TC',
    alt: 'That Cat',
    size: 'xl',
    linkToProfile: false,
  },
};

/**
 * A picture, passed as the ready-built URL the profile blocs hand over. At this
 * size the component asks the CDN for the original rather than a `_64`
 * thumbnail, which is the whole reason `xl` exists.
 */
export const HeroWithImage: Story = {
  decorators: heroBox,
  args: {
    src: 'https://cdn.weeb.vip/weeb/frieren',
    alt: 'That Cat',
    initials: 'TC',
    size: 'xl',
    linkToProfile: false,
  },
};

/**
 * A URL that 404s. The point of the fallback: a truthy-but-broken image used to
 * leave the circle empty, because the initials branch never ran.
 */
export const HeroBrokenImage: Story = {
  decorators: heroBox,
  args: {
    src: 'https://cdn.weeb.vip/weeb/definitely-not-a-real-object',
    alt: 'That Cat',
    initials: 'TC',
    size: 'xl',
    linkToProfile: false,
  },
};
