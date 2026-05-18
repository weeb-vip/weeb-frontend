import type { Meta, StoryObj } from '@storybook/svelte';
import Button from '../Button.svelte';

const meta = {
  title: 'Design System/Button',
  component: Button,
  tags: ['autodocs'],
  argTypes: {
    color: {
      control: 'select',
      options: ['blue', 'red', 'transparent', ''],
    },
    status: {
      control: 'select',
      options: ['idle', 'loading', 'success', 'error'],
    },
  },
} satisfies Meta<Button>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Accent: Story = {
  args: {
    color: 'blue',
    label: 'Add to Watchlist',
    showLabel: true,
    status: 'idle',
    disabled: false,
  },
};

export const Ghost: Story = {
  args: {
    color: 'transparent',
    label: 'View Details',
    showLabel: true,
    status: 'idle',
    disabled: false,
  },
};

export const Danger: Story = {
  args: {
    color: 'red',
    label: 'Remove from List',
    showLabel: true,
    status: 'idle',
    disabled: false,
  },
};

export const Loading: Story = {
  args: {
    color: 'blue',
    label: 'Saving...',
    showLabel: true,
    status: 'loading',
    disabled: false,
  },
};

export const Disabled: Story = {
  args: {
    color: 'blue',
    label: 'Not Available',
    showLabel: true,
    status: 'idle',
    disabled: true,
  },
};
