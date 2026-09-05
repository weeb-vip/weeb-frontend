import {
  createMutation,
  createQuery,
  type CreateBaseMutationResult,
  type QueryClient,
  type QueryObserverResult,
} from '@tanstack/svelte-query';
import { fromStore } from 'svelte/store';
import { getUser, updateUserDetails } from '../../services/queries';
import { Language, type UpdateUserInput } from '../../gql/graphql';
import { ACCENT_OPTIONS, type AccentOption } from '../utils/accents';
import { defaultQueryClient } from './MediaList.bloc.svelte';

/**
 * The settings form: your name, your address, and how your public page looks.
 *
 * The form is held as the edits made on top of the server's row rather than as
 * a copy of it. A copy had to be re-synced every time the query answered, which
 * meant a refetch landing mid-edit overwrote what was being typed.
 */

/** The fields this form writes. */
export type ProfileFormField = 'firstname' | 'lastname' | 'username' | 'email' | 'bio';

export interface ProfileSettingsForm {
  firstname: string;
  lastname: string;
  username: string;
  email: string;
  language: Language;
  bio: string;
  accentColor: string;
  listsPublic: boolean;
}

/** Where the form's row comes from and where it goes. */
export interface ProfileSettingsPort {
  user(): any;
  save(input: UpdateUserInput): Promise<any>;
}

export const realProfileSettings: ProfileSettingsPort = {
  user: () => getUser(),
  save: (input) => updateUserDetails().mutationFn(input),
};

export interface ProfileSettingsDeps {
  settings?: ProfileSettingsPort;
  accents?: AccentOption[];
  /** How long a confirmation stays up. A port so a test need not wait 3s. */
  confirmationMs?: number;
  queryClient?: QueryClient;
}

const EMPTY: ProfileSettingsForm = {
  firstname: '',
  lastname: '',
  username: '',
  email: '',
  language: Language.En,
  bio: '',
  accentColor: '',
  listsPublic: false,
};

const BIO_LIMIT = 300;

export class ProfileSettingsBloc {
  readonly accents: AccentOption[];
  readonly bioLimit = BIO_LIMIT;
  readonly languages = [
    { value: Language.En, label: 'English' },
    { value: Language.Th, label: 'Thai' },
  ];

  readonly #user: { readonly current: QueryObserverResult<any, unknown> };
  readonly #save: { readonly current: CreateBaseMutationResult<any, unknown, UpdateUserInput> };
  readonly #confirmationMs: number;

  /** Only what the viewer has changed; everything else reads from the server. */
  #edits = $state<Partial<ProfileSettingsForm>>({});
  #success = $state('');
  #error = $state('');
  /** A username collision belongs on the field, not in the page banner. */
  #usernameError = $state('');
  #timer: ReturnType<typeof setTimeout> | null = null;

  constructor({
    settings = realProfileSettings,
    accents = ACCENT_OPTIONS,
    confirmationMs = 3000,
    queryClient = defaultQueryClient(),
  }: ProfileSettingsDeps = {}) {
    this.accents = accents;
    this.#confirmationMs = confirmationMs;

    this.#user = fromStore(createQuery(settings.user(), queryClient));

    this.#save = fromStore(
      createMutation(
        {
          mutationFn: (input: UpdateUserInput) => settings.save(input),
          onSuccess: (updated: any) => {
            this.#success = 'Profile updated successfully!';
            this.#error = '';
            this.#edits = {};
            queryClient.setQueryData(['user'], updated);
            this.#clearConfirmationLater();
          },
          onError: (error: any) => {
            const gql = error?.response?.errors?.[0];
            const message = gql?.extensions?.message || gql?.message;
            if (gql?.extensions?.code === 'USERNAME_TAKEN') {
              this.#usernameError = message || 'That username is already taken.';
              this.#error = '';
            } else {
              this.#error = message || 'Failed to update profile. Please try again.';
            }
            this.#success = '';
          },
        },
        queryClient,
      ),
    );
  }

  // ── state the view renders ──────────────────────────────────

  get isLoading(): boolean {
    return this.#user.current.isLoading;
  }

  get hasUser(): boolean {
    return !!this.#user.current.data;
  }

  /** The server's row, as the form's fields. */
  get #server(): ProfileSettingsForm {
    const user = this.#user.current.data;
    if (!user) return EMPTY;
    return {
      firstname: user.firstname || '',
      lastname: user.lastname || '',
      username: user.username || '',
      email: user.email || '',
      language: user.language || Language.En,
      bio: user.bio || '',
      accentColor: user.accentColor || '',
      listsPublic: user.listsPublic ?? false,
    };
  }

  /** What the inputs show: the server's row with this session's edits over it. */
  get form(): ProfileSettingsForm {
    return { ...this.#server, ...this.#edits };
  }

  get bioLength(): number {
    return this.form.bio.length;
  }

  get successMessage(): string {
    return this.#success;
  }

  get errorMessage(): string {
    return this.#error;
  }

  get usernameError(): string {
    return this.#usernameError;
  }

  get isSaving(): boolean {
    return this.#save.current.isPending;
  }

  isAccentSelected(name: string): boolean {
    return this.form.accentColor === name;
  }

  // ── intents ─────────────────────────────────────────────────

  setField(field: ProfileFormField, value: string): void {
    this.#edits = { ...this.#edits, [field]: value };
    if (field === 'username') this.#usernameError = '';
    this.#clearMessages();
  }

  setLanguage(language: string): void {
    this.#edits = { ...this.#edits, language: language as Language };
    this.#clearMessages();
  }

  /** Picking the colour already chosen clears it -- the swatches are a toggle. */
  selectAccent(name: string): void {
    this.#edits = {
      ...this.#edits,
      accentColor: this.form.accentColor === name ? '' : name,
    };
    this.#clearMessages();
  }

  toggleListsPublic(): void {
    this.#edits = { ...this.#edits, listsPublic: !this.form.listsPublic };
    this.#clearMessages();
  }

  /**
   * Only the username is required.
   *
   * First and last name are never collected: registration asks for a username
   * and a password, so both are blank on every account that has not edited them.
   * Requiring them here made them a roadblock in front of changing the username
   * -- the one field the account actually has.
   */
  submit(): void {
    if (!this.hasUser) return;

    this.#usernameError = '';
    if (!this.form.username.trim()) {
      this.#usernameError = 'Username is required.';
      return;
    }

    const changed = this.#changedFields();
    if (Object.keys(changed).length === 0) {
      this.#success = 'No changes to save.';
      this.#clearConfirmationLater();
      return;
    }

    this.#error = '';
    this.#save.current.mutate(changed);
  }

  /** Only the fields that actually moved, so a save never rewrites the rest. */
  #changedFields(): UpdateUserInput {
    const server = this.#server;
    const form = this.form;
    const changed: UpdateUserInput = {};
    if (form.firstname !== server.firstname) changed.firstname = form.firstname;
    if (form.lastname !== server.lastname) changed.lastname = form.lastname;
    if (form.username !== server.username) changed.username = form.username;
    if (form.email !== server.email) changed.email = form.email;
    if (form.language !== server.language) changed.language = form.language;
    if (form.bio !== server.bio) changed.bio = form.bio;
    if (form.accentColor !== server.accentColor) changed.accentColor = form.accentColor;
    if (form.listsPublic !== server.listsPublic) changed.listsPublic = form.listsPublic;
    return changed;
  }

  #clearMessages(): void {
    if (this.#error) this.#error = '';
    if (this.#success) this.#success = '';
  }

  #clearConfirmationLater(): void {
    if (typeof setTimeout === 'undefined') return;
    if (this.#timer) clearTimeout(this.#timer);
    this.#timer = setTimeout(() => {
      this.#success = '';
      this.#timer = null;
    }, this.#confirmationMs);
  }
}
