import type { Meta, StoryObj } from '@storybook/svelte';
import AnimeCardSkeleton from '../AnimeCardSkeleton.svelte';
import StoryContainer from './StoryContainer.svelte';

const meta = {
  title: 'Design System/AnimeCardSkeleton',
  component: AnimeCardSkeleton,
  tags: ['autodocs'],
  parameters: {
    layout: 'centered',
  },
  decorators: [
    () => ({
      Component: StoryContainer,
      props: { width: '320px' },
    }),
  ],
  argTypes: {
    style: {
      control: 'select',
      options: ['default', 'hover', 'hover-transparent', 'transparent', 'long', 'detail', 'episode'],
    },
  },
} satisfies Meta<typeof AnimeCardSkeleton>;

export default meta;
type Story = StoryObj<typeof meta>;

/** The default poster card placeholder. */
export const Default: Story = {
  args: {
    style: 'default',
    forceListLayout: false,
  },
};

/** The wider detail-page variant, with a fourth copy line. */
export const DetailStyle: Story = {
  args: {
    style: 'detail',
    forceListLayout: false,
  },
};

/** The episode variant, whose copy lines are fixed rather than derived. */
export const EpisodeStyle: Story = {
  args: {
    style: 'episode',
    forceListLayout: false,
  },
};

/** Forced into a row on every breakpoint, as the profile lists render it. */
export const ListLayout: Story = {
  args: {
    style: 'detail',
    forceListLayout: true,
  },
};
