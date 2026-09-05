import { readable } from 'svelte/store';
import type { Meta, StoryObj } from '@storybook/svelte';
import HomepageSSR from '../HomepageSSR.svelte';
import { createQueryClient } from '../../services/query-client';
import {
  HomepageBloc,
  type AiringQueryPort,
  type HomeAnime,
  type HomeQueryPort,
  type HomepageDeps,
  type PublishingWork,
  type SeasonalQueryPort,
  type ViewportPort,
} from '../HomepageSSR.bloc.svelte';

/** Fixed clock: the hero countdown and the rail are the same every render. */
const NOW = new Date('2026-03-11T12:00:00Z');

function at(hoursFromNow: number): string {
  return new Date(NOW.getTime() + hoursFromNow * 60 * 60 * 1000).toISOString();
}

function anime(
  id: string,
  titleEn: string,
  rating: string,
  studio: string,
  tags: string[],
  extra: Partial<HomeAnime> = {},
): HomeAnime {
  return {
    id,
    slug: id,
    titleEn,
    titleJp: titleEn,
    description: `${titleEn} — a homepage shelf entry.`,
    rating,
    status: 'AIRING',
    tags,
    studios: [studio],
    episodeCount: 12,
    duration: '24 min',
    startDate: '2026-01-05',
    imageUrl: `https://example.invalid/${id}.jpg`,
    ...extra,
  };
}

const AIRING: HomeAnime[] = [
  anime('frieren', 'Frieren: Beyond Journey’s End', '8.94', 'Madhouse', ['Adventure', 'Fantasy'], {
    nextEpisode: { episodeNumber: 29, airTime: at(3.1) },
    userAnime: { status: 'WATCHING' },
  }),
  anime('dandadan', 'Dandadan', '8.51', 'Science SARU', ['Action', 'Comedy'], {
    nextEpisode: { episodeNumber: 8, airTime: at(9) },
  }),
  anime('apothecary', 'The Apothecary Diaries', '8.73', 'OLM', ['Drama', 'Mystery'], {
    nextEpisode: { episodeNumber: 17, airTime: at(26) },
    userAnime: { status: 'WATCHING' },
  }),
  anime('sakamoto', 'Sakamoto Days', '8.02', 'TMS', ['Action'], {
    nextEpisode: { episodeNumber: 4, airTime: at(-0.2) },
  }),
  anime('spy-family', 'Spy x Family', '7.71', 'Wit Studio', ['Action', 'Comedy'], {
    nextEpisode: { episodeNumber: 3, airTime: at(50) },
  }),
];

const TOP_RATED: HomeAnime[] = [
  anime('fmab', 'Fullmetal Alchemist: Brotherhood', '9.10', 'Bones', ['Action', 'Adventure']),
  anime('steins-gate', 'Steins;Gate', '9.07', 'White Fox', ['Sci-Fi', 'Thriller']),
  anime('gintama', 'Gintama', '9.04', 'Sunrise', ['Comedy']),
  anime('hunterxhunter', 'Hunter x Hunter', '9.03', 'Madhouse', ['Adventure']),
  anime('bebop', 'Cowboy Bebop', '8.75', 'Sunrise', ['Sci-Fi']),
  anime('monster', 'Monster', '8.87', 'Madhouse', ['Drama', 'Thriller']),
  anime('gurren', 'Gurren Lagann', '8.63', 'Gainax', ['Action', 'Mecha']),
  anime('mob', 'Mob Psycho 100', '8.50', 'Bones', ['Action', 'Comedy']),
];

const SEASONAL: HomeAnime[] = TOP_RATED.map((show, i) =>
  anime(`seasonal-${i}`, `Spring 2026 Entry ${i + 1}`, show.rating!, show.studios![0], show.tags!),
);

const WORKS: PublishingWork[] = [
  { id: 'berserk', titleEn: 'Berserk', type: 'MANGA', score: 9.4, publishedFrom: '1989-08-25', urlSlug: 'berserk' },
  { id: 'vagabond', titleEn: 'Vagabond', type: 'MANGA', score: 9.2, publishedFrom: '1998-09-03', urlSlug: 'vagabond' },
  { id: 'oyasumi', titleEn: 'Oyasumi Punpun', type: 'MANGA', score: 9.0, publishedFrom: '2007-03-15', urlSlug: 'oyasumi-punpun' },
  // No slug: dropped rather than rendered as a card that goes nowhere.
  { id: 'unslugged', titleEn: 'Not Yet Slugged', type: 'MANGA', score: 8.8, publishedFrom: '2020-01-01', urlSlug: null },
];

function stubHome(result: 'ok' | 'empty' | 'never'): HomeQueryPort {
  return () => ({
    queryKey: ['story-home', result],
    queryFn: async () => {
      if (result === 'never') return new Promise<{ topRatedAnime: HomeAnime[] }>(() => {});
      return { topRatedAnime: result === 'empty' ? [] : TOP_RATED };
    },
  });
}

function stubAiring(result: 'ok' | 'empty' | 'never'): AiringQueryPort {
  return (startDate, endDate, days, limit) => ({
    queryKey: ['story-home-airing', result, startDate.toISOString(), days, limit],
    queryFn: async () => {
      if (result === 'never') return new Promise<{ currentlyAiring: HomeAnime[] }>(() => {});
      return { currentlyAiring: result === 'empty' ? [] : AIRING };
    },
  });
}

function stubSeasonal(result: 'ok' | 'empty' | 'never'): SeasonalQueryPort {
  return (season, limit) => ({
    queryKey: ['story-home-seasonal', result, season, limit],
    queryFn: async () => {
      if (result === 'never') return new Promise<{ animeBySeasons: HomeAnime[] }>(() => {});
      return { animeBySeasons: result === 'empty' ? [] : SEASONAL };
    },
  });
}

/** A viewport tier as two plain stores, rather than a live `matchMedia`. */
function viewport(tier: 'desktop' | 'tablet' | 'phone'): ViewportPort {
  return {
    isPhone: readable(tier === 'phone'),
    isTablet: readable(tier === 'tablet'),
  };
}

const SOURCE = {
  homeData: null,
  currentlyAiringData: null,
  seasonalData: null,
  publishingWorksData: { currentlyPublishingWorks: WORKS },
  currentSeason: 'SPRING_2026',
  isTokenExpired: false,
};

function bloc(
  result: 'ok' | 'empty' | 'never',
  overrides: Partial<HomepageDeps> = {},
  after?: (bloc: HomepageBloc) => void,
): HomepageBloc {
  const built = new HomepageBloc({
    source: () => SOURCE,
    home: stubHome(result),
    airing: stubAiring(result),
    seasonal: stubSeasonal(result),
    queryClient: createQueryClient(),
    auth: readable({ isLoggedIn: true, isAuthInitialized: true }),
    viewport: viewport('desktop'),
    session: { getAuthToken: () => 'token', getRefreshToken: () => null, clearTokens: () => {} },
    notifications: { triggerImmediateUpdate: () => {} },
    clock: () => NOW,
    ...overrides,
  });
  after?.(built);
  return built;
}

const meta = {
  title: 'Pages/HomepageSSR',
  component: HomepageSSR,
  parameters: { layout: 'fullscreen' },
  tags: ['autodocs'],
} satisfies Meta<typeof HomepageSSR>;

export default meta;
type Story = StoryObj<typeof meta>;

/** The whole page: airing hero and rail, then every shelf. */
export const Populated: Story = {
  args: { currentSeason: 'SPRING_2026', bloc: bloc('ok') },
};

/** Every query still in flight: the season shelf shows its placeholders. */
export const Loading: Story = {
  args: {
    currentSeason: 'SPRING_2026',
    bloc: bloc('never', {}, (b) => b.selectSeason('SUMMER_2026')),
  },
};

/**
 * Nothing is airing, so the hero falls back to the best-rated show rather than
 * leaving the top of the page empty.
 */
export const NothingAiring: Story = {
  args: {
    currentSeason: 'SPRING_2026',
    bloc: bloc('ok', { airing: stubAiring('empty') }),
  },
};

/** Every query answered with nothing: no hero at all, just the tag browser. */
export const EverythingEmpty: Story = {
  args: { currentSeason: 'SPRING_2026', bloc: bloc('empty') },
};

/** Switched to a season the page was not rendered with -- placeholders, then cards. */
export const SeasonSwitched: Story = {
  args: {
    currentSeason: 'SPRING_2026',
    bloc: bloc('ok', {}, (b) => b.selectSeason('SUMMER_2026')),
  },
};

/**
 * Signed out: `userAnime` is null on every row, so the "airing from your list"
 * shelf does not render at all rather than rendering empty.
 */
export const SignedOut: Story = {
  args: {
    currentSeason: 'SPRING_2026',
    bloc: bloc('ok', {
      auth: readable({ isLoggedIn: false, isAuthInitialized: true }),
      airing: (startDate, endDate, days, limit) => ({
        queryKey: ['story-home-airing-signed-out', startDate.toISOString(), days, limit],
        queryFn: async () => ({
          currentlyAiring: AIRING.map((show) => ({ ...show, userAnime: null })),
        }),
      }),
    }),
  },
};

/** A phone caps each shelf at six, so a section is three rows rather than ten. */
export const PhoneShelves: Story = {
  args: {
    currentSeason: 'SPRING_2026',
    bloc: bloc('ok', { viewport: viewport('phone') }),
  },
};

/** A tablet sits between the two, at twelve. */
export const TabletShelves: Story = {
  args: {
    currentSeason: 'SPRING_2026',
    bloc: bloc('ok', { viewport: viewport('tablet') }),
  },
};
