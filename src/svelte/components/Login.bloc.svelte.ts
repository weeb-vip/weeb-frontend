import { get } from 'svelte/store';
import debug from '../../utils/debug';
import { isUnverifiedEmailError } from '../../utils/auth-errors';
import { ResendBloc } from './auth-resend.svelte';
import {
  realLogin,
  realNavigate,
  realRoute,
  validateCredentials,
  type LoginPort,
  type NavigatePort,
  type RoutePort
} from './auth-shared';

export interface LoginDeps {
  route?: RoutePort;
  login?: LoginPort;
  navigate?: NavigatePort;
  resend?: ResendBloc;
  /**
   * What a successful sign-in means here. The page goes home; the modal closes
   * itself over whatever the visitor was already doing, which is why this is a
   * seam rather than a hardcoded `goto('/')`.
   */
  onAuthenticated?: (result: { id: string }) => unknown;
}

/**
 * Signing in: the two fields, what is wrong with them, and the one failure that
 * isn't a failure -- an account that exists but has never confirmed its address.
 *
 * That case gets its own state rather than an error string. The password was
 * right, so saying "check your credentials" sends people off to reset a
 * password that was never wrong.
 */
export class LoginBloc {
  readonly resend: ResendBloc;

  readonly #login: LoginPort;
  readonly #onAuthenticated: (result: { id: string }) => unknown;

  #username = $state('');
  #password = $state('');
  #validationErrors = $state<Record<string, string>>({});
  #errorMessage = $state('');
  #needsVerification = $state(false);
  #submitting = $state(false);
  #hydrated = $state(false);

  constructor({
    route = realRoute,
    login = realLogin(),
    navigate = realNavigate,
    resend = new ResendBloc(),
    onAuthenticated
  }: LoginDeps = {}) {
    this.#login = login;
    this.resend = resend;
    this.#onAuthenticated = onAuthenticated ?? (() => navigate('/'));

    // Arriving from the verification success screen, which can't mint a session
    // itself -- pre-fill so only the password is left to type. Read once, in the
    // constructor, so it is there on the first frame rather than after a mount.
    this.#username = get(route).get('email') ?? '';
  }

  get username(): string {
    return this.#username;
  }

  get password(): string {
    return this.#password;
  }

  get validationErrors(): Record<string, string> {
    return this.#validationErrors;
  }

  get errorMessage(): string {
    return this.#errorMessage;
  }

  /** Credentials were fine; the address has never been confirmed. */
  get needsVerification(): boolean {
    return this.#needsVerification;
  }

  /** The address the verification banner is talking about. */
  get verifyAddress(): string {
    return this.#username;
  }

  get isSubmitting(): boolean {
    return this.#submitting;
  }

  /**
   * Until hydration completes a submit would be a native form POST, which
   * SvelteKit rejects because this form has no server action.
   */
  get canSubmit(): boolean {
    return this.#hydrated && !this.#submitting;
  }

  markHydrated(): void {
    this.#hydrated = true;
  }

  updateField(name: string, value: string): void {
    if (name === 'username') this.#username = value;
    else if (name === 'password') this.#password = value;

    if (this.#validationErrors[name]) {
      this.#validationErrors = { ...this.#validationErrors, [name]: '' };
    }
    if (this.#errorMessage) this.#errorMessage = '';

    // Editing the email invalidates the banner it was addressed to.
    if (this.#needsVerification && name === 'username') {
      this.#needsVerification = false;
      this.resend.reset();
    }
  }

  /** Carries the credentials over when the modal switches between its two modes. */
  setCredentials(username: string, password: string): void {
    this.#username = username;
    this.#password = password;
  }

  /** Nothing on screen still describes what is in the form. */
  clearMessages(): void {
    this.#errorMessage = '';
    this.#validationErrors = {};
    this.#needsVerification = false;
    this.resend.reset();
  }

  async submit(): Promise<void> {
    const errors = validateCredentials(
      { username: this.#username, password: this.#password },
      { usernameLabel: 'Username or email' }
    );
    this.#validationErrors = errors;
    if (Object.keys(errors).length > 0) return;

    this.#errorMessage = '';
    this.#needsVerification = false;
    this.resend.reset();
    this.#submitting = true;

    try {
      const result = await this.#login({ username: this.#username, password: this.#password });
      debug.auth('Login successful');
      await this.#onAuthenticated(result);
    } catch (error) {
      debug.error('Login failed', error);
      if (isUnverifiedEmailError(error)) {
        this.#needsVerification = true;
      } else {
        this.#errorMessage = 'Unable to sign in. Please check your credentials and try again.';
      }
    } finally {
      this.#submitting = false;
    }
  }

  /** Resends to the address already typed in, without leaving the form. */
  resendVerification(): Promise<boolean> {
    return this.resend.resend(this.#username);
  }

  dispose(): void {
    this.resend.dispose();
  }
}
