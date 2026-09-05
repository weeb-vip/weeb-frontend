import { get } from 'svelte/store';
import debug from '../../utils/debug';
import { ResendBloc, realTimer, type TimerPort } from './auth-resend.svelte';
import {
  realNavigate,
  realRoute,
  realVerifyEmail,
  type NavigatePort,
  type RoutePort,
  type VerifyEmailPort
} from './auth-shared';

/**
 * No separate 'expired' state: the gateway returns the same "Access denied" /
 * DOWNSTREAM_SERVICE_ERROR for an expired token, a malformed one, and one
 * signed by an unknown key. Splitting them would mean guessing, so the one
 * failure state covers all of them honestly and offers the same one-tap
 * recovery.
 */
export type VerificationStatus = 'loading' | 'success' | 'incomplete' | 'failed';

const REDIRECT_SECONDS = 3;

export interface EmailVerificationDeps {
  route?: RoutePort;
  verify?: VerifyEmailPort;
  navigate?: NavigatePort;
  timer?: TimerPort;
  resend?: ResendBloc;
  redirectSeconds?: number;
}

/**
 * Redeeming a verification link: whether the link was whole, whether the token
 * worked, and where you go next.
 *
 * Verification proves ownership of the address but doesn't return credentials,
 * so we can't mint a session here -- the next best thing is handing login an
 * email it doesn't have to be typed into.
 */
export class EmailVerificationBloc {
  readonly resend: ResendBloc;
  readonly redirectSeconds: number;

  readonly #verify: VerifyEmailPort;
  readonly #navigate: NavigatePort;
  readonly #timer: TimerPort;
  readonly #email: string;
  readonly #token: string;

  #status = $state<VerificationStatus>('loading');
  #redirectIn = $state(REDIRECT_SECONDS);
  #started = false;
  #handle: unknown = null;

  constructor({
    route = realRoute,
    verify = realVerifyEmail(),
    navigate = realNavigate,
    timer = realTimer,
    resend = new ResendBloc(),
    redirectSeconds = REDIRECT_SECONDS
  }: EmailVerificationDeps = {}) {
    this.#verify = verify;
    this.#navigate = navigate;
    this.#timer = timer;
    this.resend = resend;
    this.redirectSeconds = redirectSeconds;
    this.#redirectIn = redirectSeconds;

    const params = get(route);
    // Email clients cut long links in half, and half a link has nothing to
    // verify -- decided here so the first frame is already the right screen.
    this.#email = params.get('email') ?? '';
    this.#token = params.get('token') ?? '';
    if (!this.#email || !this.#token) this.#status = 'incomplete';
  }

  get status(): VerificationStatus {
    return this.#status;
  }

  /**
   * `URLSearchParams` has already decoded this once; links in the wild are
   * sometimes encoded twice, so it is decoded again where that is reversible
   * and left alone where it isn't (a lone `%` would otherwise throw here).
   */
  get email(): string {
    if (!this.#email) return '';
    try {
      return decodeURIComponent(this.#email);
    } catch {
      return this.#email;
    }
  }

  get token(): string {
    return this.#token;
  }

  get loginHref(): string {
    return this.email ? `/auth/login?email=${encodeURIComponent(this.email)}` : '/auth/login';
  }

  get redirectIn(): number {
    return this.#redirectIn;
  }

  get title(): string {
    switch (this.#status) {
      case 'success':
        return "You're verified";
      case 'failed':
        return "This link didn't work";
      case 'incomplete':
        return 'This link is incomplete';
      default:
        return 'Verifying your email';
    }
  }

  get subtitle(): string {
    switch (this.#status) {
      case 'success':
        return this.email
          ? `${this.email} is confirmed and your account is active.`
          : 'Your email is confirmed and your account is active.';
      case 'failed':
        return `Verification links expire 15 minutes after they're sent. ${
          this.email
            ? `We can send a fresh one to ${this.email}.`
            : 'Request a new one from the log in page.'
        }`;
      case 'incomplete':
        return 'Some email clients cut long links in half. Open the message again and use the Verify my email button rather than copying the address.';
      default:
        return this.email ? `Confirming ${this.email}…` : 'One moment…';
    }
  }

  /** Only the failure screen offers a fresh link, and only if it knows where to send it. */
  get canResend(): boolean {
    return this.#status === 'failed' && this.email.length > 0;
  }

  /** Called on mount. Redeeming a token is a write, so it doesn't run twice. */
  start(): void {
    if (this.#started || this.#status === 'incomplete') return;
    this.#started = true;
    void this.#runVerification();
  }

  retry(): void {
    if (!this.#token) return;
    this.#status = 'loading';
    void this.#runVerification();
  }

  resendLink(): Promise<boolean> {
    return this.resend.resend(this.email);
  }

  dispose(): void {
    this.#stopClock();
    this.resend.dispose();
  }

  async #runVerification(): Promise<void> {
    try {
      const result = await this.#verify(this.#token);
      // The mutation resolves with success=false when verification didn't
      // actually happen, so the flag decides, not the absence of a throw.
      if (result?.success) {
        debug.success('Email verification successful');
        this.#status = 'success';
        this.#startRedirect();
      } else {
        debug.error('Email verification returned unsuccessful');
        this.#status = 'failed';
      }
    } catch (error) {
      debug.error('Email verification failed', error);
      this.#status = 'failed';
    }
  }

  #startRedirect(): void {
    this.#stopClock();
    this.#redirectIn = this.redirectSeconds;
    this.#handle = this.#timer.start(() => {
      this.#redirectIn -= 1;
      if (this.#redirectIn <= 0) {
        this.#redirectIn = 0;
        this.#stopClock();
        void this.#navigate(this.loginHref);
      }
    }, 1000);
  }

  #stopClock(): void {
    if (this.#handle === null) return;
    this.#timer.stop(this.#handle);
    this.#handle = null;
  }
}
