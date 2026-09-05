import { goto } from '$app/navigation';
import { loggedInStore } from '../stores/auth';
import { AuthStorage } from '../../utils/auth-storage';
import { logout } from '../../services/queries';

/**
 * Ending the session on the server: the GraphQL mutation and the local
 * endpoint that clears the HttpOnly cookies the mutation cannot touch.
 *
 * One port rather than two, because the two calls are one operation -- there
 * is no caller that wants half of it.
 */
export interface SignOutServicePort {
  signOut(): Promise<void>;
}

/** The client's own record of who is signed in: cookies plus the auth store. */
export interface SessionPort {
  clear(): void;
}

/** `goto`, narrowed to the one shape every bloc here uses. */
export type NavigatePort = (url: string) => void;

export const realSignOutService: SignOutServicePort = {
  async signOut() {
    // Server first, client state after: if the mutation throws we still clear
    // locally (the caller catches), but clearing first would leave a live
    // server session behind with no token left to end it with.
    await logout().mutationFn();
    await fetch('/api/logout', {
      method: 'POST',
      credentials: 'include' // Send cookies to server
    });
  }
};

export const realSession: SessionPort = {
  clear() {
    AuthStorage.logout();
    loggedInStore.logout();
  }
};

export interface ProfileMenuContentDeps {
  service?: SignOutServicePort;
  session?: SessionPort;
  navigate?: NavigatePort;
}

/**
 * The profile menu's only piece of business: signing out. The rest of the
 * menu is links, which are the view's job.
 *
 * Both the desktop dropdown and the mobile drawer render this menu, and both
 * used to carry their own copy of the sign-out sequence; the sequence lives
 * here once, and `MobileDrawerBloc` reuses the same ports.
 */
export class ProfileMenuContentBloc {
  readonly #service: SignOutServicePort;
  readonly #session: SessionPort;
  readonly #navigate: NavigatePort;

  #signingOut = $state(false);

  constructor({
    service = realSignOutService,
    session = realSession,
    navigate = goto
  }: ProfileMenuContentDeps = {}) {
    this.#service = service;
    this.#session = session;
    this.#navigate = navigate;
  }

  /** True between the click and the redirect, so the control can disable itself. */
  get isSigningOut(): boolean {
    return this.#signingOut;
  }

  /**
   * A failed server call must not strand the user in a half-signed-in state,
   * so the local clear and the redirect happen either way.
   *
   * `afterClear` is the surface that hosts the menu closing itself -- the
   * dropdown or the drawer -- run before navigating so the panel does not
   * animate out over the new page.
   */
  async signOut(afterClear?: () => void): Promise<void> {
    if (this.#signingOut) return;
    this.#signingOut = true;
    try {
      await this.#service.signOut();
    } catch (error) {
      console.error('Logout error:', error);
    } finally {
      this.#session.clear();
      this.#signingOut = false;
    }
    afterClear?.();
    this.#navigate('/');
  }
}
