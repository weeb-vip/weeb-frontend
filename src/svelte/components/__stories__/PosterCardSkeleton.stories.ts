import type { Meta, StoryObj } from '@storybook/svelte';
import PosterCardSkeleton from '../PosterCardSkeleton.svelte';

const meta = {
  title: 'Composites/Cards/PosterCardSkeleton',
  component: PosterCardSkeleton,
  tags: ['autodocs'],
} satisfies Meta<typeof PosterCardSkeleton>;

export default meta;
type Story = StoryObj<typeof meta>;

/** One placeholder card: 2:3 poster, title line, subtitle line. */
export const Default: Story = {
  args: {},
};

/** Constrained to the width a poster grid gives a cell. */
export const InAGridCell: Story = {
  args: { class: 'max-w-[180px]' },
};
