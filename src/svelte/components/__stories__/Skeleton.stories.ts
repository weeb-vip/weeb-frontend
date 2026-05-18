import type { Meta, StoryObj } from '@storybook/svelte';
import Skeleton from '../Skeleton.svelte';

const meta = {
  title: 'Design System/Skeleton',
  component: Skeleton,
  tags: ['autodocs'],
} satisfies Meta<Skeleton>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    className: 'w-64 h-8',
  },
};

export const Card: Story = {
  args: {
    className: 'w-48 h-72 rounded-lg',
  },
};

export const TextLine: Story = {
  args: {
    className: 'w-full h-4 rounded',
  },
};

export const Avatar: Story = {
  args: {
    className: 'w-12 h-12 rounded-full',
  },
};
