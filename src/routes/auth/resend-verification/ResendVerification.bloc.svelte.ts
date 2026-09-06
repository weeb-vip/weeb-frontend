import debug from '$lib/utils/debug';
import { ResendBloc } from '$lib/components/auth/auth-resend.svelte';
import { describeResendError, EMAIL_PATTERN } from '$lib/components/auth/auth-shared';

export interface ResendVerificationDeps {
  resend?: ResendBloc;
}

/**
 * The standalone "send me another link" page. No longer linked from the login
 * form -- the unverified-login banner resends to the address already typed --
 * but reachable for anyone who bookmarked it or arrives from an old email.
 *
 * Thin over `ResendBloc`: what is left here is the address field and the
 * wording, because this screen is the only one that has to explain a failure
 * rather than just show one.
 */
export class ResendVerificationBloc {
  readonly resend: ResendBloc;

  #username = $state('');
  #errorMessage = $state('');
  #successMessage = $state('');

  constructor({ resend = new ResendBloc() }: ResendVerificationDeps = {}) {
    this.resend = resend;
  }

  get username(): string {
    return this.#username;
  }

  get errorMessage(): string {
    return this.#errorMessage;
  }

  get successMessage(): string {
    return this.#successMessage;
  }

  get isSubmitting(): boolean {
    return this.resend.isSending;
  }

  updateField(name: string, value: string): void {
    if (name === 'username') this.#username = value;

    // Both messages describe the address that was in the box a moment ago.
    if (this.#errorMessage) this.#errorMessage = '';
    if (this.#successMessage) this.#successMessage = '';
  }

  async submit(): Promise<void> {
    // A second submit while the first is still in flight is the user being
    // impatient, not the user being wrong. `ResendBloc` already refuses it at
    // the port, so saying nothing is the whole job -- wording it as a failure
    // put an error the user could not act on over the send that was about to
    // succeed, and wiped its success message on the way.
    if (this.resend.isSending) return;

    // Trimmed before it is judged as well as before it is sent: a pasted
    // ` james@gmail.com ` is the same address, and refusing it as malformed
    // told the user their own address was wrong.
    const username = this.#username.trim();

    if (!username) {
      this.#errorMessage = 'Please enter your email address.';
      return;
    }
    if (!EMAIL_PATTERN.test(username)) {
      this.#errorMessage = 'Please enter a valid email address.';
      return;
    }

    this.#errorMessage = '';
    this.#successMessage = '';

    const sent = await this.resend.resend(username);

    if (sent) {
      debug.success('Verification email resent successfully');
      this.#successMessage = 'Verification email sent! Please check your inbox and spam folder.';
      // Cleared on success so a second send is a deliberate retype.
      this.#username = '';
      return;
    }

    debug.error('Failed to resend verification email', this.resend.error);
    this.#errorMessage = describeResendError(this.resend.error);
  }

  dispose(): void {
    this.resend.dispose();
  }
}
