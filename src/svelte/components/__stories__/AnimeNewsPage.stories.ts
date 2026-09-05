import type { Meta, StoryObj } from '@storybook/svelte';
import { writable } from 'svelte/store';
import AnimeNewsPage from '../../../routes/anime/[slug]/news/+page.svelte';
import {
  AnimeNewsPageBloc,
  type AnimeNewsItem,
  type AnimeNewsPageData,
  type FeatureFlagPort,
  type RoutePort,
} from '../AnimeNewsPage.bloc.svelte';

/**
 * The real gate asks PostHog and then polls until the flag resolves. A story
 * has no PostHog, so it answers straight away -- and the poll never starts.
 */
function stubFlags(enabled: boolean): FeatureFlagPort {
  return { isEnabled: () => enabled };
}

/**
 * A real address bar, in memory. Category and page live in the URL, so a store
 * plus a setter is enough to make the whole cycle run: clicking a chip writes a
 * search string, the store updates, and the list re-cuts. Nothing is mocked
 * except the router.
 */
function stubRoute(initialSearch = ''): RoutePort {
  const pathname = '/anime/sousou-no-frieren/news';
  const url = writable({ pathname, search: initialSearch });

  return {
    url,
    replace: (to) => {
      const q = to.indexOf('?');
      url.set({ pathname, search: q === -1 ? '' : to.slice(q) });
    },
  };
}

const CATEGORIES = ['announcement', 'release', 'staff', 'reception'];

function item(n: number): AnimeNewsItem {
  const category = CATEGORIES[n % CATEGORIES.length];

  return {
    id: `n${n}`,
    title: [
      'Second season confirmed for autumn',
      'Episode delayed a week for a sports broadcast',
      'New character designer joins for the second cour',
      'The finale is being called one of the year’s best',
    ][n % 4],
    summary:
      'The official site posted the news alongside a visual, with most of the staff returning.',
    category,
    publishedDate: new Date(Date.UTC(2024, 11 - (n % 11), 1 + (n % 27))).toISOString(),
    sourceName: 'Anime News Network',
    sourceUrl: `https://example.com/story-${n}`,
  };
}

/** Enough stories to clear the filter threshold and spill onto a second page. */
const MANY = Array.from({ length: 14 }, (_, i) => item(i + 1));

function data(overrides: Partial<AnimeNewsPageData> = {}): AnimeNewsPageData {
  return {
    anime: { id: '154587', startDate: '2023-09-29T00:00:00Z', studios: ['Madhouse'] },
    news: MANY,
    animeTitle: "Frieren: Beyond Journey's End",
    animeTitleJp: '葬送のフリーレン',
    animeSlug: 'sousou-no-frieren',
    ssrError: null,
    ...overrides,
  };
}

function bloc(options: { enabled?: boolean; search?: string } = {}) {
  return new AnimeNewsPageBloc({
    flags: stubFlags(options.enabled ?? true),
    route: stubRoute(options.search ?? ''),
    // A story's answer is final, so the gate resolves on its first tick rather
    // than spending the real six-second budget waiting for PostHog.
    pollMs: 0,
    maxTries: 1,
  });
}

const meta = {
  title: 'Pages/AnimeNewsPage',
  component: AnimeNewsPage,
  tags: ['autodocs'],
  parameters: { layout: 'fullscreen' },
} satisfies Meta<typeof AnimeNewsPage>;

export default meta;
type Story = StoryObj<typeof meta>;

/** The full page: hero, category chips, the first ten stories and a pager. */
export const Default: Story = {
  args: {
    data: data(),
    bloc: bloc(),
  },
};

/** Page two, reached from the URL -- the count line reads "Showing 11–14". */
export const SecondPage: Story = {
  args: {
    data: data(),
    bloc: bloc({ search: '?page=2' }),
  },
};

/** A category selected: the chip counts still show the full totals, not the cut. */
export const Filtered: Story = {
  args: {
    data: data(),
    bloc: bloc({ search: '?category=staff' }),
  },
};

/**
 * A category with nothing in it. Unreachable by clicking -- a zero-count chip is
 * never rendered -- but a shared link outlives the data behind it.
 */
export const EmptyCategory: Story = {
  args: {
    data: data(),
    bloc: bloc({ search: '?category=merchandise' }),
  },
};

/** Too few stories to be worth filtering: no chips, no pager, just the list. */
export const TooFewForFilters: Story = {
  args: {
    data: data({ news: MANY.slice(0, 3) }),
    bloc: bloc(),
  },
};

/** The gateway failed. The hero stays, so a shared link still identifies the show. */
export const LoadFailed: Story = {
  args: {
    data: data({ news: [], ssrError: 'Failed to load news' }),
    bloc: bloc(),
  },
};

/** The flag is off: the hero stays and the list is replaced by one plain line. */
export const FlagOff: Story = {
  args: {
    data: data(),
    bloc: bloc({ enabled: false }),
  },
};
