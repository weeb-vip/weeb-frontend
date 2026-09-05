import type { Meta, StoryObj } from '@storybook/svelte';
import { createRawSnippet } from 'svelte';
import AuthCard from '../AuthCard.svelte';

/**
 * The forms themselves are the call sites' business, so the stories stand in a
 * plain one -- enough to show the shell's inherited input and label styling.
 */
const loginForm = createRawSnippet(() => ({
  render: () => `
    <form style="display:flex;flex-direction:column;gap:18px;">
      <div style="display:flex;flex-direction:column;gap:6px;">
        <label for="sb-auth-user">Username or email</label>
        <input id="sb-auth-user" type="text" placeholder="you@example.com" />
      </div>
      <div style="display:flex;flex-direction:column;gap:6px;">
        <label for="sb-auth-pass">Password</label>
        <input id="sb-auth-pass" type="password" placeholder="••••••••" />
      </div>
      <button type="button" style="height:44px;border:none;border-radius:var(--weeb-radius);background:var(--weeb-accent);color:#fff;font-weight:600;font-size:15px;cursor:pointer;">
        Log in
      </button>
    </form>`,
}));

const signupFooter = createRawSnippet(() => ({
  render: () => `<span>Don't have an account? <a href="/auth/register">Sign up</a></span>`,
}));

const steps = createRawSnippet(() => ({
  render: () => `
    <ol style="display:flex;flex-direction:column;gap:10px;padding:0;margin:0;list-style:none;color:var(--weeb-fg-secondary);font-size:14px;">
      <li>1 · Open the email from weeb.vip</li>
      <li>2 · Click <em>Verify my email</em></li>
      <li>3 · Come back here and log in</li>
    </ol>`,
}));

const successGlyph = createRawSnippet(() => ({
  render: () => `
    <div style="width:56px;height:56px;border-radius:9999px;display:flex;align-items:center;justify-content:center;background:color-mix(in oklch, var(--weeb-green) 15%, transparent);color:var(--weeb-green);">
      <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m5 13 4 4L19 7"/></svg>
    </div>`,
}));

const meta = {
  title: 'Composites/Auth/AuthCard',
  component: AuthCard,
  tags: ['autodocs'],
  parameters: { layout: 'fullscreen' },
} satisfies Meta<typeof AuthCard>;

export default meta;
type Story = StoryObj<typeof meta>;

/** The Login shape: title, subtitle, a form, and the "sign up instead" footer. */
export const SignIn: Story = {
  args: {
    title: 'Welcome back',
    subtitle: 'Sign in to your account',
    children: loginForm,
    footer: signupFooter,
  },
};

/** No footer -- Register and PasswordResetRequest end at the submit button. */
export const WithoutFooter: Story = {
  args: {
    title: 'Create account',
    subtitle: 'Join the community',
    children: loginForm,
  },
};

/** CheckEmail and EmailVerification lead with a glyph above the heading. */
export const WithMedia: Story = {
  args: {
    media: successGlyph,
    title: 'Check your email',
    subtitle: "We sent a verification link to you@example.com. It expires in 15 minutes.",
    children: steps,
  },
};

/** Title and subtitle are both optional, so a screen can put everything in the body. */
export const BodyOnly: Story = {
  args: {
    children: steps,
  },
};

/** Backdrop off, for a card rendered inside a surface that already has one. */
export const WithoutChrome: Story = {
  args: {
    title: 'Reset your password',
    subtitle: "Enter your email and we'll send you a reset link.",
    children: loginForm,
    showLogo: false,
    showBackground: false,
  },
};
