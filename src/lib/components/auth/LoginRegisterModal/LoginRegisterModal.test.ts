import { describe, it, expect, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/svelte';
import userEvent from '@testing-library/user-event';
import { readable, writable } from 'svelte/store';
import LoginRegisterModal from './LoginRegisterModal.svelte';
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

/**
 * The modal's markup.
 *
 * Which mode is showing, what each mode's copy is, and what a submit does are
 * the bloc's and are asserted above. What is asserted here is the surface: that
 * both modes render the fields they claim to, that switching modes carries the
 * credentials across the DOM rather than only across the bloc, that a field
 * error lands on its own field, and that the banners and the submit's busy
 * state actually appear.
 *
 * It is deliberately tested standalone. This component is content only -- the
 * dialog, the portal, the focus trap and Escape all belong to `Modal`, which
 * wraps it at the call site and has its own suite. Rendering the pair here would
 * only re-assert `Modal.test.ts`.
 *
 * jsdom caveat: no stylesheet is loaded, so the submit's `loading` state and the
 * amber-vs-red distinction between the two banners are assertable only as the
 * class and the ARIA role each carries, never as an appearance.
 */
describe('LoginRegisterModal', () => {
  const NEVER = () => new Promise<never>(() => {});

  function setup(
    options: {
      register?: boolean;
      reason?: string | null;
      login?: (input: { username: string; password: string }) => Promise<{ id: string }>;
      registerFn?: (input: { username: string; password: string }) => Promise<{ id: string }>;
      resend?: (username: string) => Promise<unknown>;
      closeFn?: () => void;
    } = {}
  ) {
    const closeFn = options.closeFn ?? vi.fn();
    const navigate = vi.fn();
    const announce = vi.fn();
    const setLoggedIn = vi.fn();
    const send = vi.fn(options.resend ?? (async () => undefined));
    const bloc = new LoginRegisterModalBloc({
      source: () => ({ closeFn }),
      modal: readable({ register: options.register ?? false, reason: options.reason ?? null }),
      login: new LoginBloc({
        route: readable(new URLSearchParams()),
        login: vi.fn(options.login ?? (async () => ({ id: 'u1' }))),
        navigate,
        resend: new ResendBloc({ send }),
        onAuthenticated: (result) => {
          setLoggedIn(result);
          announce();
          bloc.close();
        }
      }),
      register: new RegisterBloc({
        register: vi.fn(options.registerFn ?? (async () => ({ id: 'u1' }))),
        navigate,
        usernameLabel: 'Username',
        onRegistered: (email) => {
          bloc.close();
          return navigate(`/auth/check-email?email=${encodeURIComponent(email)}`);
        }
      }),
      session: { setLoggedIn },
      announce,
      navigate
    });

    const result = render(LoginRegisterModal, { props: { bloc } });
    return { ...result, bloc, closeFn, navigate, announce, setLoggedIn, send };
  }

  const submit = (name: string) => screen.getByRole('button', { name });

  describe('signing in', () => {
    it('opens on the login form: two fields, the remember box and the reset link', () => {
      setup();

      expect(screen.getByRole('heading', { name: 'Welcome back' })).toBeInTheDocument();
      expect(screen.getByText('Sign in to your account')).toBeInTheDocument();
      expect(screen.getByLabelText('Username or email')).toBeInTheDocument();
      expect(screen.getByLabelText('Password')).toBeInTheDocument();
      expect(screen.getByLabelText('Remember me')).toBeInTheDocument();
      expect(screen.getByRole('link', { name: 'Forgot password?' })).toHaveAttribute(
        'href',
        '/auth/password-reset-request'
      );
      expect(submit('Log in')).toHaveAttribute('type', 'submit');
    });

    it('has no confirm-password field -- that belongs to registering', () => {
      setup();

      expect(screen.queryByLabelText('Confirm password')).not.toBeInTheDocument();
    });

    it('offers the way over to registering', () => {
      setup();

      expect(screen.getByText("Don't have an account?")).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Sign up' })).toBeInTheDocument();
    });

    it('signs in with what was typed, and closes over whatever the visitor was doing', async () => {
      const login = vi.fn(async () => ({ id: 'u1' }));
      const { closeFn, announce, setLoggedIn } = setup({ login });

      await userEvent.type(screen.getByLabelText('Username or email'), 'ada');
      await userEvent.type(screen.getByLabelText('Password'), 'hunter22');
      await userEvent.click(submit('Log in'));

      await waitFor(() =>
        expect(login).toHaveBeenCalledWith({ username: 'ada', password: 'hunter22' })
      );
      expect(setLoggedIn).toHaveBeenCalledWith({ id: 'u1' });
      expect(announce).toHaveBeenCalled();
      expect(closeFn).toHaveBeenCalled();
    });
  });

  describe('registering', () => {
    it('opens on the register form when the modal was opened for it', () => {
      setup({ register: true });

      expect(screen.getByRole('heading', { name: 'Create account' })).toBeInTheDocument();
      expect(screen.getByText('Start tracking your anime')).toBeInTheDocument();
      // The modal asks for an "Email" here and "Username or email" on the login
      // side; the *validation* copy says "Username", which is the register
      // bloc's own label. Both are asserted, because they differ on purpose.
      expect(screen.getByLabelText('Email')).toBeInTheDocument();
      expect(screen.getByLabelText('Confirm password')).toBeInTheDocument();
      expect(submit('Create account')).toBeInTheDocument();
    });

    it('drops the remember box and the reset link, which mean nothing here', () => {
      setup({ register: true });

      expect(screen.queryByLabelText('Remember me')).not.toBeInTheDocument();
      expect(screen.queryByRole('link', { name: 'Forgot password?' })).not.toBeInTheDocument();
    });

    it('leaves the modal for the check-email screen on success', async () => {
      const { closeFn, navigate } = setup({ register: true });

      await userEvent.type(screen.getByLabelText('Email'), 'ada@example.com');
      await userEvent.type(screen.getByLabelText('Password'), 'hunter22');
      await userEvent.type(screen.getByLabelText('Confirm password'), 'hunter22');
      await userEvent.click(submit('Create account'));

      await waitFor(() =>
        expect(navigate).toHaveBeenCalledWith('/auth/check-email?email=ada%40example.com')
      );
      expect(closeFn).toHaveBeenCalled();
    });
  });

  describe('the gated-action opening', () => {
    it('says which action was gated instead of the generic subtitle', () => {
      setup({ reason: 'Sign in to add this to your list' });

      expect(screen.getByRole('heading', { name: 'Sign in to keep track' })).toBeInTheDocument();
      expect(screen.getByText('Sign in to add this to your list')).toBeInTheDocument();
      expect(screen.queryByText('Sign in to your account')).not.toBeInTheDocument();
    });
  });

  /**
   * REGRESSION. Retyping an address you just typed because you picked the wrong
   * form is the reason people abandon this modal, so the toggle carries the
   * credentials over. Asserted through the rendered inputs, not the bloc: the
   * fields are re-created by the `{#if}`, so a bloc that carries the values and
   * a view that does not re-read them would still be broken.
   */
  describe('switching between the two', () => {
    it('carries what was typed from login over to register', async () => {
      setup();
      await userEvent.type(screen.getByLabelText('Username or email'), 'ada@example.com');
      await userEvent.type(screen.getByLabelText('Password'), 'hunter22');

      await userEvent.click(screen.getByRole('button', { name: 'Sign up' }));

      const username = (await screen.findByLabelText('Email')) as HTMLInputElement;
      expect(username.value).toBe('ada@example.com');
      expect((screen.getByLabelText('Password') as HTMLInputElement).value).toBe('hunter22');
      // The second field is new, and empty: it was never typed.
      expect((screen.getByLabelText('Confirm password') as HTMLInputElement).value).toBe('');
    });

    it('carries them back again', async () => {
      setup({ register: true });
      await userEvent.type(screen.getByLabelText('Email'), 'ada@example.com');
      await userEvent.type(screen.getByLabelText('Password'), 'hunter22');

      await userEvent.click(screen.getByRole('button', { name: 'Log in' }));

      const username = (await screen.findByLabelText('Username or email')) as HTMLInputElement;
      expect(username.value).toBe('ada@example.com');
      expect((screen.getByLabelText('Password') as HTMLInputElement).value).toBe('hunter22');
    });

    it('swaps the whole surface, not just the button', async () => {
      setup();

      await userEvent.click(screen.getByRole('button', { name: 'Sign up' }));

      expect(await screen.findByRole('heading', { name: 'Create account' })).toBeInTheDocument();
      expect(screen.getByText('Already have an account?')).toBeInTheDocument();
      expect(screen.queryByLabelText('Remember me')).not.toBeInTheDocument();
    });

    it('clears a failure that described the form you just left', async () => {
      setup({ login: async () => Promise.reject(new Error('nope')) });
      await userEvent.type(screen.getByLabelText('Username or email'), 'ada');
      await userEvent.type(screen.getByLabelText('Password'), 'hunter22');
      await userEvent.click(submit('Log in'));
      await screen.findByRole('alert');

      await userEvent.click(screen.getByRole('button', { name: 'Sign up' }));

      await waitFor(() => expect(screen.queryByRole('alert')).not.toBeInTheDocument());
    });
  });

  describe('validation', () => {
    it('puts each complaint on its own field rather than in one banner', async () => {
      setup();

      await userEvent.click(submit('Log in'));

      expect(await screen.findByText('Username or email is required')).toBeInTheDocument();
      expect(screen.getByText('Password is required')).toBeInTheDocument();
      // A field error is not a failure banner.
      expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    });

    it('points the field at its own message for a screen reader', async () => {
      setup();

      await userEvent.click(submit('Log in'));

      const field = await screen.findByLabelText('Username or email');
      const described = field.getAttribute('aria-describedby');
      expect(described).toBe('modal-username-error');
      expect(document.getElementById(described!)).toHaveTextContent(
        'Username or email is required'
      );
    });

    it('names the register form’s own first field in its message', async () => {
      setup({ register: true });

      await userEvent.click(submit('Create account'));

      expect(await screen.findByText('Username is required')).toBeInTheDocument();
      expect(screen.getByText('Please confirm your password')).toBeInTheDocument();
    });

    it('catches a mismatched confirmation', async () => {
      setup({ register: true });

      await userEvent.type(screen.getByLabelText('Email'), 'ada@example.com');
      await userEvent.type(screen.getByLabelText('Password'), 'hunter22');
      await userEvent.type(screen.getByLabelText('Confirm password'), 'hunter23');
      await userEvent.click(submit('Create account'));

      expect(await screen.findByText('Passwords do not match')).toBeInTheDocument();
    });

    it('clears a field’s complaint as soon as it is corrected', async () => {
      setup();
      await userEvent.click(submit('Log in'));
      await screen.findByText('Username or email is required');

      await userEvent.type(screen.getByLabelText('Username or email'), 'a');

      await waitFor(() =>
        expect(screen.queryByText('Username or email is required')).not.toBeInTheDocument()
      );
    });

    it('never reaches the server for a form it already knows is wrong', async () => {
      const login = vi.fn(async () => ({ id: 'u1' }));
      setup({ login });

      await userEvent.click(submit('Log in'));
      await screen.findByText('Password is required');

      expect(login).not.toHaveBeenCalled();
    });
  });

  describe('the failure banner', () => {
    it('says the sign-in failed, as an assertive alert', async () => {
      setup({ login: async () => Promise.reject(new Error('nope')) });

      await userEvent.type(screen.getByLabelText('Username or email'), 'ada');
      await userEvent.type(screen.getByLabelText('Password'), 'hunter22');
      await userEvent.click(submit('Log in'));

      const alert = await screen.findByRole('alert');
      expect(alert).toHaveTextContent(
        'Unable to sign in. Please check your credentials and try again.'
      );
    });

    it('names the cause of a failed registration rather than saying "try again"', async () => {
      setup({
        register: true,
        registerFn: async () => Promise.reject(new Error('user already exists'))
      });

      await userEvent.type(screen.getByLabelText('Email'), 'ada@example.com');
      await userEvent.type(screen.getByLabelText('Password'), 'hunter22');
      await userEvent.type(screen.getByLabelText('Confirm password'), 'hunter22');
      await userEvent.click(submit('Create account'));

      expect(await screen.findByRole('alert')).toHaveTextContent(
        'An account with this email already exists.'
      );
    });
  });

  /**
   * An unverified account is not a failed sign-in: the credentials were right,
   * there is a step left. So it is a `warning` banner, which `ErrorBanner`
   * renders as `role="alert"` too but on the amber recipe -- and it carries the
   * resend action, addressed to the address already typed.
   */
  describe('the unverified-account banner', () => {
    const unverified = () =>
      Promise.reject(Object.assign(new Error('INACTIVE_CREDENTIALS'), {}));

    async function signInUnverified(over: Parameters<typeof setup>[0] = {}) {
      const harness = setup({ login: () => unverified() as Promise<{ id: string }>, ...over });
      await userEvent.type(screen.getByLabelText('Username or email'), 'ada@example.com');
      await userEvent.type(screen.getByLabelText('Password'), 'hunter22');
      await userEvent.click(submit('Log in'));
      await screen.findByText('Verify your email to continue');
      return harness;
    }

    it('replaces the generic failure with the verification step, naming the address', async () => {
      await signInUnverified();

      expect(screen.getByText('ada@example.com')).toBeInTheDocument();
      expect(
        screen.queryByText('Unable to sign in. Please check your credentials and try again.')
      ).not.toBeInTheDocument();
    });

    it('resends to that address without leaving the form', async () => {
      const { send } = await signInUnverified();

      await userEvent.click(screen.getByRole('button', { name: 'Send a new link' }));

      await waitFor(() => expect(send).toHaveBeenCalledWith('ada@example.com'));
      expect(await screen.findByText(/check your inbox/)).toBeInTheDocument();
    });

    it('says so, rather than staying silent, when the resend itself fails', async () => {
      await signInUnverified({ resend: async () => Promise.reject(new Error('smtp down')) });

      await userEvent.click(screen.getByRole('button', { name: 'Send a new link' }));

      expect(await screen.findByText(/couldn't send that just now/i)).toBeInTheDocument();
    });

    /** Editing the address invalidates the banner it was addressed to. */
    it('drops the banner once the address is edited', async () => {
      await signInUnverified();

      await userEvent.type(screen.getByLabelText('Username or email'), 'x');

      await waitFor(() =>
        expect(screen.queryByText('Verify your email to continue')).not.toBeInTheDocument()
      );
    });
  });

  describe('while the form is in flight', () => {
    it('holds the submit shut and marks it busy', async () => {
      setup({ login: NEVER as () => Promise<{ id: string }> });

      await userEvent.type(screen.getByLabelText('Username or email'), 'ada');
      await userEvent.type(screen.getByLabelText('Password'), 'hunter22');
      await userEvent.click(submit('Log in'));

      await waitFor(() => expect(submit('Log in')).toBeDisabled());
      expect(submit('Log in')).toHaveClass('loading');
      // The spinner is decoration beside the label, not a replacement for it.
      expect(submit('Log in')).toHaveTextContent('Log in');
      expect(submit('Log in').querySelector('.spinner')).toHaveAttribute('aria-hidden', 'true');
    });

    it('is not busy before anything has been submitted', () => {
      setup();

      expect(submit('Log in')).toBeEnabled();
      expect(submit('Log in')).not.toHaveClass('loading');
    });
  });

  describe('dismissal', () => {
    /**
     * The modal has no close button of its own -- that is `Modal`'s. The one
     * dismissal this surface owns is the reset link, which navigates to a page
     * and so must take the modal down with it.
     */
    it('closes itself when the visitor leaves for the password reset page', async () => {
      const { closeFn } = setup();

      await userEvent.click(screen.getByRole('link', { name: 'Forgot password?' }));

      expect(closeFn).toHaveBeenCalledTimes(1);
    });

    it('draws no dialog chrome of its own', () => {
      setup();

      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
      expect(screen.queryByRole('button', { name: 'Close modal' })).not.toBeInTheDocument();
    });
  });
});
