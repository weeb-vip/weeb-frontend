import { beforeEach, describe, it, expect, vi } from 'vitest';
import { readable, writable } from 'svelte/store';
import {
  AnimeActionsBloc,
  buttonColorFor,
  buttonSizeFor,
  type AnimeActionsDeps,
  type AnimeActionsVariant,
  type MutationValue
} from './AnimeActions.bloc.svelte';
import { createGuestList, PROMPT_AT } from '$lib/stores/guestList';

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
      guestList: createGuestList(),
      guestNotice: { added: vi.fn() },
      analytics: {
        animeListAdd: vi.fn(),
        animeListStatusChanged: vi.fn(),
        animeListRemove: vi.fn(),
        guestSignUpPromptShown: vi.fn()
      },
      ...deps
    }
  );
  return { bloc, mutations };
}

beforeEach(() => localStorage.clear());

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

  describe('a signed-out reader', () => {
    const signedOut = readable({ isLoggedIn: false, isAuthInitialized: true });

    function guestBloc(anime: unknown = ANIME, guestList = createGuestList()) {
      const requireAuth = vi.fn();
      const added = vi.fn();
      const events = {
        animeListAdd: vi.fn(),
        animeListStatusChanged: vi.fn(),
        animeListRemove: vi.fn(),
        guestSignUpPromptShown: vi.fn()
      };
      const { bloc, mutations } = makeBloc(anime, {
        auth: signedOut,
        loginPrompt: { requireAuth },
        guestList,
        guestNotice: { added },
        analytics: events
      });
      return { bloc, mutations, requireAuth, added, events, guestList };
    }

    it('keeps the show in the browser instead of asking for an account', () => {
      const { bloc, mutations, requireAuth, added, guestList } = guestBloc();
      const stop = bloc.init();

      bloc.addToList();

      expect(mutations.add.mutate).not.toHaveBeenCalled();
      expect(requireAuth).not.toHaveBeenCalled();
      expect(guestList.entries()).toMatchObject([{ animeID: 'a1', status: 'PLANTOWATCH' }]);
      expect(added.mock.calls[0][0].title).toBe('Frieren');
      expect(bloc.isInList).toBe(true);
      expect(bloc.dropdownEntry).toMatchObject({ status: 'PLANTOWATCH', anime: ANIME });
      stop();
    });

    it('survives a reload, because it lives in localStorage', () => {
      guestBloc().bloc.addToList();
      expect(createGuestList().entries().map((e) => e.animeID)).toEqual(['a1']);
    });

    it('opens sign-up by itself once, at the third show', () => {
      const guestList = createGuestList();
      for (let i = 1; i < PROMPT_AT; i++) guestBloc({ id: `a${i}` }, guestList).bloc.addToList();
      const third = guestBloc({ id: `a${PROMPT_AT}` }, guestList);
      third.bloc.addToList();

      expect(third.requireAuth).toHaveBeenCalledTimes(1);
      expect(third.requireAuth.mock.calls[0][0]).toMatchObject({
        register: true,
        reason: `Make a free account to keep the ${PROMPT_AT} shows on your list and get notified when new episodes air.`
      });
      expect(third.events.guestSignUpPromptShown).toHaveBeenCalledWith('auto', PROMPT_AT);

      const fourth = guestBloc({ id: 'a99' }, guestList);
      fourth.bloc.addToList();
      expect(fourth.requireAuth).not.toHaveBeenCalled();
      expect(fourth.added).toHaveBeenCalledTimes(1);
    });

    it('offers sign-up from the toast, and says which way it opened', () => {
      const { bloc, added, requireAuth, events } = guestBloc();
      bloc.addToList();

      added.mock.calls[0][0].onSave();

      expect(requireAuth.mock.calls[0][0].register).toBe(true);
      expect(events.guestSignUpPromptShown).toHaveBeenCalledWith('toast', 1);
    });

    it('changes and removes on the browser list, not the account', () => {
      const { bloc, mutations, guestList, events } = guestBloc();
      const stop = bloc.init();
      bloc.addToList();

      bloc.changeStatus({ animeId: 'a1', status: 'WATCHING' });
      expect(guestList.entries()[0].status).toBe('WATCHING');
      expect(events.animeListStatusChanged).toHaveBeenCalledWith('a1', 'WATCHING', true);

      bloc.removeFromList({ animeId: 'a1' });
      expect(guestList.entries()).toEqual([]);
      expect(events.animeListRemove).toHaveBeenCalledWith('a1', true);
      expect(mutations.add.mutate).not.toHaveBeenCalled();
      expect(mutations.remove.mutate).not.toHaveBeenCalled();
      stop();
    });

    it('tracks the add with the list size', () => {
      const { bloc, events } = guestBloc();
      bloc.addToList();
      expect(events.animeListAdd).toHaveBeenCalledWith({
        animeId: 'a1',
        title: 'Frieren',
        status: 'PLANTOWATCH',
        guest: true,
        guestListSize: 1
      });
    });
  });

  it('ignores the browser list once signed in', () => {
    const guestList = createGuestList();
    guestList.add('a1');
    const { bloc } = makeBloc(ANIME, { guestList });
    expect(bloc.isInList).toBe(false);
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
