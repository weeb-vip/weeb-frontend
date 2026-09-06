import { describe, it, expect, vi } from 'vitest';
import { readable } from 'svelte/store';
import { LoginBloc, type LoginDeps } from './Login.bloc.svelte';
import { ResendBloc } from './auth-resend.svelte';

/**
 * The sign-in form: its two fields, what is wrong with them, and the one
 * failure that is not a failure -- an account that has never confirmed its
 * address.
 */

/** The failure shape the gateway actually returns for an unverified account. */
const unverified = {
  message: "Failed to fetch from Subgraph 'auth-staging'.",
  response: { errors: [{ extensions: { errors: [{ extensions: { code: 'INACTIVE_CREDENTIALS' } }] } }] }
};

function makeBloc(deps: Partial<LoginDeps> = {}) {
  return new LoginBloc({
    route: readable(new URLSearchParams()),
    login: vi.fn(async () => ({ id: 'u1' })),
    navigate: vi.fn(),
    resend: new ResendBloc({ send: vi.fn(async () => undefined) }),
    ...deps
  });
}

describe('LoginBloc', () => {
  describe('what the form starts as', () => {
    it('is empty, unsubmitted and complaining about nothing', () => {
      const bloc = makeBloc();

      expect(bloc.username).toBe('');
      expect(bloc.password).toBe('');
      expect(bloc.validationErrors).toEqual({});
      expect(bloc.errorMessage).toBe('');
      expect(bloc.needsVerification).toBe(false);
      expect(bloc.isSubmitting).toBe(false);
    });

    it('pre-fills the address the verification screen handed over', () => {
      const bloc = makeBloc({
        route: readable(new URLSearchParams('email=someone%40example.com'))
      });

      expect(bloc.username).toBe('someone@example.com');
    });

    it('stays empty when the URL names no address', () => {
      expect(makeBloc({ route: readable(new URLSearchParams('foo=bar')) }).username).toBe('');
    });
  });

  describe('submitting is blocked until the page can handle it', () => {
    it('cannot submit before hydration -- a native POST has no server action', () => {
      const bloc = makeBloc();

      expect(bloc.canSubmit).toBe(false);
      bloc.markHydrated();
      expect(bloc.canSubmit).toBe(true);
    });

    it('cannot submit while a sign-in is in flight', async () => {
      let release!: () => void;
      const login = vi.fn(
        () => new Promise<{ id: string }>((resolve) => (release = () => resolve({ id: 'u1' })))
      );
      const bloc = makeBloc({ login });
      bloc.markHydrated();
      bloc.updateField('username', 'someone@example.com');
      bloc.updateField('password', 'hunter22');

      const inFlight = bloc.submit();
      expect(bloc.isSubmitting).toBe(true);
      expect(bloc.canSubmit).toBe(false);

      release();
      await inFlight;
      expect(bloc.isSubmitting).toBe(false);
    });
  });

  describe('validation', () => {
    it('does not call the port when the fields are empty', async () => {
      const login = vi.fn(async () => ({ id: 'u1' }));
      const bloc = makeBloc({ login });

      await bloc.submit();

      expect(login).not.toHaveBeenCalled();
      expect(bloc.validationErrors.username).toBe('Username or email is required');
      expect(bloc.validationErrors.password).toBe('Password is required');
    });

    it('names the first field the way the login screen names it', async () => {
      const bloc = makeBloc();
      bloc.updateField('username', 'ab');
      bloc.updateField('password', 'hunter22');

      await bloc.submit();

      expect(bloc.validationErrors.username).toBe(
        'Username or email must be at least 3 characters'
      );
    });

    it('clears a field error as soon as that field is edited', async () => {
      const bloc = makeBloc();
      await bloc.submit();
      expect(bloc.validationErrors.username).toBeTruthy();

      bloc.updateField('username', 's');

      expect(bloc.validationErrors.username).toBe('');
      // The other field's complaint is still true, so it stays.
      expect(bloc.validationErrors.password).toBe('Password is required');
    });
  });

  describe('a successful sign-in', () => {
    it('hands the typed credentials to the port', async () => {
      const login = vi.fn(async () => ({ id: 'u1' }));
      const bloc = makeBloc({ login });
      bloc.updateField('username', 'someone@example.com');
      bloc.updateField('password', 'hunter22');

      await bloc.submit();

      expect(login).toHaveBeenCalledWith({
        username: 'someone@example.com',
        password: 'hunter22'
      });
    });

    it('goes home by default, and hands the result to a caller that wants it', async () => {
      const navigate = vi.fn();
      const page = makeBloc({ navigate });
      page.updateField('username', 'someone@example.com');
      page.updateField('password', 'hunter22');
      await page.submit();
      expect(navigate).toHaveBeenCalledWith('/');

      const onAuthenticated = vi.fn();
      const modal = makeBloc({ onAuthenticated, navigate });
      modal.updateField('username', 'someone@example.com');
      modal.updateField('password', 'hunter22');
      await modal.submit();
      // The modal closes itself rather than navigating.
      expect(onAuthenticated).toHaveBeenCalledWith({ id: 'u1' });
      expect(navigate).toHaveBeenCalledTimes(1);
    });
  });

  describe('a failed sign-in', () => {
    it('says nothing about which half was wrong', async () => {
      const bloc = makeBloc({ login: vi.fn(async () => Promise.reject(new Error('nope'))) });
      bloc.updateField('username', 'someone@example.com');
      bloc.updateField('password', 'hunter22');

      await bloc.submit();

      expect(bloc.errorMessage).toBe(
        'Unable to sign in. Please check your credentials and try again.'
      );
      expect(bloc.needsVerification).toBe(false);
    });

    it('an unverified account is a banner, not an error', async () => {
      const bloc = makeBloc({ login: vi.fn(async () => Promise.reject(unverified)) });
      bloc.updateField('username', 'someone@example.com');
      bloc.updateField('password', 'hunter22');

      await bloc.submit();

      // The password was right; "check your credentials" would send someone off
      // to reset a password that was never wrong.
      expect(bloc.needsVerification).toBe(true);
      expect(bloc.errorMessage).toBe('');
      expect(bloc.verifyAddress).toBe('someone@example.com');
    });

    it('leaves the form usable again', async () => {
      const bloc = makeBloc({ login: vi.fn(async () => Promise.reject(new Error('nope'))) });
      bloc.markHydrated();
      bloc.updateField('username', 'someone@example.com');
      bloc.updateField('password', 'hunter22');

      await bloc.submit();

      expect(bloc.isSubmitting).toBe(false);
      expect(bloc.canSubmit).toBe(true);
    });

    it('drops the banner as soon as the address underneath it changes', async () => {
      const resend = new ResendBloc({ send: vi.fn(async () => undefined) });
      const bloc = makeBloc({ login: vi.fn(async () => Promise.reject(unverified)), resend });
      bloc.updateField('username', 'someone@example.com');
      bloc.updateField('password', 'hunter22');
      await bloc.submit();
      await bloc.resendVerification();
      expect(resend.isSent).toBe(true);

      bloc.updateField('username', 'someone-else@example.com');

      expect(bloc.needsVerification).toBe(false);
      expect(resend.state).toBe('idle');
    });

    it('keeps the banner when only the password changes', async () => {
      const bloc = makeBloc({ login: vi.fn(async () => Promise.reject(unverified)) });
      bloc.updateField('username', 'someone@example.com');
      bloc.updateField('password', 'hunter22');
      await bloc.submit();

      bloc.updateField('password', 'hunter23');

      expect(bloc.needsVerification).toBe(true);
    });

    it('clears the banner before the next attempt rather than leaving a stale one', async () => {
      const login = vi
        .fn()
        .mockRejectedValueOnce(unverified)
        .mockRejectedValueOnce(new Error('nope'));
      const bloc = makeBloc({ login });
      bloc.updateField('username', 'someone@example.com');
      bloc.updateField('password', 'hunter22');

      await bloc.submit();
      expect(bloc.needsVerification).toBe(true);

      await bloc.submit();
      expect(bloc.needsVerification).toBe(false);
      expect(bloc.errorMessage).toBeTruthy();
    });
  });

  describe('resending from the form', () => {
    it('sends to the address already typed in', async () => {
      const send = vi.fn(async () => undefined);
      const bloc = makeBloc({ resend: new ResendBloc({ send }) });
      bloc.updateField('username', 'someone@example.com');

      await expect(bloc.resendVerification()).resolves.toBe(true);
      expect(send).toHaveBeenCalledWith('someone@example.com');
    });

    it('is a no-op with nothing in the field', async () => {
      const send = vi.fn(async () => undefined);
      const bloc = makeBloc({ resend: new ResendBloc({ send }) });

      await expect(bloc.resendVerification()).resolves.toBe(false);
      expect(send).not.toHaveBeenCalled();
    });
  });

  describe('the modal’s two extra intents', () => {
    it('carries credentials over when the modal switches mode', () => {
      const bloc = makeBloc();

      bloc.setCredentials('someone@example.com', 'hunter22');

      expect(bloc.username).toBe('someone@example.com');
      expect(bloc.password).toBe('hunter22');
    });

    it('clearMessages leaves nothing on screen describing the old form', async () => {
      const resend = new ResendBloc({ send: vi.fn(async () => undefined) });
      const bloc = makeBloc({ login: vi.fn(async () => Promise.reject(unverified)), resend });
      bloc.updateField('username', 'someone@example.com');
      bloc.updateField('password', 'hunter22');
      await bloc.submit();
      await bloc.resendVerification();

      bloc.clearMessages();

      expect(bloc.errorMessage).toBe('');
      expect(bloc.validationErrors).toEqual({});
      expect(bloc.needsVerification).toBe(false);
      expect(resend.state).toBe('idle');
      // The typed credentials survive; only the messages go.
      expect(bloc.username).toBe('someone@example.com');
    });
  });

  it('dispose kills the resend sub-bloc’s clock', async () => {
    const stop = vi.fn();
    const resend = new ResendBloc({
      send: vi.fn(async () => undefined),
      timer: { start: () => 1, stop },
      cooldownSeconds: 60
    });
    const bloc = makeBloc({ resend });
    bloc.updateField('username', 'someone@example.com');
    await bloc.resendVerification();

    bloc.dispose();

    expect(stop).toHaveBeenCalledTimes(1);
  });
});
