import { fromStore, type Readable } from 'svelte/store';
import { toast } from 'svelte-sonner';
import { loggedInStore, loginModalStore } from '$lib/stores/auth';
import { resolveLoggedIn, type ClientAuthState, type ServerAuth } from '$lib/stores/server-auth';
import { followUser, unfollowUser } from '$lib/services/query-options';

/**
 * The Follow button on someone's public page.
 *
 * The page arrives from the server already knowing how the viewer relates to
 * this user (`viewerFollowStatus`), so the bloc starts from that and layers
 * the result of each click on top. The override is keyed on the user id: a
 * client-side navigation from /u/a to /u/b must not carry a's "Following"
 * across.
 */

export type FollowState = 'NONE' | 'REQUESTED' | 'FOLLOWING' | 'SELF';

export interface FollowTarget {
  userID: string;
  username: string;
  status: FollowState;
  followApprovalRequired: boolean;
}

export interface FollowPort {
  follow(userID: string): Promise<string>;
  unfollow(userID: string): Promise<boolean>;
}

export const realFollowPort: FollowPort = {
  follow: (userID) => followUser().mutationFn(userID),
  unfollow: (userID) => unfollowUser().mutationFn(userID),
};

export interface AuthPromptPort {
  requireAuth(options: { reason?: string; onAuthed?: () => void | Promise<void> }): void;
}

export interface NotifyPort {
  error(message: string): void;
}

export interface FollowButtonDeps {
  source?: () => FollowTarget;
  port?: FollowPort;
  auth?: Readable<ClientAuthState>;
  /** The server's answer, believed until `auth` has resolved: a signed-in
   * visitor who clicks before the store catches up is not sent to the login modal. */
  serverAuth?: ServerAuth | null;
  prompt?: AuthPromptPort;
  notify?: NotifyPort;
  /** Called with the delta to the follower count after a successful change. */
  onFollowerCountChange?: (delta: number) => void;
}

export class FollowButtonBloc {
  readonly #source: () => FollowTarget;
  readonly #port: FollowPort;
  readonly #auth: { readonly current: ClientAuthState };
  readonly #serverAuth: ServerAuth | null;
  readonly #prompt: AuthPromptPort;
  readonly #notify: NotifyPort;
  readonly #onCountChange: (delta: number) => void;

  /** The state after this session's clicks, for the user it was clicked on. */
  #override = $state<{ userID: string; status: FollowState } | null>(null);
  #pending = $state(false);

  constructor({
    source = () => ({ userID: '', username: '', status: 'NONE', followApprovalRequired: false }),
    port = realFollowPort,
    auth = loggedInStore,
    serverAuth = null,
    prompt = loginModalStore,
    notify = { error: (message) => toast.error(message) },
    onFollowerCountChange = () => {},
  }: FollowButtonDeps = {}) {
    this.#source = source;
    this.#port = port;
    this.#auth = fromStore(auth);
    this.#serverAuth = serverAuth;
    this.#prompt = prompt;
    this.#notify = notify;
    this.#onCountChange = onFollowerCountChange;
  }

  get status(): FollowState {
    const target = this.#source();
    if (this.#override && this.#override.userID === target.userID) {
      return this.#override.status;
    }
    return target.status;
  }

  /** You cannot follow yourself; the button simply is not there. */
  get isVisible(): boolean {
    return this.status !== 'SELF' && !!this.#source().userID;
  }

  get isPending(): boolean {
    return this.#pending;
  }

  get label(): string {
    switch (this.status) {
      case 'FOLLOWING':
        return 'Following';
      case 'REQUESTED':
        return 'Requested';
      default:
        return 'Follow';
    }
  }

  /** The filled accent button is the invitation; a quieter one is the state. */
  get isActive(): boolean {
    return this.status === 'FOLLOWING' || this.status === 'REQUESTED';
  }

  get ariaLabel(): string {
    const name = this.#source().username;
    switch (this.status) {
      case 'FOLLOWING':
        return `Unfollow ${name}`;
      case 'REQUESTED':
        return `Withdraw follow request to ${name}`;
      default:
        return `Follow ${name}`;
    }
  }

  get isLoggedIn(): boolean {
    return resolveLoggedIn(this.#auth.current, this.#serverAuth);
  }

  /** One click does the natural thing for the current state. */
  async toggle(): Promise<void> {
    if (this.#pending || !this.isVisible) return;
    if (!this.isLoggedIn) {
      this.#prompt.requireAuth({
        reason: `Sign in to follow @${this.#source().username}`,
        // Returns the promise so a caller that wants to wait for the replayed
        // follow can; the modal itself ignores it.
        onAuthed: () => this.toggle(),
      });
      return;
    }
    if (this.status === 'NONE') {
      await this.#follow();
    } else {
      await this.#unfollow();
    }
  }

  async #follow(): Promise<void> {
    const target = this.#source();
    this.#pending = true;
    try {
      const result = (await this.#port.follow(target.userID)) as FollowState;
      this.#override = { userID: target.userID, status: result === 'REQUESTED' ? 'REQUESTED' : 'FOLLOWING' };
      if (result === 'FOLLOWING') this.#onCountChange(1);
    } catch (error: any) {
      this.#notify.error(messageOf(error, 'Could not follow right now.'));
    } finally {
      this.#pending = false;
    }
  }

  async #unfollow(): Promise<void> {
    const target = this.#source();
    const wasFollowing = this.status === 'FOLLOWING';
    this.#pending = true;
    try {
      await this.#port.unfollow(target.userID);
      this.#override = { userID: target.userID, status: 'NONE' };
      if (wasFollowing) this.#onCountChange(-1);
    } catch (error: any) {
      this.#notify.error(messageOf(error, 'Could not unfollow right now.'));
    } finally {
      this.#pending = false;
    }
  }
}

function messageOf(error: any, fallback: string): string {
  const gql = error?.response?.errors?.[0];
  return gql?.extensions?.message || gql?.message || fallback;
}
