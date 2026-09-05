import { fromStore, readable, type Readable } from 'svelte/store';
import { loggedInStore, loginModalStore } from '../stores/auth';
import { ResendBloc } from './auth-resend.svelte';
import { LoginBloc } from './Login.bloc.svelte';
import { RegisterBloc } from './Register.bloc.svelte';
import { realNavigate, type NavigatePort } from './auth-shared';

export type AuthMode = 'login' | 'register';

/** What the modal reads off the store that opened it. */
export type LoginModalStatePort = Readable<{ register: boolean; reason?: string | null }>;

/** The bit of the auth store this needs: recording who just signed in. */
export interface SessionPort {
  setLoggedIn(user: { id: string }): void;
}

/**
 * The app-wide "you are signed in now" nudge. A port because a story must not
 * fire a global event at the Storybook shell.
 */
export type AnnouncePort = () => void;

export const realAnnounce: AnnouncePort = () => {
  window.dispatchEvent(new CustomEvent('loginSuccess'));
};

/** What the view knows and the bloc doesn't: how to dismiss the modal. */
export type ModalAccessor = () => { closeFn?: () => void };

export interface LoginRegisterModalDeps {
  source?: ModalAccessor;
  modal?: LoginModalStatePort;
  login?: LoginBloc;
  register?: RegisterBloc;
  session?: SessionPort;
  announce?: AnnouncePort;
  navigate?: NavigatePort;
}

/**
 * The auth modal, which is the login form and the register form sharing one
 * surface -- so it holds one of each bloc rather than a third copy of their
 * rules. It was previously exactly that third copy, and had already drifted:
 * its register failures all said "try again" where the page named the cause.
 *
 * What is genuinely its own: which mode is showing, why the modal opened (the
 * gated action, when there was one), and the fact that success here closes a
 * surface instead of leaving a page.
 */
export class LoginRegisterModalBloc {
  readonly login: LoginBloc;
  readonly register: RegisterBloc;

  readonly #source: ModalAccessor;
  readonly #modal: { readonly current: { register: boolean; reason?: string | null } };

  /** Null means "whatever the store opened us in"; set once the user switches. */
  #mode = $state<AuthMode | null>(null);

  constructor({
    source = () => ({}),
    modal = loginModalStore,
    session = loggedInStore,
    announce = realAnnounce,
    navigate = realNavigate,
    login,
    register
  }: LoginRegisterModalDeps = {}) {
    this.#source = source;
    this.#modal = fromStore(modal);

    this.login =
      login ??
      new LoginBloc({
        // The modal is not a route: it must not inherit a ?email= that belongs
        // to whatever page it opened over.
        route: readable(new URLSearchParams()),
        // No navigation on success -- the visitor stays where they were, which
        // is the whole point of gating an action with a modal instead of a page.
        onAuthenticated: (result) => {
          session.setLoggedIn({ id: result.id });
          announce();
          this.close();
        }
      });

    this.register =
      register ??
      new RegisterBloc({
        usernameLabel: 'Username',
        // Registration leaves the modal for the dedicated check-email screen,
        // so this path doesn't diverge from /auth/register.
        onRegistered: (email) => {
          this.close();
          return navigate(`/auth/check-email?email=${encodeURIComponent(email)}`);
        }
      });
  }

  get isRegister(): boolean {
    return this.#mode ? this.#mode === 'register' : this.#modal.current.register;
  }

  /** The gated action, when the modal opened in front of one. */
  get reason(): string | null {
    return this.#modal.current.reason ?? null;
  }

  get title(): string {
    if (this.reason) return this.isRegister ? 'Create your account' : 'Sign in to keep track';
    return this.isRegister ? 'Create account' : 'Welcome back';
  }

  /**
   * When the visitor was gated mid-action, say which action. The generic
   * subtitle only applies when they opened this deliberately.
   */
  get subtitle(): string {
    return this.reason ?? (this.isRegister ? 'Start tracking your anime' : 'Sign in to your account');
  }

  get submitLabel(): string {
    return this.isRegister ? 'Create account' : 'Log in';
  }

  get toggleLabel(): string {
    return this.isRegister ? 'Log in' : 'Sign up';
  }

  get togglePrompt(): string {
    return this.isRegister ? 'Already have an account?' : "Don't have an account?";
  }

  get usernameLabel(): string {
    return this.isRegister ? 'Email' : 'Username or email';
  }

  get usernamePlaceholder(): string {
    return this.isRegister ? 'you@example.com' : 'your_username';
  }

  get passwordPlaceholder(): string {
    return this.isRegister ? 'At least 6 characters' : 'Enter your password';
  }

  // ── Delegated form state ───────────────────────────────────────

  get username(): string {
    return this.isRegister ? this.register.username : this.login.username;
  }

  get password(): string {
    return this.isRegister ? this.register.password : this.login.password;
  }

  get confirmPassword(): string {
    return this.register.confirmPassword;
  }

  get validationErrors(): Record<string, string> {
    return this.isRegister ? this.register.validationErrors : this.login.validationErrors;
  }

  get errorMessage(): string {
    return this.isRegister ? this.register.errorMessage : this.login.errorMessage;
  }

  /** Only login can hit this: registering doesn't check an address it just took. */
  get needsVerification(): boolean {
    return !this.isRegister && this.login.needsVerification;
  }

  get verifyAddress(): string {
    return this.login.verifyAddress;
  }

  get resend(): ResendBloc {
    return this.login.resend;
  }

  get isSubmitting(): boolean {
    return this.login.isSubmitting || this.register.isSubmitting;
  }

  get canSubmit(): boolean {
    return this.isRegister ? this.register.canSubmit : this.login.canSubmit;
  }

  // ── Intents ────────────────────────────────────────────────────

  markHydrated(): void {
    this.login.markHydrated();
    this.register.markHydrated();
  }

  updateField(name: string, value: string): void {
    if (this.isRegister) this.register.updateField(name, value);
    else this.login.updateField(name, value);
  }

  submit(): Promise<void> {
    return this.isRegister ? this.register.submit() : this.login.submit();
  }

  /**
   * Switching modes carries the credentials across. Retyping an address you
   * just typed because you picked the wrong tab is the reason people abandon
   * this modal.
   */
  toggleMode(): void {
    const username = this.username;
    const password = this.password;
    const next: AuthMode = this.isRegister ? 'login' : 'register';
    this.#mode = next;
    this.login.clearMessages();
    this.register.clearMessages();

    if (next === 'register') this.register.setCredentials(username, password);
    else this.login.setCredentials(username, password);
  }

  resendVerification(): Promise<boolean> {
    return this.login.resendVerification();
  }

  close(): void {
    this.#source().closeFn?.();
  }

  dispose(): void {
    this.login.dispose();
  }
}
