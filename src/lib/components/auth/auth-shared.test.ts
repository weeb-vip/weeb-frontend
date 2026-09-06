import { describe, it, expect } from 'vitest';
import {
  EMAIL_PATTERN,
  VERIFY_BANNER,
  describeRegisterError,
  describeResendError,
  formatCountdown,
  passwordStrength,
  validateCredentials
} from './auth-shared';

/**
 * The rules seven auth screens used to each own a copy of. Everything here is
 * pure, so it is exercised directly rather than through a bloc.
 */

describe('validateCredentials', () => {
  it('accepts a good login pair with no errors at all', () => {
    expect(validateCredentials({ username: 'someone@example.com', password: 'hunter22' })).toEqual(
      {}
    );
  });

  it('names the missing first field by the screen’s own label', () => {
    expect(validateCredentials({ username: '', password: 'hunter22' }).username).toBe(
      'Email is required'
    );
    expect(
      validateCredentials(
        { username: '   ', password: 'hunter22' },
        { usernameLabel: 'Username or email' }
      ).username
    ).toBe('Username or email is required');
  });

  it('treats whitespace as empty rather than as two characters', () => {
    // ' ' trims to nothing: "required", not "must be at least 3 characters".
    expect(validateCredentials({ username: ' ', password: 'hunter22' }).username).toBe(
      'Email is required'
    );
  });

  it('measures the untrimmed length once the field is non-blank', () => {
    expect(validateCredentials({ username: 'ab', password: 'hunter22' }).username).toBe(
      'Email must be at least 3 characters'
    );
    expect(validateCredentials({ username: 'abc', password: 'hunter22' }).username).toBeUndefined();
  });

  it('requires a password, then six characters of it', () => {
    expect(validateCredentials({ username: 'abc', password: '' }).password).toBe(
      'Password is required'
    );
    expect(validateCredentials({ username: 'abc', password: '12345' }).password).toBe(
      'Password must be at least 6 characters'
    );
    expect(validateCredentials({ username: 'abc', password: '123456' }).password).toBeUndefined();
  });

  it('ignores the confirmation field unless the screen asked for one', () => {
    // Login has no second field, so a mismatch there is not an error.
    expect(
      validateCredentials({ username: 'abc', password: '123456', confirmPassword: 'nope' })
    ).toEqual({});
  });

  it('demands a confirmation, and that it matches', () => {
    expect(
      validateCredentials({ username: 'abc', password: '123456' }, { confirm: true })
        .confirmPassword
    ).toBe('Please confirm your password');

    expect(
      validateCredentials(
        { username: 'abc', password: '123456', confirmPassword: '654321' },
        { confirm: true }
      ).confirmPassword
    ).toBe('Passwords do not match');

    expect(
      validateCredentials(
        { username: 'abc', password: '123456', confirmPassword: '123456' },
        { confirm: true }
      )
    ).toEqual({});
  });

  it('reports every broken field at once, not just the first', () => {
    const errors = validateCredentials({ username: '', password: '' }, { confirm: true });

    expect(Object.keys(errors).sort()).toEqual(['confirmPassword', 'password', 'username']);
  });
});

describe('passwordStrength', () => {
  it('says nothing about an empty field', () => {
    expect(passwordStrength('')).toBe('none');
  });

  it('is none below the six-character floor', () => {
    expect(passwordStrength('Aa1!')).toBe('none');
    expect(passwordStrength('abcde')).toBe('none');
  });

  it('does not call a long run of one letter strong', () => {
    // Length alone was the old bug: `aaaaaaaaaaaa` is twelve characters.
    expect(passwordStrength('aaaaaaaaaaaa')).toBe('weak');
  });

  it('does not call four varied characters strong', () => {
    // Variety alone was the other bug.
    expect(passwordStrength('Aa1!')).toBe('none');
  });

  it('is weak from six characters, medium from eight with a capital', () => {
    expect(passwordStrength('abcdef')).toBe('weak');
    expect(passwordStrength('abcdefgh')).toBe('weak'); // eight, but no capital
    expect(passwordStrength('Abcdefgh')).toBe('medium');
  });

  it('needs all of length, capital, digit and symbol to be strong', () => {
    expect(passwordStrength('Abcdefghij1!')).toBe('strong');
    expect(passwordStrength('Abcdefghij1')).toBe('medium'); // no symbol
    expect(passwordStrength('Abcdefghij!')).toBe('medium'); // no digit
    expect(passwordStrength('abcdefghij1!')).toBe('weak'); // no capital
    expect(passwordStrength('Abcdefghi1!')).toBe('medium'); // eleven characters
  });
});

describe('describeRegisterError', () => {
  it('points an existing account at the login form', () => {
    expect(describeRegisterError(new Error('user already exists'))).toContain(
      'already exists'
    );
  });

  it('names an invalid address', () => {
    expect(describeRegisterError(new Error('invalid email'))).toBe(
      'Please enter a valid email address.'
    );
  });

  it('names a rejected password', () => {
    expect(describeRegisterError(new Error('password too short'))).toContain('6 characters');
  });

  it('names a connection failure', () => {
    expect(describeRegisterError(new Error('failed to fetch'))).toContain('Network error');
  });

  it('falls back to the gateway message when it recognises nothing', () => {
    expect(describeRegisterError(new Error('subgraph exploded'))).toBe('subgraph exploded');
  });

  it('has a message for null, undefined and a message-less throw', () => {
    expect(describeRegisterError(null)).toBe('Registration failed. Please try again.');
    expect(describeRegisterError(undefined)).toBe('Registration failed. Please try again.');
    expect(describeRegisterError({})).toBe('Registration failed. Please try again.');
    expect(describeRegisterError(new Error(''))).toBe('Registration failed. Please try again.');
  });
});

describe('describeResendError', () => {
  it('names an unknown address', () => {
    expect(describeResendError(new Error('User not found'))).toContain('No account found');
  });

  it('sends an already-verified account to the login form', () => {
    expect(describeResendError(new Error('email already verified'))).toContain(
      'already verified'
    );
  });

  it('names a connection failure', () => {
    expect(describeResendError(new Error('network unreachable'))).toContain('Network error');
  });

  it('falls back to its own copy for a throw with nothing in it', () => {
    expect(describeResendError({})).toBe('Failed to send verification email. Please try again.');
  });
});

describe('formatCountdown', () => {
  it('pads the seconds so the width never jitters', () => {
    expect(formatCountdown(59)).toBe('0:59');
    expect(formatCountdown(9)).toBe('0:09');
    expect(formatCountdown(0)).toBe('0:00');
  });

  it('rolls over into minutes', () => {
    expect(formatCountdown(60)).toBe('1:00');
    expect(formatCountdown(61)).toBe('1:01');
    expect(formatCountdown(125)).toBe('2:05');
  });

  it('never renders a negative or fractional clock', () => {
    expect(formatCountdown(-5)).toBe('0:00');
    expect(formatCountdown(59.9)).toBe('0:59');
  });
});

describe('EMAIL_PATTERN', () => {
  it('accepts an ordinary address', () => {
    expect(EMAIL_PATTERN.test('someone@example.com')).toBe(true);
  });

  it('rejects the shapes that are obviously not one', () => {
    for (const bad of ['', 'someone', 'someone@', '@example.com', 'a b@example.com', 'a@b']) {
      expect(EMAIL_PATTERN.test(bad)).toBe(false);
    }
  });
});

describe('VERIFY_BANNER', () => {
  it('never claims an account exists', () => {
    // Saying "we sent you a link" would be wrong for a typo and would make
    // login a user-enumeration oracle.
    const copy = Object.values(VERIFY_BANNER).join(' ').toLowerCase();

    expect(copy).not.toContain('we sent you');
    expect(copy).not.toContain('your account');
  });
});
