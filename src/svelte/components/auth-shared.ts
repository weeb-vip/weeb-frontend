import { goto } from '$app/navigation';
import { page } from '$app/stores';
import { derived, get, type Readable } from 'svelte/store';
import type { LoginInput, RegisterInput, RequestPasswordResetInput } from '../../gql/graphql';
import {
  requestPasswordReset as requestPasswordResetQuery,
  type VerifyEmailResult
} from '../../services/queries';
import {
  useLogin,
  useRegister,
  useResendVerificationEmail,
  useVerifyEmail
} from '../services/queries';

/**
 * The auth screens' shared vocabulary.
 *
 * Login, Register, CheckEmail, EmailVerification, ResendVerification,
 * PasswordResetRequest and LoginRegisterModal each carried their own copy of
 * these ports, the same validation rules under slightly different wording, and
 * the same error ladders. Seven copies of a rule is seven chances for one of
 * them to drift, which is exactly what had happened -- the modal and the login
 * page disagreed about whether an empty field is a banner or a field error, and
 * the modal's register error said "try again" where the page named the cause.
 *
 * Everything here is either a port (the seam a story or a test injects through)
 * or a pure rule. No component state.
 */

// ── Ports ────────────────────────────────────────────────────────

/** Signing in. Resolves to the new session's user, throws on any failure. */
export type LoginPort = (input: LoginInput) => Promise<{ id: string }>;

/** Creating an account. Resolves once the address has been sent a link. */
export type RegisterPort = (input: RegisterInput) => Promise<{ id: string } | null | undefined>;

/** Sending another verification link to an address. */
export type ResendVerificationPort = (username: string) => Promise<unknown>;

/**
 * Redeeming a verification token. Note it resolves with `success: false` for a
 * token that didn't verify anything, so callers must read the flag rather than
 * treat "no throw" as success.
 */
export type VerifyEmailPort = (token: string) => Promise<VerifyEmailResult>;

/** Asking for a password-reset link. */
export type PasswordResetRequestPort = (input: RequestPasswordResetInput) => Promise<boolean>;

/** Leaving the screen. `goto` in the app, a spy in a story. */
export type NavigatePort = (url: string) => unknown;

/**
 * The current URL's query string. The verification flow passes the address (and
 * the token) between screens this way, so every screen but the modal reads it.
 */
export type RoutePort = Readable<URLSearchParams>;

// ── The real ports ───────────────────────────────────────────────

/**
 * Each of these wraps the existing TanStack mutation rather than re-issuing the
 * GraphQL call, so the side effects that hang off those mutations -- the auth
 * store, the token refresher, the analytics funnel -- keep firing exactly as
 * they did. `get` reads the mutation object out of the store; `mutateAsync` is
 * bound to the observer at construction and stays callable after that read.
 *
 * They call `createMutation`, which reads the query client off Svelte's
 * context, so like every hook they may only run while a component is
 * initialising -- which is where a bloc's `$props()` default constructs it.
 */
export function realLogin(): LoginPort {
  const mutation = get(useLogin());
  return (input) => mutation.mutateAsync(input) as Promise<{ id: string }>;
}

export function realRegister(): RegisterPort {
  const mutation = get(useRegister());
  return (input) => mutation.mutateAsync(input) as Promise<{ id: string }>;
}

export function realResendVerification(): ResendVerificationPort {
  const mutation = get(useResendVerificationEmail());
  return (username) => mutation.mutateAsync({ username });
}

export function realVerifyEmail(): VerifyEmailPort {
  const mutation = get(useVerifyEmail());
  return (token) => mutation.mutateAsync(token);
}

/**
 * The one auth call with no hook behind it: nothing observes its result but the
 * form itself, so it goes straight to the query rather than dragging a query
 * client onto a page that needs one for nothing else.
 */
export const realPasswordResetRequest: PasswordResetRequestPort = (input) =>
  requestPasswordResetQuery().mutationFn({ input });

export const realNavigate: NavigatePort = (url) => goto(url);

export const realRoute: RoutePort = derived(page, ($page) => $page.url.searchParams);

// ── Validation ───────────────────────────────────────────────────

/** Deliberately loose: the confirmation email is the real check. */
export const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export interface CredentialFields {
  username: string;
  password: string;
  confirmPassword?: string;
}

export interface CredentialRules {
  /** Register and the modal's register mode; login has no second field. */
  confirm?: boolean;
  /**
   * What the first field is called on this screen. The register page asks for
   * an email, the modal asks for a username, and the error has to say which.
   */
  usernameLabel?: string;
}

/**
 * One set of rules for every credential form. Returns field -> message, empty
 * when the form is good.
 *
 * The minimums match what the backend enforces; anything stricter here would
 * reject accounts that already exist.
 */
export function validateCredentials(
  fields: CredentialFields,
  { confirm = false, usernameLabel = 'Email' }: CredentialRules = {}
): Record<string, string> {
  const errors: Record<string, string> = {};

  if (!fields.username.trim()) {
    errors.username = `${usernameLabel} is required`;
  } else if (fields.username.length < 3) {
    errors.username = `${usernameLabel} must be at least 3 characters`;
  }

  if (!fields.password) {
    errors.password = 'Password is required';
  } else if (fields.password.length < 6) {
    errors.password = 'Password must be at least 6 characters';
  }

  if (confirm) {
    if (!fields.confirmPassword) {
      errors.confirmPassword = 'Please confirm your password';
    } else if (fields.password !== fields.confirmPassword) {
      errors.confirmPassword = 'Passwords do not match';
    }
  }

  return errors;
}

export type PasswordStrength = 'none' | 'weak' | 'medium' | 'strong';

/**
 * Length first, then variety. A meter that only counted characters called
 * `aaaaaaaaaaaa` strong, and one that only counted classes called `Aa1!` strong.
 */
export function passwordStrength(password: string): PasswordStrength {
  if (!password) return 'none';

  const hasUpper = /[A-Z]/.test(password);
  const hasDigit = /[0-9]/.test(password);
  const hasSymbol = /[^A-Za-z0-9]/.test(password);

  if (password.length >= 12 && hasUpper && hasDigit && hasSymbol) return 'strong';
  if (password.length >= 8 && hasUpper) return 'medium';
  if (password.length >= 6) return 'weak';
  return 'none';
}

// ── Error copy ───────────────────────────────────────────────────

function messageOf(error: unknown): string {
  return String((error as { message?: unknown } | null)?.message ?? '');
}

/**
 * Registration failures, named. The gateway's own message is the last resort
 * because it is usually a subgraph wrapper nobody can act on.
 */
export function describeRegisterError(error: unknown): string {
  const message = messageOf(error);

  if (message.includes('already exists') || message.includes('exists')) {
    return 'An account with this email already exists. Please try logging in or use a different email.';
  }
  if (message.includes('invalid email') || message.includes('email')) {
    return 'Please enter a valid email address.';
  }
  if (message.includes('password')) {
    return "Password requirements not met. Please ensure it's at least 6 characters long.";
  }
  if (message.includes('network') || message.includes('fetch')) {
    return 'Network error. Please check your connection and try again.';
  }
  return message || 'Registration failed. Please try again.';
}

/** The same ladder for the resend form, whose failures differ. */
export function describeResendError(error: unknown): string {
  const message = messageOf(error);

  if (message.includes('User not found') || message.includes('not found')) {
    return 'No account found with this email address. Please check and try again.';
  }
  if (message.includes('already verified') || message.includes('verified')) {
    return 'Your email is already verified. You can proceed to login.';
  }
  if (message.includes('network') || message.includes('fetch')) {
    return 'Network error. Please check your connection and try again.';
  }
  return message || 'Failed to send verification email. Please try again.';
}

// ── Shared copy ──────────────────────────────────────────────────

/**
 * The unverified-account banner, worded once for the login page and the modal.
 *
 * It deliberately does not assert the account exists: the backend returns
 * INACTIVE_CREDENTIALS for an unknown address too, so claiming "we sent you a
 * link" would be wrong for a typo -- and would turn login into a
 * user-enumeration oracle.
 */
export const VERIFY_BANNER = {
  title: 'Verify your email to continue',
  sent: 'Sent — check your inbox, and your spam folder.',
  failed: "We couldn't send that just now. Try again in a moment.",
  action: 'Send a new link',
  sending: 'Sending…'
} as const;

/** `m:ss`, for a countdown that must not jitter in width. */
export function formatCountdown(seconds: number): string {
  const safe = Math.max(0, Math.floor(seconds));
  const minutes = Math.floor(safe / 60);
  return `${minutes}:${String(safe % 60).padStart(2, '0')}`;
}
