import { invalidateAll } from '$app/navigation';
import { browser } from '$app/environment';
import {
  createMutation,
  type CreateBaseMutationResult,
  type QueryClient,
} from '@tanstack/svelte-query';
import { fromStore } from 'svelte/store';
import { toast } from 'svelte-sonner';
import { createQueryClient, getQueryClient } from '../services/query-client';
import { upsertWork, deleteWork } from '../../services/queries';
import { WorkStatus } from '../../gql/graphql';

/** The viewer's row on a work -- the two fields this control reads. */
export interface UserWorkSnapshot {
  id?: string | null;
  status?: string | null;
}

/** What the view knows and the bloc needs: which work, and the server's row for it. */
export type WorkAccessor = () => { workId: string; userWork: UserWorkSnapshot | null };

/**
 * The two writes this control makes. Narrowed to verbs rather than exposing the
 * GraphQL mutation shapes, so a story or a test can hand over a promise that
 * never settles (pending) or rejects (the rollback path) without a network.
 */
export interface WorkTrackingPort {
  setStatus(workId: string, status: WorkStatus): Promise<unknown>;
  untrack(workId: string): Promise<unknown>;
}

/**
 * "The server moved, re-read the page." `invalidateAll`, not just the query
 * cache: a manga page is server-loaded, so the cache holds nothing to
 * invalidate and `userWork` would stay stale until a manual reload.
 */
export type RefreshPort = () => Promise<void>;

/** Only the failure channel -- the control never announces a success. */
export interface NotifyPort {
  error(message: string): void;
}

/** What `fromStore` hands back for one of the mutation stores. */
type MutationView<TVariables> = {
  readonly current: CreateBaseMutationResult<unknown, unknown, TVariables>;
};

export interface WorkStatusControlDeps {
  work?: WorkAccessor;
  tracking?: WorkTrackingPort;
  refresh?: RefreshPort;
  notify?: NotifyPort;
  queryClient?: QueryClient;
}

/**
 * "Not tracking" is an option in the same list rather than a separate remove
 * button: it is where someone goes to undo, and hiding it behind a second
 * control makes removing harder than adding.
 */
export const NOT_TRACKING = '';

export const WORK_STATUS_OPTIONS: { value: string; label: string }[] = [
  { value: NOT_TRACKING, label: 'Not tracking' },
  { value: WorkStatus.Reading, label: 'Reading' },
  { value: WorkStatus.Plantoread, label: 'Plan to read' },
  { value: WorkStatus.Completed, label: 'Completed' },
  { value: WorkStatus.Onhold, label: 'On hold' },
  { value: WorkStatus.Dropped, label: 'Dropped' },
];

const realTracking: WorkTrackingPort = {
  setStatus: (workId, status) =>
    upsertWork().mutationFn({ input: { workID: workId, status } }),
  untrack: (workId) => deleteWork().mutationFn(workId),
};

const realNotify: NotifyPort = { error: (message) => toast.error(message) };

/**
 * The browser shares one client; a server render gets its own, so per-user data
 * never leaks between concurrent requests. Same rule as the root layout.
 */
export function defaultQueryClient(): QueryClient {
  return browser ? getQueryClient() : createQueryClient();
}

/**
 * The one error worth rewording. Everything else is shown as it arrives,
 * because a made-up message is harder to act on than a real one.
 */
export function authAware(error: unknown, fallback: string): string {
  const text = String((error as { message?: unknown })?.message ?? '').toLowerCase();
  if (
    text.includes('access denied') ||
    text.includes('unauthenticated') ||
    text.includes('unauthorized')
  ) {
    return 'Log in to keep track of what you are reading';
  }

  return fallback;
}

/**
 * Put a work on your shelf, or move it.
 *
 * The interesting part is the optimistic status. The control answers straight
 * away rather than waiting for a round trip, but it must not out-stubborn the
 * server: a choice is held only while the server still says what it said when
 * the choice was made. The moment the server reports anything else -- our own
 * write landing, or another tab moving the row -- the server wins again. That
 * is the same rule the old `serverStatus` mirror implemented with an assignment
 * inside a reactive block, expressed here as a pure read.
 */
export class WorkStatusControlBloc {
  readonly options = WORK_STATUS_OPTIONS;

  readonly #work: WorkAccessor;
  readonly #notify: NotifyPort;

  /** The reader's choice, and the server value it was made against. */
  #choice = $state<{ against: string; value: string } | null>(null);

  readonly #save: MutationView<string>;
  readonly #remove: MutationView<void>;

  constructor({
    work = () => ({ workId: '', userWork: null }),
    tracking = realTracking,
    refresh = async () => {
      await invalidateAll();
    },
    notify = realNotify,
    queryClient = defaultQueryClient(),
  }: WorkStatusControlDeps = {}) {
    this.#work = work;
    this.#notify = notify;

    const settled = async () => {
      queryClient.invalidateQueries();
      await refresh();
    };

    this.#save = fromStore(
      createMutation(
        {
          mutationFn: async (next: string) =>
            tracking.setStatus(this.#work().workId, next as WorkStatus),
          onSuccess: settled,
          onError: (error: unknown) => {
            // Put the control back to what the server still believes.
            this.#choice = null;
            this.#notify.error(authAware(error, 'Could not update your list'));
          },
        },
        queryClient,
      ),
    );

    this.#remove = fromStore(
      createMutation(
        {
          mutationFn: async () => tracking.untrack(this.#work().workId),
          onSuccess: settled,
          onError: (error: unknown) => {
            this.#choice = null;
            this.#notify.error(authAware(error, 'Could not remove this from your list'));
          },
        },
        queryClient,
      ),
    );
  }

  /** What the server currently says the row is. */
  get serverStatus(): string {
    return this.#work().userWork?.status ?? NOT_TRACKING;
  }

  /** What the control shows: the reader's choice while it still stands, else the server's. */
  get status(): string {
    const choice = this.#choice;
    const server = this.serverStatus;
    return choice && choice.against === server ? choice.value : server;
  }

  /** A write is in flight; the select is inert until it lands. */
  get busy(): boolean {
    return this.#save.current.isPending || this.#remove.current.isPending;
  }

  selectStatus(next: string): void {
    if (next === this.status) return;
    this.#choice = { against: this.serverStatus, value: next };

    if (next === NOT_TRACKING) {
      this.#remove.current.mutate();
      return;
    }

    this.#save.current.mutate(next);
  }
}
