import type { Meta, StoryObj } from '@storybook/svelte';
import CheckEmail from '../CheckEmail.svelte';
import { CheckEmailBloc } from '../CheckEmail.bloc.svelte';
import { resendIn, routeWith, type ResendStoryState } from './auth-stubs';

function checkEmailBloc(query: string, resend: ResendStoryState = 'idle') {
  return new CheckEmailBloc({ route: routeWith(query), resend: resendIn(resend) });
}

const meta = {
  title: 'Design System/CheckEmail',
  component: CheckEmail,
  tags: ['autodocs'],
  parameters: { layout: 'fullscreen' }
} satisfies Meta<typeof CheckEmail>;

export default meta;
type Story = StoryObj<typeof meta>;

/** The usual arrival: a recognised domain, so the primary action opens it. */
export const Gmail: Story = {
  args: { bloc: checkEmailBloc('email=kaori@gmail.com') }
};

/** An unrecognised domain -- a wrong guess is worse than no button, so it links to login. */
export const UnknownProvider: Story = {
  args: { bloc: checkEmailBloc('email=kaori@shibuya-mail.co.jp') }
};

/**
 * Landed here from history or a shared link, with no address in the URL. The
 * resend has nothing to send to, so it is disabled and the action falls back.
 */
export const WithoutEmail: Story = {
  args: { bloc: checkEmailBloc('') }
};

/** Mid-send, before the confirmation lands. */
export const Resending: Story = {
  args: { bloc: checkEmailBloc('email=kaori@gmail.com', 'sending') }
};

/** Sent again: the confirmation replaces the steps rather than stacking under them. */
export const Resent: Story = {
  args: { bloc: checkEmailBloc('email=kaori@gmail.com', 'sent') }
};

/**
 * The cooldown, so repeat taps can't fan out N identical emails. The clock is
 * stubbed here, so it sits at the top of the minute instead of racing you.
 */
export const CoolingDown: Story = {
  args: { bloc: checkEmailBloc('email=kaori@gmail.com', 'cooling') }
};

/** The resend itself failed -- said in place, with the steps still available. */
export const ResendFailed: Story = {
  args: { bloc: checkEmailBloc('email=kaori@gmail.com', 'failed') }
};
