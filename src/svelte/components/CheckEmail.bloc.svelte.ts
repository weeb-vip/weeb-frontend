import { fromStore } from 'svelte/store';
import debug from '../../utils/debug';
import { emailProviderFor, type EmailProvider } from '../../utils/email-provider';
import { ResendBloc } from './auth-resend.svelte';
import { realRoute, type RoutePort } from './auth-shared';

/**
 * Long enough that repeat taps can't fan out a handful of identical emails,
 * short enough that someone whose first one really did vanish isn't stuck.
 */
export const RESEND_COOLDOWN_SECONDS = 60;

export interface CheckEmailDeps {
  route?: RoutePort;
  resend?: ResendBloc;
}

/**
 * The screen after registering: which address the link went to, how to get back
 * to it, and how to ask for another one.
 *
 * The address arrives as a query param rather than as component state, so the
 * form is gone by the time this is read and a typo is still visible and fixable.
 */
export class CheckEmailBloc {
  readonly resend: ResendBloc;

  readonly #route: { readonly current: URLSearchParams };

  constructor({
    route = realRoute,
    resend = new ResendBloc({ cooldownSeconds: RESEND_COOLDOWN_SECONDS })
  }: CheckEmailDeps = {}) {
    this.#route = fromStore(route);
    this.resend = resend;
  }

  get email(): string {
    return this.#route.current.get('email') ?? '';
  }

  get hasEmail(): boolean {
    return this.email.length > 0;
  }

  /** A one-tap way back to the message, when we recognise the domain. */
  get provider(): EmailProvider {
    return emailProviderFor(this.email);
  }

  /** The confirmation replaces the instructions, so the change is noticed. */
  get resentJustNow(): boolean {
    return this.resend.isSent;
  }

  get resendError(): string {
    return this.resend.isFailed
      ? "We couldn't send that again just now. Try once more in a moment."
      : '';
  }

  get isResending(): boolean {
    return this.resend.isSending;
  }

  get isCoolingDown(): boolean {
    return this.resend.isCoolingDown;
  }

  get cooldownLabel(): string {
    return this.resend.cooldownLabel;
  }

  /** Nothing to resend to when the address never made it into the URL. */
  get canResend(): boolean {
    return this.hasEmail && !this.isResending;
  }

  /** Called on mount: landing here without an address is worth a breadcrumb. */
  start(): void {
    if (!this.hasEmail) {
      debug.warn('CheckEmail rendered without an email query param');
    }
  }

  async resendEmail(): Promise<void> {
    if (!this.canResend) return;
    if (await this.resend.resend(this.email)) {
      debug.success('Verification email resent');
    } else if (this.resend.isFailed) {
      debug.error('Failed to resend verification email', this.resend.error);
    }
  }

  dispose(): void {
    this.resend.dispose();
  }
}
