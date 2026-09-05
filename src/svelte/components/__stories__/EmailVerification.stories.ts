import type { Meta, StoryObj } from '@storybook/svelte';
import EmailVerification from '../EmailVerification.svelte';
import { EmailVerificationBloc } from '../EmailVerification.bloc.svelte';
import type { VerifyEmailPort } from '../auth-shared';
import { failsWith, frozenClock, pending, resendIn, routeWith, type ResendStoryState } from './auth-stubs';

const LINK = 'email=kaori%40example.com&token=eyJhbGciOi';

function verificationBloc(query: string, verify: VerifyEmailPort, resend: ResendStoryState = 'idle') {
  return new EmailVerificationBloc({
    route: routeWith(query),
    verify,
    navigate: () => {},
    // Frozen: the redirect countdown holds at 3 instead of bouncing the canvas.
    timer: frozenClock,
    resend: resendIn(resend)
  });
}

const meta = {
  title: 'Design System/EmailVerification',
  component: EmailVerification,
  tags: ['autodocs'],
  parameters: { layout: 'fullscreen' }
} satisfies Meta<typeof EmailVerification>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Redeeming the token: the only state the user should ever see for long. */
export const Verifying: Story = {
  args: { bloc: verificationBloc(LINK, pending) }
};

/** Verified, with the bounce to login counting down under the button. */
export const Verified: Story = {
  args: { bloc: verificationBloc(LINK, async () => ({ success: true, userID: 'user-1' })) }
};

/**
 * Expired, malformed, or signed by an unknown key -- the gateway returns the
 * same thing for all three, so there is one honest failure state.
 */
export const LinkDidNotWork: Story = {
  args: { bloc: verificationBloc(LINK, failsWith('Access denied')) }
};

/** The subtler failure: the call resolved, but it verified nothing. */
export const VerificationUnsuccessful: Story = {
  args: { bloc: verificationBloc(LINK, async () => ({ success: false, userID: null })) }
};

/** A fresh link, sent to the address that was already in the URL. */
export const NewLinkSent: Story = {
  args: { bloc: verificationBloc(LINK, failsWith('Access denied'), 'sent') }
};

/** The resend failed too -- the recovery routes below it still stand. */
export const ResendFailed: Story = {
  args: { bloc: verificationBloc(LINK, failsWith('Access denied'), 'failed') }
};

/**
 * Email clients cut long links in half. With no token there is nothing to
 * verify, so this doesn't pretend the server rejected anything.
 */
export const IncompleteLink: Story = {
  args: { bloc: verificationBloc('email=kaori%40example.com', pending) }
};
