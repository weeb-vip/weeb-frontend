import { initializeAnimeNotifications } from '../stores/animeNotificationProvider';
import debug from '../../utils/debug';

/** Bringing the notification manager up. The only thing this component does. */
export interface AnimeNotificationsPort {
  initialize(): Promise<void>;
}

/**
 * "Has this already been done in this browser session?"
 *
 * The real one is a window flag, so it survives client-side navigation (the
 * component remounts on every layout re-render) but resets on a hard reload.
 * A port because a story or a test must be able to answer "yes, already done"
 * and get a component that starts nothing at all.
 */
export interface OnceGuardPort {
  /** True the first time only; marks the work as claimed. */
  claim(): boolean;
}

export const browserSessionOnce: OnceGuardPort = {
  claim() {
    if (typeof window === 'undefined') return false;
    if (window.__animeNotificationsComponentMounted) return false;

    window.__animeNotificationsComponentMounted = true;
    return true;
  },
};

export interface AnimeNotificationProviderDeps {
  notifications?: AnimeNotificationsPort;
  once?: OnceGuardPort;
}

/**
 * Starts anime episode notifications once per browser session.
 *
 * There are two layers of de-duplication and both matter: this guard stops the
 * component asking twice, and the singleton manager behind
 * `initializeAnimeNotifications` stops anything else asking twice.
 */
export class AnimeNotificationProviderBloc {
  readonly #notifications: AnimeNotificationsPort;
  readonly #once: OnceGuardPort;

  constructor({
    notifications = { initialize: initializeAnimeNotifications },
    once = browserSessionOnce,
  }: AnimeNotificationProviderDeps = {}) {
    this.#notifications = notifications;
    this.#once = once;
  }

  /** Fire-and-forget: nothing renders from the result, and failures are logged. */
  start(): void {
    if (!this.#once.claim()) return;

    debug.info('🔔 AnimeNotificationProvider: Checking initialization status');
    void this.#notifications
      .initialize()
      .catch((error) => debug.error('🔔 AnimeNotificationProvider: initialization failed', error));
  }
}
