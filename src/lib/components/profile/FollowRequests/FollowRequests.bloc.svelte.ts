import { createMutation, createQuery, type CreateBaseMutationResult, type QueryClient, type QueryObserverResult } from '@tanstack/svelte-query';
import { derived, fromStore, type Readable } from 'svelte/store';
import { toast } from 'svelte-sonner';
import { loggedInStore } from '$lib/stores/auth';
import { resolveLoggedIn, type ClientAuthState, type ServerAuth } from '$lib/stores/server-auth';
import { acceptFollowRequest, declineFollowRequest, fetchFollowRequests } from '$lib/services/query-options';
import { defaultQueryClient } from '$lib/components/profile/MediaList.bloc.svelte';
import { actorOf, type ActivityActor } from '$lib/components/feed/activity';

/**
 * Pending requests to follow the signed-in user, on the dashboard.
 *
 * Only shown when there is something to answer; an account that does not
 * require approval never has any, so the panel is simply absent for it.
 */

export interface FollowRequestsPort {
  list(limit: number): { queryKey: unknown[]; queryFn: () => Promise<any> };
  accept(followerID: string): Promise<boolean>;
  decline(followerID: string): Promise<boolean>;
}

export const realFollowRequestsPort: FollowRequestsPort = {
  list: (limit) => fetchFollowRequests(1, limit),
  accept: (id) => acceptFollowRequest().mutationFn(id),
  decline: (id) => declineFollowRequest().mutationFn(id),
};

export interface NotifyPort {
  error(message: string): void;
}

export interface FollowRequestsDeps {
  port?: FollowRequestsPort;
  auth?: Readable<ClientAuthState>;
  /** The server's answer, believed until `auth` has resolved. */
  serverAuth?: ServerAuth | null;
  queryClient?: QueryClient;
  notify?: NotifyPort;
  limit?: number;
}

type Decision = { followerID: string; accept: boolean };

export class FollowRequestsBloc {
  readonly #auth: { readonly current: ClientAuthState };
  readonly #serverAuth: ServerAuth | null;
  readonly #query: { readonly current: QueryObserverResult<any, unknown> };
  readonly #decide: { readonly current: CreateBaseMutationResult<boolean, unknown, Decision> };
  /** Requests answered this session, hidden before the refetch lands. */
  #answered = $state<Record<string, true>>({});
  #busy = $state<string | null>(null);

  constructor({
    port = realFollowRequestsPort,
    auth = loggedInStore,
    serverAuth = null,
    queryClient = defaultQueryClient(),
    notify = { error: (message) => toast.error(message) },
    limit = 20,
  }: FollowRequestsDeps = {}) {
    this.#auth = fromStore(auth);
    this.#serverAuth = serverAuth;
    this.#query = fromStore(
      createQuery(
        derived(auth, (state) => ({ ...port.list(limit), enabled: state.isLoggedIn, staleTime: 30_000, retry: false })),
        queryClient,
      ),
    );

    this.#decide = fromStore(
      createMutation(
        {
          mutationFn: ({ followerID, accept }: Decision) => (accept ? port.accept(followerID) : port.decline(followerID)),
          onMutate: ({ followerID }: Decision) => {
            this.#busy = followerID;
          },
          onSuccess: (_result: boolean, { followerID }: Decision) => {
            this.#answered = { ...this.#answered, [followerID]: true };
            queryClient.invalidateQueries({ queryKey: ['follow-requests'] });
            queryClient.invalidateQueries({ queryKey: ['followers'] });
            queryClient.invalidateQueries({ queryKey: ['unread-notification-count'] });
          },
          onError: (error: any) => {
            const gql = error?.response?.errors?.[0];
            notify.error(gql?.extensions?.message || gql?.message || 'Could not answer that request. Try again.');
          },
          onSettled: () => {
            this.#busy = null;
          },
        },
        queryClient,
      ),
    );
  }

  /** Who the panel is for: the client store once resolved, else the server's answer. */
  get isLoggedIn(): boolean {
    return resolveLoggedIn(this.#auth.current, this.#serverAuth);
  }

  get isLoading(): boolean {
    return this.#query.current.isLoading;
  }

  get requests(): ActivityActor[] {
    const rows: any[] = this.#query.current.data?.users ?? [];
    return rows.filter((row) => !this.#answered[row.id]).map(actorOf);
  }

  get total(): number {
    return Math.max(0, Number(this.#query.current.data?.total ?? 0) - Object.keys(this.#answered).length);
  }

  get hasRequests(): boolean {
    return this.requests.length > 0;
  }

  isBusy(followerID: string): boolean {
    return this.#busy === followerID;
  }

  accept(followerID: string): void {
    if (this.#busy) return;
    this.#decide.current.mutate({ followerID, accept: true });
  }

  decline(followerID: string): void {
    if (this.#busy) return;
    this.#decide.current.mutate({ followerID, accept: false });
  }
}
