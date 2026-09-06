import { describe, it, expect, vi } from 'vitest';
import { RegisterBloc, type RegisterDeps } from './Register.bloc.svelte';

/** Creating an account: three fields, their rules, and the strength meter. */
function makeBloc(deps: Partial<RegisterDeps> = {}) {
  return new RegisterBloc({
    register: vi.fn(async () => ({ id: 'u1' })),
    navigate: vi.fn(),
    ...deps
  });
}

function fill(bloc: RegisterBloc, password = 'hunter22') {
  bloc.updateField('username', 'someone@example.com');
  bloc.updateField('password', password);
  bloc.updateField('confirmPassword', password);
}

describe('RegisterBloc', () => {
  describe('what the form starts as', () => {
    it('is empty and complaining about nothing', () => {
      const bloc = makeBloc();

      expect(bloc.username).toBe('');
      expect(bloc.password).toBe('');
      expect(bloc.confirmPassword).toBe('');
      expect(bloc.validationErrors).toEqual({});
      expect(bloc.errorMessage).toBe('');
      expect(bloc.isSubmitting).toBe(false);
    });

    it('takes its first field’s name from the screen it is on', () => {
      expect(makeBloc().usernameLabel).toBe('Email');
      expect(makeBloc({ usernameLabel: 'Username' }).usernameLabel).toBe('Username');
    });

    it('cannot submit before hydration', () => {
      const bloc = makeBloc();

      expect(bloc.canSubmit).toBe(false);
      bloc.markHydrated();
      expect(bloc.canSubmit).toBe(true);
    });
  });

  describe('the strength meter', () => {
    it('says nothing at all until something is typed', () => {
      const bloc = makeBloc();

      expect(bloc.showStrength).toBe(false);
      expect(bloc.strength).toBe('none');
      // Empty, so the meter renders no word rather than the word "None".
      expect(bloc.strengthLabel).toBe('');
    });

    it('reads the password live, through the shared rule', () => {
      const bloc = makeBloc();

      bloc.updateField('password', 'abcdef');
      expect(bloc.showStrength).toBe(true);
      expect(bloc.strength).toBe('weak');
      expect(bloc.strengthLabel).toBe('Weak');

      bloc.updateField('password', 'Abcdefgh');
      expect(bloc.strengthLabel).toBe('Medium');

      bloc.updateField('password', 'Abcdefghij1!');
      expect(bloc.strengthLabel).toBe('Strong');
    });

    it('shows the meter for a password too short to score', () => {
      const bloc = makeBloc();

      bloc.updateField('password', 'abc');

      expect(bloc.showStrength).toBe(true);
      expect(bloc.strengthLabel).toBe('');
    });
  });

  describe('validation', () => {
    it('does not call the port when the form is empty', async () => {
      const register = vi.fn(async () => ({ id: 'u1' }));
      const bloc = makeBloc({ register });

      await bloc.submit();

      expect(register).not.toHaveBeenCalled();
      expect(bloc.validationErrors.username).toBe('Email is required');
      expect(bloc.validationErrors.confirmPassword).toBe('Please confirm your password');
    });

    it('names the first field by the label the screen chose', async () => {
      const bloc = makeBloc({ usernameLabel: 'Username' });

      await bloc.submit();

      expect(bloc.validationErrors.username).toBe('Username is required');
    });

    it('refuses a mismatched confirmation', async () => {
      const register = vi.fn(async () => ({ id: 'u1' }));
      const bloc = makeBloc({ register });
      bloc.updateField('username', 'someone@example.com');
      bloc.updateField('password', 'hunter22');
      bloc.updateField('confirmPassword', 'hunter23');

      await bloc.submit();

      expect(bloc.validationErrors.confirmPassword).toBe('Passwords do not match');
      expect(register).not.toHaveBeenCalled();
    });

    it('clears a field error when that field is edited', async () => {
      const bloc = makeBloc();
      await bloc.submit();

      bloc.updateField('confirmPassword', 'x');

      expect(bloc.validationErrors.confirmPassword).toBe('');
    });
  });

  describe('a successful registration', () => {
    it('registers with the typed credentials', async () => {
      const register = vi.fn(async () => ({ id: 'u1' }));
      const bloc = makeBloc({ register });
      fill(bloc);

      await bloc.submit();

      expect(register).toHaveBeenCalledWith({
        username: 'someone@example.com',
        password: 'hunter22'
      });
    });

    it('empties the form, then still hands the address on', async () => {
      const onRegistered = vi.fn();
      const bloc = makeBloc({ onRegistered });
      fill(bloc);

      await bloc.submit();

      expect(bloc.username).toBe('');
      expect(bloc.password).toBe('');
      expect(bloc.confirmPassword).toBe('');
      // The form is cleared before the redirect, so the address is kept aside.
      expect(onRegistered).toHaveBeenCalledWith('someone@example.com');
    });

    it('lands on the check-email screen by default, address encoded', async () => {
      const navigate = vi.fn();
      const bloc = makeBloc({ navigate });
      bloc.updateField('username', 'a+b@example.com');
      bloc.updateField('password', 'hunter22');
      bloc.updateField('confirmPassword', 'hunter22');

      await bloc.submit();

      expect(navigate).toHaveBeenCalledWith('/auth/check-email?email=a%2Bb%40example.com');
    });

    it('does not navigate when the caller took the redirect over', async () => {
      const navigate = vi.fn();
      const bloc = makeBloc({ navigate, onRegistered: vi.fn() });
      fill(bloc);

      await bloc.submit();

      expect(navigate).not.toHaveBeenCalled();
    });
  });

  describe('a failed registration', () => {
    it('names the cause rather than saying "try again"', async () => {
      const bloc = makeBloc({
        register: vi.fn(async () => Promise.reject(new Error('user already exists')))
      });
      fill(bloc);

      await bloc.submit();

      expect(bloc.errorMessage).toContain('already exists');
    });

    it('keeps what was typed so it can be corrected', async () => {
      const bloc = makeBloc({
        register: vi.fn(async () => Promise.reject(new Error('boom')))
      });
      fill(bloc);

      await bloc.submit();

      expect(bloc.username).toBe('someone@example.com');
      expect(bloc.password).toBe('hunter22');
      expect(bloc.isSubmitting).toBe(false);
    });

    it('does not leave the screen', async () => {
      const onRegistered = vi.fn();
      const bloc = makeBloc({
        register: vi.fn(async () => Promise.reject(new Error('boom'))),
        onRegistered
      });
      fill(bloc);

      await bloc.submit();

      expect(onRegistered).not.toHaveBeenCalled();
    });

    it('clears the old banner as soon as any field is edited', async () => {
      const bloc = makeBloc({
        register: vi.fn(async () => Promise.reject(new Error('boom')))
      });
      fill(bloc);
      await bloc.submit();
      expect(bloc.errorMessage).toBeTruthy();

      bloc.updateField('username', 'someone-else@example.com');

      expect(bloc.errorMessage).toBe('');
    });
  });

  it('is submitting while the port has not settled', async () => {
    let release!: () => void;
    const register = vi.fn(
      () => new Promise<{ id: string }>((resolve) => (release = () => resolve({ id: 'u1' })))
    );
    const bloc = makeBloc({ register });
    bloc.markHydrated();
    fill(bloc);

    const inFlight = bloc.submit();
    expect(bloc.isSubmitting).toBe(true);
    expect(bloc.canSubmit).toBe(false);

    release();
    await inFlight;
    expect(bloc.isSubmitting).toBe(false);
  });

  describe('the modal’s extra intents', () => {
    it('carries credentials over when the modal switches mode', () => {
      const bloc = makeBloc();

      bloc.setCredentials('someone@example.com', 'hunter22');

      expect(bloc.username).toBe('someone@example.com');
      expect(bloc.password).toBe('hunter22');
      // Only the two shared fields carry; the confirmation is re-typed.
      expect(bloc.confirmPassword).toBe('');
    });

    it('clearMessages wipes the banner and the field errors', async () => {
      const bloc = makeBloc({
        register: vi.fn(async () => Promise.reject(new Error('boom')))
      });
      await bloc.submit();
      fill(bloc);
      await bloc.submit();

      bloc.clearMessages();

      expect(bloc.errorMessage).toBe('');
      expect(bloc.validationErrors).toEqual({});
    });
  });
});
