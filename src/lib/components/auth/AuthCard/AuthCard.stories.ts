import type { Meta, StoryObj } from '@storybook/svelte';
import AuthCardDemo from '$lib/components/__stories__/AuthCardDemo.svelte';

/**
 * The shell every auth screen sits in. The stories drive it through
 * `AuthCardDemo`, which fills the card with the real FormInput fields and the
 * real Button its call sites use -- the old raw-HTML `<input>` stand-ins were
 * what let the card's duplicated input styling look correct in Storybook while
 * it was silently overriding FormInput's error state on every auth page.
 */
type AuthCardArgs = {
  title?: string;
  subtitle?: string;
  showLogo?: boolean;
  showBackground?: boolean;
  withFooter?: boolean;
  withMedia?: boolean;
  body?: 'form' | 'steps';
  error?: boolean;
};

const meta = {
  title: 'Composites/Auth/AuthCard',
  tags: ['autodocs'],
  parameters: { layout: 'fullscreen' },
  render: (args: AuthCardArgs) => ({ Component: AuthCardDemo, props: args }),
} satisfies Meta<AuthCardArgs>;

export default meta;
type Story = StoryObj<AuthCardArgs>;

/** The Login shape: title, subtitle, a form, and the "sign up instead" footer. */
export const SignIn: Story = {
  args: {
    title: 'Welcome back',
    subtitle: 'Sign in to your account',
    withFooter: true,
  },
};

/**
 * Invalid fields. The card must not restyle FormInput: the red border and tint
 * belong to the field, and this is the story that proves they survive the shell.
 */
export const FieldErrors: Story = {
  args: {
    title: 'Welcome back',
    subtitle: 'Sign in to your account',
    withFooter: true,
    error: true,
  },
};

/** No footer -- Register and PasswordResetRequest end at the submit button. */
export const WithoutFooter: Story = {
  args: {
    title: 'Create account',
    subtitle: 'Join the community',
  },
};

/** CheckEmail and EmailVerification lead with a glyph above the heading. */
export const WithMedia: Story = {
  args: {
    withMedia: true,
    title: 'Check your email',
    subtitle: 'We sent a verification link to you@example.com. It expires in 15 minutes.',
    body: 'steps',
  },
};

/** Title and subtitle are both optional, so a screen can put everything in the body. */
export const BodyOnly: Story = {
  args: {
    body: 'steps',
  },
};

/** Backdrop off, for a card rendered inside a surface that already has one. */
export const WithoutChrome: Story = {
  args: {
    title: 'Reset your password',
    subtitle: "Enter your email and we'll send you a reset link.",
    showLogo: false,
    showBackground: false,
  },
};
