import type { Meta, StoryObj } from '@storybook/svelte';
import CharactersWithStaff from '../CharactersWithStaff.svelte';
import { createQueryClient } from '../../services/query-client';
import {
  CharactersWithStaffBloc,
  type CharacterEntry,
  type CharactersQueryPort,
} from '../CharactersWithStaff.bloc.svelte';

function entry(
  name: string,
  role: string,
  voices: { givenName: string; familyName: string; language: string }[],
): CharacterEntry {
  return {
    character: { id: `char-${name.toLowerCase().replace(/\W+/g, '-')}`, name, role },
    staff: voices.map((va, i) => ({ id: `va-${name}-${i}`, slug: null, ...va })),
  };
}

const CAST: CharacterEntry[] = [
  entry('Frieren', 'Main', [
    { givenName: 'Atsumi', familyName: 'Tanezaki', language: 'Japanese' },
    { givenName: 'Bryn', familyName: 'Apprill', language: 'English' },
    { givenName: 'Laura', familyName: 'Pastor', language: 'Spanish' },
  ]),
  entry('Fern', 'Main', [{ givenName: 'Kana', familyName: 'Ichinose', language: 'Japanese' }]),
  entry('Stark', 'Supporting', [
    { givenName: 'Chiaki', familyName: 'Kobayashi', language: 'Japanese' },
    { givenName: 'Jordan', familyName: 'Dash Cruz', language: 'English' },
  ]),
  entry('Himmel', 'Supporting', [{ givenName: 'Nobuhiko', familyName: 'Okamoto', language: 'Japanese' }]),
  entry('Heiter', 'Supporting', [{ givenName: 'Hiroki', familyName: 'Touchi', language: 'Japanese' }]),
  entry('Eisen', 'Minor', [{ givenName: 'Yoji', familyName: 'Ueda', language: 'Japanese' }]),
  entry('Kraft', 'Minor', [{ givenName: 'Kenjiro', familyName: 'Tsuda', language: 'Japanese' }]),
];

/**
 * The cast source, stubbed. Each story gets its own query client as well, so a
 * story that is meant to be loading is not served the previous story's cache.
 */
function stubCharacters(result: 'ok' | 'empty' | 'never' | 'fail'): CharactersQueryPort {
  return (animeId) => ({
    queryKey: ['charactersAndStaff', animeId, result],
    queryFn: async () => {
      if (result === 'never') return new Promise<CharacterEntry[]>(() => {});
      if (result === 'fail') throw new Error('anime-api returned 503');
      return result === 'empty' ? [] : CAST;
    },
  });
}

function bloc(result: 'ok' | 'empty' | 'never' | 'fail') {
  return new CharactersWithStaffBloc({
    source: () => ({ animeId: `anime-${result}`, ssrCharactersData: null }),
    characters: stubCharacters(result),
    queryClient: createQueryClient(),
  });
}

const meta = {
  title: 'Composites/Show/CharactersWithStaff',
  component: CharactersWithStaff,
  tags: ['autodocs'],
} satisfies Meta<typeof CharactersWithStaff>;

export default meta;
type Story = StoryObj<typeof meta>;

/** The whole cast, importance first, with the role filters above it. */
export const Populated: Story = {
  args: {
    animeId: 'anime-ok',
    bloc: bloc('ok'),
  },
};

/**
 * The page loader already had the cast, so no query runs at all -- the path the
 * show page actually takes.
 */
export const FromServerData: Story = {
  args: {
    animeId: 'anime-ssr',
    ssrCharactersData: { charactersAndStaffByAnimeId: CAST },
    bloc: new CharactersWithStaffBloc({
      source: () => ({
        animeId: 'anime-ssr',
        ssrCharactersData: { charactersAndStaffByAnimeId: CAST },
      }),
      characters: stubCharacters('never'),
      queryClient: createQueryClient(),
    }),
  },
};

/** Waiting on the query: the spinner, and nothing that could be mistaken for an answer. */
export const Loading: Story = {
  args: {
    animeId: 'anime-never',
    bloc: bloc('never'),
  },
};

/**
 * The fetch failed. A banner with a retry, rather than an empty state claiming
 * this show has no cast.
 */
export const FetchFailed: Story = {
  args: {
    animeId: 'anime-fail',
    bloc: bloc('fail'),
  },
};

/** The query answered with nothing -- genuinely no character data for this show. */
export const NoCast: Story = {
  args: {
    animeId: 'anime-empty',
    bloc: bloc('empty'),
  },
};

/**
 * A cast with no minor roles at all: choosing "Minor" leaves the grid empty and
 * offers the way back out of the filter.
 */
export const FilteredToNothing: Story = {
  args: {
    animeId: 'anime-leads',
    bloc: (() => {
      const leads = CAST.filter((e) => e.character.role !== 'Minor');
      return new CharactersWithStaffBloc({
        source: () => ({
          animeId: 'anime-leads',
          ssrCharactersData: { charactersAndStaffByAnimeId: leads },
        }),
        characters: stubCharacters('never'),
        queryClient: createQueryClient(),
      });
    })(),
  },
};
