import { derived, fromStore, type Readable } from 'svelte/store';
import { createQuery } from '@tanstack/svelte-query';
import { loggedInStore } from '../stores/auth';
import { userQueryOptions } from '../services/queries';
import { openMobileDrawer } from '../stores/mobileDrawer';

/** The shape the profile surfaces render. Only these fields are ever read. */
export interface ProfileUser {
  id: string;
  username: string;
  firstname: string;
  lastname: string;
  email?: string | null;
  profileImageUrl?: string | null;
}

/** Just "is someone signed in" -- the store carries more, none of it used here. */
export type AuthPort = Readable<{ isLoggedIn: boolean }>;

/**
 * The three flags a TanStack query result contributes. Narrowed to this so a
 * story can hand over a plain writable instead of a QueryClient.
 */
export type UserQueryPort = Readable<{
  data?: ProfileUser | null;
  isLoading?: boolean;
  isError?: boolean;
}>;

/** The mobile drawer, opened by the avatar/hamburger. */
export interface DrawerPort {
  open(): void;
}

/** The window events `LoginModalHandler` listens for. */
export interface AuthPromptPort {
  requestLogin(): void;
  requestRegister(): void;
}

export const realAuthPrompt: AuthPromptPort = {
  requestLogin: () => window.dispatchEvent(new CustomEvent('openLogin')),
  requestRegister: () => window.dispatchEvent(new CustomEvent('openRegister'))
};

/**
 * The real user query. Must be built during component initialisation --
 * `createQuery` reads the QueryClient out of Svelte context -- which is why
 * the view constructs its bloc in the init body rather than as a lazily
 * evaluated prop default.
 */
export function createUserQuery(): UserQueryPort {
  return createQuery(
    derived(loggedInStore, (state) => userQueryOptions(state.isLoggedIn))
  ) as unknown as UserQueryPort;
}

/**
 * Who to render when the user query has failed.
 *
 * This used to require the error message to contain "Access denied", so any
 * other failure -- a network error, a timeout, a 500, an auth error worded
 * differently -- left displayUser null and dropped through to a pulsing
 * skeleton with nothing to resolve it. Users saw an empty avatar and a grey
 * bar that animated forever.
 *
 * Being logged in and having the query fail is enough. What renders from this
 * is an initial in a circle; getting that slightly generic is much better than
 * appearing permanently stuck.
 *
 * Exported and pure so the rule can be checked on its own.
 */
export function fallbackUserFor(isLoggedIn: boolean, hasError: boolean): ProfileUser | null {
  if (!isLoggedIn || !hasError) return null;
  // Only the fields the avatar and the name line read; cast to the shape the
  // dropdown expects (unchanged runtime behaviour).
  return { username: 'User', profileImageUrl: null } as Partial<ProfileUser> as ProfileUser;
}

export interface UserProfileWrapperDeps {
  auth?: AuthPort;
  userQuery?: UserQueryPort;
  drawer?: DrawerPort;
  prompt?: AuthPromptPort;
}

/**
 * Which of the header's four right-hand states is showing, and the two
 * intents behind them.
 */
export class UserProfileWrapperBloc {
  readonly #auth: { current: { isLoggedIn: boolean } };
  readonly #query: { current: { data?: ProfileUser | null; isLoading?: boolean; isError?: boolean } };
  readonly #drawer: DrawerPort;
  readonly #prompt: AuthPromptPort;

  constructor({
    auth = loggedInStore,
    // Evaluated only when no stub is supplied, so a story never reaches for a
    // QueryClient that is not there.
    userQuery = createUserQuery(),
    drawer = { open: openMobileDrawer },
    prompt = realAuthPrompt
  }: UserProfileWrapperDeps = {}) {
    this.#auth = fromStore(auth);
    this.#query = fromStore(userQuery);
    this.#drawer = drawer;
    this.#prompt = prompt;
  }

  get isLoggedIn(): boolean {
    return this.#auth.current?.isLoggedIn ?? false;
  }

  get isLoading(): boolean {
    return this.isLoggedIn && Boolean(this.#query.current?.isLoading);
  }

  get hasError(): boolean {
    return Boolean(this.#query.current?.isError);
  }

  get displayUser(): ProfileUser | null {
    return this.#query.current?.data || fallbackUserFor(this.isLoggedIn, this.hasError);
  }

  /**
   * The one thing the view has to switch on. `stuck` is signed in, settled,
   * and still nobody -- it renders a still placeholder rather than a pulsing
   * one, because nothing is going to resolve it.
   */
  get status(): 'signed-out' | 'loading' | 'ready' | 'stuck' {
    if (!this.isLoggedIn) return 'signed-out';
    if (this.isLoading) return 'loading';
    return this.displayUser ? 'ready' : 'stuck';
  }

  openDrawer(): void {
    this.#drawer.open();
  }

  requestLogin(): void {
    this.#prompt.requestLogin();
  }

  requestRegister(): void {
    this.#prompt.requestRegister();
  }
}
