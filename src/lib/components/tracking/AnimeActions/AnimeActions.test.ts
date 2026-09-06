import { describe, it, expect, vi } from 'vitest';
import { readable, writable } from 'svelte/store';
import {
  AnimeActionsBloc,
  buttonColorFor,
  buttonSizeFor,
  type AnimeActionsDeps,
  type AnimeActionsVariant,
  type MutationValue
} from './AnimeActions.bloc.svelte';

const ANIME = { id: 'a1', titleEn: 'Frieren', titleJp: '葬送のフリーレン' };

/** A mutation store the test can drive. */
function mutation(initial: Partial<MutationValue> = {}) {
  const value: MutationValue = { mutate: vi.fn(), isPending: false, ...initial };
  const store = writable(value);
  return {
    store,
    mutate: value.mutate as ReturnType<typeof vi.fn>,
    setPending(isPending: boolean) {
      store.set({ ...value, isPending });
    }
  };
}

function makeBloc(
  anime: unknown = ANIME,
  deps: AnimeActionsDeps = {},
  mutations = { add: mutation(), remove: mutation() }
) {
  const bloc = new AnimeActionsBloc(
    { anime },
    {
      mutations: { add: () => mutations.add.store, remove: () => mutations.remove.store },
      auth: readable({ isLoggedIn: true, isAuthInitialized: true }),
      loginPrompt: { requireAuth: vi.fn() },
      preferences: readable({ titleLanguage: 'english' as const }),
      ...deps
    }
  );
  return { bloc, mutations };
}

describe('AnimeActionsBloc', () => {
  describe('what the view draws', () => {
    it('reports the anime it was given', () => {
      expect(makeBloc().bloc.anime).toBe(ANIME);
    });

    it('is a status dropdown once the show is on the list', () => {
      expect(makeBloc({ ...ANIME, userAnime: { id: 'ua1', status: 'WATCHING' } }).bloc.isInList).toBe(
        true
      );
      expect(makeBloc(ANIME).bloc.isInList).toBe(false);
      expect(makeBloc({ ...ANIME, userAnime: null }).bloc.isInList).toBe(false);
    });

    it('hands the dropdown the user’s row carrying the anime', () => {
      const anime = { ...ANIME, userAnime: { id: 'ua1', status: 'WATCHING' } };

      expect(makeBloc(anime).bloc.dropdownEntry).toEqual({
        id: 'ua1',
        status: 'WATCHING',
        anime
      });
    });

    it('still builds an entry for a show that is not on the list', () => {
      expect(makeBloc(ANIME).bloc.dropdownEntry.anime).toBe(ANIME);
    });

    it('is idle until a mutation is in flight', () => {
      const { bloc, mutations } = makeBloc();
      expect(bloc.buttonStatus).toBe('idle');

      const stop = bloc.init();
      expect(bloc.buttonStatus).toBe('idle');

      mutations.add.setPending(true);
      expect(bloc.buttonStatus).toBe('loading');

      mutations.add.setPending(false);
      mutations.remove.setPending(true);
      expect(bloc.buttonStatus).toBe('loading');

      stop();
    });
  });

  describe('the sign-in reason', () => {
    it('names the show, in the reader’s language', () => {
      expect(makeBloc().bloc.signInReason).toBe('Frieren will be added to your list.');
      expect(
        makeBloc(ANIME, { preferences: readable({ titleLanguage: 'japanese' as const }) }).bloc
          .signInReason
      ).toBe('葬送のフリーレン will be added to your list.');
    });

    it('says "this show" rather than "Unknown will be added"', () => {
      expect(makeBloc({ id: 'a1' }).bloc.signInReason).toBe(
        'This show will be added to your list.'
      );
      expect(makeBloc(null).bloc.signInReason).toBe('This show will be added to your list.');
    });
  });

  describe('adding to the list', () => {
    it('writes straight away for a signed-in reader', () => {
      const { bloc, mutations } = makeBloc();
      const stop = bloc.init();

      bloc.addToList();

      expect(mutations.add.mutate).toHaveBeenCalledWith({
        input: { animeID: 'a1', status: 'PLANTOWATCH' }
      });
      stop();
    });

    it('does nothing before the mutations exist', () => {
      const { bloc, mutations } = makeBloc();

      bloc.addToList();

      expect(mutations.add.mutate).not.toHaveBeenCalled();
    });

    it('does nothing for a record with no id', () => {
      const { bloc, mutations } = makeBloc({ titleEn: 'Orphan' });
      const stop = bloc.init();

      bloc.addToList();

      expect(mutations.add.mutate).not.toHaveBeenCalled();
      stop();
    });

    it('asks a signed-out reader to sign in instead of firing a doomed write', () => {
      const requireAuth = vi.fn();
      const { bloc, mutations } = makeBloc(ANIME, {
        auth: readable({ isLoggedIn: false, isAuthInitialized: true }),
        loginPrompt: { requireAuth }
      });
      const stop = bloc.init();

      bloc.addToList();

      // The site's highest-intent action used to have exactly one possible
      // outcome: failure.
      expect(mutations.add.mutate).not.toHaveBeenCalled();
      expect(requireAuth).toHaveBeenCalledTimes(1);
      expect(requireAuth.mock.calls[0][0].reason).toBe('Frieren will be added to your list.');
      stop();
    });

    it('carries the intent through sign-in, so the show still lands on the list', () => {
      const requireAuth = vi.fn();
      const { bloc, mutations } = makeBloc(ANIME, {
        auth: readable({ isLoggedIn: false, isAuthInitialized: true }),
        loginPrompt: { requireAuth }
      });
      const stop = bloc.init();
      bloc.addToList();

      requireAuth.mock.calls[0][0].onAuthed();

      expect(mutations.add.mutate).toHaveBeenCalledWith({
        input: { animeID: 'a1', status: 'PLANTOWATCH' }
      });
      stop();
    });

    it('does not prompt before auth has resolved', () => {
      const requireAuth = vi.fn();
      const { bloc, mutations } = makeBloc(ANIME, {
        auth: readable({ isLoggedIn: false, isAuthInitialized: false }),
        loginPrompt: { requireAuth }
      });
      const stop = bloc.init();

      bloc.addToList();

      // A returning visitor with valid cookies reads as signed-out until then.
      expect(requireAuth).not.toHaveBeenCalled();
      expect(mutations.add.mutate).toHaveBeenCalledTimes(1);
      stop();
    });
  });

  describe('the other two writes', () => {
    it('changes a status through the add mutation', () => {
      const { bloc, mutations } = makeBloc();
      const stop = bloc.init();

      bloc.changeStatus({ animeId: 'a1', status: 'COMPLETED' });

      expect(mutations.add.mutate).toHaveBeenCalledWith({
        input: { animeID: 'a1', status: 'COMPLETED' }
      });
      stop();
    });

    it('removes by id', () => {
      const { bloc, mutations } = makeBloc();
      const stop = bloc.init();

      bloc.removeFromList({ animeId: 'a1' });

      expect(mutations.remove.mutate).toHaveBeenCalledWith('a1');
      stop();
    });

    it('removes nothing without an id', () => {
      const { bloc, mutations } = makeBloc();
      const stop = bloc.init();

      bloc.removeFromList({ animeId: '' });

      expect(mutations.remove.mutate).not.toHaveBeenCalled();
      stop();
    });

    it('does nothing at all before the mutations exist', () => {
      const { bloc, mutations } = makeBloc();

      bloc.changeStatus({ animeId: 'a1', status: 'COMPLETED' });
      bloc.removeFromList({ animeId: 'a1' });

      expect(mutations.add.mutate).not.toHaveBeenCalled();
      expect(mutations.remove.mutate).not.toHaveBeenCalled();
    });
  });

  it('drops both subscriptions when the view goes away', () => {
    const { bloc, mutations } = makeBloc();
    const stop = bloc.init();

    stop();
    mutations.add.setPending(true);

    // The bloc is no longer listening, so nothing moves.
    expect(bloc.buttonStatus).toBe('idle');
  });
});

describe('the four variants are four button shapes', () => {
  const variants: AnimeActionsVariant[] = ['default', 'icon-only', 'hero', 'compact'];

  it('maps each variant to its own size', () => {
    expect(buttonSizeFor('icon-only')).toBe('icon');
    expect(buttonSizeFor('compact')).toBe('sm');
    expect(buttonSizeFor('hero')).toBe('hero');
    expect(buttonSizeFor('default')).toBe('md');
  });

  it('only the hero sits on artwork, so only it is transparent', () => {
    expect(buttonColorFor('hero')).toBe('transparent');
    for (const variant of variants.filter((v) => v !== 'hero')) {
      expect(buttonColorFor(variant)).toBe('blue');
    }
  });
});
