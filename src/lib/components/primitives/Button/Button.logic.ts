import type { IconDefinition } from '@fortawesome/fontawesome-svg-core';
import type { Snippet } from 'svelte';

/**
 * Button's vocabulary and its two decisions: which visual phase the control is
 * in, and the class list that follows from the variant props.
 *
 * The view keeps only the transient timer that retires a success/error state,
 * because that is wiring rather than a rule.
 */

export type ButtonStatus = 'idle' | 'loading' | 'success' | 'error';
export type ButtonColor = 'blue' | 'red' | 'transparent' | '';
/**
 * `sm` is the old hand-rolled "compact" action (EmptyState's CTA, the sticky
 * header's add button), `lg` the 46px full-width auth submit, `hero` the pair
 * that sit on the banner panel, and `icon` the 32px round icon-only one.
 */
export type ButtonSize = 'sm' | 'md' | 'lg' | 'hero' | 'icon';

export interface ButtonProps {
  color?: ButtonColor;
  size?: ButtonSize;
  /** Stretches to the container -- what every auth CTA and dialog action wants. */
  fullWidth?: boolean;
  /** Renders an `<a>` instead of a `<button>`, styled and focused identically. */
  href?: string;
  target?: string;
  rel?: string;
  /**
   * Only meaningful without `href`. Defaults to `button`, so a Button inside a
   * form is inert unless it asks to submit.
   */
  type?: 'button' | 'submit' | 'reset';
  /** A FontAwesome icon rendered before the label. */
  icon?: IconDefinition | null;
  /** The label. */
  children?: Snippet;
  onClick?: () => void;
  /** Layout only -- a class here must not restyle the variant. */
  className?: string;
  status?: ButtonStatus;
  /** Sugar for `status="loading"`, which is all most call sites need. */
  loading?: boolean;
  /** Called once the transient success/error state has been shown. */
  onResetStatus?: () => void;
  disabled?: boolean;
  /** Required when the button has an icon and no visible label. */
  ariaLabel?: string;
}

/** How long a success/error state stays on screen before falling back to idle. */
export const STATUS_HOLD_MS = 2000;

const COLOR_CLASSES: Record<ButtonColor, string> = {
  blue: 'btn-accent',
  red: 'btn-danger',
  transparent: 'btn-ghost',
  '': ''
};

/** What the caller asked for: `loading` is sugar for `status="loading"`. */
export function requestedStatus(status: ButtonStatus, loading: boolean): ButtonStatus {
  return loading ? 'loading' : status;
}

/** What is actually drawn, once a transient state has been retired locally. */
export function phaseOf(requested: ButtonStatus, expired: boolean): ButtonStatus {
  return expired ? 'idle' : requested;
}

/** Only success and error retire on their own; idle and loading are the caller's to end. */
export function isTransient(requested: ButtonStatus): boolean {
  return requested !== 'idle' && requested !== 'loading';
}

export function buttonClasses(
  size: ButtonSize,
  color: ButtonColor,
  fullWidth: boolean,
  className: string
): string {
  return ['btn', `btn--${size}`, COLOR_CLASSES[color], fullWidth ? 'btn--full' : '', className]
    .filter(Boolean)
    .join(' ');
}
