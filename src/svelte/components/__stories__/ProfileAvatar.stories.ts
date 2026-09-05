import type { Meta, StoryObj } from '@storybook/svelte';
import ProfileAvatar from '../ProfileAvatar.svelte';

/**
 * Presentational, so the stories are just props. The image URLs point at a
 * host that will not answer here, which is deliberate: it exercises the
 * fallback the component falls back to in production.
 */
const meta = {
  title: 'Design System/ProfileAvatar',
  component: ProfileAvatar,
  tags: ['autodocs'],
} satisfies Meta<typeof ProfileAvatar>;

export default meta;
type Story = StoryObj<typeof meta>;

/** No uploaded image: the initial in the gradient disc, which is the common case. */
export const Initial: Story = {
  args: {
    username: 'sakura',
    linkToProfile: false,
  },
};

/** The three sizes side by side is what the header, the drawer and the profile page use. */
export const Small: Story = {
  args: {
    username: 'sakura',
    size: 'sm',
    linkToProfile: false,
  },
};

/** The large disc the profile page header renders. */
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
