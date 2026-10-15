import { fromStore, type Readable } from 'svelte/store';
import { useAddAnimeWithToast, useDeleteAnimeWithToast } from '$lib/utils/anime-actions';
import { toast } from 'svelte-sonner';
import { analytics } from '$lib/utils/analytics';
import { loggedInStore, loginModalStore } from '$lib/stores/auth';
import { guestList as browserGuestList, PROMPT_AT, type GuestListPort, type GuestListState } from '$lib/stores/guestList';
import { getAnimeTitle, preferencesStore, type TitleLanguage } from '$lib/stores/preferences';
import type { ButtonColor, ButtonSize } from '$lib/components/primitives/Button';

/** How the add/track control is drawn: the four call-site shapes it takes. */
export type AnimeActionsVariant = 'default' | 'icon-only' | 'hero' | 'compact';

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

/** The confirmation a signed-out add gets, with a way into sign-up. */
export interface GuestNoticePort {
  added: (options: { title: string; onSave: () => void }) => void;
}

const browserGuestNotice: GuestNoticePort = {
  added: ({ title, onSave }) =>
    toast.success(`${title} added to your list`, {
      description: 'Saved in this browser. Make a free account to keep it everywhere.',
      action: { label: 'Save it', onClick: onSave },
      duration: 6000
    })
};

/** The props the view feeds in. Getters, so the bloc reads them live. */
/** The PostHog events this control sends. */
export type ListAnalyticsPort = Pick<
  typeof analytics,
  'animeListAdd' | 'animeListStatusChanged' | 'animeListRemove' | 'guestSignUpPromptShown'
>;

export interface AnimeActionsInputs {
  readonly anime: any;
}

export interface AnimeActionsDeps {
  mutations?: MutationsPort;
  auth?: AuthPort;
  loginPrompt?: LoginPromptPort;
  preferences?: PreferencesPort;
  guestList?: GuestListPort;
  guestNotice?: GuestNoticePort;
  analytics?: ListAnalyticsPort;
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
  readonly #guestList: GuestListPort;
  readonly #guest: { current: GuestListState };
  readonly #guestNotice: GuestNoticePort;
  readonly #analytics: ListAnalyticsPort;

  #add = $state<MutationValue | null>(null);
  #remove = $state<MutationValue | null>(null);

  constructor(inputs: AnimeActionsInputs, deps: AnimeActionsDeps = {}) {
    this.#inputs = inputs;
    this.#mutations = deps.mutations ?? browserMutations;
    this.#loginPrompt = deps.loginPrompt ?? loginModalStore;
    this.#auth = fromStore(deps.auth ?? loggedInStore);
    this.#prefs = fromStore(deps.preferences ?? preferencesStore);
    this.#guestList = deps.guestList ?? browserGuestList;
    this.#guest = fromStore(this.#guestList);
    this.#guestNotice = deps.guestNotice ?? browserGuestNotice;
    this.#analytics = deps.analytics ?? analytics;
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
    return Boolean(this.#inputs.anime?.userAnime) || Boolean(this.#guestEntry);
  }

  /** What `AnimeStatusDropdown` needs: the user's entry, carrying the anime. */
  get dropdownEntry(): { id: string; anime: any; status?: string } {
    const guest = this.#guestEntry;
    if (!this.#inputs.anime?.userAnime && guest) {
      return { id: `guest:${guest.animeID}`, status: guest.status, anime: this.#inputs.anime };
    }
    return { ...this.#inputs.anime?.userAnime, anime: this.#inputs.anime };
  }

  /** Signed out, with auth resolved: the list lives in this browser. */
  get #isGuest(): boolean {
    const auth = this.#auth.current;
    return auth.isAuthInitialized && !auth.isLoggedIn;
  }

  /** This show on the browser list, while the visitor is signed out. */
  get #guestEntry() {
    const id = this.#inputs.anime?.id;
    if (!id || !this.#isGuest) return undefined;
    return this.#guest.current.entries[id];
  }

  /** Feeds `Button`'s status: a mutation in flight is the only busy state. */
  get buttonStatus(): 'idle' | 'loading' | 'success' | 'error' {
    return this.#add?.isPending || this.#remove?.isPending ? 'loading' : 'idle';
  }

  /**
   * A signed-out click puts the show on the list kept in this browser instead
   * of demanding an account first. Asking for sign-up on the very first click
   * lost most visitors; letting them build a list gives them something worth
   * an account. The prompt opens on its own once, at the PROMPT_AT-th show,
   * and every add offers it from the toast. The list is uploaded on sign-in.
   */
  addToList(): void {
    const anime = this.#inputs.anime;
    if (!anime?.id) return;

    // Only once auth has resolved. Before that a returning visitor with valid
    // cookies reads as signed-out, and their show would land in the browser
    // list instead of their account.
    if (this.#isGuest) {
      this.#addAsGuest(anime.id);
      return;
    }

    if (!this.#add) return;
    this.#addNow();
  }

  #addAsGuest(animeID: string): void {
    const count = this.#guestList.add(animeID);
    this.#analytics.animeListAdd({
      animeId: animeID,
      title: this.#title,
      status: 'PLANTOWATCH',
      guest: true,
      guestListSize: count
    });
    const openSignUp = (trigger: 'auto' | 'toast') => {
      this.#analytics.guestSignUpPromptShown(trigger, count);
      this.#loginPrompt.requireAuth({ register: true, reason: this.saveListReason(count) });
    };

    if (count >= PROMPT_AT && this.#guest.current.promptedAt === null) {
      this.#guestList.markPrompted();
      openSignUp('auto');
      return;
    }
    this.#guestNotice.added({ title: this.#title ?? 'This show', onSave: () => openSignUp('toast') });
  }

  /** The sign-up modal's subtitle when a visitor saves their browser list. */
  saveListReason(count: number): string {
    const shows = count === 1 ? 'the show' : `the ${count} shows`;
    return `Make a free account to keep ${shows} on your list and get notified when new episodes air.`;
  }

  get #title(): string | null {
    const title = getAnimeTitle(this.#inputs.anime, this.#prefs.current.titleLanguage);
    return title && title !== 'Unknown' ? title : null;
  }

  changeStatus(detail: { animeId: string; status: string }): void {
    if (this.#isGuest) {
      this.#guestList.setStatus(detail.animeId, detail.status);
      this.#analytics.animeListStatusChanged(detail.animeId, detail.status, true);
      return;
    }
    if (!this.#add) return;
    this.#analytics.animeListStatusChanged(detail.animeId, detail.status, false);
    this.#add.mutate({ input: { animeID: detail.animeId, status: detail.status } });
  }

  removeFromList(detail: { animeId: string }): void {
    if (detail?.animeId && this.#isGuest) {
      this.#guestList.remove(detail.animeId);
      this.#analytics.animeListRemove(detail.animeId, true);
      return;
    }
    if (!detail?.animeId || !this.#remove) return;
    this.#analytics.animeListRemove(detail.animeId, false);
    this.#remove.mutate(detail.animeId);
  }

  #addNow(): void {
    this.#analytics.animeListAdd({
      animeId: this.#inputs.anime.id,
      title: this.#title,
      status: 'PLANTOWATCH',
      guest: false
    });
    this.#add?.mutate({ input: { animeID: this.#inputs.anime.id, status: 'PLANTOWATCH' } });
  }
}

/*
  The four variants are four Button sizes -- nothing here needs a class to
  restyle the primitive, so the mapping is a pair of functions rather than a
  ternary chain in the markup.
*/

export function buttonSizeFor(variant: AnimeActionsVariant): ButtonSize {
  if (variant === 'icon-only') return 'icon';
  if (variant === 'compact') return 'sm';
  if (variant === 'hero') return 'hero';
  return 'md';
}

export function buttonColorFor(variant: AnimeActionsVariant): ButtonColor {
  return variant === 'hero' ? 'transparent' : 'blue';
}
