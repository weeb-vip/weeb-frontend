import type { Meta, StoryObj } from '@storybook/svelte';
import SectionHeader from '../SectionHeader.svelte';

const meta = {
  title: 'Design System/SectionHeader',
  component: SectionHeader,
  tags: ['autodocs'],
} satisfies Meta<SectionHeader>;

export default meta;
type Story = StoryObj<typeof meta>;

export const WithLink: Story = {
  args: {
    title: 'Trending This Season',
    href: '/season/2026/spring',
    linkText: 'View All',
  },
};

export const WithoutLink: Story = {
  args: {
    title: 'Popular Anime',
    href: '',
    linkText: '',
  },
};
