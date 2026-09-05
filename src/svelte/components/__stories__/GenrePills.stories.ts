import type { Meta, StoryObj } from '@storybook/svelte';
import GenrePills from '../GenrePills.svelte';

const meta = {
  title: 'Primitives/GenrePills',
  component: GenrePills,
  tags: ['autodocs'],
} satisfies Meta<typeof GenrePills>;

export default meta;
type Story = StoryObj<typeof meta>;

/** The full genre list, wrapping onto as many rows as it needs. */
export const Default: Story = {
  args: {
    genres: [
      'Action', 'Adventure', 'Comedy', 'Drama', 'Fantasy', 'Horror',
      'Mecha', 'Music', 'Mystery', 'Psychological', 'Romance', 'Sci-Fi',
      'Slice of Life', 'Sports', 'Supernatural', 'Thriller',
    ],
  },
};
