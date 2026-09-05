import {
  createQuery,
  type QueryClient,
  type QueryObserverResult,
} from '@tanstack/svelte-query';
import { fromStore } from 'svelte/store';
import { SvelteSet } from 'svelte/reactivity';
import { browser } from '$app/environment';
import { getCharactersAndStaffByAnimeID } from '../../services/queries';
import { createQueryClient, getQueryClient } from '../services/query-client';

/**
 * The browser shares one client; a server render gets its own, so nothing is
 * cached across concurrent requests. Same rule as the root layout.
 */
function defaultQueryClient(): QueryClient {
  return browser ? getQueryClient() : createQueryClient();
}

/** A voice actor as the cards read one. */
export interface StaffLike {
  id?: string | null;
  slug?: string | null;
  givenName?: string | null;
  familyName?: string | null;
  language?: string | null;
  [key: string]: unknown;
}

/** One character and everyone who voiced them. */
export interface CharacterEntry {
  character: {
    id?: string | null;
    name?: string | null;
    role?: string | null;
    [key: string]: unknown;
  };
  staff?: StaffLike[] | null;
}

export type CharacterFilter = 'all' | 'main' | 'supporting' | 'minor';

export const CHARACTER_FILTERS: { value: CharacterFilter; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'main', label: 'Main' },
  { value: 'supporting', label: 'Supporting' },
  { value: 'minor', label: 'Minor' },
];

/**
 * Where the cast comes from. Narrowed to "give me the query options for this
 * anime", which is all the bloc uses -- a story hands over a resolved (or
 * never-resolving, or rejecting) promise instead of a GraphQL client.
 */
export type CharactersQueryPort = (animeId: string) => {
  queryKey: readonly unknown[];
  queryFn: () => Promise<CharacterEntry[]>;
};

/** What the view knows: which anime, and whatever the loader already fetched. */
export type CharactersAccessor = () => {
  animeId: string;
  /** The SSR payload, when the page had one. Present means the query never runs. */
  ssrCharactersData: { charactersAndStaffByAnimeId?: CharacterEntry[] | null } | null;
};

export interface CharactersWithStaffDeps {
  source?: CharactersAccessor;
  characters?: CharactersQueryPort;
  queryClient?: QueryClient;
}

/** main > supporting > minor. The order the page is read in. */
function rolePriority(role: string | null | undefined): number {
  const value = (role ?? '').toLowerCase();
  if (value.includes('main') || value.includes('protagonist')) return 3;
  if (value.includes('supporting')) return 2;
  return 1;
}

/** Which filter bucket a role falls in. Same words, one place. */
export function matchesFilter(role: string | null | undefined, filter: CharacterFilter): boolean {
  const value = (role ?? '').toLowerCase();
  switch (filter) {
    case 'main':
      return value.includes('main') || value.includes('protagonist');
    case 'supporting':
      return value.includes('supporting');
    case 'minor':
      return (
        !value.includes('main') && !value.includes('supporting') && !value.includes('protagonist')
      );
    default:
      return true;
  }
}

/**
 * The cast list: where it comes from, how it is ordered, which slice of it is
 * on screen, and which cards are open.
 *
 * The fetch is the reason for the bloc -- the component either renders what the
 * page loader already had or runs its own query for it, and both paths have to
 * present the same loading/error/empty shape to the view.
 */
export class CharactersWithStaffBloc {
  readonly filters = CHARACTER_FILTERS;

  readonly #source: CharactersAccessor;
  readonly #query: { readonly current: QueryObserverResult<CharacterEntry[], unknown> };

  #filter = $state<CharacterFilter>('all');
  readonly #expanded = new SvelteSet<string>();

  constructor({
    source = () => ({ animeId: '', ssrCharactersData: null }),
    characters = getCharactersAndStaffByAnimeID as CharactersQueryPort,
    queryClient = defaultQueryClient(),
  }: CharactersWithStaffDeps = {}) {
    this.#source = source;
    const { animeId, ssrCharactersData } = source();

    this.#query = fromStore(
      createQuery(
        {
          ...characters(animeId),
          // Nothing to fetch when the page was rendered with the cast already
          // in hand.
          enabled: !ssrCharactersData,
        },
        queryClient,
      ),
    );
  }

  /** The SSR payload if there was one, otherwise whatever the query has. */
  get entries(): CharacterEntry[] {
    const ssr = this.#source().ssrCharactersData;
    if (ssr) return ssr.charactersAndStaffByAnimeId ?? [];
    return this.#query.current.data ?? [];
  }

  get isLoading(): boolean {
    return this.#source().ssrCharactersData ? false : this.#query.current.isLoading;
  }

  get isError(): boolean {
    return this.#source().ssrCharactersData ? false : this.#query.current.isError;
  }

  /** The cause, for the banner's second line. Empty when there is nothing useful to say. */
  get errorDetail(): string {
    const error = this.#query.current.error as { message?: unknown } | null;
    return error?.message ? String(error.message) : '';
  }

  get isRetrying(): boolean {
    return this.#query.current.isFetching;
  }

  /** True once we know there is no cast at all, rather than none in this filter. */
  get isEmpty(): boolean {
    return this.entries.length === 0;
  }

  get filter(): CharacterFilter {
    return this.#filter;
  }

  /**
   * Importance first, then name. Sorted before filtering so switching filters
   * never reshuffles the cards that stay.
   */
  get visible(): CharacterEntry[] {
    const sorted = [...this.entries].sort((a, b) => {
      const byRole = rolePriority(b.character.role) - rolePriority(a.character.role);
      if (byRole !== 0) return byRole;
      return (a.character.name ?? '').localeCompare(b.character.name ?? '');
    });

    if (this.#filter === 'all') return sorted;
    return sorted.filter((entry) => matchesFilter(entry.character.role, this.#filter));
  }

  /** The cast is here, but this filter matches none of it. */
  get isFilteredOut(): boolean {
    return !this.isEmpty && this.visible.length === 0;
  }

  selectFilter(filter: string): void {
    this.#filter = filter as CharacterFilter;
  }

  isExpanded(entry: CharacterEntry): boolean {
    return this.#expanded.has(entry.character.name ?? '');
  }

  /** A card with one voice actor has nothing to open. */
  hasMultipleVoiceActors(entry: CharacterEntry): boolean {
    return (entry.staff?.length ?? 0) > 1;
  }

  primaryVoiceActor(entry: CharacterEntry): StaffLike | undefined {
    return entry.staff?.[0];
  }

  toggleExpanded(entry: CharacterEntry): void {
    if (!this.hasMultipleVoiceActors(entry)) return;
    const key = entry.character.name ?? '';
    if (this.#expanded.has(key)) this.#expanded.delete(key);
    else this.#expanded.add(key);
  }

  /** Whether the role reads as a lead, which is the only distinction the cards draw. */
  isLeadRole(entry: CharacterEntry): boolean {
    return matchesFilter(entry.character.role, 'main');
  }

  retry(): void {
    void this.#query.current.refetch();
  }
}
