import type { Meta, StoryObj } from '@storybook/svelte';
import PasswordResetRequest from '../../../routes/auth/password-reset-request/+page.svelte';
import { PasswordResetRequestBloc } from '../PasswordResetRequest.bloc.svelte';
import type { PasswordResetRequestPort } from '../auth-shared';
import { failsWith, pending } from './auth-stubs';

function resetBloc(options: { request?: PasswordResetRequestPort; fill?: boolean; submit?: boolean } = {}) {
  const bloc = new PasswordResetRequestBloc({
    request: options.request ?? (async () => true)
  });

  if (options.fill) {
    bloc.updateField('username', 'kaori');
    bloc.updateField('email', 'kaori@example.com');
  }
  if (options.submit) void bloc.submit();

  return bloc;
}

const meta = {
  title: 'Pages/PasswordResetRequest',
  component: PasswordResetRequest,
  tags: ['autodocs'],
  parameters: { layout: 'fullscreen' }
} satisfies Meta<typeof PasswordResetRequest>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Both fields empty: the reset needs the username as well as the address. */
export const Idle: Story = {
  args: { bloc: resetBloc() }
};

/** Submitted with a field missing. */
export const ValidationError: Story = {
  args: { bloc: resetBloc({ submit: true }) }
};

/** In flight: the whole fieldset goes inert, not just the button. */
export const Submitting: Story = {
  args: { bloc: resetBloc({ request: pending, fill: true, submit: true }) }
};

/** Sent. The screen becomes a confirmation -- a reset email can't be un-sent. */
export const Sent: Story = {
  args: { bloc: resetBloc({ fill: true, submit: true }) }
};

/** The request failed, and the form unlocks so it can be tried again. */
export const ServerError: Story = {
  args: {
    bloc: resetBloc({ request: failsWith('auth service unavailable'), fill: true, submit: true })
  }
};
