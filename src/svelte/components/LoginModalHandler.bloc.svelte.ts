import { fromStore, type Readable } from 'svelte/store';
import { loginModalStore } from '../stores/auth';

/** What the handler renders from, and the one intent it forwards. */
export interface LoginModalPort extends Readable<{ isOpen: boolean; register: boolean }> {
  openLogin(): void;
  openRegister(): void;
  close(): void;
}

/**
 * The two global events anything on the page can fire to ask for the modal
 * (`AuthPromptPort` in `UserProfileWrapper.bloc` is the other end of this).
 *
 * A port because it is `window` -- a story must be able to render the modal
 * without a component quietly attaching listeners to the Storybook shell.
 */
export interface AuthPromptEventsPort {
  /** Returns the teardown, so the listeners die with the component. */
  listen(handlers: { openLogin(): void; openRegister(): void }): () => void;
}

export const windowAuthPromptEvents: AuthPromptEventsPort = {
  listen(handlers) {
    if (typeof window === 'undefined') return () => {};

    const onLogin = () => handlers.openLogin();
    const onRegister = () => handlers.openRegister();
    window.addEventListener('openLogin', onLogin);
    window.addEventListener('openRegister', onRegister);

    return () => {
      window.removeEventListener('openLogin', onLogin);
      window.removeEventListener('openRegister', onRegister);
    };
  },
};

export interface LoginModalHandlerDeps {
  modal?: LoginModalPort;
  events?: AuthPromptEventsPort;
}

/**
 * Whether the auth modal is up, and the wiring that opens it from anywhere.
 *
 * The old version subscribed to the store and added both window listeners
 * inside an async `onMount`, which cannot register cleanup -- so every mount
 * leaked a store subscription and two listeners. `fromStore` unsubscribes with
 * the render effect, and `listen()` hands its teardown back to the view.
 */
export class LoginModalHandlerBloc {
  readonly #modal: LoginModalPort;
  readonly #state: { current: { isOpen: boolean; register: boolean } };
  readonly #events: AuthPromptEventsPort;

  constructor({
    modal = loginModalStore,
    events = windowAuthPromptEvents,
  }: LoginModalHandlerDeps = {}) {
    this.#modal = modal;
    this.#state = fromStore(modal);
    this.#events = events;
  }

  get isOpen(): boolean {
    return this.#state.current?.isOpen ?? false;
  }

  close(): void {
    this.#modal.close();
  }

  /** Start honouring `openLogin` / `openRegister`; returns the teardown. */
  listen(): () => void {
    return this.#events.listen({
      openLogin: () => this.#modal.openLogin(),
      openRegister: () => this.#modal.openRegister(),
    });
  }
}
