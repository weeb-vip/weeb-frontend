import { describe, it, expect, vi, afterEach } from 'vitest';
import { QueryClient } from '@tanstack/svelte-query';
import { reactiveScope } from '../../__tests__/reactive-scope.svelte';
import {
  CHARACTER_FILTERS,
  CharactersWithStaffBloc,
  matchesFilter,
  type CharacterEntry,
  type CharactersWithStaffDeps
} from './CharactersWithStaff.bloc.svelte';

const character = (name: string, role: string | null, staffCount = 1): CharacterEntry => ({
  character: { id: name, name, role },
  staff: Array.from({ length: staffCount }, (_, i) => ({
    id: `${name}-${i}`,
    givenName: `VA${i}`,
    familyName: name
  }))
});

const CAST = [
  character('Zoe', 'Supporting'),
  character('Adam', 'Main'),
  character('Nia', 'Main'),
  character('Bob', 'Background')
];

function makeBloc(deps: Partial<CharactersWithStaffDeps> = {}, ssr: CharacterEntry[] | null = CAST) {
  return new CharactersWithStaffBloc({
    source: () => ({
      animeId: 'a1',
      ssrCharactersData: ssr ? { charactersAndStaffByAnimeId: ssr } : null
    }),
    characters: () => ({ queryKey: ['cast', 'a1'], queryFn: async () => [] }),
    queryClient: new QueryClient({ defaultOptions: { queries: { retry: false } } }),
    ...deps
  });
}

const names = (entries: CharacterEntry[]) => entries.map((e) => e.character.name);

const scopes: (() => void)[] = [];
afterEach(() => {
  while (scopes.length) scopes.pop()!();
});

describe('matchesFilter', () => {
  it('lets everything through under "all"', () => {
    for (const role of ['Main', 'Supporting', 'Background', null]) {
      expect(matchesFilter(role, 'all')).toBe(true);
    }
  });

  it('counts a protagonist as main', () => {
    expect(matchesFilter('Main', 'main')).toBe(true);
    expect(matchesFilter('Protagonist', 'main')).toBe(true);
    expect(matchesFilter('Supporting', 'main')).toBe(false);
  });

  it('reads whatever case the role arrived in', () => {
    expect(matchesFilter('MAIN CHARACTER', 'main')).toBe(true);
    expect(matchesFilter('supporting cast', 'supporting')).toBe(true);
  });

  it('treats anything that is neither as minor, including no role at all', () => {
    expect(matchesFilter('Background', 'minor')).toBe(true);
    expect(matchesFilter(null, 'minor')).toBe(true);
    expect(matchesFilter('Main', 'minor')).toBe(false);
    expect(matchesFilter('Supporting', 'minor')).toBe(false);
  });

  it('never puts one role in two buckets', () => {
    for (const role of ['Main', 'Protagonist', 'Supporting', 'Background', null]) {
      const buckets = (['main', 'supporting', 'minor'] as const).filter((f) =>
        matchesFilter(role, f)
      );

      expect(buckets).toHaveLength(1);
    }
  });
});

describe('CharactersWithStaffBloc', () => {
  describe('where the cast comes from', () => {
    it('renders what the page loader already had, and never fetches', async () => {
      const queryFn = vi.fn(async () => []);
      const bloc = makeBloc({ characters: () => ({ queryKey: ['cast'], queryFn }) });
      scopes.push(reactiveScope(() => bloc.entries, () => bloc.isLoading));

      expect(bloc.entries).toEqual(CAST);
      expect(bloc.isLoading).toBe(false);
      expect(bloc.isError).toBe(false);
      await new Promise((resolve) => setTimeout(resolve, 5));
      expect(queryFn).not.toHaveBeenCalled();
    });

    it('runs its own query when the page had none', async () => {
      const queryFn = vi.fn(async () => CAST);
      const bloc = makeBloc({ characters: () => ({ queryKey: ['cast'], queryFn }) }, null);
      scopes.push(reactiveScope(() => bloc.entries, () => bloc.isLoading));

      await vi.waitFor(() => expect(bloc.entries).toEqual(CAST));
      expect(queryFn).toHaveBeenCalledTimes(1);
    });

    it('is loading, not empty, before that query answers', () => {
      const bloc = makeBloc(
        { characters: () => ({ queryKey: ['cast'], queryFn: () => new Promise(() => {}) }) },
        null
      );

      expect(bloc.isLoading).toBe(true);
      expect(bloc.entries).toEqual([]);
    });

    it('reports a failed fetch and its cause', async () => {
      const bloc = makeBloc(
        {
          characters: () => ({
            queryKey: ['cast'],
            queryFn: async () => Promise.reject(new Error('upstream 500'))
          })
        },
        null
      );
      scopes.push(reactiveScope(() => bloc.isError, () => bloc.entries));

      await vi.waitFor(() => expect(bloc.isError).toBe(true));
      expect(bloc.errorDetail).toBe('upstream 500');
    });

    it('has no second line for a failure that carried no message', async () => {
      const bloc = makeBloc(
        { characters: () => ({ queryKey: ['cast'], queryFn: async () => Promise.reject({}) }) },
        null
      );
      scopes.push(reactiveScope(() => bloc.isError));

      await vi.waitFor(() => expect(bloc.isError).toBe(true));
      expect(bloc.errorDetail).toBe('');
    });

    it('reads an SSR payload with an empty cast as empty, not loading', () => {
      const bloc = makeBloc({}, []);

      expect(bloc.isEmpty).toBe(true);
      expect(bloc.isLoading).toBe(false);
    });
  });

  describe('the order', () => {
    it('puts leads first, then supporting, then everyone else', () => {
      expect(names(makeBloc().visible)).toEqual(['Adam', 'Nia', 'Zoe', 'Bob']);
    });

    it('breaks ties by name', () => {
      const bloc = makeBloc({}, [character('Nia', 'Main'), character('Adam', 'Main')]);

      expect(names(bloc.visible)).toEqual(['Adam', 'Nia']);
    });

    it('sorts before filtering, so the cards that stay do not reshuffle', () => {
      const bloc = makeBloc();
      const leadsInAll = names(bloc.visible).filter((n) => n === 'Adam' || n === 'Nia');

      bloc.selectFilter('main');

      expect(names(bloc.visible)).toEqual(leadsInAll);
    });

    it('does not reorder the source array in place', () => {
      const cast = [character('Zoe', 'Supporting'), character('Adam', 'Main')];
      makeBloc({}, cast).visible;

      expect(names(cast)).toEqual(['Zoe', 'Adam']);
    });
  });

  describe('the filter', () => {
    it('starts on all, and offers the four buckets', () => {
      const bloc = makeBloc();

      expect(bloc.filter).toBe('all');
      expect(bloc.filters).toBe(CHARACTER_FILTERS);
      expect(CHARACTER_FILTERS.map((f) => f.value)).toEqual([
        'all',
        'main',
        'supporting',
        'minor'
      ]);
    });

    it('narrows the cards to the chosen bucket', () => {
      const bloc = makeBloc();

      bloc.selectFilter('main');
      expect(names(bloc.visible)).toEqual(['Adam', 'Nia']);

      bloc.selectFilter('supporting');
      expect(names(bloc.visible)).toEqual(['Zoe']);

      bloc.selectFilter('minor');
      expect(names(bloc.visible)).toEqual(['Bob']);
    });

    it('tells "no cast at all" apart from "none in this filter"', () => {
      const bloc = makeBloc({}, [character('Adam', 'Main')]);

      bloc.selectFilter('minor');

      expect(bloc.isEmpty).toBe(false);
      expect(bloc.isFilteredOut).toBe(true);
    });

    it('is not "filtered out" when there was never a cast', () => {
      const bloc = makeBloc({}, []);

      expect(bloc.isEmpty).toBe(true);
      expect(bloc.isFilteredOut).toBe(false);
    });
  });

  describe('the cards', () => {
    it('opens and closes a card with several voice actors', () => {
      const many = character('Adam', 'Main', 3);
      const bloc = makeBloc({}, [many]);

      expect(bloc.isExpanded(many)).toBe(false);
      bloc.toggleExpanded(many);
      expect(bloc.isExpanded(many)).toBe(true);

      bloc.toggleExpanded(many);
      expect(bloc.isExpanded(many)).toBe(false);
    });

    it('will not open a card with one voice actor -- it has nothing to show', () => {
      const one = character('Adam', 'Main', 1);
      const bloc = makeBloc({}, [one]);

      expect(bloc.hasMultipleVoiceActors(one)).toBe(false);
      bloc.toggleExpanded(one);
      expect(bloc.isExpanded(one)).toBe(false);
    });

    it('will not open a card with no cast credited at all', () => {
      const none: CharacterEntry = { character: { name: 'Adam', role: 'Main' }, staff: null };
      const bloc = makeBloc({}, [none]);

      expect(bloc.hasMultipleVoiceActors(none)).toBe(false);
      expect(bloc.primaryVoiceActor(none)).toBeUndefined();
    });

    it('shows the first credited voice actor on the face of the card', () => {
      const many = character('Adam', 'Main', 3);

      expect(makeBloc({}, [many]).primaryVoiceActor(many)?.id).toBe('Adam-0');
    });

    it('marks only a lead as a lead', () => {
      const bloc = makeBloc();

      expect(bloc.isLeadRole(character('Adam', 'Main'))).toBe(true);
      expect(bloc.isLeadRole(character('Zoe', 'Supporting'))).toBe(false);
    });
  });
});
