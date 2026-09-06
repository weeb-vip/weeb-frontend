import { describe, it, expect, vi, afterEach } from 'vitest';
import { QueryClient } from '@tanstack/svelte-query';
import { WorkStatus } from '../../../../gql/graphql';
import { reactiveScope } from '../../__tests__/reactive-scope.svelte';
import {
  ChapterProgressBloc,
  type ChapterProgressDeps,
  type ChapterProgressInput,
  type UserWorkProgress
} from './ChapterProgress.bloc.svelte';

/**
 * How far through a work the reader is: the clamping, and the same optimistic
 * rule as WorkStatusControl -- the reader's number is held only while the
 * server still says what it said when they set it.
 */

/** A `work` accessor whose server row the test can move underneath the bloc. */
function server(userWork: UserWorkProgress | null, totalChapters: number | null = null) {
  let row = userWork;
  return {
    accessor: () => ({ workId: 'w1', totalChapters, userWork: row }),
    reports(next: UserWorkProgress | null) {
      row = next;
    }
  };
}

function makeBloc(deps: Partial<ChapterProgressDeps> = {}) {
  return new ChapterProgressBloc({
    work: server(null).accessor,
    progress: { save: vi.fn(async () => undefined) },
    refresh: vi.fn(async () => {}),
    notify: { error: vi.fn() },
    queryClient: new QueryClient({
      defaultOptions: { mutations: { retry: false }, queries: { retry: false } }
    }),
    ...deps
  });
}

const settle = () => new Promise((resolve) => setTimeout(resolve, 1));

const scopes: (() => void)[] = [];
afterEach(() => {
  while (scopes.length) scopes.pop()!();
});

describe('ChapterProgressBloc', () => {
  describe('what the stepper reads', () => {
    it('starts at zero when the viewer has no row at all', () => {
      const bloc = makeBloc();

      expect(bloc.serverRead).toBe(0);
      expect(bloc.read).toBe(0);
      expect(bloc.atStart).toBe(true);
      expect(bloc.busy).toBe(false);
    });

    it('reads the server’s chapter count', () => {
      const bloc = makeBloc({ work: server({ chapters: 12 }).accessor });

      expect(bloc.read).toBe(12);
      expect(bloc.atStart).toBe(false);
    });

    it('treats a null chapter count as none read', () => {
      expect(makeBloc({ work: server({ chapters: null }).accessor }).read).toBe(0);
    });
  });

  describe('the work’s length', () => {
    it('is null when the source never recorded one', () => {
      expect(makeBloc({ work: server(null, null).accessor }).max).toBeNull();
    });

    it('treats zero and a negative total as "unknown" rather than as a length', () => {
      expect(makeBloc({ work: server(null, 0).accessor }).max).toBeNull();
      expect(makeBloc({ work: server(null, -3).accessor }).max).toBeNull();
    });

    it('is the recorded total when there is one', () => {
      expect(makeBloc({ work: server(null, 120).accessor }).max).toBe(120);
    });
  });

  describe('the progress bar', () => {
    it('is zero without a known total, however much has been read', () => {
      expect(makeBloc({ work: server({ chapters: 40 }, null).accessor }).percent).toBe(0);
    });

    it('is a whole percentage of the total', () => {
      expect(makeBloc({ work: server({ chapters: 50 }, 200).accessor }).percent).toBe(25);
      expect(makeBloc({ work: server({ chapters: 1 }, 3).accessor }).percent).toBe(33);
      expect(makeBloc({ work: server({ chapters: 0 }, 10).accessor }).percent).toBe(0);
    });

    it('never runs past full, even on a row that overshoots its total', () => {
      expect(makeBloc({ work: server({ chapters: 300 }, 200).accessor }).percent).toBe(100);
    });
  });

  describe('the ends of the range', () => {
    it('is at the start only with nothing read', () => {
      expect(makeBloc({ work: server({ chapters: 0 }, 10).accessor }).atStart).toBe(true);
      expect(makeBloc({ work: server({ chapters: 1 }, 10).accessor }).atStart).toBe(false);
    });

    it('is at the end only when the total is known and reached', () => {
      expect(makeBloc({ work: server({ chapters: 10 }, 10).accessor }).atEnd).toBe(true);
      expect(makeBloc({ work: server({ chapters: 9 }, 10).accessor }).atEnd).toBe(false);
      // An ongoing work has no end to be at.
      expect(makeBloc({ work: server({ chapters: 900 }, null).accessor }).atEnd).toBe(false);
    });
  });

  describe('setting the count', () => {
    it('answers immediately, before the write lands', () => {
      const save = vi.fn(() => new Promise<void>(() => {}));
      const bloc = makeBloc({ work: server({ chapters: 3 }).accessor, progress: { save } });

      bloc.setRead(4);

      expect(bloc.read).toBe(4);
    });

    it('carries the rest of the row so a chapters write does not blank it', async () => {
      const save = vi.fn(async () => undefined);
      const bloc = makeBloc({
        work: server({
          status: WorkStatus.Reading,
          score: 8,
          volumes: 2,
          chapters: 3
        }).accessor,
        progress: { save }
      });

      bloc.setRead(4);
      await settle();

      expect(save).toHaveBeenCalledWith<[ChapterProgressInput]>({
        workID: 'w1',
        status: WorkStatus.Reading,
        score: 8,
        volumes: 2,
        chapters: 4
      });
    });

    it('sends undefined rather than null for the fields the row has not set', async () => {
      const save = vi.fn(async () => undefined);
      const bloc = makeBloc({
        work: server({ status: null, score: null, volumes: null, chapters: 0 }).accessor,
        progress: { save }
      });

      bloc.setRead(1);
      await settle();

      expect(save).toHaveBeenCalledWith<[ChapterProgressInput]>({
        workID: 'w1',
        status: undefined,
        score: undefined,
        volumes: undefined,
        chapters: 1
      });
    });

    it('clamps below zero and above the total', async () => {
      const save = vi.fn(async () => undefined);
      const bloc = makeBloc({
        work: server({ chapters: 5 }, 10).accessor,
        progress: { save }
      });

      bloc.setRead(-4);
      expect(bloc.read).toBe(0);

      bloc.setRead(999);
      expect(bloc.read).toBe(10);
    });

    it('does not clamp upward when the work has no known total', () => {
      const bloc = makeBloc({ work: server({ chapters: 5 }, null).accessor });

      bloc.setRead(9999);

      expect(bloc.read).toBe(9999);
    });

    it('rounds a fractional chapter to a whole one', () => {
      const bloc = makeBloc({ work: server({ chapters: 0 }, 100).accessor });

      bloc.setRead(4.6);

      expect(bloc.read).toBe(5);
    });

    it('writes nothing when the number lands where it already was', async () => {
      const save = vi.fn(async () => undefined);
      const bloc = makeBloc({ work: server({ chapters: 5 }, 10).accessor, progress: { save } });

      bloc.setRead(5);
      // Clamping to a value that is already showing is still a no-op.
      bloc.setRead(50);
      bloc.setRead(50);
      await settle();

      expect(save).toHaveBeenCalledTimes(1);
      expect(save).toHaveBeenCalledWith(expect.objectContaining({ chapters: 10 }));
    });
  });

  describe('stepping', () => {
    it('moves relative to what is showing, not to the server’s value', async () => {
      const save = vi.fn(async () => undefined);
      const bloc = makeBloc({ work: server({ chapters: 3 }, 10).accessor, progress: { save } });

      bloc.step(1);
      bloc.step(1);
      await settle();

      expect(bloc.read).toBe(5);
      expect(save).toHaveBeenLastCalledWith(expect.objectContaining({ chapters: 5 }));
    });

    it('will not step below zero', () => {
      const bloc = makeBloc({ work: server({ chapters: 0 }, 10).accessor });

      bloc.step(-1);

      expect(bloc.read).toBe(0);
    });

    it('will not step past the end', () => {
      const bloc = makeBloc({ work: server({ chapters: 10 }, 10).accessor });

      bloc.step(1);

      expect(bloc.read).toBe(10);
    });
  });

  describe('a typed chapter number', () => {
    it('takes the digits', () => {
      const bloc = makeBloc({ work: server({ chapters: 0 }, 100).accessor });

      bloc.setReadFromText('42');

      expect(bloc.read).toBe(42);
    });

    it('reads a cleared or unparseable field as zero, never NaN', () => {
      for (const raw of ['', '   ', 'abc', '-']) {
        const bloc = makeBloc({ work: server({ chapters: 7 }, 100).accessor });

        bloc.setReadFromText(raw);

        expect(bloc.read).toBe(0);
      }
    });

    it('takes the leading number out of a half-typed value', () => {
      const bloc = makeBloc({ work: server({ chapters: 0 }, 100).accessor });

      bloc.setReadFromText('12abc');

      expect(bloc.read).toBe(12);
    });
  });

  describe('the optimistic rule', () => {
    it('holds the reader’s number while the server still says what it said', async () => {
      const src = server({ chapters: 3 }, 10);
      const bloc = makeBloc({ work: src.accessor });

      bloc.setRead(4);
      await settle();

      // Our own successful write re-reads a page whose loader has not caught up.
      expect(bloc.serverRead).toBe(3);
      expect(bloc.read).toBe(4);
    });

    it('lets the server win the moment it reports anything else', () => {
      const src = server({ chapters: 3 }, 10);
      const bloc = makeBloc({ work: src.accessor });

      bloc.setRead(4);
      src.reports({ chapters: 7 }); // another device moved the row

      expect(bloc.read).toBe(7);
    });

    it('puts the number back when the write fails, and says why', async () => {
      const notify = { error: vi.fn() };
      const bloc = makeBloc({
        work: server({ chapters: 3 }, 10).accessor,
        progress: { save: vi.fn(async () => Promise.reject(new Error('upstream 500'))) },
        notify
      });

      bloc.setRead(4);
      expect(bloc.read).toBe(4);
      await settle();

      expect(bloc.read).toBe(3);
      expect(notify.error).toHaveBeenCalledWith('upstream 500');
    });

    it('has its own words for a failure that carried none', async () => {
      const notify = { error: vi.fn() };
      const bloc = makeBloc({
        work: server({ chapters: 3 }, 10).accessor,
        progress: { save: vi.fn(async () => Promise.reject({})) },
        notify
      });

      bloc.setRead(4);
      await settle();

      expect(notify.error).toHaveBeenCalledWith('Could not save your progress');
    });
  });

  it('re-reads the page once the write lands', async () => {
    const refresh = vi.fn(async () => {});
    const bloc = makeBloc({ work: server({ chapters: 3 }, 10).accessor, refresh });

    bloc.setRead(4);
    await settle();

    expect(refresh).toHaveBeenCalledTimes(1);
  });

  it('is busy while the write is in flight and inert again once it lands', async () => {
    let release!: () => void;
    const bloc = makeBloc({
      work: server({ chapters: 3 }, 10).accessor,
      progress: { save: vi.fn(() => new Promise<void>((resolve) => (release = resolve))) }
    });
    scopes.push(reactiveScope(() => bloc.busy));

    bloc.setRead(4);
    await vi.waitFor(() => expect(bloc.busy).toBe(true));

    release();
    await vi.waitFor(() => expect(bloc.busy).toBe(false));
  });
});
