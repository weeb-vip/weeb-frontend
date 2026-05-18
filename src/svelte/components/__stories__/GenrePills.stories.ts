import type { Meta, StoryObj } from '@storybook/svelte';
import GenrePills from '../GenrePills.svelte';

const meta = {
  title: 'Design System/GenrePills',
  component: GenrePills,
  tags: ['autodocs'],
} satisfies Meta<GenrePills>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    genres: [
      'Action', 'Adventure', 'Comedy', 'Drama', 'Fantasy', 'Horror',
      'Mecha', 'Music', 'Mystery', 'Psychological', 'Romance', 'Sci-Fi',
      'Slice of Life', 'Sports', 'Supernatural', 'Thriller',
    ],
  },
};
