import type { Meta, StoryObj } from '@storybook/svelte';
import SectionHeader from './SectionHeader.svelte';

const meta = {
  title: 'Primitives/SectionHeader',
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

/**
 * The `sub` scale with its rule: the show page's section headings, which used
 * to be a second implementation inside `ShowSection`. The hairline runs from
 * the words to the edge of the column, so the heading measures the section.
 */
export const SubWithRule: Story = {
  args: {
    title: 'Characters & Staff',
    size: 'sub',
    rule: true,
  },
};

/**
 * The `eyebrow` scale: the label over a group inside a section, which used to
 * be a third implementation inside `RelatedAnime`.
 */
export const Eyebrow: Story = {
  args: {
    title: 'Same series',
    size: 'eyebrow',
    as: 'h3',
    href: '/series/12345',
    linkText: 'View all seasons →',
  },
};
