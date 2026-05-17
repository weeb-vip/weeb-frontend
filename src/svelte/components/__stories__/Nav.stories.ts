import type { Meta, StoryObj } from '@storybook/svelte';
import Nav from '../Nav.svelte';

const meta = {
  title: 'Design System/Nav',
  component: Nav,
  tags: ['autodocs'],
  parameters: {
    layout: 'fullscreen',
  },
} satisfies Meta<Nav>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    currentPath: '/',
    seasonUrl: '/season/SUMMER_2026',
  },
};

export const OnSeasonPage: Story = {
  args: {
    currentPath: '/season/SUMMER_2026',
    seasonUrl: '/season/SUMMER_2026',
  },
};

export const OnAiringPage: Story = {
  args: {
    currentPath: '/airing',
    seasonUrl: '/season/SUMMER_2026',
  },
};

export const OnBrowsePage: Story = {
  args: {
    currentPath: '/search',
    seasonUrl: '/season/SUMMER_2026',
  },
};
