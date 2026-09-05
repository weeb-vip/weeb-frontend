import type { Meta, StoryObj } from '@storybook/svelte';
import ResendVerification from '../ResendVerification.svelte';
import { ResendVerificationBloc } from '../ResendVerification.bloc.svelte';
import { ResendBloc } from '../auth-resend.svelte';
import type { ResendVerificationPort } from '../auth-shared';
import { failsWith, frozenClock, pending } from './auth-stubs';

function resendBloc(options: { send?: ResendVerificationPort; typed?: string; submit?: boolean } = {}) {
  const bloc = new ResendVerificationBloc({
    resend: new ResendBloc({ send: options.send ?? (async () => true), timer: frozenClock })
  });

  if (options.typed !== undefined) bloc.updateField('username', options.typed);
  if (options.submit) void bloc.submit();

  return bloc;
}

const meta = {
  title: 'Design System/ResendVerification',
  component: ResendVerification,
  tags: ['autodocs'],
  parameters: { layout: 'fullscreen' }
} satisfies Meta<typeof ResendVerification>;

export default meta;
type Story = StoryObj<typeof meta>;

/** The standalone page: one field, for anyone who arrives with no link in hand. */
export const Idle: Story = {
  args: { bloc: resendBloc() }
};

/** Submitted empty. */
export const MissingEmail: Story = {
  args: { bloc: resendBloc({ submit: true }) }
};

/** Caught before the round trip: this isn't an address. */
export const InvalidEmail: Story = {
  args: { bloc: resendBloc({ typed: 'kaori@', submit: true }) }
};

/** In flight. */
export const Submitting: Story = {
  args: { bloc: resendBloc({ send: pending, typed: 'kaori@example.com', submit: true }) }
};

/** Sent: green, and the field clears so a second send is a deliberate retype. */
export const Sent: Story = {
  args: { bloc: resendBloc({ typed: 'kaori@example.com', submit: true }) }
};

/** No such account -- named, rather than a generic "something went wrong". */
export const UnknownAccount: Story = {
  args: {
    bloc: resendBloc({ send: failsWith('User not found'), typed: 'kaori@example.com', submit: true })
  }
};

/** Nothing to resend: this address is already verified, so it points at login. */
export const AlreadyVerified: Story = {
  args: {
    bloc: resendBloc({
      send: failsWith('email already verified'),
      typed: 'kaori@example.com',
      submit: true
    })
  }
};
