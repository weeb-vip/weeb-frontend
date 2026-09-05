import type { Meta, StoryObj } from '@storybook/svelte';
import SeasonPage from '../../../routes/season/[season]/+page.svelte';
import { createQueryClient } from '../../services/query-client';
import {
  SeasonPageBloc,
  type SeasonPageDeps,
  type SeasonalAnime,
  type SeasonalQueryPort,
} from '../SeasonPage.bloc.svelte';

/** Fixed clock, so "jump to current season" is offered consistently. */
const NOW = new Date('2026-03-11T12:00:00Z');

function anime(
  id: string,
  titleEn: string,
  rating: string | null,
  studio: string,
  tags: string[],
  onList: string | null = null,
): SeasonalAnime {
  return {
    id,
    slug: id,
    titleEn,
    titleJp: titleEn,
    description: `${titleEn} — a season entry used to exercise the grid.`,
    rating,
    status: 'AIRING',
    tags,
    studios: [studio],
    episodeCount: 12,
    startDate: '2026-04-05',
    imageUrl: `https://example.invalid/${id}.jpg`,
    userAnime: onList ? { status: onList } : null,
  };
}

const SEASON: SeasonalAnime[] = [
  anime('frieren', 'Frieren: Beyond Journey’s End', '8.94', 'Madhouse', ['Adventure', 'Drama', 'Fantasy'], 'WATCHING'),
  anime('apothecary', 'The Apothecary Diaries', '8.73', 'OLM', ['Drama', 'Mystery']),
  anime('dandadan', 'Dandadan', '8.51', 'Science SARU', ['Action', 'Comedy', 'Supernatural']),
  anime('sakamoto', 'Sakamoto Days', '8.02', 'TMS', ['Action', 'Comedy']),
  anime('oshi-no-ko', '【Oshi no Ko】', '7.88', 'Doga Kobo', ['Drama', 'Supernatural']),
  anime('spy-family', 'Spy x Family', '7.71', 'Wit Studio', ['Action', 'Comedy']),
  anime('vinland', 'Vinland Saga', '7.55', 'MAPPA', ['Action', 'Adventure', 'Drama']),
  anime('bocchi', 'Bocchi the Rock!', '7.30', 'CloverWorks', ['Comedy', 'Music']),
  anime('mushoku', 'Mushoku Tensei', '7.12', 'Studio Bind', ['Adventure', 'Fantasy']),
  anime('blue-box', 'Blue Box', '6.94', 'Telecom', ['Romance', 'Sports']),
  anime('kaiju', 'Kaiju No. 8', '6.80', 'Production I.G', ['Action', 'Sci-Fi']),
  anime('ranma', 'Ranma ½', '6.42', 'MAPPA', ['Comedy', 'Romance']),
  anime('undead', 'Undead Unluck', null, 'David Production', ['Action', 'Supernatural']),
  anime('nameless', 'A Title With No Rating At All', 'N/A', 'Studio Nowhere', ['Slice of Life']),
];

function stubSeasonal(result: 'ok' | 'empty' | 'never' | 'fail'): SeasonalQueryPort {
  return (season, limit) => ({
    queryKey: ['story-season', result, season, limit],
    queryFn: async () => {
      if (result === 'never') return new Promise<{ animeBySeasons: SeasonalAnime[] }>(() => {});
      if (result === 'fail') throw new Error('gateway.weeb.vip returned 503');
      return { animeBySeasons: result === 'empty' ? [] : SEASON };
    },
  });
}

function bloc(
  result: 'ok' | 'empty' | 'never' | 'fail',
  overrides: Partial<SeasonPageDeps> = {},
  after?: (bloc: SeasonPageBloc) => void,
): SeasonPageBloc {
  const built = new SeasonPageBloc({
    source: () => ({ season: 'SPRING_2026', seasonalData: null, ssrError: null }),
    seasonal: stubSeasonal(result),
    queryClient: createQueryClient(),
    clock: () => NOW,
    navigate: () => {},
    ...overrides,
  });
  after?.(built);
  return built;
}

const meta = {
  title: 'Pages/SeasonPage',
  component: SeasonPage,
  parameters: { layout: 'fullscreen' },
  tags: ['autodocs'],
  // The loader payload. The stories inject their own bloc, so what this feeds
  // is the page title, the breadcrumb, and the key the markup remounts on.
  args: { data: { season: 'SPRING_2026', displayName: 'Spring 2026' } },
} satisfies Meta<typeof SeasonPage>;

export default meta;
type Story = StoryObj<typeof meta>;

/** A full season: the top-five strip, the tag facets, and the grid. */
export const Populated: Story = {
  args: { bloc: bloc('ok') },
};

/** Waiting on the query -- sixteen poster placeholders, one shared shape. */
export const Loading: Story = {
  args: { bloc: bloc('never') },
};

/** The season loaded, and it is genuinely empty. */
export const NoTitles: Story = {
  args: { bloc: bloc('empty') },
};

/** The fetch failed: a distinct message from "this season is empty", with a retry. */
export const FetchFailed: Story = {
  args: { bloc: bloc('fail') },
};

/** Filtering narrows the grid, and the counter shows the denominator. */
export const TagFiltered: Story = {
  args: { bloc: bloc('ok', {}, (b) => b.toggleTag('Comedy')) },
};

/**
 * Tags narrow rather than widen, so two unrelated ones can match nothing --
 * the state that needs a way back out rather than a blank page.
 */
export const FilteredToNothing: Story = {
  args: {
    bloc: bloc('ok', {}, (b) => {
      b.toggleTag('Music');
      b.toggleTag('Sports');
    }),
  },
};

/** All the facets, rather than the first twelve. */
export const AllTagsExpanded: Story = {
  args: { bloc: bloc('ok', {}, (b) => b.toggleShowAllTags()) },
};

/**
 * A season that is not the current one: the header, tabs and year strip all
 * move together, and the "jump to current season" shortcut appears.
 */
export const ADifferentSeason: Story = {
  args: {
    data: { season: 'WINTER_2025', displayName: 'Winter 2025' },
    bloc: bloc('ok', {
      source: () => ({ season: 'WINTER_2025', seasonalData: null, ssrError: null }),
    }),
  },
};

/** The season the clock says we are in -- no "jump to current season" link. */
export const CurrentSeason: Story = {
  args: {
    bloc: bloc('ok', {
      source: () => ({ season: 'SPRING_2026', seasonalData: null, ssrError: null }),
    }),
  },
};

/** The loader failed on the server; the page still renders the chrome. */
export const ServerLoadFailed: Story = {
  args: {
    data: {
      season: 'SPRING_2026',
      displayName: 'Spring 2026',
      ssrError: 'Seasonal query timed out',
    },
    bloc: bloc('empty', {
      source: () => ({
        season: 'SPRING_2026',
        seasonalData: null,
        ssrError: 'Seasonal query timed out',
      }),
    }),
  },
};
