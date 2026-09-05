import type { Meta, StoryObj } from '@storybook/svelte';
import RelatedAnime from '../RelatedAnime.svelte';

const CURRENT = {
  id: 'anime-2',
  slug: 'frieren-s2',
  titleEn: 'Frieren: Beyond Journey’s End Season 2',
  titleJp: '葬送のフリーレン 第2期',
  type: 'TV',
  startDate: '2026-01-10',
  seasonNumber: 2,
  seriesId: 'series-1',
};

const SAME_SERIES = [
  {
    relation: 'SAME_SERIES',
    anime: {
      id: 'anime-1',
      slug: 'frieren',
      titleEn: 'Frieren: Beyond Journey’s End',
      type: 'TV',
      startDate: '2023-09-29',
      seasonNumber: 1,
    },
  },
  {
    relation: 'SAME_SERIES',
    anime: {
      id: 'anime-3',
      slug: 'frieren-special',
      titleEn: 'Frieren: The First Journey',
      type: 'Special',
      startDate: '2024-06-14',
      seasonNumber: 0,
    },
  },
];

const meta = {
  title: 'Composites/Show/RelatedAnime',
  component: RelatedAnime,
  tags: ['autodocs'],
} satisfies Meta<typeof RelatedAnime>;

export default meta;
type Story = StoryObj<typeof meta>;

/** The usual case: a series timeline in air-date order with "you are here" on the current entry. */
export const SameSeries: Story = {
  args: {
    related: SAME_SERIES,
    current: CURRENT,
  },
};

/** No current anime, so the timeline is just the other entries -- no highlighted row. */
export const WithoutCurrent: Story = {
  args: {
    related: SAME_SERIES,
    current: null,
  },
};

/** A relation kind this component has never heard of still renders, under the fallback heading. */
export const UnknownRelationKind: Story = {
  args: {
    related: [
      ...SAME_SERIES,
      {
        relation: 'SHARED_SOURCE',
        anime: {
          id: 'anime-9',
          slug: 'sousou-spinoff',
          titleEn: 'A spin-off with a title long enough to need the two-line clamp the cards use',
          type: 'ONA',
          startDate: null,
        },
      },
    ],
    current: CURRENT,
  },
};

/**
 * One same-series entry besides the current anime is not a timeline, so the
 * group is suppressed entirely and this renders nothing.
 */
export const SingleEntrySuppressed: Story = {
  args: {
    related: [SAME_SERIES[0]],
    current: null,
  },
};

/** Missing artwork and missing air dates: undated entries sort last and read "Unknown". */
export const MissingArtworkAndDates: Story = {
  args: {
    related: [
      { relation: 'SAME_SERIES', anime: { id: 'no-art-1', titleJp: 'タイトル未定', type: 'TV', startDate: null } },
      { relation: 'SAME_SERIES', anime: { id: 'no-art-2', titleEn: 'Announced, undated', type: 'Movie', startDate: null } },
      SAME_SERIES[0],
    ],
    current: null,
  },
};
