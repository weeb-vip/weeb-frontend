import type { Meta, StoryObj } from '@storybook/svelte';
import ProfileHeroAvatar from '../ProfileHeroAvatar.svelte';

/**
 * The large profile avatar. It fills its wrapper on a real page; the stories
 * give it an explicit size instead, since a story has no sized wrapper.
 */
const meta = {
  title: 'Profile/ProfileHeroAvatar',
  component: ProfileHeroAvatar,
  tags: ['autodocs'],
} satisfies Meta<typeof ProfileHeroAvatar>;

export default meta;
type Story = StoryObj<typeof meta>;

/** No picture on file: the initial over the accent gradient. */
export const Initials: Story = {
  args: { initials: 'T', alt: 'thatcat', size: '120px' },
};

/** Two initials, which is what a first and last name gives the public page. */
export const TwoInitials: Story = {
  args: { initials: 'TC', alt: 'That Cat', size: '120px' },
};

/** A picture that loads. */
export const WithImage: Story = {
  args: {
    src: 'https://cdn.weeb.vip/weeb/frieren',
    alt: 'That Cat',
    initials: 'TC',
    size: '120px',
  },
};

/**
 * A URL that 404s. The point of the component: a truthy-but-broken image used
 * to leave the circle empty, because the initials branch never ran.
 */
export const BrokenImage: Story = {
  args: {
    src: 'https://cdn.weeb.vip/weeb/definitely-not-a-real-object',
    alt: 'That Cat',
    initials: 'TC',
    size: '120px',
  },
};
