import type { Meta, StoryObj } from '@storybook/svelte';
import { readable } from 'svelte/store';
import MangaContent from '../../../routes/manga/[slug]/+page.svelte';
import { MangaContentBloc, type Work } from '../MangaContent.bloc.svelte';

/** Preferences, pinned. The real store touches localStorage on construction. */
const english = readable({ titleLanguage: 'english' as const });

/**
 * The CDN, replaced by the local placeholder. Every URL resolves to the same
 * file, so the hero and the covers render without a network round trip and
 * without a story depending on what happens to be in the bucket.
 */
const localImages = () => '/assets/not found.jpg';

function adaptation(id: number, titleEn: string, year: number) {
  return {
    id: `anime-${id}`,
    slug: titleEn.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
    titleEn,
    titleJp: titleEn,
    rating: 8.2,
    animeStatus: 'FINISHED_AIRING',
    tags: ['Action', 'Drama'],
    episodeCount: 24,
    startDate: `${year}-04-05`,
  };
}

const WORK: Work = {
  id: 'work-1',
  titleEn: 'Vinland Saga',
  titleJp: 'ヴィンランド・サガ',
  type: 'MANGA',
  status: 'Publishing',
  publishedFrom: '2005-04-13',
  publishedTo: null,
  authors: ['Yukimura, Makoto'],
  serialization: 'Afternoon',
  demographic: 'Seinen',
  volumes: 28,
  chapters: 219,
  score: 8.83,
  ranking: 12,
  synopsis:
    'Thorfinn, son of one of the Vikings’ greatest warriors, is a boy who joined the very band of mercenaries that killed his father — and follows them for a chance at revenge.',
  adaptations: [adaptation(1, 'Vinland Saga', 2019), adaptation(2, 'Vinland Saga Season 2', 2023)],
  userWork: null,
};

function bloc(work: Work | null, ssrError: string | null = null) {
  return new MangaContentBloc({
    source: () => ({ work, ssrError }),
    preferences: english,
    imageUrl: localImages,
  });
}

const meta = {
  title: 'Pages/MangaContent',
  component: MangaContent,
  tags: ['autodocs'],
  parameters: { layout: 'fullscreen' },
  // The loader payload. Each story injects the bloc that draws the work, so
  // what this carries is the title, the social card and the breadcrumb.
  args: { data: { slug: 'vinland-saga', workTitle: 'Vinland Saga' } },
} satisfies Meta<typeof MangaContent>;

export default meta;
type Story = StoryObj<typeof meta>;

/** A complete record: credits, the stats strip, a synopsis and two adaptations. */
export const Populated: Story = {
  args: { bloc: bloc(WORK) },
};

/** The common case -- most manga were never adapted, so this is the EmptyState. */
export const NoAdaptations: Story = {
  args: {
    bloc: bloc({ ...WORK, adaptations: [] }),
  },
};

/** A finished run: the published range closes rather than reading "ongoing". */
export const FinishedRun: Story = {
  args: {
    bloc: bloc({ ...WORK, status: 'Finished', publishedTo: '2024-11-25' }),
  },
};

/** Already on the shelf, so the chapter stepper joins the status control. */
export const Tracked: Story = {
  args: {
    bloc: bloc({ ...WORK, userWork: { status: 'READING', chapters: 84 } }),
  },
};

/** A barely-scraped record: no counts, no credits, no synopsis. */
export const SparseRecord: Story = {
  args: {
    bloc: bloc({
      id: 'work-2',
      titleEn: 'A work the backfill has barely touched',
      type: 'ONE_SHOT',
      adaptations: [],
    }),
  },
};

/** The loader failed: the shared ErrorBanner, with the way home under it. */
export const LoadFailed: Story = {
  args: {
    data: {
      slug: 'vinland-saga',
      workTitle: 'Vinland Saga',
      ssrError: 'workBySlug returned 502',
    },
    bloc: bloc(null, 'workBySlug returned 502'),
  },
};

/** A title and credits wide enough to test the hero panel's wrapping. */
export const LongTitles: Story = {
  args: {
    bloc: bloc({
      ...WORK,
      titleEn:
        'I Was Reincarnated as the Seventh Prince, So I Will Optimise My Magic However I Please',
      titleJp: '転生したら第七王子だったので、気ままに魔術を極めます',
      authors: ['Kenkyo na Circle', 'Ishikawa, Mitsuki', 'A Third Credited Author Besides'],
      serialization: 'Weekly Shounen Magazine (Kodansha, Tokyo)',
      adaptations: [
        adaptation(
          3,
          'I Was Reincarnated as the Seventh Prince and Will Optimise My Magic However I Please',
          2024,
        ),
      ],
    }),
  },
};
