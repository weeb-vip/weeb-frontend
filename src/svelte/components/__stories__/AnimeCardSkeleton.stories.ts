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
} satisfies Meta<AnimeCardSkeleton>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    style: 'default',
    forceListLayout: false,
  },
};

export const DetailStyle: Story = {
  args: {
    style: 'detail',
    forceListLayout: false,
  },
};

export const EpisodeStyle: Story = {
  args: {
    style: 'episode',
    forceListLayout: false,
  },
};

export const ListLayout: Story = {
  args: {
    style: 'detail',
    forceListLayout: true,
  },
};
