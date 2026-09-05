import { invalidateAll } from '$app/navigation';
import {
  createMutation,
  type CreateBaseMutationResult,
  type QueryClient,
} from '@tanstack/svelte-query';
import { fromStore } from 'svelte/store';
import { toast } from 'svelte-sonner';
import { upsertWork } from '../../services/queries';
import { WorkStatus } from '../../gql/graphql';
import {
  defaultQueryClient,
  type NotifyPort,
  type RefreshPort,
} from './WorkStatusControl.bloc.svelte';

/** The viewer's row on a work: everything a chapters write has to carry. */
export interface UserWorkProgress {
  status?: string | null;
  score?: number | null;
  chapters?: number | null;
  volumes?: number | null;
}

/** What the view knows: which work, how long it is, and the viewer's row. */
export type WorkProgressAccessor = () => {
  workId: string;
  totalChapters: number | null;
  userWork: UserWorkProgress | null;
};

/** The whole row as it is written back, so the port stays one call. */
export interface ChapterProgressInput {
  workID: string;
  status?: WorkStatus;
  score?: number;
  volumes?: number;
  chapters: number;
}

/** The single write this control makes. */
export interface WorkProgressPort {
  save(input: ChapterProgressInput): Promise<unknown>;
}

export interface ChapterProgressDeps {
  work?: WorkProgressAccessor;
  progress?: WorkProgressPort;
  refresh?: RefreshPort;
  notify?: NotifyPort;
  queryClient?: QueryClient;
}

type MutationView<TVariables> = {
  readonly current: CreateBaseMutationResult<unknown, unknown, TVariables>;
};

const realProgress: WorkProgressPort = {
  save: (input) => upsertWork().mutationFn({ input }),
};

const realNotify: NotifyPort = { error: (message) => toast.error(message) };

/**
 * How far through a work the reader is, in chapters.
 *
 * The stepper answers immediately rather than after a round trip, and holds the
 * reader's number only while the server still says what it said when they set
 * it -- the same optimistic rule as WorkStatusControl, for the same reason: our
 * own successful write re-reads a page whose loader has not caught up yet, and
 * a plain mirror of the prop stamped on what the reader had just typed.
 */
export class ChapterProgressBloc {
  readonly #work: WorkProgressAccessor;
  readonly #notify: NotifyPort;
  readonly #save: MutationView<number>;

  #choice = $state<{ against: number; value: number } | null>(null);

  constructor({
    work = () => ({ workId: '', totalChapters: null, userWork: null }),
    progress = realProgress,
    refresh = async () => {
      await invalidateAll();
    },
    notify = realNotify,
    queryClient = defaultQueryClient(),
  }: ChapterProgressDeps = {}) {
    this.#work = work;
    this.#notify = notify;

    this.#save = fromStore(
      createMutation(
        {
          mutationFn: async (next: number) => {
            const { workId, userWork } = this.#work();
            return progress.save({
              workID: workId,
              // Carry the rest of the row, or a chapters-only write would blank
              // the status and score the reader already set.
              status: (userWork?.status ?? undefined) as WorkStatus | undefined,
              score: userWork?.score ?? undefined,
              volumes: userWork?.volumes ?? undefined,
              chapters: next,
            });
          },
          onSuccess: async () => {
            queryClient.invalidateQueries();
            await refresh();
          },
          onError: (error: unknown) => {
            // Put it back to what the server still believes.
            this.#choice = null;
            this.#notify.error(
              String((error as { message?: unknown })?.message ?? 'Could not save your progress'),
            );
          },
        },
        queryClient,
      ),
    );
  }

  /** The chapter count the server has on record. */
  get serverRead(): number {
    return this.#work().userWork?.chapters ?? 0;
  }

  /** What the stepper shows: the reader's number while it still stands, else the server's. */
  get read(): number {
    const choice = this.#choice;
    const server = this.serverRead;
    return choice && choice.against === server ? choice.value : server;
  }

  /** The work's chapter total, or null when the source never recorded one. */
  get max(): number | null {
    const total = this.#work().totalChapters;
    return total && total > 0 ? total : null;
  }

  /** Progress as a whole percentage, for the bar. Zero without a known total. */
  get percent(): number {
    const max = this.max;
    return max ? Math.min(100, Math.round((this.read / max) * 100)) : 0;
  }

  get atStart(): boolean {
    return this.read <= 0;
  }

  get atEnd(): boolean {
    const max = this.max;
    return max != null && this.read >= max;
  }

  get busy(): boolean {
    return this.#save.current.isPending;
  }

  /** Set the count, clamped to the work. A no-op when it lands where it already was. */
  setRead(next: number): void {
    let value = Math.max(0, Math.round(next));
    const max = this.max;
    if (max != null) value = Math.min(value, max);
    if (value === this.read) return;

    this.#choice = { against: this.serverRead, value };
    this.#save.current.mutate(value);
  }

  step(delta: number): void {
    this.setRead(this.read + delta);
  }

  /** What a typed field gives us: anything unreadable means zero, not NaN. */
  setReadFromText(raw: string): void {
    const parsed = parseInt(raw, 10);
    this.setRead(Number.isNaN(parsed) ? 0 : parsed);
  }
}
