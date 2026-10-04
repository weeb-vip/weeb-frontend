import { createQuery, type QueryClient, type QueryObserverResult } from '@tanstack/svelte-query';
import { derived, fromStore, writable, type Readable } from 'svelte/store';
import { loggedInStore } from '$lib/stores/auth';
import { resolveLoggedIn, type ClientAuthState, type ServerAuth } from '$lib/stores/server-auth';
import { fetchFeed } from '$lib/services/query-options';
import { defaultQueryClient } from '$lib/components/profile/MediaList.bloc.svelte';
import { toActivityItems, type ActivityItem } from '$lib/components/feed/activity';

/**
 * The /feed page: what the people you follow have been up to, a page at a time.
 *
 * Page one arrives from the server; it seeds the query so there is no second
 * fetch on arrival. Later pages are plain client queries keyed on the page
 * number, so going back to a page you have seen is instant.
 */

export interface FeedPageSource {
  ssr: { feed: any } | null;
}

export interface FeedPort {
  page(page: number, limit: number): { queryKey: unknown[]; queryFn: () => Promise<any> };
}

export const realFeedPort: FeedPort = {
  page: (page, limit) => fetchFeed(page, limit),
};

export interface FeedPageDeps {
  source?: () => FeedPageSource;
  port?: FeedPort;
  auth?: Readable<ClientAuthState>;
  /** The server's answer (the loader already fetched the feed on its strength),
   * believed until `auth` has resolved: a signed-in response renders its items
   * rather than "Sign in to see your feed". */
  serverAuth?: ServerAuth | null;
  queryClient?: QueryClient;
  pageSize?: number;
  now?: () => number;
}

export class FeedPageBloc {
  readonly pageSize: number;
  readonly #source: () => FeedPageSource;
  readonly #auth: { readonly current: ClientAuthState };
  readonly #serverAuth: ServerAuth | null;
  readonly #page = writable(1);
  readonly #query: { readonly current: QueryObserverResult<any, unknown> };
  readonly #now: () => number;
  #pageValue = $state(1);

  constructor({
    source = () => ({ ssr: null }),
    port = realFeedPort,
    auth = loggedInStore,
    serverAuth = null,
    queryClient = defaultQueryClient(),
    pageSize = 24,
    now = () => Date.now(),
  }: FeedPageDeps = {}) {
    this.pageSize = pageSize;
    this.#source = source;
    this.#auth = fromStore(auth);
    this.#serverAuth = serverAuth;
    this.#now = now;

    const options = derived([this.#page, auth], ([page, state]) => {
      const ssr = page === 1 ? source().ssr?.feed : null;
      return {
        ...port.page(page, pageSize),
        enabled: state.isLoggedIn,
        ...(ssr ? { initialData: ssr } : {}),
        staleTime: 30_000,
        retry: false,
      };
    });
    this.#query = fromStore(createQuery(options, queryClient));
  }

  get isLoggedIn(): boolean {
    return resolveLoggedIn(this.#auth.current, this.#serverAuth);
  }

  get isLoading(): boolean {
    return this.isLoggedIn && this.#query.current.isLoading;
  }

  get isError(): boolean {
    return this.#query.current.isError;
  }

  get items(): ActivityItem[] {
    return toActivityItems(this.#query.current.data?.activities, this.#now());
  }

  get total(): number {
    return Number(this.#query.current.data?.total ?? 0);
  }

  get page(): number {
    return this.#pageValue;
  }

  get totalPages(): number {
    return Math.max(1, Math.ceil(this.total / this.pageSize));
  }

  get hasPrevious(): boolean {
    return this.page > 1;
  }

  get hasNext(): boolean {
    return this.page < this.totalPages;
  }

  /** True when the viewer follows nobody yet, or nobody has done anything. */
  get isEmpty(): boolean {
    return this.isLoggedIn && !this.isLoading && !this.isError && this.items.length === 0;
  }

  goTo(page: number): void {
    const next = Math.min(Math.max(1, page), this.totalPages);
    this.#pageValue = next;
    this.#page.set(next);
  }

  next(): void {
    if (this.hasNext) this.goTo(this.page + 1);
  }

  previous(): void {
    if (this.hasPrevious) this.goTo(this.page - 1);
  }
}
