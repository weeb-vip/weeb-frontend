import debug from '../../utils/debug';
import {
  describeRegisterError,
  passwordStrength,
  realNavigate,
  realRegister,
  validateCredentials,
  type NavigatePort,
  type PasswordStrength,
  type RegisterPort
} from './auth-shared';

export interface RegisterDeps {
  register?: RegisterPort;
  navigate?: NavigatePort;
  /** "Email" on the register page, "Username" in the modal. */
  usernameLabel?: string;
  /**
   * Where a new account goes next. Both call sites land on the check-email
   * screen; the modal has to close itself first, which is why this is a port.
   */
  onRegistered?: (email: string) => unknown;
}

/**
 * Creating an account: three fields, the rules they have to satisfy, and the
 * strength of the password while it is being typed.
 *
 * Registration succeeds into a dedicated screen rather than an inline alert
 * under an emptied form -- the verification step was too easy to miss there.
 */
export class RegisterBloc {
  readonly usernameLabel: string;

  readonly #register: RegisterPort;
  readonly #onRegistered: (email: string) => unknown;

  #username = $state('');
  #password = $state('');
  #confirmPassword = $state('');
  #validationErrors = $state<Record<string, string>>({});
  #errorMessage = $state('');
  #submitting = $state(false);
  #hydrated = $state(false);

  constructor({
    register = realRegister(),
    navigate = realNavigate,
    usernameLabel = 'Email',
    onRegistered
  }: RegisterDeps = {}) {
    this.#register = register;
    this.usernameLabel = usernameLabel;
    this.#onRegistered =
      onRegistered ?? ((email) => navigate(`/auth/check-email?email=${encodeURIComponent(email)}`));
  }

  get username(): string {
    return this.#username;
  }

  get password(): string {
    return this.#password;
  }

  get confirmPassword(): string {
    return this.#confirmPassword;
  }

  get validationErrors(): Record<string, string> {
    return this.#validationErrors;
  }

  get errorMessage(): string {
    return this.#errorMessage;
  }

  get isSubmitting(): boolean {
    return this.#submitting;
  }

  /** See LoginBloc: the submit stays inert until the form can be handled in JS. */
  get canSubmit(): boolean {
    return this.#hydrated && !this.#submitting;
  }

  get strength(): PasswordStrength {
    return passwordStrength(this.#password);
  }

  /** Empty for 'none', so the meter says nothing rather than "None". */
  get strengthLabel(): string {
    switch (this.strength) {
      case 'weak':
        return 'Weak';
      case 'medium':
        return 'Medium';
      case 'strong':
        return 'Strong';
      default:
        return '';
    }
  }

  get showStrength(): boolean {
    return this.#password.length > 0;
  }

  markHydrated(): void {
    this.#hydrated = true;
  }

  updateField(name: string, value: string): void {
    if (name === 'username') this.#username = value;
    else if (name === 'password') this.#password = value;
    else if (name === 'confirmPassword') this.#confirmPassword = value;

    if (this.#validationErrors[name]) {
      this.#validationErrors = { ...this.#validationErrors, [name]: '' };
    }
    if (this.#errorMessage) this.#errorMessage = '';
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
  }

  async submit(): Promise<void> {
    const errors = validateCredentials(
      {
        username: this.#username,
        password: this.#password,
        confirmPassword: this.#confirmPassword
      },
      { confirm: true, usernameLabel: this.usernameLabel }
    );
    this.#validationErrors = errors;
    if (Object.keys(errors).length > 0) return;

    this.#errorMessage = '';
    this.#submitting = true;

    // Kept because the form is cleared before the redirect carries it.
    const email = this.#username;

    try {
      await this.#register({ username: this.#username, password: this.#password });
      debug.success('Registration successful!');
      this.#username = '';
      this.#password = '';
      this.#confirmPassword = '';
      await this.#onRegistered(email);
    } catch (error) {
      debug.error('Registration failed', error);
      this.#errorMessage = describeRegisterError(error);
    } finally {
      this.#submitting = false;
    }
  }
}
