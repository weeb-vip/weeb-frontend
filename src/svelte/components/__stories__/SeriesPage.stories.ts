import type { Meta, StoryObj } from '@storybook/svelte';
import { readable } from 'svelte/store';
import SeriesPage from '../../../routes/series/[id]/+page.svelte';
import { SeriesPageBloc, type SeriesEntry } from '../SeriesPage.bloc.svelte';

/**
 * The preferences store, replaced by a fixed answer. The real one reads and
 * writes localStorage on construction, which a story canvas should not do.
 */
const english = readable({ titleLanguage: 'english' as const });

function entry(
  id: string,
  titleEn: string,
  seasonNumber: number | null,
  startDate: string | null,
  type = 'TV',
): SeriesEntry {
  return {
    id,
    slug: titleEn.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
    titleEn,
    titleJp: titleEn,
    seasonNumber,
    startDate,
    type,
    tags: ['Action', 'Fantasy'],
    episodeCount: 12,
    description: 'A party of adventurers, some years after the fact.',
  };
}

const FULL_SERIES: SeriesEntry[] = [
  entry('1', 'Frieren: Beyond Journey’s End', 1, '2023-09-29'),
  entry('2', 'Frieren: Beyond Journey’s End Season 2', 2, '2026-01-16'),
  entry('3', 'Frieren: A Short Rest', 0, '2024-04-01', 'Special'),
  entry('4', 'Frieren: The Movie', null, '2025-08-01', 'Movie'),
];

function bloc(entries: SeriesEntry[], ssrError: string | null = null, seriesTitle = 'Frieren') {
  return new SeriesPageBloc({
    source: () => ({ entries, seriesTitle, ssrError }),
    preferences: english,
  });
}

const meta = {
  title: 'Pages/SeriesPage',
  component: SeriesPage,
  tags: ['autodocs'],
  parameters: { layout: 'fullscreen' },
  // The loader payload. Each story injects the bloc that actually renders the
  // groups, so what this carries is the page's title, canonical and breadcrumb.
  args: { data: { seriesId: '1', seriesSlug: 'frieren', seriesTitle: 'Frieren' } },
} satisfies Meta<typeof SeriesPage>;

export default meta;
type Story = StoryObj<typeof meta>;

/** The ordinary case: numbered seasons, then specials, then what could not be placed. */
export const Populated: Story = {
  args: {
    bloc: bloc(FULL_SERIES),
  },
};

/** A series with one entry -- the summary line has to stay grammatical. */
export const SingleEntry: Story = {
  args: {
    bloc: bloc([FULL_SERIES[0]]),
  },
};

/** Nothing derived a season for any of them, so everything lands in "Other entries". */
export const NoSeasonsDerived: Story = {
  args: {
    bloc: bloc(FULL_SERIES.map((e) => ({ ...e, seasonNumber: null }))),
  },
};

/** A series id that resolves to nothing: the empty state, not a blank page. */
export const NoEntries: Story = {
  args: {
    data: { seriesId: '9', seriesTitle: 'An empty series' },
    bloc: bloc([]),
  },
};

/** The loader failed -- the shared ErrorBanner rather than a bare line of grey text. */
export const LoadFailed: Story = {
  args: {
    data: { seriesId: '1', seriesTitle: 'Frieren', ssrError: 'anime-api returned 503' },
    bloc: bloc([], 'anime-api returned 503'),
  },
};

/** Titles wider than a card: the grid must not reflow around the longest one. */
export const LongTitles: Story = {
  args: {
    data: { seriesId: '2', seriesTitle: 'A series with a great deal to say' },
    bloc: bloc([
      entry(
        '1',
        'The Exiled Heavy Knight Knows How to Game the System and Will Not Be Returning to the Capital',
        1,
        '2024-01-05',
      ),
      entry(
        '2',
        'That Time I Got Reincarnated as a Slime and Then Got a Second Season of Considerable Length',
        2,
        '2025-01-05',
      ),
    ]),
  },
};
