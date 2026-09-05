import type { Meta, StoryObj } from '@storybook/svelte';
import { readable } from 'svelte/store';
import LoginRegisterModal from '../LoginRegisterModal.svelte';
import { LoginRegisterModalBloc } from '../LoginRegisterModal.bloc.svelte';
import { LoginBloc } from '../Login.bloc.svelte';
import { RegisterBloc } from '../Register.bloc.svelte';
import { ResendBloc } from '../auth-resend.svelte';
import type { LoginPort, RegisterPort } from '../auth-shared';
import {
  failsWith,
  frozenClock,
  pending,
  resendPort,
  routeWith,
  type ResendStoryState
} from './auth-stubs';

function modalBloc(options: {
  register?: boolean;
  reason?: string;
  loginPort?: LoginPort;
  registerPort?: RegisterPort;
  resend?: ResendStoryState;
  submit?: 'empty' | 'filled';
} = {}) {
  const bloc = new LoginRegisterModalBloc({
    source: () => ({ closeFn: () => {} }),
    modal: readable({ register: options.register ?? false, reason: options.reason ?? null }),
    session: { setLoggedIn: () => {} },
    announce: () => {},
    navigate: () => {},
    login: new LoginBloc({
      route: routeWith(),
      login: options.loginPort ?? (async () => ({ id: 'user-1' })),
      navigate: () => {},
      resend: new ResendBloc({ send: resendPort(options.resend ?? 'idle'), timer: frozenClock }),
      onAuthenticated: () => {}
    }),
    register: new RegisterBloc({
      register: options.registerPort ?? (async () => ({ id: 'user-1' })),
      usernameLabel: 'Username',
      onRegistered: () => {}
    })
  });

  if (options.submit === 'filled') {
    bloc.updateField('username', 'kaori@example.com');
    bloc.updateField('password', 'hunter22');
    bloc.updateField('confirmPassword', 'hunter22');
  }
  if (options.submit) void bloc.submit();
  if (options.resend && options.resend !== 'idle') void bloc.resendVerification();

  return bloc;
}

const meta = {
  title: 'Design System/LoginRegisterModal',
  component: LoginRegisterModal,
  tags: ['autodocs'],
  parameters: { layout: 'centered' }
} satisfies Meta<typeof LoginRegisterModal>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Opened deliberately, in login mode. */
export const SignIn: Story = {
  args: { bloc: modalBloc() }
};

/** Opened deliberately, in register mode: a third field, and no "remember me". */
export const SignUp: Story = {
  args: { bloc: modalBloc({ register: true }) }
};

/**
 * Opened in front of a gated action. The heading and subtitle name the action
 * rather than greeting someone who never asked to sign in.
 */
export const GatedByAnAction: Story = {
  args: { bloc: modalBloc({ reason: 'Sign in to add this to your list' }) }
};

/** Submitted empty -- the same field rules the pages use, not a third copy. */
export const ValidationErrors: Story = {
  args: { bloc: modalBloc({ submit: 'empty' }) }
};

/** In flight. */
export const Submitting: Story = {
  args: { bloc: modalBloc({ loginPort: pending, submit: 'filled' }) }
};

/** Bad password: the credential error, in the modal's own alert spacing. */
export const ServerError: Story = {
  args: { bloc: modalBloc({ loginPort: failsWith('INVALID_CREDENTIALS'), submit: 'filled' }) }
};

/**
 * Registration failures now name the cause here too. This modal used to say
 * "Unable to create account. Please try again." for every one of them.
 */
export const RegisterServerError: Story = {
  args: {
    bloc: modalBloc({
      register: true,
      registerPort: failsWith('user already exists'),
      submit: 'filled'
    })
  }
};

/** The unverified-account banner, identical in wording to the login page's. */
export const NeedsVerification: Story = {
  args: { bloc: modalBloc({ loginPort: failsWith('INACTIVE_CREDENTIALS'), submit: 'filled' }) }
};

/** And after the resend lands. */
export const VerificationResent: Story = {
  args: {
    bloc: modalBloc({
      loginPort: failsWith('INACTIVE_CREDENTIALS'),
      submit: 'filled',
      resend: 'sent'
    })
  }
};
