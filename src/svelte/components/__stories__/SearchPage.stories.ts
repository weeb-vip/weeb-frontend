import type { Meta, StoryObj } from '@storybook/svelte';
import { writable } from 'svelte/store';
import SearchPage from '../SearchPage.svelte';
import {
  SearchPageBloc,
  type CatalogSearchPort,
  type CatalogSearchResponse,
  type RoutePort,
  type UserListPort,
} from '../SearchPage.bloc.svelte';
import type { GenreFacet, Hit } from '../SearchPage.results';

/**
 * A real address bar, in memory.
 *
 * The whole page hangs off the URL -- chips, the query and the back button all
 * go through it -- so a store plus a setter is enough to make the cycle run in
 * a story: clicking a genre writes a search string, the store updates, the
 * effect syncs and a search runs. Nothing is mocked except the router.
 */
function stubRoute(initialSearch = ''): RoutePort {
  const url = writable({ pathname: '/search', search: initialSearch });
  return {
    url,
    replace: (search) => url.set({ pathname: '/search', search }),
  };
}

const GENRES: GenreFacet[] = [
  ['Action', 8421], ['Comedy', 7788], ['Fantasy', 6120], ['Drama', 5904],
  ['Adventure', 5310], ['Sci-Fi', 4402], ['Romance', 4180], ['Slice of Life', 3311],
  ['Supernatural', 2980], ['Mystery', 2110], ['Sports', 1544], ['Horror', 1288],
  ['Mecha', 1102], ['Psychological', 980], ['Music', 744], ['Historical', 610],
].map(([name, count]) => ({ name: name as string, count: count as number }));

function hit(id: number, title: string, year: number, tags: string[] = ['Action']): Hit {
  return {
    objectID: `a-${id}`,
    id: `a-${id}`,
    url_slug: title.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
    title_en: title,
    title_jp: title,
    synopsis: 'A show about which a great deal could be said, and here is some of it.',
    genres: JSON.stringify(tags),
    studios: JSON.stringify(['Studio Pierrot']),
    episodes: 12 + (id % 4) * 12,
    rating: String(7 + (id % 30) / 10),
    status: id % 3 === 0 ? 'CURRENTLY_AIRING' : 'FINISHED_AIRING',
    start_date: `${year}-04-05T00:00:00Z`,
  };
}

const TITLES = [
  'Cowboy Bebop', 'Sousou no Frieren', 'Steins;Gate', 'Mushishi', 'Monster',
  'Ping Pong the Animation', 'Chainsaw Man', 'Vinland Saga', 'Odd Taxi',
  'Bocchi the Rock!', 'Dungeon Meshi', 'Kaiju No. 8', 'Blue Lock',
  'Jujutsu Kaisen', 'Apothecary Diaries', 'Dan Da Dan', 'Zom 100',
  'Skip and Loafer', 'Heavenly Delusion', 'Oshi no Ko', 'Undead Unluck',
  'Ranking of Kings', 'Wonder Egg Priority', 'Sonny Boy',
];

const HITS = TITLES.map((title, i) => hit(i + 1, title, 1998 + i));

function work(id: number, title: string, type: string): Hit {
  return {
    objectID: `w-${id}`,
    id: `w-${id}`,
    slug: title.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
    title_en: title,
    type,
    published_from: '2005-04-13T00:00:00Z',
    score: 8.6,
    description: 'The source the anime was adapted from.',
    authors: ['Yukimura, Makoto'],
    volumes: 28,
    chapters: 219,
  };
}

const WORKS = [work(1, 'Vinland Saga', 'MANGA'), work(2, 'Spice and Wolf', 'LIGHT_NOVEL')];

/** Algolia, replaced by a fixed answer that still honours page size and genre. */
function stubSearch(
  hits: Hit[],
  {
    total = hits.length,
    works = WORKS,
    genres = GENRES,
  }: { total?: number; works?: Hit[]; genres?: GenreFacet[] } = {},
): CatalogSearchPort {
  return {
    async search(request): Promise<CatalogSearchResponse> {
      const start = request.page * request.hitsPerPage;
      return {
        hits: hits.slice(start, start + request.hitsPerPage),
        total,
        works: request.includeWorks ? works : [],
      };
    },
    async genreFacets() {
      return genres;
    },
  };
}

/** A search that never settles, so the page stays on its skeletons. */
const neverResolves: CatalogSearchPort = {
  search: () => new Promise(() => {}),
  genreFacets: () => new Promise(() => {}),
};

/** Every request fails: the page falls back to its no-results state. */
const failing: CatalogSearchPort = {
  search: async () => {
    throw new Error('algolia unreachable');
  },
  genreFacets: async () => GENRES,
};

/** Nobody is signed in, so no card carries a list badge. */
const signedOut: UserListPort = { load: async () => new Map() };

/** A signed-in viewer with a few of these already on their list. */
const withList: UserListPort = {
  load: async () =>
    new Map([
      ['a-1', 'COMPLETED'],
      ['a-2', 'WATCHING'],
      ['a-3', 'PLANTOWATCH'],
      ['a-4', 'DROPPED'],
      ['a-5', 'ONHOLD'],
    ]),
};

function bloc(
  search: CatalogSearchPort,
  initialSearch = '',
  userList: UserListPort = signedOut,
): SearchPageBloc {
  return new SearchPageBloc({ search, userList, route: stubRoute(initialSearch) });
}

const meta = {
  title: 'Pages/SearchPage',
  component: SearchPage,
  tags: ['autodocs'],
  parameters: { layout: 'fullscreen' },
} satisfies Meta<typeof SearchPage>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Nothing searched yet: the genre strip over the browse placeholder. */
export const Idle: Story = {
  args: { bloc: bloc(stubSearch(HITS)) },
};

/** Facets and results both still in flight -- chip skeletons and card skeletons. */
export const Loading: Story = {
  args: { bloc: bloc(neverResolves, '?query=frieren') },
};

/** A query that matched: the grid, the count, and the works section under it. */
export const Populated: Story = {
  args: { bloc: bloc(stubSearch(HITS), '?query=frieren') },
};

/** The same results with a signed-in viewer, so the list badges appear. */
export const WithUserList: Story = {
  args: { bloc: bloc(stubSearch(HITS), '?query=frieren', withList) },
};

/** List view: the same page as rows, badges and score included. */
export const ListView: Story = {
  args: {
    bloc: (() => {
      const b = bloc(stubSearch(HITS), '?query=frieren', withList);
      b.setViewMode('list');
      return b;
    })(),
  },
};

/** A genre chip selected: the active-filters row, and no works section. */
export const FiltersApplied: Story = {
  args: {
    bloc: (() => {
      const b = bloc(stubSearch(HITS), '?genre=Action');
      b.setStatus('CURRENTLY_AIRING');
      return b;
    })(),
  },
};

/** Deep in a large result set: the shared Pagination, with its per-page select. */
export const Paginated: Story = {
  args: {
    bloc: (() => {
      const b = bloc(stubSearch(HITS, { total: 1204, works: [] }), '?query=a');
      b.goToPage(0);
      return b;
    })(),
  },
};

/** A query nothing matched: the shared EmptyState with a way to clear filters. */
export const NoResults: Story = {
  args: { bloc: bloc(stubSearch([], { total: 0, works: [] }), '?query=qqqzzz') },
};

/** Search itself failed. It reads as "no results" -- there is nothing to show. */
export const SearchFailed: Story = {
  args: { bloc: bloc(failing, '?query=frieren') },
};

/** Titles far wider than a card, to check the grid does not reflow around one. */
export const LongTitles: Story = {
  args: {
    bloc: bloc(
      stubSearch(
        [
          hit(1, 'The Exiled Heavy Knight Knows How to Game the System and Does So Relentlessly', 2024),
          hit(2, 'I Was Reincarnated as the Seventh Prince and Will Optimise My Magic However I Please', 2024),
          hit(3, 'That Time I Got Reincarnated as a Slime and Kept Getting Longer Season Titles', 2018),
        ],
        { works: [] },
      ),
      '?query=the',
    ),
  },
};
