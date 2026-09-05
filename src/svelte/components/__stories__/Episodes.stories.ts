import type { Meta, StoryObj } from '@storybook/svelte';
import Episodes from '../Episodes.svelte';
import { EpisodesBloc, type EpisodeLike } from '../Episodes.bloc.svelte';

/** Pinned, so "aired" and "next up" mean the same thing in every snapshot. */
const NOW = new Date('2024-01-20T12:00:00Z');

function series(count: number, startWeek: string, titled = true): EpisodeLike[] {
  const start = new Date(startWeek).getTime();
  return Array.from({ length: count }, (_, i) => ({
    id: `ep-${i + 1}`,
    episodeNumber: i + 1,
    titleEn: titled ? `Episode ${i + 1}: The one where something happens` : null,
    titleJp: titled ? `第${i + 1}話` : null,
    airDate: new Date(start + i * 7 * 24 * 60 * 60 * 1000).toISOString(),
  }));
}

/** A part-aired season: eleven behind us, the twelfth this Saturday, then TBA. */
const AIRING: EpisodeLike[] = [
  ...series(13, '2023-11-04T15:00:00Z'),
  { id: 'ep-14', episodeNumber: 14, titleEn: null, titleJp: null, airDate: null },
];

interface SourceOverrides {
  episodes?: EpisodeLike[];
  watchedCount?: number;
  watchedNumbers?: Set<number> | null;
  canTrack?: boolean;
  pending?: boolean;
}

/** A bloc on a pinned clock, whose watch intents go to the console instead of the API. */
function bloc(overrides: SourceOverrides = {}) {
  const source = {
    episodes: AIRING,
    watchedCount: 0,
    watchedNumbers: null as Set<number> | null,
    canTrack: false,
    pending: false,
    ...overrides,
  };
  return new EpisodesBloc({
    source: () => source,
    now: () => NOW,
    watch: (intent) => console.info('[watch]', intent),
  });
}

const meta = {
  title: 'Show/Episodes',
  component: Episodes,
  tags: ['autodocs'],
} satisfies Meta<typeof Episodes>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Signed out: newest first, no watch controls, and the next episode carries its time. */
export const SignedOut: Story = {
  args: {
    episodes: AIRING,
    bloc: bloc(),
  },
};

/** On the viewer's list, with per-episode ticks from the watched-episodes query. */
export const Trackable: Story = {
  args: {
    episodes: AIRING,
    canTrack: true,
    watchedCount: 8,
    watchedNumbers: new Set([1, 2, 3, 5, 8]),
    bloc: bloc({
      canTrack: true,
      watchedCount: 8,
      watchedNumbers: new Set([1, 2, 3, 5, 8]),
    }),
  },
};

/**
 * The moment before the per-episode query answers: `watchedNumbers` is null, so
 * the list falls back to "up to N" rather than showing everything unwatched.
 */
export const WatchedCountFallback: Story = {
  args: {
    episodes: AIRING,
    canTrack: true,
    watchedCount: 6,
    watchedNumbers: null,
    bloc: bloc({ canTrack: true, watchedCount: 6, watchedNumbers: null }),
  },
};

/** A write is in flight, so every tick is inert until it lands. */
export const Pending: Story = {
  args: {
    episodes: AIRING,
    canTrack: true,
    pending: true,
    watchedNumbers: new Set([1, 2]),
    bloc: bloc({ canTrack: true, pending: true, watchedNumbers: new Set([1, 2]) }),
  },
};

/** Nothing has aired yet: every row is future, and episode 1 is the one to watch for. */
export const NothingAiredYet: Story = {
  args: {
    episodes: series(12, '2024-04-06T15:00:00Z'),
    bloc: bloc({ episodes: series(12, '2024-04-06T15:00:00Z') }),
  },
};

/** Untitled rows -- "TBA" instead of a blank column, which is most of a fresh season. */
export const UntitledEpisodes: Story = {
  args: {
    episodes: series(6, '2024-02-03T15:00:00Z', false),
    bloc: bloc({ episodes: series(6, '2024-02-03T15:00:00Z', false) }),
  },
};

/**
 * A long-running show. Only the first 24 rows render until the reader asks for
 * the rest -- the reason this list stopped shipping 500 rows into every payload.
 */
export const LongRun: Story = {
  args: {
    episodes: series(500, '2015-01-08T15:00:00Z'),
    bloc: bloc({ episodes: series(500, '2015-01-08T15:00:00Z') }),
  },
};

/** One episode: the count line has to say "1 episode", not "1 episodes". */
export const SingleEpisode: Story = {
  args: {
    episodes: series(1, '2023-12-25T15:00:00Z'),
    bloc: bloc({ episodes: series(1, '2023-12-25T15:00:00Z') }),
  },
};
