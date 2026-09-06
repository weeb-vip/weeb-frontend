import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/svelte';
import userEvent from '@testing-library/user-event';
import { QueryClient } from '@tanstack/svelte-query';
import ChapterProgress from './ChapterProgress.svelte';
import {
  ChapterProgressBloc,
  type ChapterProgressDeps,
  type ChapterProgressInput,
  type UserWorkProgress
} from './ChapterProgress.bloc.svelte';

/**
 * How far through a work the reader is, as it is drawn: the count, the two
 * steppers, the typed field and the bar.
 *
 * The rules -- clamping, the optimistic "hold the reader's number only while
 * the server still says what it said", what a chapters write carries -- are the
 * bloc's and are asserted in `ChapterProgress.test.ts`. This file mounts the
 * real bloc over stub ports and asserts the DOM: which control is disabled
 * when, what the field shows, and what a press actually sends.
 *
 * jsdom caveats: the bar is a `scaleX` on a custom property, so what is
 * asserted is the property and the `progressbar`'s ARIA values. That the fill
 * is visibly 40% wide is layout, and jsdom performs none -- that belongs to the
 * visual layer.
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

/** The stepper's own field, which is also where the current count is readable. */
const field = () => screen.getByLabelText('Chapters read') as HTMLInputElement;
const fewer = () => screen.getByRole('button', { name: 'One chapter fewer' });
const more = () => screen.getByRole('button', { name: 'One chapter more' });

const mount = (bloc: ChapterProgressBloc) =>
  render(ChapterProgress, { props: { workId: 'w1', bloc } });

describe('ChapterProgress (rendering)', () => {
  describe('what it shows', () => {
    it('names itself and starts at zero for a work nothing has been read of', () => {
      mount(makeBloc());

      expect(screen.getByText('Chapters read')).toBeInTheDocument();
      expect(field()).toHaveValue(0);
    });

    it('shows the count the server has on record', () => {
      mount(makeBloc({ work: server({ chapters: 12 }, 120).accessor }));

      expect(field()).toHaveValue(12);
      // The head reads "12 / 120": the total is context, not a second figure to
      // read on its own.
      expect(screen.getByText('120')).toBeInTheDocument();
    });

    it('prints no total, and no bar, for a work whose length was never recorded', () => {
      const { container } = mount(makeBloc({ work: server({ chapters: 12 }, null).accessor }));

      expect(container.querySelector('.cp-sep')).toBeNull();
      expect(screen.queryByRole('progressbar')).not.toBeInTheDocument();
    });

    it('bounds the field by the work’s length, so the browser stops an overshoot too', () => {
      mount(makeBloc({ work: server({ chapters: 12 }, 120).accessor }));

      expect(field()).toHaveAttribute('max', '120');
      expect(field()).toHaveAttribute('min', '0');
    });
  });

  describe('the bar', () => {
    it('reports where the reader is, as a progressbar rather than a bare div', () => {
      mount(makeBloc({ work: server({ chapters: 30 }, 120).accessor }));

      const bar = screen.getByRole('progressbar');
      expect(bar).toHaveAttribute('aria-valuenow', '30');
      expect(bar).toHaveAttribute('aria-valuemin', '0');
      expect(bar).toHaveAttribute('aria-valuemax', '120');
    });

    it('hands the fill to the stylesheet as a fraction', () => {
      const { container } = mount(makeBloc({ work: server({ chapters: 30 }, 120).accessor }));

      // 25%, as a 0-1 factor for `scaleX`. That the fill is a quarter of the
      // track wide is layout, which jsdom does not do.
      expect(container.querySelector('.cp-fill')).toHaveAttribute(
        'style',
        expect.stringContaining('--p: 0.25')
      );
    });
  });

  describe('the steppers', () => {
    it('will not step below the start of the work', () => {
      mount(makeBloc());

      expect(fewer()).toBeDisabled();
      expect(more()).toBeEnabled();
    });

    it('will not step past the end of it', () => {
      mount(makeBloc({ work: server({ chapters: 120 }, 120).accessor }));

      expect(more()).toBeDisabled();
      expect(fewer()).toBeEnabled();
    });

    it('keeps stepping up on a work with no recorded length', () => {
      mount(makeBloc({ work: server({ chapters: 900 }, null).accessor }));

      expect(more()).toBeEnabled();
    });

    it('answers immediately rather than after the round trip', async () => {
      const save = vi.fn(async () => undefined);
      mount(makeBloc({ work: server({ chapters: 12 }, 120).accessor, progress: { save } }));

      await userEvent.click(more());

      // The field moves on the press; the loader that would confirm it has not
      // even been asked yet.
      expect(field()).toHaveValue(13);
      expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '13');
    });

    it('steps back down', async () => {
      mount(makeBloc({ work: server({ chapters: 12 }, 120).accessor }));

      await userEvent.click(fewer());

      expect(field()).toHaveValue(11);
    });

    it('writes the rest of the reader’s row alongside the new count', async () => {
      const save = vi.fn<(input: ChapterProgressInput) => Promise<unknown>>(async () => undefined);
      mount(
        makeBloc({
          work: server({ chapters: 12, status: 'READING', score: 9, volumes: 2 }, 120).accessor,
          progress: { save }
        })
      );

      await userEvent.click(more());

      // A chapters-only write would blank the status and score the reader had
      // already set.
      expect(save).toHaveBeenCalledWith({
        workID: 'w1',
        status: 'READING',
        score: 9,
        volumes: 2,
        chapters: 13
      });
    });
  });

  describe('the typed field', () => {
    it('takes a number straight to that chapter', async () => {
      const save = vi.fn<(input: ChapterProgressInput) => Promise<unknown>>(async () => undefined);
      mount(makeBloc({ work: server({ chapters: 3 }, 120).accessor, progress: { save } }));

      await fireEvent.change(field(), { target: { value: '40' } });

      expect(field()).toHaveValue(40);
      expect(save).toHaveBeenCalledWith(expect.objectContaining({ chapters: 40 }));
    });

    it('clamps a number past the end of the work', async () => {
      const save = vi.fn<(input: ChapterProgressInput) => Promise<unknown>>(async () => undefined);
      mount(makeBloc({ work: server({ chapters: 3 }, 120).accessor, progress: { save } }));

      await fireEvent.change(field(), { target: { value: '9999' } });

      expect(field()).toHaveValue(120);
      expect(save).toHaveBeenCalledWith(expect.objectContaining({ chapters: 120 }));
    });

    it('reads an unreadable field as none rather than as NaN', async () => {
      const save = vi.fn<(input: ChapterProgressInput) => Promise<unknown>>(async () => undefined);
      mount(makeBloc({ work: server({ chapters: 3 }, 120).accessor, progress: { save } }));

      await fireEvent.change(field(), { target: { value: '' } });

      expect(field()).toHaveValue(0);
      expect(save).toHaveBeenCalledWith(expect.objectContaining({ chapters: 0 }));
    });

    it('sends nothing at all for a change that lands where it already was', async () => {
      const save = vi.fn<(input: ChapterProgressInput) => Promise<unknown>>(async () => undefined);
      mount(makeBloc({ work: server({ chapters: 3 }, 120).accessor, progress: { save } }));

      await fireEvent.change(field(), { target: { value: '3' } });

      expect(save).not.toHaveBeenCalled();
    });
  });

  describe('while the write is in flight', () => {
    it('locks every control, so a second press cannot race the first', async () => {
      const bloc = makeBloc({
        work: server({ chapters: 12 }, 120).accessor,
        progress: { save: () => new Promise<never>(() => {}) }
      });
      mount(bloc);

      await userEvent.click(more());

      await waitFor(() => expect(field()).toBeDisabled());
      expect(more()).toBeDisabled();
      expect(fewer()).toBeDisabled();
      // The reader's number stands while it is saving.
      expect(field()).toHaveValue(13);
    });

    it('unlocks again once the write lands', async () => {
      let release: () => void = () => {};
      mount(
        makeBloc({
          work: server({ chapters: 12 }, 120).accessor,
          progress: {
            save: () =>
              new Promise<void>((resolve) => {
                release = resolve;
              })
          }
        })
      );

      await userEvent.click(more());
      await waitFor(() => expect(field()).toBeDisabled());

      release();

      await waitFor(() => expect(field()).toBeEnabled());
      expect(more()).toBeEnabled();
    });
  });

  describe('when the write fails', () => {
    it('puts the field back to what the server still believes, and says so', async () => {
      const error = vi.fn();
      mount(
        makeBloc({
          work: server({ chapters: 12 }, 120).accessor,
          progress: { save: async () => Promise.reject(new Error('Network is down')) },
          notify: { error }
        })
      );

      await userEvent.click(more());

      // Optimism is not asserted here: this port rejects on the next microtask,
      // so the rollback has already happened by the time the click resolves.
      // The "reader's number stands while it is saving" case is the in-flight
      // test above, which holds the promise open.
      await waitFor(() => expect(field()).toHaveValue(12));
      expect(error).toHaveBeenCalledWith('Network is down');
      expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '12');
    });

    it('leaves the controls usable, so the reader can try again', async () => {
      mount(
        makeBloc({
          work: server({ chapters: 12 }, 120).accessor,
          progress: { save: async () => Promise.reject(new Error('nope')) },
          notify: { error: vi.fn() }
        })
      );

      await userEvent.click(more());

      await waitFor(() => {
        expect(field()).toHaveValue(12);
        expect(field()).toBeEnabled();
      });
      expect(more()).toBeEnabled();
    });
  });
});
