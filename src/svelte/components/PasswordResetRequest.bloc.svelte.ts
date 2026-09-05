import debug from '../../utils/debug';
import { realPasswordResetRequest, type PasswordResetRequestPort } from './auth-shared';

export interface PasswordResetRequestDeps {
  request?: PasswordResetRequestPort;
}

/**
 * Asking for a password-reset link.
 *
 * The form locks itself the moment a request is in flight and stays locked
 * after one succeeds: a reset email is a thing you can't un-send, and the old
 * screen let an impatient second Enter send a second one.
 */
export class PasswordResetRequestBloc {
  readonly #request: PasswordResetRequestPort;

  #username = $state('');
  #email = $state('');
  #errorMessage = $state('');
  #submitted = $state(false);
  #blocked = $state(false);

  constructor({ request = realPasswordResetRequest }: PasswordResetRequestDeps = {}) {
    this.#request = request;
  }

  get username(): string {
    return this.#username;
  }

  get email(): string {
    return this.#email;
  }

  get errorMessage(): string {
    return this.#errorMessage;
  }

  /** The link is out; the screen becomes a confirmation. */
  get submitted(): boolean {
    return this.#submitted;
  }

  get isSubmitting(): boolean {
    return this.#blocked && !this.#submitted;
  }

  /** Fields and submit go inert together, so nothing can be re-fired mid-flight. */
  get isDisabled(): boolean {
    return this.#blocked || this.#submitted;
  }

  updateField(name: string, value: string): void {
    if (name === 'username') this.#username = value;
    else if (name === 'email') this.#email = value;

    if (this.#errorMessage) this.#errorMessage = '';
  }

  /** Enter and Space are the other two ways to fire a locked form. */
  handleKeyDown(event: KeyboardEvent): void {
    if (!this.#blocked) return;
    if (event.key === 'Enter' || event.key === ' ' || event.key === 'Spacebar') {
      event.preventDefault();
      event.stopPropagation();
    }
  }

  async submit(): Promise<void> {
    if (this.isDisabled) return;

    if (!this.#username.trim() || !this.#email.trim()) {
      this.#errorMessage = 'Please fill in all fields';
      return;
    }

    this.#errorMessage = '';
    this.#blocked = true;

    try {
      const result = await this.#request({ username: this.#username, email: this.#email });
      if (result) {
        debug.auth('Password reset request successful');
        this.#submitted = true;
        return;
      }
      this.#errorMessage = 'Failed to send password reset email. Please try again.';
      this.#blocked = false;
    } catch (error) {
      debug.error('Password reset request failed:', error);
      this.#errorMessage =
        (error as { message?: string } | null)?.message ||
        'Failed to send password reset email. Please try again.';
      this.#blocked = false;
    }
  }
}
