import type { Meta, StoryObj } from '@storybook/svelte';
import { createRawSnippet } from 'svelte';
import ErrorBanner from '../ErrorBanner.svelte';

const resendLink = createRawSnippet(() => ({
  render: () =>
    `<a href="/auth/resend-verification" style="color: inherit; font-weight: 600;">Resend the verification email</a>`,
}));

const meta = {
  title: 'Primitives/ErrorBanner',
  component: ErrorBanner,
  tags: ['autodocs'],
} satisfies Meta<typeof ErrorBanner>;

export default meta;
type Story = StoryObj<typeof meta>;

/** The commonest shape by far: a form rejected the submission and there is nothing to retry. */
export const Error: Story = {
  args: {
    message: 'Unable to sign in. Please check your credentials and try again.',
  },
};

/** A load failed rather than a submission, so the banner carries the retry itself. */
export const WithRetry: Story = {
  args: {
    message: "Couldn't load this page.",
    onRetry: () => {},
  },
};

/** While the retry is in flight the control is disabled and says so. */
export const Retrying: Story = {
  args: {
    message: "Couldn't load this page.",
    onRetry: () => {},
    retrying: true,
  },
};

/** The specific cause, under the human-readable message -- muted, so it does not compete. */
export const WithDetail: Story = {
  args: {
    message: 'Failed to update profile.',
    detail: 'The server rejected the request (HTTP 422: username already taken).',
  },
};

/** Amber, not red: the credentials were correct, there is just a step left (Login's unverified account). */
export const Warning: Story = {
  args: {
    severity: 'warning',
    message: 'Your email address is not verified yet.',
    children: resendLink,
  },
};

/** Same box, `role="status"` instead of `role="alert"` -- the confirmations that sit in the same forms. */
export const Success: Story = {
  args: {
    severity: 'success',
    message: 'Verification email sent — check your inbox, and your spam folder.',
  },
};

/** Neutral information rather than a failure, e.g. a feature that is not switched on yet. */
export const Info: Story = {
  args: {
    severity: 'info',
    message: "News isn't available for this title yet.",
  },
};

/** Icon suppressed, for banners squeezed into a narrow column. */
export const WithoutIcon: Story = {
  args: {
    message: 'Please fill in all fields.',
    showIcon: false,
  },
};
