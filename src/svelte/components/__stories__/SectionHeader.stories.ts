import type { Meta, StoryObj } from '@storybook/svelte';
import SectionHeader from '../SectionHeader.svelte';

const meta = {
  title: 'Design System/SectionHeader',
  component: SectionHeader,
  tags: ['autodocs'],
} satisfies Meta<typeof SectionHeader>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Title plus a "view all" link, which is the usual shelf heading. */
export const WithLink: Story = {
  args: {
    title: 'Trending This Season',
    href: '/season/2026/spring',
    linkText: 'View All',
  },
};

/** No href or link text, so only the heading renders. */
export const WithoutLink: Story = {
  args: {
    title: 'Popular Anime',
    href: '',
    linkText: '',
  },
};
