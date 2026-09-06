import { describe, it, expect } from 'vitest';
import {
  STATUS_HOLD_MS,
  buttonClasses,
  isTransient,
  phaseOf,
  requestedStatus,
  type ButtonColor,
  type ButtonSize,
  type ButtonStatus
} from './Button.logic';

/**
 * Button's two decisions, as functions. The component test beside this one owns
 * the markup and the timer; what a status maps to and what classes a variant
 * produces are pure, so they are exercised directly.
 */

const STATUSES: ButtonStatus[] = ['idle', 'loading', 'success', 'error'];

describe('requestedStatus', () => {
  it('treats `loading` as sugar for status="loading"', () => {
    expect(requestedStatus('idle', true)).toBe('loading');
    expect(requestedStatus('idle', false)).toBe('idle');
  });

  it('lets the shorthand win over an explicit status', () => {
    // Most call sites only pass `loading`, so it must not be quietly ignored.
    expect(requestedStatus('success', true)).toBe('loading');
    expect(requestedStatus('error', true)).toBe('loading');
  });

  it('passes an explicit status through untouched', () => {
    for (const status of STATUSES) {
      expect(requestedStatus(status, false)).toBe(status);
    }
  });
});

describe('phaseOf', () => {
  it('draws what was asked for until the hold expires', () => {
    for (const status of STATUSES) {
      expect(phaseOf(status, false)).toBe(status);
    }
  });

  it('falls back to idle once a transient state has been retired', () => {
    expect(phaseOf('success', true)).toBe('idle');
    expect(phaseOf('error', true)).toBe('idle');
  });
});

describe('isTransient', () => {
  it('retires only success and error on their own', () => {
    expect(isTransient('success')).toBe(true);
    expect(isTransient('error')).toBe(true);
  });

  it('leaves idle and loading for the caller to end', () => {
    // A spinner that timed itself out would go idle mid-request.
    expect(isTransient('idle')).toBe(false);
    expect(isTransient('loading')).toBe(false);
  });
});

describe('STATUS_HOLD_MS', () => {
  it('holds a confirmation long enough to read', () => {
    expect(STATUS_HOLD_MS).toBe(2000);
  });
});

describe('buttonClasses', () => {
  it('always carries the base class and the size', () => {
    for (const size of ['sm', 'md', 'lg', 'hero', 'icon'] as ButtonSize[]) {
      const classes = buttonClasses(size, 'blue', false, '');

      expect(classes.startsWith('btn ')).toBe(true);
      expect(classes).toContain(`btn--${size}`);
    }
  });

  it('maps each colour onto its own token class', () => {
    expect(buttonClasses('md', 'blue', false, '')).toContain('btn-accent');
    expect(buttonClasses('md', 'red', false, '')).toContain('btn-danger');
    expect(buttonClasses('md', 'transparent', false, '')).toContain('btn-ghost');
  });

  it('adds no colour class when the caller named none', () => {
    expect(buttonClasses('md', '' as ButtonColor, false, '')).toBe('btn btn--md');
  });

  it('stretches only when asked', () => {
    expect(buttonClasses('lg', 'blue', true, '')).toContain('btn--full');
    expect(buttonClasses('lg', 'blue', false, '')).not.toContain('btn--full');
  });

  it('keeps the caller’s layout class last, so it cannot restyle the variant', () => {
    const classes = buttonClasses('md', 'blue', false, 'mt-4');

    expect(classes.endsWith('mt-4')).toBe(true);
  });

  it('emits no empty class fragments', () => {
    expect(buttonClasses('md', '' as ButtonColor, false, '')).not.toMatch(/\s{2}|\s$/);
  });
});
