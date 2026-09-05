import type { Meta, StoryObj } from '@storybook/svelte';
import CurrentlyAiringPage from '../CurrentlyAiringPage.svelte';
import { createQueryClient } from '../../services/query-client';
import {
  CurrentlyAiringPageBloc,
  type AiringQueryPort,
  type CurrentlyAiringDeps,
} from '../CurrentlyAiringPage.bloc.svelte';
import type { AiringShow } from '../CurrentlyAiringPage.schedule';

/**
 * A fixed clock, so the countdowns, the "Today" badge and which square is
 * ringed are the same in every screenshot. Wednesday, 11 March 2026, midday.
 */
const NOW = new Date('2026-03-11T12:00:00Z');

/** An air time relative to the fixed clock, in hours. */
function at(hoursFromNow: number): string {
  return new Date(NOW.getTime() + hoursFromNow * 60 * 60 * 1000).toISOString();
}

function show(
  id: string,
  title: string,
  episodes: { episodeNumber: number; airTime: string }[],
  onList = false,
): AiringShow {
  return {
    id,
    slug: id,
    titleEn: title,
    titleJp: title,
    duration: '24 min',
    imageUrl: `https://example.invalid/${id}.jpg`,
    userAnime: onList ? { status: 'WATCHING' } : null,
    episodes,
  };
}

const SHOWS: AiringShow[] = [
  // Just started -- the LIVE badge.
  show('kaiju-no-9', 'Kaiju No. 9', [{ episodeNumber: 11, airTime: at(-0.2) }], true),
  // Earlier today, past the live window.
  show('sakamoto-days', 'Sakamoto Days', [{ episodeNumber: 4, airTime: at(-5) }]),
  // Later today.
  show('frieren', 'Frieren: Beyond Journey’s End', [{ episodeNumber: 29, airTime: at(3.1) }], true),
  show('dandadan', 'Dandadan', [{ episodeNumber: 8, airTime: at(9) }]),
  // Tomorrow and the days after, so the schedule has several day sections.
  show('apothecary', 'The Apothecary Diaries', [{ episodeNumber: 17, airTime: at(26) }], true),
  show('spy-family', 'Spy x Family', [{ episodeNumber: 3, airTime: at(31) }]),
  show('oshi-no-ko', '【Oshi no Ko】', [{ episodeNumber: 6, airTime: at(50) }]),
  show('vinland', 'Vinland Saga', [{ episodeNumber: 22, airTime: at(74) }]),
  // A long way out, to exercise the "In Nd Nh" countdown and the load-more.
  show('bocchi', 'Bocchi the Rock!', [{ episodeNumber: 2, airTime: at(200) }]),
  show('mushoku', 'Mushoku Tensei', [{ episodeNumber: 14, airTime: at(340) }]),
  show('exiled-knight', 'The Exiled Heavy Knight Knows How to Game the System', [
    { episodeNumber: 5, airTime: at(410) },
  ]),
];

/** The airing source, stubbed: answers, answers with nothing, hangs, or fails. */
function stubAiring(result: 'ok' | 'empty' | 'never' | 'fail', shows = SHOWS): AiringQueryPort {
  return (startDate, endDate, days, limit) => ({
    queryKey: ['story-airing', result, startDate.toISOString(), endDate?.toISOString(), days, limit],
    queryFn: async () => {
      if (result === 'never') return new Promise<{ currentlyAiring: AiringShow[] }>(() => {});
      if (result === 'fail') throw new Error('gateway.weeb.vip returned 503');
      return { currentlyAiring: result === 'empty' ? [] : shows };
    },
  });
}

function bloc(
  result: 'ok' | 'empty' | 'never' | 'fail',
  overrides: Partial<CurrentlyAiringDeps> = {},
  after?: (bloc: CurrentlyAiringPageBloc) => void,
): CurrentlyAiringPageBloc {
  const built = new CurrentlyAiringPageBloc({
    source: () => ({ ssrData: null }),
    airing: stubAiring(result),
    // Its own client per story, so a story that is meant to be loading is not
    // served the previous story's cache.
    queryClient: createQueryClient(),
    clock: () => NOW,
    localZone: () => 'Asia/Tokyo',
    navigate: () => {},
    addAnime: { add: () => {} },
    ...overrides,
  });
  after?.(built);
  return built;
}

const meta = {
  title: 'Pages/CurrentlyAiringPage',
  component: CurrentlyAiringPage,
  parameters: { layout: 'fullscreen' },
  tags: ['autodocs'],
} satisfies Meta<typeof CurrentlyAiringPage>;

export default meta;
type Story = StoryObj<typeof meta>;

/** The schedule: a week of days, each a scrollable row of episode cards. */
export const Schedule: Story = {
  args: { bloc: bloc('ok') },
};

/** Waiting on the query -- placeholder day sections, no invented content. */
export const Loading: Story = {
  args: { bloc: bloc('never') },
};

/** The fetch failed. A banner with a retry, not an empty schedule. */
export const FetchFailed: Story = {
  args: { bloc: bloc('fail') },
};

/** The query answered with nothing at all: genuinely no schedule to show. */
export const NothingAiring: Story = {
  args: { bloc: bloc('empty') },
};

/**
 * "My list only" on, over a set where nothing on the list is airing -- the
 * state that used to be an empty page, and now offers the way back out.
 */
export const FilteredToNothing: Story = {
  args: {
    bloc: bloc(
      'ok',
      { airing: stubAiring('ok', SHOWS.map((s) => ({ ...s, userAnime: null }))) },
      (b) => b.toggleMyListOnly(),
    ),
  },
};

/** Only the shows the visitor follows. */
export const MyListOnly: Story = {
  args: { bloc: bloc('ok', {}, (b) => b.toggleMyListOnly()) },
};

/** The month grid, nothing selected yet: the side panel invites a pick. */
export const CalendarView: Story = {
  args: { bloc: bloc('ok', {}, (b) => b.selectView('calendar')) },
};

/** A day with several episodes on it, listed in the side panel. */
export const CalendarDaySelected: Story = {
  args: {
    bloc: bloc('ok', {}, (b) => {
      b.selectView('calendar');
      b.selectDay('2026-03-12');
    }),
  },
};

/** A day nothing airs on: the square exists, the panel says so. */
export const CalendarQuietDay: Story = {
  args: {
    bloc: bloc('ok', {}, (b) => {
      b.selectView('calendar');
      b.selectDay('2026-03-19');
    }),
  },
};

/** The calendar while it is still fetching -- a full-height grid of squares. */
export const CalendarLoading: Story = {
  args: { bloc: bloc('never', {}, (b) => b.selectView('calendar')) },
};

/**
 * The same schedule read in a different timezone. Every clock face and every
 * day boundary moves together, which is the whole point of the picker -- it
 * used to be bound to a variable nothing read.
 */
export const InLondonTime: Story = {
  args: { bloc: bloc('ok', { localZone: () => 'Europe/London' }, (b) => b.selectTimezone('GMT')) },
};
