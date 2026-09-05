import type { Meta, StoryObj } from '@storybook/svelte';
import { readable } from 'svelte/store';
import WorksBrowsePage from '../WorksBrowsePage.svelte';
import {
  WorksBrowsePageBloc,
  type ViewportPort,
  type WorkShelf,
  type WorkSummary,
} from '../WorksBrowsePage.bloc.svelte';

/**
 * The viewport store, pinned. The real one is matchMedia, so a story that
 * wanted the phone shelf size would otherwise have to be resized by hand.
 */
function viewport(tier: 'desktop' | 'tablet' | 'phone'): ViewportPort {
  return {
    isPhone: readable(tier === 'phone'),
    isTablet: readable(tier === 'tablet'),
  };
}

function work(id: number, titleEn: string, type = 'MANGA'): WorkSummary {
  return {
    id: `work-${id}`,
    urlSlug: titleEn.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
    titleEn,
    titleJp: titleEn,
    type,
    publishedFrom: `${1990 + (id % 30)}-04-01`,
    score: 7 + (id % 30) / 10,
  };
}

const TITLES = [
  'Berserk',
  'Vinland Saga',
  'Vagabond',
  'Monster',
  '20th Century Boys',
  'Oyasumi Punpun',
  'Chainsaw Man',
  'Dorohedoro',
  'Blame!',
  'Nausicaä of the Valley of the Wind',
  'Pluto',
  'Hellsing',
  'Claymore',
  'Homunculus',
  'Real',
];

const WORKS = TITLES.map((title, i) => work(i + 1, title));

const SHELVES: WorkShelf[] = [
  { sort: 'top', label: 'Highest rated', works: WORKS },
  { sort: 'popular', label: 'Most read', works: [...WORKS].reverse() },
  { sort: 'newest', label: 'Recently added', works: WORKS.slice(0, 8) },
];

function bloc(
  overrides: Partial<{
    shelves: WorkShelf[] | null;
    works: WorkSummary[];
    sort: string | null;
    total: number;
    page: number;
    totalPages: number;
    ssrError: string | null;
  }>,
  tier: 'desktop' | 'tablet' | 'phone' = 'desktop',
) {
  return new WorksBrowsePageBloc({
    source: () => ({
      heading: 'Manga',
      blurb: 'Manga, manhwa, manhua and one-shots — everything anime gets adapted from.',
      basePath: '/manga',
      shelves: null,
      works: [],
      sort: null,
      total: 0,
      page: 1,
      totalPages: 0,
      ssrError: null,
      ...overrides,
    }),
    viewport: viewport(tier),
  });
}

const base = {
  heading: 'Manga',
  blurb: 'Manga, manhwa, manhua and one-shots — everything anime gets adapted from.',
  basePath: '/manga',
};

const meta = {
  title: 'Pages/WorksBrowsePage',
  component: WorksBrowsePage,
  tags: ['autodocs'],
  parameters: { layout: 'fullscreen' },
} satisfies Meta<typeof WorksBrowsePage>;

export default meta;
type Story = StoryObj<typeof meta>;

/** The landing view: three shelves, each cut to the desktop count. */
export const Shelves: Story = {
  args: { ...base, shelves: SHELVES, bloc: bloc({ shelves: SHELVES }) },
};

/** The same shelves on a phone, where each holds six cards rather than twenty. */
export const ShelvesOnPhone: Story = {
  args: { ...base, shelves: SHELVES, bloc: bloc({ shelves: SHELVES }, 'phone') },
};

/** One shelf opened in full, mid-way through its pages -- both ellipses show. */
export const PagedMidway: Story = {
  args: {
    ...base,
    works: WORKS,
    sort: 'top',
    total: 2219,
    page: 12,
    totalPages: 89,
    bloc: bloc({ works: WORKS, sort: 'top', total: 2219, page: 12, totalPages: 89 }),
  },
};

/** The first page, where there is no "Previous" and no leading gap. */
export const PagedFirstPage: Story = {
  args: {
    ...base,
    works: WORKS,
    sort: 'top',
    total: 2219,
    page: 1,
    totalPages: 89,
    bloc: bloc({ works: WORKS, sort: 'top', total: 2219, page: 1, totalPages: 89 }),
  },
};

/** A page past the end of the data: the shared EmptyState, with a way back. */
export const PagedEmpty: Story = {
  args: {
    ...base,
    works: [],
    sort: 'top',
    total: 2219,
    page: 400,
    totalPages: 89,
    bloc: bloc({ works: [], sort: 'top', total: 2219, page: 400, totalPages: 89 }),
  },
};

/** Every shelf came back empty -- a real answer while the catalogue backfills. */
export const NothingHereYet: Story = {
  args: {
    ...base,
    shelves: SHELVES.map((shelf) => ({ ...shelf, works: [] })),
    bloc: bloc({ shelves: SHELVES.map((shelf) => ({ ...shelf, works: [] })) }),
  },
};

/** The loader failed: ErrorBanner in place of the shelves. */
export const LoadFailed: Story = {
  args: { ...base, ssrError: 'works-api timed out', bloc: bloc({ ssrError: 'works-api timed out' }) },
};

/** Titles far wider than a cover, to check the cards clip rather than stretch. */
export const LongTitles: Story = {
  args: {
    ...base,
    works: [
      work(1, 'The Exiled Heavy Knight Knows How to Game the System and Does So Relentlessly'),
      work(2, 'I Was Reincarnated as the Seventh Prince and Will Optimise My Magic However I Please'),
      work(3, 'A Story About a Bookish Girl Who Will Do Anything to Become a Librarian, Volume One'),
    ],
    sort: 'top',
    total: 3,
    page: 1,
    totalPages: 1,
    bloc: bloc({
      works: [
        work(1, 'The Exiled Heavy Knight Knows How to Game the System and Does So Relentlessly'),
        work(2, 'I Was Reincarnated as the Seventh Prince and Will Optimise My Magic However I Please'),
        work(3, 'A Story About a Bookish Girl Who Will Do Anything to Become a Librarian, Volume One'),
      ],
      sort: 'top',
      total: 3,
      page: 1,
      totalPages: 1,
    }),
  },
};
