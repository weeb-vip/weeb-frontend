import { describe, it, expect, vi, afterEach } from 'vitest';
import { reactiveScope } from '../../__tests__/reactive-scope.svelte';
import { QueryClient } from '@tanstack/svelte-query';
import { WorkStatus } from '../../../../gql/graphql';
import {
  NOT_TRACKING,
  WORK_STATUS_OPTIONS,
  WorkStatusControlBloc,
  authAware,
  type UserWorkSnapshot,
  type WorkStatusControlDeps
} from './WorkStatusControl.bloc.svelte';

/**
 * The optimistic status rule: a reader's choice is held only while the server
 * still says what it said when the choice was made.
 */

/** A `work` accessor whose server row the test can move underneath the bloc. */
function server(initial: UserWorkSnapshot | null = null) {
  let userWork = initial;
  return {
    accessor: () => ({ workId: 'w1', userWork }),
    /** The server (or another tab) reports a new row. */
    reports(next: UserWorkSnapshot | null) {
      userWork = next;
    }
  };
}

function quiet() {
  return new QueryClient({
    defaultOptions: { mutations: { retry: false }, queries: { retry: false } }
  });
}

function makeBloc(deps: Partial<WorkStatusControlDeps> = {}) {
  return new WorkStatusControlBloc({
    tracking: {
      setStatus: vi.fn(async () => undefined),
      untrack: vi.fn(async () => undefined)
    },
    refresh: vi.fn(async () => {}),
    notify: { error: vi.fn() },
    queryClient: quiet(),
    ...deps
  });
}

/** Lets a mutation's own promise chain, and the notify manager, settle. */
const settle = () => new Promise((resolve) => setTimeout(resolve, 1));

/** Open effect roots, torn down after each test. */
const scopes: (() => void)[] = [];
afterEach(() => {
  while (scopes.length) scopes.pop()!();
});

/** Keeps `busy` live -- a mutation store only moves while something reads it. */
function watchBusy(bloc: WorkStatusControlBloc) {
  scopes.push(reactiveScope(() => bloc.busy));
}

describe('WORK_STATUS_OPTIONS', () => {
  it('offers "Not tracking" first, as the way to undo', () => {
    expect(WORK_STATUS_OPTIONS[0]).toEqual({ value: NOT_TRACKING, label: 'Not tracking' });
    expect(NOT_TRACKING).toBe('');
  });

  it('covers every WorkStatus the schema has', () => {
    const offered = WORK_STATUS_OPTIONS.map((o) => o.value).filter(Boolean);

    expect(new Set(offered)).toEqual(new Set(Object.values(WorkStatus)));
  });
});

describe('authAware', () => {
  it('rewords the one error worth rewording, however it is cased', () => {
    for (const message of ['Access denied', 'UNAUTHENTICATED', 'unauthorized']) {
      expect(authAware(new Error(message), 'fallback')).toBe(
        'Log in to keep track of what you are reading'
      );
    }
  });

  it('shows anything else as the caller worded it', () => {
    expect(authAware(new Error('upstream 500'), 'Could not update your list')).toBe(
      'Could not update your list'
    );
  });

  it('falls back for a throw with no message at all', () => {
    expect(authAware(null, 'Could not update your list')).toBe('Could not update your list');
    expect(authAware({}, 'Could not remove this')).toBe('Could not remove this');
  });
});

describe('WorkStatusControlBloc', () => {
  describe('what the control reads', () => {
    it('is not tracking when the viewer has no row on the work', () => {
      const bloc = makeBloc({ work: server(null).accessor });

      expect(bloc.serverStatus).toBe(NOT_TRACKING);
      expect(bloc.status).toBe(NOT_TRACKING);
      expect(bloc.busy).toBe(false);
    });

    it('reads the server’s status when there is no local choice', () => {
      const bloc = makeBloc({ work: server({ status: WorkStatus.Reading }).accessor });

      expect(bloc.status).toBe(WorkStatus.Reading);
    });

    it('treats a null status on an existing row as not tracking', () => {
      const bloc = makeBloc({ work: server({ id: 'uw1', status: null }).accessor });

      expect(bloc.status).toBe(NOT_TRACKING);
    });
  });

  describe('the optimistic rule', () => {
    it('answers straight away, before the write lands', async () => {
      const setStatus = vi.fn(() => new Promise<void>(() => {}));
      const bloc = makeBloc({
        work: server(null).accessor,
        tracking: { setStatus, untrack: vi.fn() }
      });

      bloc.selectStatus(WorkStatus.Reading);

      // The control has already moved, before the port has even been reached.
      expect(bloc.status).toBe(WorkStatus.Reading);
      await settle();
      expect(setStatus).toHaveBeenCalledWith('w1', WorkStatus.Reading);
    });

    it('holds the choice while the server still says what it said', async () => {
      const src = server(null);
      const bloc = makeBloc({
        work: src.accessor,
        tracking: { setStatus: vi.fn(async () => undefined), untrack: vi.fn() }
      });

      bloc.selectStatus(WorkStatus.Reading);
      await settle();

      // Our own write landed, but the loader has not caught up: the server row
      // is still the old one, so the reader's choice must survive.
      expect(bloc.serverStatus).toBe(NOT_TRACKING);
      expect(bloc.status).toBe(WorkStatus.Reading);
    });

    it('lets the server win the moment it reports anything else', async () => {
      const src = server(null);
      const bloc = makeBloc({
        work: src.accessor,
        tracking: { setStatus: vi.fn(async () => undefined), untrack: vi.fn() }
      });

      bloc.selectStatus(WorkStatus.Reading);
      src.reports({ status: WorkStatus.Completed }); // another tab moved the row

      expect(bloc.status).toBe(WorkStatus.Completed);
    });

    it('lets the server win even when it lands on the value the reader chose', async () => {
      const src = server(null);
      const bloc = makeBloc({
        work: src.accessor,
        tracking: { setStatus: vi.fn(async () => undefined), untrack: vi.fn() }
      });

      bloc.selectStatus(WorkStatus.Reading);
      src.reports({ status: WorkStatus.Reading }); // our write, now visible

      expect(bloc.status).toBe(WorkStatus.Reading);
      // And a later server move is obeyed rather than out-stubborned.
      src.reports({ status: WorkStatus.Dropped });
      expect(bloc.status).toBe(WorkStatus.Dropped);
    });

    it('rolls back to the server’s value when the write fails', async () => {
      const notify = { error: vi.fn() };
      const bloc = makeBloc({
        work: server({ status: WorkStatus.Reading }).accessor,
        tracking: {
          setStatus: vi.fn(async () => Promise.reject(new Error('upstream 500'))),
          untrack: vi.fn()
        },
        notify
      });

      bloc.selectStatus(WorkStatus.Dropped);
      expect(bloc.status).toBe(WorkStatus.Dropped);
      await settle();

      expect(bloc.status).toBe(WorkStatus.Reading);
      expect(notify.error).toHaveBeenCalledWith('Could not update your list');
    });

    it('tells a signed-out reader why, rather than "could not update"', async () => {
      const notify = { error: vi.fn() };
      const bloc = makeBloc({
        work: server(null).accessor,
        tracking: {
          setStatus: vi.fn(async () => Promise.reject(new Error('Access denied'))),
          untrack: vi.fn()
        },
        notify
      });

      bloc.selectStatus(WorkStatus.Reading);
      await settle();

      expect(notify.error).toHaveBeenCalledWith('Log in to keep track of what you are reading');
    });
  });

  describe('intents', () => {
    it('does nothing when the chosen status is the one already shown', async () => {
      const setStatus = vi.fn(async () => undefined);
      const bloc = makeBloc({
        work: server({ status: WorkStatus.Reading }).accessor,
        tracking: { setStatus, untrack: vi.fn() }
      });

      bloc.selectStatus(WorkStatus.Reading);
      await settle();

      expect(setStatus).not.toHaveBeenCalled();
    });

    it('untracks rather than writing an empty status', async () => {
      const untrack = vi.fn(async () => undefined);
      const setStatus = vi.fn(async () => undefined);
      const bloc = makeBloc({
        work: server({ status: WorkStatus.Reading }).accessor,
        tracking: { setStatus, untrack }
      });

      bloc.selectStatus(NOT_TRACKING);
      expect(bloc.status).toBe(NOT_TRACKING);
      await settle();

      expect(untrack).toHaveBeenCalledWith('w1');
      expect(setStatus).not.toHaveBeenCalled();
    });

    it('rolls an untrack back when it fails', async () => {
      const notify = { error: vi.fn() };
      const bloc = makeBloc({
        work: server({ status: WorkStatus.Reading }).accessor,
        tracking: {
          setStatus: vi.fn(),
          untrack: vi.fn(async () => Promise.reject(new Error('boom')))
        },
        notify
      });

      bloc.selectStatus(NOT_TRACKING);
      await settle();

      expect(bloc.status).toBe(WorkStatus.Reading);
      expect(notify.error).toHaveBeenCalledWith('Could not remove this from your list');
    });

    it('re-reads the page once a write lands, not only the query cache', async () => {
      const refresh = vi.fn(async () => {});
      const bloc = makeBloc({
        work: server(null).accessor,
        tracking: { setStatus: vi.fn(async () => undefined), untrack: vi.fn() },
        refresh
      });

      bloc.selectStatus(WorkStatus.Reading);
      await settle();

      // A manga page is server-loaded, so the cache holds nothing to invalidate.
      expect(refresh).toHaveBeenCalledTimes(1);
    });

    it('is busy while a write is in flight and inert again once it settles', async () => {
      let release!: () => void;
      const bloc = makeBloc({
        work: server(null).accessor,
        tracking: {
          setStatus: vi.fn(() => new Promise<void>((resolve) => (release = resolve))),
          untrack: vi.fn()
        }
      });

      watchBusy(bloc);
      bloc.selectStatus(WorkStatus.Reading);
      await vi.waitFor(() => expect(bloc.busy).toBe(true));

      release();
      await vi.waitFor(() => expect(bloc.busy).toBe(false));
    });
  });

  it('exposes the option list the view renders', () => {
    expect(makeBloc().options).toBe(WORK_STATUS_OPTIONS);
  });
});
