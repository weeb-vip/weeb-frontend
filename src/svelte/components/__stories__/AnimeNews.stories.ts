import type { Meta, StoryObj } from '@storybook/svelte';
import AnimeNews from '../AnimeNews.svelte';

const ITEMS = [
  {
    id: 'n1',
    title: 'Season 2 confirmed for autumn',
    summary:
      'The official site announced a second season alongside a teaser visual, with the staff returning from the first.',
    category: 'announcement',
    publishedDate: '2024-05-18T09:00:00Z',
    sourceName: 'Official site',
    sourceUrl: 'https://example.com/announcement',
    language: 'ja',
    references: [
      { url: 'https://youtube.com/watch?v=abc', title: 'Teaser PV', kind: 'video' },
      { url: 'https://x.com/example/status/1', title: 'Staff post', kind: 'social' },
    ],
  },
  {
    id: 'n2',
    title: 'Episode 12 delayed a week',
    summary: 'The broadcast slot moves for a sports programme; streaming follows the same schedule.',
    category: 'release',
    episodeNumber: 12,
    publishedDate: '2024-05-02T11:30:00Z',
    sourceName: 'Broadcaster',
    sourceUrl: 'https://example.com/delay',
  },
  {
    id: 'n3',
    title: 'New character designer joins for the second cour',
    category: 'staff',
    publishedDate: '2024-04-11T08:00:00Z',
    sourceName: 'Anime News Network',
    sourceUrl: 'https://example.com/staff',
  },
  {
    id: 'n4',
    title: 'The finale is being called one of the year’s best',
    summary: 'Reviews collected across three outlets, all pointing at the same episode.',
    category: 'reception',
    publishedDate: '2024-03-28T19:45:00Z',
    sourceName: 'Review round-up',
  },
  {
    id: 'n5',
    title: 'A stray item with a category nobody has seen before',
    category: 'merchandise',
    publishedDate: '2024-03-02T00:00:00Z',
    sourceName: 'Shop',
    sourceUrl: 'https://example.com/shop',
  },
  {
    id: 'n6',
    title: 'An item the pipeline never dated',
    summary: 'It must never render as "Invalid Date", so it collects in a trailing group.',
    category: 'announcement',
    publishedDate: null,
    sourceName: 'Unknown',
  },
];

const meta = {
  title: 'Composites/Show/AnimeNews',
  component: AnimeNews,
  tags: ['autodocs'],
} satisfies Meta<typeof AnimeNews>;

export default meta;
type Story = StoryObj<typeof meta>;

/** The whole rail: several months, every category colour, and the undated group last. */
export const FullTimeline: Story = {
  args: {
    news: ITEMS,
  },
};

/**
 * The show page's cut: the five newest, with the link to the rest. "Newest" is
 * decided before the slice, not by the order the API happened to return.
 */
export const LimitedWithViewAll: Story = {
  args: {
    news: ITEMS,
    limit: 5,
    viewAllHref: '/anime/frieren/news',
  },
};

/** Limited, but with nowhere to send the reader: the "view all" link is simply absent. */
export const LimitedWithoutViewAll: Story = {
  args: {
    news: ITEMS,
    limit: 3,
  },
};

/** One story with references: media chips, each its own link, each with its host named. */
export const WithReferences: Story = {
  args: {
    news: [ITEMS[0]],
  },
};

/** Nothing dated at all -- one "Undated" group rather than a broken month heading. */
export const AllUndated: Story = {
  args: {
    news: [
      { id: 'u1', title: 'Undated one', publishedDate: null, sourceName: 'Unknown' },
      { id: 'u2', title: 'Undated two', publishedDate: 'not-a-date', sourceName: 'Unknown' },
    ],
  },
};

/** No news for this show yet -- the shared empty surface, not a dashed box of its own. */
export const Empty: Story = {
  args: {
    news: [],
  },
};

/** Entries with no usable title are dropped before anything renders. */
export const OnlyUntitledEntries: Story = {
  args: {
    news: [{ id: 'x', title: '   ', publishedDate: '2024-01-01T00:00:00Z' }],
  },
};
