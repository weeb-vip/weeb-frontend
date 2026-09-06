import { describe, it, expect, vi, afterEach } from 'vitest';
import { QueryClient } from '@tanstack/svelte-query';
import { reactiveScope } from '../__tests__/reactive-scope.svelte';
import {
  MediaListBloc,
  PAGE_SIZE_OPTIONS,
  browserUrlState,
  realViewport,
  type MediaListDeps,
  type MediaListMediumConfig,
  type MediaListRow,
  type MediaListUrlPort
} from './MediaList.bloc.svelte';

/**
 * The list behind /profile/anime and /profile/manga: which tab is open, which
 * page of it, how many per page, which view, and the two writes a row can make.
 *
 * Everything per-medium arrives as a `MediaListMediumConfig`, so the config
 * below stands in for both media and the mapping rows are asserted through it.
 */

const STATUSES = ['WATCHING', 'COMPLETED', 'DROPPED'];

type Entry = { id: string; title: string; score: number | null };

function makeConfig(overrides: Partial<MediaListMediumConfig> = {}): MediaListMediumConfig {
  return {
    medium: 'anime',
    statuses: STATUSES,
    defaultStatus: 'WATCHING',
    statusLabel: (status) => (status === 'WATCHING' ? 'Watching' : String(status ?? '')),
    statusColor: (status) => (status === 'WATCHING' ? 'green' : 'grey'),
    counts: (data) => data?.counts ?? {},
    entries: (data) => data?.entries ?? [],
    total: (data) => data?.total ?? 0,
    row: (entry: Entry): MediaListRow => ({
      key: entry.id,
      href: `/anime/${entry.id}`,
      title: entry.title,
      image: entry.id,
      imagePath: '',
      score: entry.score,
      typeBadge: 'TV',
      status: 'WATCHING',
      progress: { current: 1, total: 12, unit: 'episodes' },
      card: { id: entry.id, title: entry.title, image: entry.id },
      entry
    }),
    empty: {
      heading: (statusLabel) => `Nothing ${statusLabel}`,
      message: 'Go and find something.',
      actionLabel: 'Browse',
      actionHref: '/browse'
    },
    tabsLabel: 'Your list',
    errorMessage: 'Could not load your list',
    invalidateKeys: [['anime-list'], ['anime-counts']],
    ssrList: (ssr) => ssr?.list ?? null,
    ssrCounts: (ssr) => ssr?.counts ?? null,
    ...overrides
  };
}

/** A URL port with no history behind it, which records what was written. */
function fakeUrl(initial: { status: string | null; page: string | null } = { status: null, page: null }) {
  let current = initial;
  let listener: (() => void) | null = null;
  const writes: { status: string; page: number }[] = [];

  const port: MediaListUrlPort = {
    read: () => current,
    write: (state) => writes.push(state),
    onChange: (fn) => {
      listener = fn;
      return () => {
        listener = null;
      };
    }
  };

  return {
    port,
    writes,
    get listening() {
      return listener !== null;
    },
    /** Back/forward: the address changes, then the port fires. */
    navigate(next: { status: string | null; page: string | null }) {
      current = next;
      listener?.();
    }
  };
}

function makeBloc(deps: Partial<MediaListDeps> = {}) {
  return new MediaListBloc({
    config: makeConfig(),
    list: vi.fn(() => ({ queryKey: ['list'], queryFn: async () => ({ entries: [], total: 0 }) })),
    counts: vi.fn(() => ({ queryKey: ['counts'], queryFn: async () => ({ counts: {} }) })),
    url: fakeUrl().port,
    viewport: { defaultPageSize: () => 24 },
    notify: { error: vi.fn() },
    queryClient: new QueryClient({
      defaultOptions: { queries: { retry: false }, mutations: { retry: false } }
    }),
    ...deps
  });
}

const scopes: (() => void)[] = [];
afterEach(() => {
  while (scopes.length) scopes.pop()!();
});

/** Keeps the query-backed reads live for the length of a test. */
function watch(bloc: MediaListBloc) {
  scopes.push(reactiveScope(() => bloc.rows, () => bloc.tabs, () => bloc.isLoading));
}

describe('PAGE_SIZE_OPTIONS', () => {
  it('offers a rising set of page sizes', () => {
    expect(PAGE_SIZE_OPTIONS).toEqual([24, 48, 72, 100]);
    expect([...PAGE_SIZE_OPTIONS].sort((a, b) => a - b)).toEqual(PAGE_SIZE_OPTIONS);
  });
});

describe('MediaListBloc', () => {
  describe('where it opens', () => {
    it('opens on the medium’s default shelf, page one', () => {
      const bloc = makeBloc();

      expect(bloc.status).toBe('WATCHING');
      expect(bloc.page).toBe(0);
      expect(bloc.view).toBe('grid');
    });

    it('takes its page size from the viewport when the server named none', () => {
      expect(makeBloc({ viewport: { defaultPageSize: () => 72 } }).perPage).toBe(72);
    });

    it('adopts what the server resolved for THIS medium', () => {
      const bloc = makeBloc({
        source: () => ({ ssr: { medium: 'anime', status: 'COMPLETED', page: 2, perPage: 48 } })
      });

      expect(bloc.status).toBe('COMPLETED');
      expect(bloc.page).toBe(2);
      expect(bloc.perPage).toBe(48);
    });

    it('ignores another medium’s resolution but still takes its page size', () => {
      const bloc = makeBloc({
        source: () => ({ ssr: { medium: 'manga', status: 'READING', page: 3, perPage: 100 } })
      });

      // The counts are fetched for both media, so perPage seeds either way.
      expect(bloc.status).toBe('WATCHING');
      expect(bloc.page).toBe(0);
      expect(bloc.perPage).toBe(100);
    });
  });

  describe('the tab strip', () => {
    it('names every status in the medium’s own order', () => {
      const bloc = makeBloc();

      expect(bloc.tabs.map((t) => t.value)).toEqual(STATUSES);
      expect(bloc.tabs[0].label).toBe('Watching');
    });

    it('shows zero for a shelf the counts payload does not mention', () => {
      const bloc = makeBloc();

      expect(bloc.tabs.every((t) => t.count === 0)).toBe(true);
    });

    it('reads the counts the server already sent', () => {
      const bloc = makeBloc({
        source: () => ({ ssr: { counts: { counts: { WATCHING: 12, DROPPED: 2 } } } })
      });

      expect(bloc.tabs.map((t) => t.count)).toEqual([12, 0, 2]);
    });

    it('names the open shelf for the empty state’s heading', () => {
      expect(makeBloc().statusLabel).toBe('Watching');
    });

    it('asks the medium for a status colour rather than deciding one', () => {
      const bloc = makeBloc();

      expect(bloc.statusColor('WATCHING')).toBe('green');
      expect(bloc.statusColor(null)).toBe('grey');
    });
  });

  describe('the rows', () => {
    const seeded = (entries: Entry[], total = entries.length) => ({
      ssr: {
        medium: 'anime',
        status: 'WATCHING',
        page: 0,
        perPage: 24,
        list: { entries, total }
      }
    });

    it('is empty, not broken, when the shelf has nothing on it', () => {
      const bloc = makeBloc({ source: () => seeded([], 0) });

      expect(bloc.rows).toEqual([]);
      expect(bloc.total).toBe(0);
      expect(bloc.totalPages).toBe(0);
      expect(bloc.isEmpty).toBe(true);
    });

    it('maps every entry through the medium’s own row mapping', () => {
      const bloc = makeBloc({
        source: () => seeded([{ id: 'a1', title: 'Frieren', score: 9 }])
      });

      expect(bloc.rows).toHaveLength(1);
      expect(bloc.rows[0]).toMatchObject({
        key: 'a1',
        href: '/anime/a1',
        title: 'Frieren',
        score: 9,
        typeBadge: 'TV'
      });
      // The untouched entry rides along for the medium's own row control.
      expect(bloc.rows[0].entry).toEqual({ id: 'a1', title: 'Frieren', score: 9 });
    });

    it('survives a payload with no rows in it at all', () => {
      const bloc = makeBloc({
        config: makeConfig({ entries: (data) => data?.entries ?? [], total: () => 0 }),
        source: () => ({ ssr: { medium: 'anime', status: 'WATCHING', page: 0, perPage: 24, list: {} } })
      });

      expect(bloc.rows).toEqual([]);
    });

    it('counts pages from the grand total and the page size', () => {
      const bloc = makeBloc({ source: () => seeded([{ id: 'a1', title: 'x', score: null }], 101) });

      expect(bloc.total).toBe(101);
      expect(bloc.totalPages).toBe(Math.ceil(101 / 24));
    });

    it('is not empty while the first page is still loading', () => {
      const bloc = makeBloc();

      // Nothing is seeded, so this is "loading", not "you have nothing".
      expect(bloc.isLoading).toBe(true);
      expect(bloc.isEmpty).toBe(false);
    });
  });

  describe('when the page fetch fails', () => {
    it('reports the failure and the cause, and is not "empty"', async () => {
      const bloc = makeBloc({
        list: () => ({
          queryKey: ['list'],
          queryFn: async () => Promise.reject(new Error('upstream 500'))
        })
      });
      watch(bloc);

      await vi.waitFor(() => expect(bloc.isError).toBe(true));
      expect(bloc.errorDetail).toBe('upstream 500');
      expect(bloc.isEmpty).toBe(false);
    });

    it('has no second line to show for a failure that carried no message', async () => {
      const bloc = makeBloc({
        list: () => ({ queryKey: ['list'], queryFn: async () => Promise.reject({}) })
      });
      watch(bloc);

      await vi.waitFor(() => expect(bloc.isError).toBe(true));
      expect(bloc.errorDetail).toBe('');
    });

    it('retry asks the query to run again', async () => {
      const queryFn = vi.fn(async () => ({ entries: [], total: 0 }));
      const bloc = makeBloc({ list: () => ({ queryKey: ['list'], queryFn }) });
      watch(bloc);
      await vi.waitFor(() => expect(bloc.isLoading).toBe(false));
      expect(queryFn).toHaveBeenCalledTimes(1);

      bloc.retry();

      await vi.waitFor(() => expect(queryFn).toHaveBeenCalledTimes(2));
    });
  });

  describe('choosing a shelf', () => {
    it('moves to the shelf and back to its first page', () => {
      const url = fakeUrl();
      const bloc = makeBloc({ url: url.port });
      bloc.goToPage(0);

      bloc.selectStatus('COMPLETED');

      expect(bloc.status).toBe('COMPLETED');
      expect(bloc.page).toBe(0);
      expect(url.writes).toEqual([{ status: 'COMPLETED', page: 0 }]);
    });

    it('leaves a deep page behind when the shelf changes', () => {
      const url = fakeUrl();
      const bloc = makeBloc({
        url: url.port,
        source: () => ({
          ssr: {
            medium: 'anime',
            status: 'WATCHING',
            page: 0,
            perPage: 24,
            list: { entries: [], total: 200 }
          }
        })
      });
      bloc.goToPage(3);

      bloc.selectStatus('DROPPED');

      expect(bloc.page).toBe(0);
    });

    it('ignores a status this medium does not have', () => {
      const url = fakeUrl();
      const bloc = makeBloc({ url: url.port });

      bloc.selectStatus('READING');

      expect(bloc.status).toBe('WATCHING');
      expect(url.writes).toEqual([]);
    });

    it('does not push a history entry for the shelf already open', () => {
      const url = fakeUrl();
      const bloc = makeBloc({ url: url.port });

      bloc.selectStatus('WATCHING');

      expect(url.writes).toEqual([]);
    });
  });

  describe('paging', () => {
    const twoHundred = () => ({
      ssr: {
        medium: 'anime',
        status: 'WATCHING',
        page: 0,
        perPage: 24,
        list: { entries: [], total: 200 }
      }
    });

    it('goes to the page it was given', () => {
      const url = fakeUrl();
      const bloc = makeBloc({ url: url.port, source: twoHundred });

      bloc.goToPage(4);

      expect(bloc.page).toBe(4);
      expect(url.writes).toEqual([{ status: 'WATCHING', page: 4 }]);
    });

    it('clamps to the first and last pages', () => {
      const bloc = makeBloc({ source: twoHundred });

      bloc.goToPage(-3);
      expect(bloc.page).toBe(0);

      bloc.goToPage(999);
      expect(bloc.page).toBe(Math.ceil(200 / 24) - 1);
    });

    it('stays on page one when there is nothing to page through', () => {
      const bloc = makeBloc();

      bloc.goToPage(5);

      expect(bloc.page).toBe(0);
    });

    it('does not push a history entry for the page already showing', () => {
      const url = fakeUrl();
      const bloc = makeBloc({ url: url.port, source: twoHundred });

      bloc.goToPage(0);

      expect(url.writes).toEqual([]);
    });
  });

  describe('page size', () => {
    it('changes the size and returns to page one', () => {
      const url = fakeUrl();
      const bloc = makeBloc({
        url: url.port,
        source: () => ({
          ssr: {
            medium: 'anime',
            status: 'WATCHING',
            page: 0,
            perPage: 24,
            list: { entries: [], total: 200 }
          }
        })
      });
      bloc.goToPage(3);
      url.writes.length = 0;

      bloc.setPerPage(48);

      // More cards per page puts the viewer somewhere else entirely.
      expect(bloc.perPage).toBe(48);
      expect(bloc.page).toBe(0);
      expect(url.writes).toEqual([{ status: 'WATCHING', page: 0 }]);
    });

    it('refuses a size that is not a usable number', () => {
      const bloc = makeBloc();

      for (const bad of [0, -10, Number.NaN, Number.POSITIVE_INFINITY]) {
        bloc.setPerPage(bad);
        expect(bloc.perPage).toBe(24);
      }
    });

    it('does nothing when the size is already what was asked for', () => {
      const url = fakeUrl();
      const bloc = makeBloc({ url: url.port });

      bloc.setPerPage(24);

      expect(url.writes).toEqual([]);
    });

    it('exposes the sizes the select offers', () => {
      expect(makeBloc().perPageOptions).toEqual(PAGE_SIZE_OPTIONS);
    });
  });

  describe('the grid/list toggle', () => {
    it('is a viewer’s choice and does not touch the address', () => {
      const url = fakeUrl();
      const bloc = makeBloc({ url: url.port });

      bloc.setView('list');

      expect(bloc.view).toBe('list');
      expect(url.writes).toEqual([]);

      bloc.setView('grid');
      expect(bloc.view).toBe('grid');
    });
  });

  describe('the two row writes', () => {
    it('changes a row’s status through the tracking port', async () => {
      const tracking = { setStatus: vi.fn(async () => undefined), remove: vi.fn() };
      const bloc = makeBloc({ tracking });

      bloc.changeStatus('a1', 'COMPLETED');
      await vi.waitFor(() => expect(tracking.setStatus).toHaveBeenCalledWith('a1', 'COMPLETED'));
    });

    it('removes a row through the tracking port', async () => {
      const tracking = { setStatus: vi.fn(), remove: vi.fn(async () => undefined) };
      const bloc = makeBloc({ tracking });

      bloc.remove('a1');
      await vi.waitFor(() => expect(tracking.remove).toHaveBeenCalledWith('a1'));
    });

    it('writes nothing when the medium owns its own row control', async () => {
      const notify = { error: vi.fn() };
      const bloc = makeBloc({ tracking: null, notify });

      bloc.changeStatus('a1', 'COMPLETED');
      bloc.remove('a1');
      await new Promise((resolve) => setTimeout(resolve, 1));

      expect(notify.error).not.toHaveBeenCalled();
    });

    it('writes nothing for a row with no id', async () => {
      const tracking = { setStatus: vi.fn(), remove: vi.fn() };
      const bloc = makeBloc({ tracking });

      bloc.changeStatus('', 'COMPLETED');
      bloc.remove('');
      await new Promise((resolve) => setTimeout(resolve, 1));

      expect(tracking.setStatus).not.toHaveBeenCalled();
      expect(tracking.remove).not.toHaveBeenCalled();
    });

    it('moves the grid and the tab numbers together once a write lands', async () => {
      const queryClient = new QueryClient({
        defaultOptions: { queries: { retry: false }, mutations: { retry: false } }
      });
      const invalidate = vi.spyOn(queryClient, 'invalidateQueries');
      const bloc = makeBloc({
        queryClient,
        tracking: { setStatus: vi.fn(async () => undefined), remove: vi.fn() }
      });

      bloc.changeStatus('a1', 'COMPLETED');

      await vi.waitFor(() => {
        expect(invalidate).toHaveBeenCalledWith({ queryKey: ['anime-list'] });
        expect(invalidate).toHaveBeenCalledWith({ queryKey: ['anime-counts'] });
      });
    });

    it('says what went wrong when a write fails', async () => {
      const notify = { error: vi.fn() };
      const bloc = makeBloc({
        notify,
        tracking: {
          setStatus: vi.fn(async () => Promise.reject(new Error('Access denied'))),
          remove: vi.fn()
        }
      });

      bloc.changeStatus('a1', 'COMPLETED');

      await vi.waitFor(() => expect(notify.error).toHaveBeenCalledWith('Access denied'));
    });

    it('has its own words for a failure that carried none', async () => {
      const notify = { error: vi.fn() };
      const bloc = makeBloc({
        notify,
        tracking: { setStatus: vi.fn(async () => Promise.reject({})), remove: vi.fn() }
      });

      bloc.changeStatus('a1', 'COMPLETED');

      await vi.waitFor(() =>
        expect(notify.error).toHaveBeenCalledWith('Could not update your list')
      );
    });

    it('dims the grid while a write is in flight rather than swapping it out', async () => {
      let release!: () => void;
      const bloc = makeBloc({
        tracking: {
          setStatus: vi.fn(() => new Promise<void>((resolve) => (release = resolve))),
          remove: vi.fn()
        }
      });
      scopes.push(reactiveScope(() => bloc.isMutating));

      bloc.changeStatus('a1', 'COMPLETED');
      await vi.waitFor(() => expect(bloc.isMutating).toBe(true));

      release();
      await vi.waitFor(() => expect(bloc.isMutating).toBe(false));
    });
  });

  describe('following the address', () => {
    it('adopts the address on start', () => {
      const url = fakeUrl({ status: 'DROPPED', page: '3' });
      const bloc = makeBloc({ url: url.port });

      bloc.start();

      expect(bloc.status).toBe('DROPPED');
      // The address is 1-based; the bloc is 0-based.
      expect(bloc.page).toBe(2);
    });

    it('follows back and forward', () => {
      const url = fakeUrl({ status: 'WATCHING', page: null });
      const bloc = makeBloc({ url: url.port });
      bloc.start();

      url.navigate({ status: 'COMPLETED', page: '2' });

      expect(bloc.status).toBe('COMPLETED');
      expect(bloc.page).toBe(1);
    });

    it('hands back a teardown that stops listening', () => {
      const url = fakeUrl();
      const bloc = makeBloc({ url: url.port });

      const stop = bloc.start();
      expect(url.listening).toBe(true);

      stop();
      expect(url.listening).toBe(false);
    });

    it('ignores a status in the URL that this medium does not have', () => {
      const url = fakeUrl({ status: 'READING', page: null });
      const bloc = makeBloc({ url: url.port });

      bloc.start();

      expect(bloc.status).toBe('WATCHING');
    });

    it('reads an absent, zero or unreadable page as the first one', () => {
      for (const page of [null, '0', 'abc', '-2']) {
        const bloc = makeBloc({ url: fakeUrl({ status: null, page }).port });

        bloc.start();

        expect(bloc.page).toBe(0);
      }
    });
  });
});

describe('browserUrlState', () => {
  afterEach(() => window.history.replaceState({}, '', '/profile/anime'));

  it('reads the status and page out of the address', () => {
    window.history.replaceState({}, '', '/profile/anime?status=COMPLETED&page=3');

    expect(browserUrlState.read()).toEqual({ status: 'COMPLETED', page: '3' });
  });

  it('reads nothing out of a bare address', () => {
    window.history.replaceState({}, '', '/profile/anime');

    expect(browserUrlState.read()).toEqual({ status: null, page: null });
  });

  it('writes the page as its 1-based label', () => {
    browserUrlState.write({ status: 'COMPLETED', page: 2 });

    expect(window.location.search).toBe('?status=COMPLETED&page=3');
  });

  it('leaves page one out, so the canonical link to a shelf is the short one', () => {
    window.history.replaceState({}, '', '/profile/anime?status=WATCHING&page=4');

    browserUrlState.write({ status: 'WATCHING', page: 0 });

    expect(window.location.search).toBe('?status=WATCHING');
  });

  it('listens for back and forward, and stops when torn down', () => {
    const listener = vi.fn();

    const stop = browserUrlState.onChange(listener);
    window.dispatchEvent(new PopStateEvent('popstate'));
    expect(listener).toHaveBeenCalledTimes(1);

    stop();
    window.dispatchEvent(new PopStateEvent('popstate'));
    expect(listener).toHaveBeenCalledTimes(1);
  });
});

describe('realViewport', () => {
  const width = window.innerWidth;
  afterEach(() => Object.defineProperty(window, 'innerWidth', { value: width, configurable: true }));

  function at(px: number) {
    Object.defineProperty(window, 'innerWidth', { value: px, configurable: true });
    return realViewport.defaultPageSize();
  }

  it('fits more cards above the fold on a wider screen', () => {
    expect(at(1920)).toBe(72);
    expect(at(1440)).toBe(48);
    expect(at(1024)).toBe(24);
  });

  it('steps at the breakpoint, not past it', () => {
    expect(at(1919)).toBe(48);
    expect(at(1439)).toBe(24);
  });

  it('offers only sizes the per-page select can show', () => {
    for (const px of [360, 1024, 1440, 1920, 3840]) {
      expect(PAGE_SIZE_OPTIONS).toContain(at(px));
    }
  });
});
