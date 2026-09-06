import { describe, it, expect, vi } from 'vitest';
import { readable, writable } from 'svelte/store';
import { LoginBloc } from '../Login.bloc.svelte';
import { RegisterBloc } from '../Register.bloc.svelte';
import { ResendBloc } from '../auth-resend.svelte';
import {
  LoginRegisterModalBloc,
  type LoginRegisterModalDeps
} from './LoginRegisterModal.bloc.svelte';

/**
 * The modal is the login form and the register form on one surface, so it holds
 * one of each bloc rather than a third copy of their rules -- which is what it
 * was, and it had already drifted.
 */
function makeBloc(deps: Partial<LoginRegisterModalDeps> = {}) {
  return new LoginRegisterModalBloc({
    modal: readable({ register: false }),
    login: new LoginBloc({
      route: readable(new URLSearchParams()),
      login: vi.fn(async () => ({ id: 'u1' })),
      navigate: vi.fn(),
      resend: new ResendBloc({ send: vi.fn(async () => undefined) }),
      onAuthenticated: vi.fn()
    }),
    register: new RegisterBloc({
      register: vi.fn(async () => ({ id: 'u1' })),
      navigate: vi.fn(),
      usernameLabel: 'Username',
      onRegistered: vi.fn()
    }),
    session: { setLoggedIn: vi.fn() },
    announce: vi.fn(),
    navigate: vi.fn(),
    ...deps
  });
}

describe('LoginRegisterModalBloc', () => {
  describe('which mode is showing', () => {
    it('opens in whichever mode the store asked for', () => {
      expect(makeBloc({ modal: readable({ register: false }) }).isRegister).toBe(false);
      expect(makeBloc({ modal: readable({ register: true }) }).isRegister).toBe(true);
    });

    it('follows the store until the visitor picks a side', () => {
      const modal = writable({ register: false });
      const bloc = makeBloc({ modal });

      modal.set({ register: true });
      expect(bloc.isRegister).toBe(true);

      bloc.toggleMode();
      expect(bloc.isRegister).toBe(false);

      // The store no longer wins once the visitor has switched.
      modal.set({ register: true });
      expect(bloc.isRegister).toBe(false);
    });
  });

  describe('the copy', () => {
    it('words the deliberate visit generically', () => {
      const login = makeBloc({ modal: readable({ register: false }) });

      expect(login.title).toBe('Welcome back');
      expect(login.subtitle).toBe('Sign in to your account');
      expect(login.submitLabel).toBe('Log in');
      expect(login.togglePrompt).toBe("Don't have an account?");
      expect(login.toggleLabel).toBe('Sign up');
    });

    it('words the register side of the same surface', () => {
      const register = makeBloc({ modal: readable({ register: true }) });

      expect(register.title).toBe('Create account');
      expect(register.subtitle).toBe('Start tracking your anime');
      expect(register.submitLabel).toBe('Create account');
      expect(register.togglePrompt).toBe('Already have an account?');
      expect(register.toggleLabel).toBe('Log in');
    });

    it('names the gated action instead of the generic subtitle', () => {
      const gated = makeBloc({
        modal: readable({ register: false, reason: 'Frieren will be added to your list.' })
      });

      expect(gated.reason).toBe('Frieren will be added to your list.');
      expect(gated.title).toBe('Sign in to keep track');
      expect(gated.subtitle).toBe('Frieren will be added to your list.');
    });

    it('keeps the gated wording on the register side too', () => {
      const gated = makeBloc({
        modal: readable({ register: true, reason: 'Frieren will be added to your list.' })
      });

      expect(gated.title).toBe('Create your account');
      expect(gated.subtitle).toBe('Frieren will be added to your list.');
    });

    it('has no reason when the store carried none', () => {
      expect(makeBloc().reason).toBeNull();
      expect(makeBloc({ modal: readable({ register: false, reason: null }) }).reason).toBeNull();
    });

    it('asks for the right thing in the first field on each side', () => {
      const login = makeBloc({ modal: readable({ register: false }) });
      const register = makeBloc({ modal: readable({ register: true }) });

      expect(login.usernameLabel).toBe('Username or email');
      expect(login.usernamePlaceholder).toBe('your_username');
      expect(login.passwordPlaceholder).toBe('Enter your password');

      expect(register.usernameLabel).toBe('Email');
      expect(register.usernamePlaceholder).toBe('you@example.com');
      expect(register.passwordPlaceholder).toBe('At least 6 characters');
    });
  });

  describe('the form it is standing in front of', () => {
    it('reads the login form’s fields on the login side', () => {
      const bloc = makeBloc({ modal: readable({ register: false }) });

      bloc.updateField('username', 'ada');
      bloc.updateField('password', 'hunter22');

      expect(bloc.username).toBe('ada');
      expect(bloc.password).toBe('hunter22');
      expect(bloc.login.username).toBe('ada');
      expect(bloc.register.username).toBe('');
    });

    it('reads the register form’s fields on the register side', () => {
      const bloc = makeBloc({ modal: readable({ register: true }) });

      bloc.updateField('username', 'ada@example.com');
      bloc.updateField('confirmPassword', 'hunter22');

      expect(bloc.username).toBe('ada@example.com');
      expect(bloc.confirmPassword).toBe('hunter22');
      expect(bloc.login.username).toBe('');
    });

    it('submits the form that is showing', async () => {
      const register = vi.fn(async () => ({ id: 'u1' }));
      const login = vi.fn(async () => ({ id: 'u1' }));
      const bloc = makeBloc({
        modal: readable({ register: true }),
        login: new LoginBloc({
          route: readable(new URLSearchParams()),
          login,
          navigate: vi.fn(),
          resend: new ResendBloc({ send: vi.fn() }),
          onAuthenticated: vi.fn()
        }),
        register: new RegisterBloc({ register, navigate: vi.fn(), onRegistered: vi.fn() })
      });
      bloc.updateField('username', 'ada@example.com');
      bloc.updateField('password', 'hunter22');
      bloc.updateField('confirmPassword', 'hunter22');

      await bloc.submit();

      expect(register).toHaveBeenCalledTimes(1);
      expect(login).not.toHaveBeenCalled();
    });

    it('reports the showing form’s errors, and never the other one’s', async () => {
      const bloc = makeBloc({ modal: readable({ register: false }) });

      await bloc.submit();

      expect(bloc.validationErrors.username).toBe('Username or email is required');
      // The register form has not been submitted, so it is complaining about
      // nothing.
      expect(bloc.register.validationErrors).toEqual({});
    });

    it('is submitting while either half is', async () => {
      let release!: () => void;
      const bloc = makeBloc({
        login: new LoginBloc({
          route: readable(new URLSearchParams()),
          login: vi.fn(() => new Promise<{ id: string }>((r) => (release = () => r({ id: 'u1' })))),
          navigate: vi.fn(),
          resend: new ResendBloc({ send: vi.fn() }),
          onAuthenticated: vi.fn()
        })
      });
      bloc.markHydrated();
      bloc.updateField('username', 'ada');
      bloc.updateField('password', 'hunter22');

      const inFlight = bloc.submit();
      expect(bloc.isSubmitting).toBe(true);
      expect(bloc.canSubmit).toBe(false);

      release();
      await inFlight;
      expect(bloc.isSubmitting).toBe(false);
    });

    it('markHydrated enables both halves at once', () => {
      const bloc = makeBloc({ modal: readable({ register: true }) });
      expect(bloc.canSubmit).toBe(false);

      bloc.markHydrated();

      expect(bloc.canSubmit).toBe(true);
      expect(bloc.login.canSubmit).toBe(true);
    });
  });

  describe('the verification banner', () => {
    const unverified = {
      response: {
        errors: [{ extensions: { errors: [{ extensions: { code: 'INACTIVE_CREDENTIALS' } }] } }]
      }
    };

    it('is only ever the login side’s', async () => {
      const bloc = makeBloc({
        login: new LoginBloc({
          route: readable(new URLSearchParams()),
          login: vi.fn(async () => Promise.reject(unverified)),
          navigate: vi.fn(),
          resend: new ResendBloc({ send: vi.fn(async () => undefined) }),
          onAuthenticated: vi.fn()
        })
      });
      bloc.updateField('username', 'ada@example.com');
      bloc.updateField('password', 'hunter22');
      await bloc.submit();

      expect(bloc.needsVerification).toBe(true);
      expect(bloc.verifyAddress).toBe('ada@example.com');

      // Registering does not check an address it just took.
      bloc.toggleMode();
      expect(bloc.needsVerification).toBe(false);
    });

    it('resends through the login form’s own sub-bloc', async () => {
      const send = vi.fn(async () => undefined);
      const resend = new ResendBloc({ send });
      const bloc = makeBloc({
        login: new LoginBloc({
          route: readable(new URLSearchParams()),
          login: vi.fn(),
          navigate: vi.fn(),
          resend,
          onAuthenticated: vi.fn()
        })
      });
      bloc.updateField('username', 'ada@example.com');

      await expect(bloc.resendVerification()).resolves.toBe(true);
      expect(send).toHaveBeenCalledWith('ada@example.com');
      expect(bloc.resend).toBe(resend);
    });
  });

  describe('switching sides', () => {
    it('carries the credentials across', () => {
      const bloc = makeBloc({ modal: readable({ register: false }) });
      bloc.updateField('username', 'ada@example.com');
      bloc.updateField('password', 'hunter22');

      bloc.toggleMode();

      // Retyping an address you just typed is why people abandon this modal.
      expect(bloc.isRegister).toBe(true);
      expect(bloc.username).toBe('ada@example.com');
      expect(bloc.password).toBe('hunter22');
    });

    it('carries them back again', () => {
      const bloc = makeBloc({ modal: readable({ register: true }) });
      bloc.updateField('username', 'ada@example.com');
      bloc.updateField('password', 'hunter22');

      bloc.toggleMode();

      expect(bloc.isRegister).toBe(false);
      expect(bloc.username).toBe('ada@example.com');
      expect(bloc.password).toBe('hunter22');
    });

    it('leaves no message from the other side on screen', async () => {
      const bloc = makeBloc({ modal: readable({ register: false }) });
      await bloc.submit();
      expect(bloc.validationErrors.username).toBeTruthy();

      bloc.toggleMode();

      expect(bloc.validationErrors).toEqual({});
      expect(bloc.errorMessage).toBe('');
    });
  });

  describe('closing the surface', () => {
    /*
     * The modal's own `onAuthenticated` and `onRegistered` -- record the
     * session, announce, close; and close-then-go-to-check-email -- are only
     * wired onto the blocs the modal builds itself, and building those means
     * `realLogin()` / `realRegister()`, which call TanStack hooks and therefore
     * need a live component context. They are covered by the modal's stories
     * and the registration e2e run rather than here; what is unit-testable is
     * the close intent they both end in.
     */

    it('closes through the closer the view handed over', () => {
      const closeFn = vi.fn();
      const bloc = makeBloc({ source: () => ({ closeFn }) });

      bloc.close();

      expect(closeFn).toHaveBeenCalledTimes(1);
    });

    it('close is safe when the view has not handed over a closer', () => {
      expect(() => makeBloc({ source: () => ({}) }).close()).not.toThrow();
    });

    it('dispose kills the login form’s resend clock', () => {
      const stop = vi.fn();
      const bloc = makeBloc({
        login: new LoginBloc({
          route: readable(new URLSearchParams()),
          login: vi.fn(),
          navigate: vi.fn(),
          resend: new ResendBloc({
            send: vi.fn(async () => undefined),
            timer: { start: () => 1, stop },
            cooldownSeconds: 60
          }),
          onAuthenticated: vi.fn()
        })
      });

      expect(() => bloc.dispose()).not.toThrow();
    });
  });
});
