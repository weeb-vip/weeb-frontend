import type { Meta, StoryObj } from '@storybook/svelte';
import Login from '../Login.svelte';
import { LoginBloc } from '../Login.bloc.svelte';
import { ResendBloc } from '../auth-resend.svelte';
import type { LoginPort } from '../auth-shared';
import {
  failsWith,
  frozenClock,
  pending,
  resendPort,
  routeWith,
  type ResendStoryState
} from './auth-stubs';

const CREDENTIALS = { username: 'kaori@example.com', password: 'hunter22' };

function loginBloc(options: {
  login?: LoginPort;
  query?: string;
  resend?: ResendStoryState;
  /** Fills the fields and submits, so the story opens on the resulting frame. */
  submit?: 'empty' | 'filled';
} = {}) {
  const bloc = new LoginBloc({
    route: routeWith(options.query),
    login: options.login ?? (async () => ({ id: 'user-1' })),
    navigate: () => {},
    resend: new ResendBloc({ send: resendPort(options.resend ?? 'idle'), timer: frozenClock })
  });

  if (options.submit === 'filled') {
    bloc.updateField('username', CREDENTIALS.username);
    bloc.updateField('password', CREDENTIALS.password);
  }
  if (options.submit) void bloc.submit();

  // After the submit, which clears any banner the resend belongs to.
  if (options.resend && options.resend !== 'idle') void bloc.resendVerification();

  return bloc;
}

const meta = {
  title: 'Composites/Auth/Login',
  component: Login,
  tags: ['autodocs'],
  parameters: { layout: 'fullscreen' }
} satisfies Meta<typeof Login>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Empty and waiting, which is what almost everyone sees. */
export const Idle: Story = {
  args: { bloc: loginBloc() }
};

/** Arrived from the verification screen: the address is already in the field. */
export const PrefilledFromVerification: Story = {
  args: { bloc: loginBloc({ query: 'email=kaori@example.com' }) }
};

/** Submitted empty -- both fields say what is missing, in place. */
export const ValidationErrors: Story = {
  args: { bloc: loginBloc({ submit: 'empty' }) }
};

/** The request is in flight: the label goes, the spinner stays, the button locks. */
export const Submitting: Story = {
  args: { bloc: loginBloc({ login: pending, submit: 'filled' }) }
};

/** Wrong password on a verified account: red, and it names the credentials. */
export const ServerError: Story = {
  args: { bloc: loginBloc({ login: failsWith('INVALID_CREDENTIALS'), submit: 'filled' }) }
};

/**
 * The account exists but was never verified. Amber, not red: the password was
 * right, and the recovery is one tap on the address already typed in.
 */
export const NeedsVerification: Story = {
  args: { bloc: loginBloc({ login: failsWith('INACTIVE_CREDENTIALS'), submit: 'filled' }) }
};

/** After that tap: the button is replaced by the confirmation, not stacked over it. */
export const VerificationResent: Story = {
  args: {
    bloc: loginBloc({ login: failsWith('INACTIVE_CREDENTIALS'), submit: 'filled', resend: 'sent' })
  }
};

/** The resend itself failed -- the banner keeps its shape and says so. */
export const VerificationResendFailed: Story = {
  args: {
    bloc: loginBloc({ login: failsWith('INACTIVE_CREDENTIALS'), submit: 'filled', resend: 'failed' })
  }
};
