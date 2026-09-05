import type { Meta, StoryObj } from '@storybook/svelte';
import AiringCalendar from '../AiringCalendar.svelte';
import { createQueryClient } from '../../services/query-client';
import { AiringCalendarBloc, type AiringCalendarDeps } from '../AiringCalendar.bloc.svelte';
import type { AiringShow } from '../CurrentlyAiringPage.schedule';
import type { AiringQueryPort } from '../CurrentlyAiringPage.bloc.svelte';

/** Fixed clock, so "today" is always the same ringed square. */
const NOW = new Date('2026-03-11T12:00:00Z');

function episodeOn(day: number, hour: number): string {
  return new Date(Date.UTC(2026, 2, day, hour, 0, 0)).toISOString();
}

const SHOWS: AiringShow[] = [
  {
    id: 'frieren',
    slug: 'frieren',
    titleEn: 'Frieren: Beyond Journey’s End',
    duration: '24 min',
    episodes: [
      { episodeNumber: 28, airTime: episodeOn(4, 14) },
      { episodeNumber: 29, airTime: episodeOn(11, 14) },
      { episodeNumber: 30, airTime: episodeOn(18, 14) },
      { episodeNumber: 31, airTime: episodeOn(25, 14) },
    ],
  },
  {
    id: 'dandadan',
    slug: 'dandadan',
    titleEn: 'Dandadan',
    duration: '24 min',
    episodes: [
      { episodeNumber: 7, airTime: episodeOn(5, 16) },
      { episodeNumber: 8, airTime: episodeOn(12, 16) },
      { episodeNumber: 9, airTime: episodeOn(19, 16) },
    ],
  },
  {
    id: 'apothecary',
    slug: 'apothecary',
    titleEn: 'The Apothecary Diaries',
    duration: '24 min',
    episodes: [
      { episodeNumber: 16, airTime: episodeOn(11, 9) },
      { episodeNumber: 17, airTime: episodeOn(18, 9) },
    ],
  },
  {
    id: 'sakamoto',
    slug: 'sakamoto',
    titleEn: 'Sakamoto Days',
    duration: '24 min',
    // Same day as two others, so one square has a scrollable stack.
    episodes: [{ episodeNumber: 4, airTime: episodeOn(11, 21) }],
  },
];

function stubAiring(result: 'ok' | 'empty' | 'never' | 'fail'): AiringQueryPort {
  return (startDate, endDate, days, limit) => ({
    queryKey: ['story-calendar', result, startDate.toISOString(), days, limit],
    queryFn: async () => {
      if (result === 'never') return new Promise<{ currentlyAiring: AiringShow[] }>(() => {});
      if (result === 'fail') throw new Error('gateway.weeb.vip returned 503');
      return { currentlyAiring: result === 'empty' ? [] : SHOWS };
    },
  });
}

function bloc(
  result: 'ok' | 'empty' | 'never' | 'fail',
  overrides: Partial<AiringCalendarDeps> = {},
  after?: (bloc: AiringCalendarBloc) => void,
): AiringCalendarBloc {
  const built = new AiringCalendarBloc({
    source: () => ({ ssrData: null, ssrError: null }),
    airing: stubAiring(result),
    queryClient: createQueryClient(),
    clock: () => NOW,
    localZone: () => 'Etc/UTC',
    ...overrides,
  });
  after?.(built);
  return built;
}

const meta = {
  title: 'Pages/AiringCalendar',
  component: AiringCalendar,
  parameters: { layout: 'fullscreen' },
  tags: ['autodocs'],
} satisfies Meta<typeof AiringCalendar>;

export default meta;
type Story = StoryObj<typeof meta>;

/** A month with episodes spread through it, today's square ringed. */
export const Month: Story = {
  args: { bloc: bloc('ok') },
};

/** The week view: the same data, seven taller cells. */
export const Week: Story = {
  args: { bloc: bloc('ok', {}, (b) => b.selectViewMode('week')) },
};

/**
 * Waiting on the query. The placeholder carries a plausible spread of rows so
 * the grid does not visibly reflow when the real month lands.
 */
export const Loading: Story = {
  args: { bloc: bloc('never') },
};

/** The fetch failed: say so and offer the retry. */
export const FetchFailed: Story = {
  args: { bloc: bloc('fail') },
};

/** A month with nothing scheduled in it at all. */
export const NothingAiring: Story = {
  args: { bloc: bloc('empty') },
};

/** A month away from today -- no square is ringed, and the data is empty here. */
export const AnotherMonth: Story = {
  args: { bloc: bloc('empty', {}, (b) => b.next()) },
};
