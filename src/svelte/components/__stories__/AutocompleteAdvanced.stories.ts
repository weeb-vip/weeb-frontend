import type { Meta, StoryObj } from '@storybook/svelte';
import AutocompleteAdvanced from '../AutocompleteAdvanced.svelte';
import {
  AutocompleteAdvancedBloc,
  type SearchPort,
  type SearchState,
} from '../AutocompleteAdvanced.bloc.svelte';

/**
 * Algolia, replaced by a fixed answer. The real port lazily imports the client,
 * reads two index names off the config store and talks to the network -- none
 * of which a story can do, which is the whole reason the port exists.
 */
function stubSearch(state: SearchState): SearchPort {
  return {
    async connect(onState) {
      onState(state);

      return {
        setQuery: (query) => onState({ ...state, query }),
        refresh: () => {},
        setIsOpen: (isOpen) => onState({ ...state, isOpen }),
      };
    },
  };
}

/** Search never resolves, so the component stays on its loading skeleton. */
const neverConnects: SearchPort = { connect: () => new Promise(() => {}) };

/** Search failed to load: the port reports null and the view degrades. */
const unavailable: SearchPort = { connect: async () => null };

const anime = (id: string, title: string, year: string) => ({
  objectID: id,
  id,
  title_en: title,
  url_slug: title.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
  start_date: `${year}-04-04T00:00:00Z`,
});

const work = (id: string, title: string, type: string) => ({
  objectID: id,
  id,
  __kind: 'work',
  type,
  title_en: title,
  url_slug: title.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
  published_from: '2006-02-10T00:00:00Z',
});

/**
 * Builds a bloc already focused and open. `focus()` is an ordinary intent, so
 * a story can put the panel on screen without a real pointer.
 */
function openBloc(state: Partial<SearchState>) {
  const bloc = new AutocompleteAdvancedBloc({
    search: stubSearch({ query: '', isOpen: true, collections: [], ...state }),
    navigate: () => {},
    analytics: { searchPerformed: () => {} },
    // No dismiss timer: the panel would otherwise close itself 200ms after any
    // blur the canvas happens to produce.
    dismissDelayMs: 0,
  });
  bloc.focus();

  return bloc;
}

const meta = {
  title: 'Composites/App Shell/AutocompleteAdvanced',
  component: AutocompleteAdvanced,
  tags: ['autodocs'],
} satisfies Meta<typeof AutocompleteAdvanced>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Before the search client has loaded: the pill skeleton, not a dead input. */
export const Loading: Story = {
  args: {
    bloc: new AutocompleteAdvancedBloc({ search: neverConnects, navigate: () => {} }),
  },
};

/** At rest: the collapsed field with its "/" hint. */
export const Idle: Story = {
  args: {
    bloc: new AutocompleteAdvancedBloc({
      search: stubSearch({ query: '', isOpen: false, collections: [] }),
      navigate: () => {},
    }),
  },
};

/** Anime hits only -- no group headings, exactly as it looked before works were searchable. */
export const AnimeResults: Story = {
  args: {
    bloc: openBloc({
      query: 'naruto',
      collections: [
        {
          source: { sourceId: 'data' },
          items: [
            anime('1', 'Naruto', '2002'),
            anime('2', 'Naruto Shippuden', '2007'),
            anime('3', 'Boruto: Naruto Next Generations', '2017'),
          ],
        },
      ],
    }),
  },
};

/** Both indices answered, so each group gets a heading and the highlight still runs flat through them. */
export const GroupedResults: Story = {
  args: {
    bloc: openBloc({
      query: 'spice',
      collections: [
        { source: { sourceId: 'data' }, items: [anime('1', 'Spice and Wolf', '2008')] },
        {
          source: { sourceId: 'works' },
          items: [
            work('w1', 'Spice and Wolf', 'LIGHT_NOVEL'),
            work('w2', 'Spice and Wolf: Merchant Meets the Wise Wolf', 'MANGA'),
          ],
        },
      ],
    }),
  },
};

/** A query that matched nothing: the shared EmptyState, plus the footer link out to full search. */
export const NoResults: Story = {
  args: {
    bloc: openBloc({ query: 'qqqqzzzz', collections: [] }),
  },
};

/** The second row highlighted, which is what two presses of ArrowDown produce. */
export const Highlighted: Story = {
  args: {
    bloc: (() => {
      const bloc = openBloc({
        query: 'naruto',
        collections: [
          {
            source: { sourceId: 'data' },
            items: [anime('1', 'Naruto', '2002'), anime('2', 'Naruto Shippuden', '2007')],
          },
        ],
      });
      bloc.keydown('ArrowDown');
      bloc.keydown('ArrowDown');

      return bloc;
    })(),
  },
};

/** Titles wider than the panel: rows truncate rather than reflowing it. */
export const LongTitles: Story = {
  args: {
    bloc: openBloc({
      query: 'the',
      collections: [
        {
          source: { sourceId: 'data' },
          items: [
            anime(
              '1',
              'The Detective Is Already Dead and the Title Keeps Going Well Past the Panel',
              '2021',
            ),
            anime(
              '2',
              'That Time I Got Reincarnated as a Slime and Also as an Extremely Long Search Result',
              '2018',
            ),
          ],
        },
      ],
    }),
  },
};

/** Algolia unreachable: a plain input that still runs a full search on Enter. */
export const SearchUnavailable: Story = {
  args: {
    bloc: new AutocompleteAdvancedBloc({
      search: unavailable,
      navigate: () => {},
      analytics: { searchPerformed: () => {} },
    }),
  },
};
