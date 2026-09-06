import { describe, it, expect, vi, beforeAll, beforeEach, afterEach } from 'vitest';
import { render, screen, within, waitFor } from '@testing-library/svelte';
import userEvent from '@testing-library/user-event';
import { createRawSnippet } from 'svelte';
import { QueryClient } from '@tanstack/svelte-query';
import { goto } from '$app/navigation';
import ProfileMediaList from './ProfileMediaList.svelte';
import {
  MediaListBloc,
  type MediaListDeps,
  type MediaListMediumConfig,
  type MediaListRow,
  type MediaListUrlPort
} from '$lib/components/profile/MediaList.bloc.svelte';

vi.mock('$app/navigation', () => ({ goto: vi.fn() }));

/**
 * The shelf both profile lists render: status tabs with counts, the grid/list
 * switch, the entries and the pager.
 *
 * Everything the bloc decides -- which tab, which page, how many per page, what
 * a write does -- is asserted against the bloc in `MediaList.test.ts`. This
 * file is the other half: what that state renders as, and that the controls in
 * the markup reach the intents. So the bloc here is the real one, driven
 * through fake ports, and the assertions are all on the DOM it produces.
 *
 * jsdom caveats, honestly: `scrollActiveTabIntoView` measures with
 * `getBoundingClientRect`, which is all zeros here and `scrollTo` is not
 * implemented -- keeping the active tab on screen is a real behaviour that only
 * a browser can show, so it is not asserted. Nor are the posters: `SafeImage`
 * picks a source by loading candidates and jsdom loads none, so a row's cover
 * never becomes an `<img>`.
 */

const STATUSES = ['WATCHING', 'COMPLETED', 'DROPPED'];

type Entry = { id: string; title: string; score: number | null };

const ENTRIES: Entry[] = [
  { id: 'a1', title: 'Frieren', score: 8.9 },
  { id: 'a2', title: 'Dandadan', score: null }
];

function makeConfig(overrides: Partial<MediaListMediumConfig> = {}): MediaListMediumConfig {
  return {
    medium: 'anime',
    statuses: STATUSES,
    defaultStatus: 'WATCHING',
    statusLabel: (status) =>
      ({ WATCHING: 'Watching', COMPLETED: 'Completed', DROPPED: 'Dropped' })[
        String(status ?? '')
      ] ?? String(status ?? ''),
    statusColor: () => 'rgb(0, 128, 0)',
    counts: (data) => data?.counts ?? {},
    entries: (data) => data?.entries ?? [],
    total: (data) => data?.total ?? 0,
    row: (entry: Entry): MediaListRow => ({
      key: entry.id,
      href: `/anime/${entry.id}`,
      title: entry.title,
      image: entry.id,
      imagePath: 'posters',
      score: entry.score,
      typeBadge: 'TV',
      status: 'WATCHING',
      progress: { current: 4, total: 28, unit: 'episodes' },
      card: { id: entry.id, title: entry.title, image: entry.id },
      entry
    }),
    empty: {
      heading: (statusLabel) => `Nothing ${statusLabel}`,
      message: 'Go and find something to watch.',
      actionLabel: 'Browse anime',
      actionHref: '/browse'
    },
    tabsLabel: 'Your anime list',
    errorMessage: 'Could not load your list',
    invalidateKeys: [['anime-list']],
    ssrList: (ssr) => ssr?.list ?? null,
    ssrCounts: (ssr) => ssr?.counts ?? null,
    ...overrides
  };
}

/** A URL port with no history behind it, which records what was written. */
function fakeUrl() {
  const writes: { status: string; page: number }[] = [];
  const port: MediaListUrlPort = {
    read: () => ({ status: null, page: null }),
    write: (state) => writes.push(state),
    onChange: () => () => {}
  };
  return { port, writes };
}

const NEVER = () => new Promise<never>(() => {});

type Payload = { entries?: Entry[]; total?: number; counts?: Record<string, number> };

function makeBloc(
  options: {
    list?: () => Promise<Payload>;
    counts?: () => Promise<Payload>;
    url?: MediaListUrlPort;
    deps?: Partial<MediaListDeps>;
  } = {}
) {
  return new MediaListBloc({
    config: makeConfig(),
    list: ({ status, page }) => ({
      queryKey: ['list', status, page],
      queryFn: options.list ?? (async () => ({ entries: ENTRIES, total: 2 }))
    }),
    counts: () => ({
      queryKey: ['counts'],
      queryFn: options.counts ?? (async () => ({ counts: { WATCHING: 12, COMPLETED: 3 } }))
    }),
    url: options.url ?? fakeUrl().port,
    viewport: { defaultPageSize: () => 24 },
    notify: { error: vi.fn() },
    queryClient: new QueryClient({
      defaultOptions: { queries: { retry: false }, mutations: { retry: false } }
    }),
    ...options.deps
  });
}

/** The medium's own row control, the one bit of markup a medium owns. */
const rowActions = createRawSnippet((row: () => MediaListRow) => ({
  render: () => `<button type="button">Track ${row().title}</button>`
}));

const emptyIcon = createRawSnippet(() => ({ render: () => '<span>icon</span>' }));

/**
 * A row, by title. Anchored, because the row's accessible name is its whole
 * contents -- including the tracking control's own "Track <title>".
 */
const row = (title: string) => screen.getByRole('button', { name: new RegExp(`^${title}`) });

/** Renders the shelf and waits for the first page of rows to land. */
async function renderLoaded(bloc = makeBloc()) {
  const result = render(ProfileMediaList, { props: { bloc, rowActions, emptyIcon } });
  await screen.findByRole('tab', { name: /Watching/ });
  return result;
}

beforeAll(() => {
  // jsdom implements no scrolling, so `Element.prototype.scrollTo` does not
  // exist and the component's keep-the-active-tab-visible effect throws on
  // every tab change. A no-op, not a spy: what it would have scrolled to is
  // computed from `getBoundingClientRect`, which is all zeros without layout.
  Element.prototype.scrollTo = () => {};
  // The same gap, reached through the pager's `Select`: opening its menu
  // scrolls the active option into view.
  Element.prototype.scrollIntoView = () => {};
});

beforeEach(() => {
  vi.mocked(goto).mockClear();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('ProfileMediaList', () => {
  describe('while the first page is loading', () => {
    it('shows a shelf-shaped placeholder rather than an empty list', () => {
      const { container } = render(ProfileMediaList, {
        props: { bloc: makeBloc({ list: NEVER }), rowActions, emptyIcon }
      });

      // A tab row, then a wall of cards: the same shape as what loads in.
      expect(container.querySelectorAll('.pml-tab-skeleton .animate-pulse')).toHaveLength(5);
      expect(container.querySelectorAll('.poster-card-skeleton')).toHaveLength(8);
    });

    it('offers no controls to press while there is nothing to control', () => {
      render(ProfileMediaList, {
        props: { bloc: makeBloc({ list: NEVER }), rowActions, emptyIcon }
      });

      expect(screen.queryAllByRole('tab')).toHaveLength(0);
      expect(screen.queryByRole('navigation', { name: 'List pages' })).not.toBeInTheDocument();
    });
  });

  describe('the status tabs', () => {
    it('is a real tablist, named, with every status and its count', async () => {
      await renderLoaded();

      const tablist = screen.getByRole('tablist', { name: 'Your anime list' });

      // The counts are their own query, so they land a beat after the tabs do.
      await waitFor(() => {
        const tabs = within(tablist).getAllByRole('tab');
        expect(tabs.map((tab) => tab.textContent?.replace(/\s+/g, ' ').trim())).toEqual([
          'Watching 12',
          'Completed 3',
          'Dropped 0'
        ]);
      });
    });

    it('marks the open shelf as the selected tab', async () => {
      await renderLoaded();

      expect(screen.getByRole('tab', { name: /Watching/ })).toHaveAttribute(
        'aria-selected',
        'true'
      );
      expect(screen.getByRole('tab', { name: /Completed/ })).toHaveAttribute(
        'aria-selected',
        'false'
      );
    });

    it('opens another shelf when its tab is chosen, and says so in the address', async () => {
      const url = fakeUrl();
      await renderLoaded(makeBloc({ url: url.port }));

      await userEvent.click(screen.getByRole('tab', { name: /Completed/ }));

      await waitFor(() => {
        expect(screen.getByRole('tab', { name: /Completed/ })).toHaveAttribute(
          'aria-selected',
          'true'
        );
      });
      // Page one of the new shelf, and a shareable address for it.
      expect(url.writes).toEqual([{ status: 'COMPLETED', page: 0 }]);
    });
  });

  describe('the grid/list switch', () => {
    it('is a pair of named toggles, opening on the grid', async () => {
      await renderLoaded();

      expect(screen.getByRole('button', { name: 'Grid view' })).toHaveAttribute(
        'aria-pressed',
        'true'
      );
      expect(screen.getByRole('button', { name: 'List view' })).toHaveAttribute(
        'aria-pressed',
        'false'
      );
    });

    it('swaps the poster wall for the table', async () => {
      const { container } = await renderLoaded();

      expect(container.querySelector('.poster-grid')).toBeInTheDocument();
      expect(container.querySelectorAll('.row')).toHaveLength(0);

      await userEvent.click(screen.getByRole('button', { name: 'List view' }));

      await waitFor(() => {
        expect(container.querySelectorAll('.row')).toHaveLength(2);
      });
      expect(container.querySelector('.poster-grid')).not.toBeInTheDocument();
    });
  });

  describe('the grid', () => {
    it('draws a card per entry', async () => {
      await renderLoaded();

      expect(screen.getByRole('link', { name: /Frieren/ })).toBeInTheDocument();
      expect(screen.getByRole('link', { name: /Dandadan/ })).toBeInTheDocument();
    });
  });

  describe('a row in the table', () => {
    async function renderRows() {
      const result = await renderLoaded();
      await userEvent.click(screen.getByRole('button', { name: 'List view' }));
      await screen.findByRole('button', { name: /^Frieren/ });
      return result;
    }

    it('carries the title, the format badge, the status and the score', async () => {
      await renderRows();

      const first = row('Frieren');
      expect(first).toHaveTextContent('Frieren');
      expect(first).toHaveTextContent('TV');
      expect(first).toHaveTextContent('Watching');
      expect(first).toHaveTextContent('8.9');
    });

    it('says an unrated entry has no score rather than printing a zero', async () => {
      await renderRows();

      expect(row('Dandadan')).toHaveTextContent('—');
    });

    it('prints progress as a fraction with the medium’s unit', async () => {
      await renderRows();

      expect(row('Frieren')).toHaveTextContent('4 / 28 episodes');
    });

    it('renders the medium’s own tracking control at the end of the row', async () => {
      await renderRows();

      expect(within(row('Frieren')).getByRole('button', { name: 'Track Frieren' })).toBeInTheDocument();
    });

    it('opens the entry when the row is clicked', async () => {
      await renderRows();

      await userEvent.click(row('Frieren'));

      expect(goto).toHaveBeenCalledWith('/anime/a1');
    });

    /** The row is a div with role="button", so it has to answer both keys itself. */
    it('opens the entry from the keyboard, on Enter and on Space', async () => {
      await renderRows();

      row('Frieren').focus();
      await userEvent.keyboard('{Enter}');
      expect(goto).toHaveBeenCalledWith('/anime/a1');

      vi.mocked(goto).mockClear();
      await userEvent.keyboard(' ');
      expect(goto).toHaveBeenCalledWith('/anime/a1');
    });

    /**
     * REGRESSION shape: the tracking control sits inside a row that navigates,
     * so using it must not also open the show.
     */
    it('does not open the entry when the tracking control inside it is used', async () => {
      await renderRows();

      await userEvent.click(screen.getByRole('button', { name: 'Track Frieren' }));

      expect(goto).not.toHaveBeenCalled();
    });
  });

  describe('when the shelf is empty', () => {
    const empty = () => makeBloc({ list: async () => ({ entries: [], total: 0 }) });

    it('says which shelf is empty and offers the way out', async () => {
      render(ProfileMediaList, { props: { bloc: empty(), rowActions, emptyIcon } });

      expect(await screen.findByRole('heading', { name: 'Nothing Watching' })).toBeInTheDocument();
      expect(screen.getByText('Go and find something to watch.')).toBeInTheDocument();
      expect(screen.getByRole('link', { name: 'Browse anime' })).toHaveAttribute('href', '/browse');
    });

    it('drops the pager -- there are no pages to move between', async () => {
      render(ProfileMediaList, { props: { bloc: empty(), rowActions, emptyIcon } });

      await screen.findByRole('heading', { name: 'Nothing Watching' });
      expect(screen.queryByRole('navigation', { name: 'List pages' })).not.toBeInTheDocument();
    });
  });

  describe('when the page fails to load', () => {
    const failing = () =>
      makeBloc({ list: async () => Promise.reject(new Error('gateway timeout')) });

    /**
     * A failed fetch is not an empty shelf. Saying "nothing on your list" to
     * someone whose list did not load is the wrong thing to say.
     */
    it('says what happened, with the cause, instead of claiming the list is empty', async () => {
      render(ProfileMediaList, { props: { bloc: failing(), rowActions, emptyIcon } });

      expect(await screen.findByText('Could not load your list')).toBeInTheDocument();
      expect(screen.getByText('gateway timeout')).toBeInTheDocument();
      expect(screen.queryByRole('heading', { name: 'Nothing Watching' })).not.toBeInTheDocument();
    });

    it('offers a retry that fetches the page again', async () => {
      const listFn = vi.fn(async () => Promise.reject(new Error('gateway timeout')));
      render(ProfileMediaList, {
        props: { bloc: makeBloc({ list: listFn }), rowActions, emptyIcon }
      });
      await screen.findByText('Could not load your list');
      expect(listFn).toHaveBeenCalledTimes(1);

      await userEvent.click(screen.getByRole('button', { name: 'Try again' }));

      await waitFor(() => {
        expect(listFn).toHaveBeenCalledTimes(2);
      });
    });

    it('drops the pager as well -- there is nothing to page through', async () => {
      render(ProfileMediaList, { props: { bloc: failing(), rowActions, emptyIcon } });

      await screen.findByText('Could not load your list');
      expect(screen.queryByRole('navigation', { name: 'List pages' })).not.toBeInTheDocument();
    });
  });

  describe('the pager', () => {
    const paged = (url?: MediaListUrlPort) =>
      makeBloc({ list: async () => ({ entries: ENTRIES, total: 60 }), url });

    it('is a named landmark saying where in the list the viewer is', async () => {
      await renderLoaded(paged());

      const pager = screen.getByRole('navigation', { name: 'List pages' });
      // 60 entries at the viewport's 24 per page.
      expect(within(pager).getByText('Page 1 of 3')).toBeInTheDocument();
    });

    it('cannot go back from the first page', async () => {
      await renderLoaded(paged());

      expect(screen.getByRole('button', { name: 'Previous page' })).toBeDisabled();
      expect(screen.getByRole('button', { name: 'Next page' })).toBeEnabled();
    });

    it('moves to the next page and puts it in the address', async () => {
      const url = fakeUrl();
      await renderLoaded(paged(url.port));

      await userEvent.click(screen.getByRole('button', { name: 'Next page' }));

      await waitFor(() => {
        expect(screen.getByText('Page 2 of 3')).toBeInTheDocument();
      });
      expect(url.writes).toEqual([{ status: 'WATCHING', page: 1 }]);
    });

    it('offers the page sizes and returns to page one when one is chosen', async () => {
      const url = fakeUrl();
      await renderLoaded(paged(url.port));
      await userEvent.click(screen.getByRole('button', { name: 'Next page' }));
      await screen.findByText('Page 2 of 3');
      url.writes.length = 0;

      await userEvent.click(screen.getByRole('button', { name: 'Results per page' }));
      await userEvent.click(await screen.findByRole('option', { name: '48' }));

      await waitFor(() => {
        expect(url.writes).toEqual([{ status: 'WATCHING', page: 0 }]);
      });
    });
  });
});
