import {
  formatCountdown,
  realResendVerification,
  type ResendVerificationPort
} from './auth-shared';

/**
 * "Send me another link", which five screens offer and five screens had
 * separately implemented: the login banner, the modal's banner, the
 * check-email screen, the broken-link screen, and the standalone resend page.
 * Four of them tracked the same idle/sending/sent/failed states in their own
 * `let`s, and the fifth also owned a countdown.
 *
 * Sub-bloc, not a bloc: it is composed into the screen's bloc rather than
 * given a view of its own, because each screen draws the same states
 * differently -- an amber banner, a green alert, a countdown next to a link.
 */

export type ResendState = 'idle' | 'sending' | 'sent' | 'failed';

/**
 * The cooldown's clock. A port because a story that shows the countdown
 * ticking must be able to drive it without waiting a real minute -- and
 * because a story that shows it frozen must be able to not tick at all.
 */
export interface TimerPort {
  start(tick: () => void, everyMs: number): unknown;
  stop(handle: unknown): void;
}

export const realTimer: TimerPort = {
  start: (tick, everyMs) => setInterval(tick, everyMs),
  stop: (handle) => clearInterval(handle as ReturnType<typeof setInterval>)
};

export interface ResendDeps {
  send?: ResendVerificationPort;
  timer?: TimerPort;
  /**
   * Seconds before another send is allowed. Zero on the screens where the
   * action is already behind a failure the user had to reach; sixty on
   * check-email, where the button sits in front of everyone and repeat taps
   * would fan out N identical emails.
   */
  cooldownSeconds?: number;
}

export class ResendBloc {
  readonly cooldownSeconds: number;

  readonly #send: ResendVerificationPort;
  readonly #timer: TimerPort;

  #state = $state<ResendState>('idle');
  #cooldown = $state(0);
  #error = $state<unknown>(null);
  #handle: unknown = null;

  constructor({
    send = realResendVerification(),
    timer = realTimer,
    cooldownSeconds = 0
  }: ResendDeps = {}) {
    this.#send = send;
    this.#timer = timer;
    this.cooldownSeconds = cooldownSeconds;
  }

  get state(): ResendState {
    return this.#state;
  }

  get isSending(): boolean {
    return this.#state === 'sending';
  }

  get isSent(): boolean {
    return this.#state === 'sent';
  }

  get isFailed(): boolean {
    return this.#state === 'failed';
  }

  /** The rejection, for a caller that words its own message from the cause. */
  get error(): unknown {
    return this.#error;
  }

  get cooldown(): number {
    return this.#cooldown;
  }

  get isCoolingDown(): boolean {
    return this.#cooldown > 0;
  }

  /** `0:59` -- the countdown that replaces the button while it is inert. */
  get cooldownLabel(): string {
    return formatCountdown(this.#cooldown);
  }

  get canSend(): boolean {
    return !this.isSending && !this.isCoolingDown;
  }

  /**
   * Sends, and reports whether it landed so a caller can word its own success.
   * A send with no address, one already in flight, or one inside the cooldown
   * is a no-op rather than an error -- none of them is the user's mistake.
   */
  async resend(email: string): Promise<boolean> {
    if (!email.trim() || !this.canSend) return false;

    this.#state = 'sending';
    this.#error = null;

    try {
      await this.#send(email);
      this.#state = 'sent';
      this.#startCooldown();
      return true;
    } catch (error) {
      this.#error = error;
      this.#state = 'failed';
      return false;
    }
  }

  /** Back to offering the action, e.g. when the address underneath it changes. */
  reset(): void {
    this.#state = 'idle';
    this.#error = null;
    this.#stopClock();
    this.#cooldown = 0;
  }

  /** Called from the view's teardown: an interval outlives its component. */
  dispose(): void {
    this.#stopClock();
  }

  #startCooldown(): void {
    if (this.cooldownSeconds <= 0) return;

    this.#stopClock();
    this.#cooldown = this.cooldownSeconds;
    this.#handle = this.#timer.start(() => {
      this.#cooldown -= 1;
      if (this.#cooldown <= 0) {
        this.#cooldown = 0;
        this.#stopClock();
      }
    }, 1000);
  }

  #stopClock(): void {
    if (this.#handle === null) return;
    this.#timer.stop(this.#handle);
    this.#handle = null;
  }
}
