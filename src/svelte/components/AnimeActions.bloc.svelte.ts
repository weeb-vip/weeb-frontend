import { fromStore, type Readable } from 'svelte/store';
import { useAddAnimeWithToast, useDeleteAnimeWithToast } from '../utils/anime-actions';
import { loggedInStore, loginModalStore } from '../stores/auth';
import { getAnimeTitle, preferencesStore, type TitleLanguage } from '../stores/preferences';

/** What this component actually calls on a TanStack mutation store's value. */
export interface MutationValue {
  mutate: (variables: any) => void;
  isPending: boolean;
}

export type MutationStore = Readable<MutationValue>;

/**
 * The two mutations, created lazily. They are not built in the constructor:
 * `createMutation` reads the query client off Svelte's context, so it can only
 * run while a component is initialising -- and a story constructs its bloc at
 * module scope, where there is no component at all.
 */
export interface MutationsPort {
  add: () => MutationStore;
  remove: () => MutationStore;
}

export interface AuthPort extends Readable<{ isLoggedIn: boolean; isAuthInitialized: boolean }> {}

/** The one thing this bloc asks of the login modal. */
export interface LoginPromptPort {
  requireAuth: (options: { reason?: string; register?: boolean; onAuthed?: () => void }) => void;
}

export interface PreferencesPort extends Readable<{ titleLanguage: TitleLanguage }> {}

/** The props the view feeds in. Getters, so the bloc reads them live. */
export interface AnimeActionsInputs {
  readonly anime: any;
}

export interface AnimeActionsDeps {
  mutations?: MutationsPort;
  auth?: AuthPort;
  loginPrompt?: LoginPromptPort;
  preferences?: PreferencesPort;
}

const browserMutations: MutationsPort = {
  add: () => useAddAnimeWithToast() as unknown as MutationStore,
  remove: () => useDeleteAnimeWithToast() as unknown as MutationStore
};

/**
 * Add-to-list and change-status for one show.
 *
 * Everything here is a dependency the view has no business holding: two
 * TanStack mutations, the auth store, the login modal and the title-language
 * preference. What is left in the view is which button shape to draw.
 */
export class AnimeActionsBloc {
  readonly #inputs: AnimeActionsInputs;
  readonly #mutations: MutationsPort;
  readonly #loginPrompt: LoginPromptPort;
  readonly #auth: { current: { isLoggedIn: boolean; isAuthInitialized: boolean } };
  readonly #prefs: { current: { titleLanguage: TitleLanguage } };

  #add = $state<MutationValue | null>(null);
  #remove = $state<MutationValue | null>(null);

  constructor(inputs: AnimeActionsInputs, deps: AnimeActionsDeps = {}) {
    this.#inputs = inputs;
    this.#mutations = deps.mutations ?? browserMutations;
    this.#loginPrompt = deps.loginPrompt ?? loginModalStore;
    this.#auth = fromStore(deps.auth ?? loggedInStore);
    this.#prefs = fromStore(deps.preferences ?? preferencesStore);
  }

  /**
   * Creates the mutations and mirrors their state. Call it from an effect --
   * the previous `onMount` equivalent -- and return the teardown so the
   * subscriptions die with the component.
   */
  init(): () => void {
    const add = this.#mutations.add();
    const remove = this.#mutations.remove();
    const unsubscribers = [
      add.subscribe((value) => (this.#add = value)),
      remove.subscribe((value) => (this.#remove = value))
    ];
    return () => unsubscribers.forEach((unsubscribe) => unsubscribe());
  }

  get anime(): any {
    return this.#inputs.anime;
  }

  /** The show is already tracked, so the control is a status dropdown. */
  get isInList(): boolean {
    return Boolean(this.#inputs.anime?.userAnime);
  }

  /** What `AnimeStatusDropdown` needs: the user's entry, carrying the anime. */
  get dropdownEntry(): { id: string; anime: any; status?: string } {
    return { ...this.#inputs.anime?.userAnime, anime: this.#inputs.anime };
  }

  /** Feeds `Button`'s status: a mutation in flight is the only busy state. */
  get buttonStatus(): 'idle' | 'loading' | 'success' | 'error' {
    return this.#add?.isPending || this.#remove?.isPending ? 'loading' : 'idle';
  }

  /**
   * Tracking needs an account, so a signed-out click used to fire the mutation
   * and take a rejection: the site's highest-intent action had exactly one
   * possible outcome, failure. Gate it, and carry the intent through sign-in so
   * the show still lands on their list.
   */
  addToList(): void {
    const anime = this.#inputs.anime;
    if (!anime?.id || !this.#add) return;

    // Only gate once auth has resolved. Before that a returning visitor with
    // valid cookies reads as signed-out, and we would prompt someone who is
    // already logged in.
    const auth = this.#auth.current;
    if (auth.isAuthInitialized && !auth.isLoggedIn) {
      this.#loginPrompt.requireAuth({
        reason: this.signInReason,
        onAuthed: () => this.#addNow()
      });
      return;
    }

    this.#addNow();
  }

  /** The sentence the login modal shows in place of its generic subtitle. */
  get signInReason(): string {
    const title = getAnimeTitle(this.#inputs.anime, this.#prefs.current.titleLanguage);
    return title && title !== 'Unknown'
      ? `${title} will be added to your list.`
      : 'This show will be added to your list.';
  }

  changeStatus(detail: { animeId: string; status: string }): void {
    if (!this.#add) return;
    this.#add.mutate({ input: { animeID: detail.animeId, status: detail.status } });
  }

  removeFromList(detail: { animeId: string }): void {
    if (!detail?.animeId || !this.#remove) return;
    this.#remove.mutate(detail.animeId);
  }

  #addNow(): void {
    this.#add?.mutate({ input: { animeID: this.#inputs.anime.id, status: 'PLANTOWATCH' } });
  }
}
