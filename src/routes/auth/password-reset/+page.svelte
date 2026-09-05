<script lang="ts">
  import Seo from '$lib/Seo.svelte';
  import { goto } from '$app/navigation';
  import AuthCard from '$lib/components/auth/AuthCard';
  import Button from '$lib/components/primitives/Button';
  import ErrorBanner from '$lib/components/primitives/ErrorBanner';
  import type { ActionData, PageData } from './$types';

  /**
   * Setting a new password from a reset link.
   *
   * The only auth screen with no bloc: it is a progressively-enhanced form
   * action, so the server owns the state and this renders `data`/`form`. It
   * used to hand-roll a Tailwind lookalike of the auth shell in raw grays and
   * blues -- it sits in the same `AuthCard` as the rest of them now.
   */
  let { data, form }: { data: PageData; form: ActionData } = $props();

  const errorMessage = $derived(form?.errorMessage ?? data.errorMessage);
  const successMessage = $derived(form?.successMessage ?? '');
  const showForm = $derived(data.showForm && !successMessage);

  // Long enough to read the confirmation, short enough not to be a dead end.
  $effect(() => {
    if (!successMessage) return;
    const timer = setTimeout(() => goto('/'), 3000);
    return () => clearTimeout(timer);
  });
</script>

<Seo title="Reset Password" />

{#if successMessage}
  <AuthCard
    title="Password reset complete"
    subtitle="Your password has been reset. You can now log in with your new password."
  >
    {#snippet media()}
      <div class="glyph good" aria-hidden="true">
        <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round">
          <path d="M5 13l4 4L19 7" />
        </svg>
      </div>
    {/snippet}

    {#snippet children()}
      <p class="hint" aria-live="polite">Redirecting you to the home page…</p>
      <Button size="lg" fullWidth href="/auth/login">Log in now</Button>
    {/snippet}
  </AuthCard>
{:else if !showForm}
  <AuthCard
    title="Invalid reset link"
    subtitle="This password reset link is invalid or has expired."
  >
    {#snippet media()}
      <div class="glyph bad" aria-hidden="true">
        <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round">
          <rect x="4" y="10.5" width="16" height="10" rx="2" />
          <path d="M8 10.5V7a4 4 0 0 1 8 0v3.5" />
        </svg>
      </div>
    {/snippet}

    {#snippet children()}
      <Button size="lg" fullWidth href="/auth/password-reset-request">Request a new link</Button>
      <div class="secondary-actions">
        <Button color="transparent" fullWidth href="/">Back to home</Button>
      </div>
    {/snippet}
  </AuthCard>
{:else}
  <AuthCard title="Set new password" subtitle="Enter your new password below">
    {#snippet media()}
      <div class="glyph" aria-hidden="true">
        <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round">
          <rect x="4" y="10.5" width="16" height="10" rx="2" />
          <path d="M8 10.5V7a4 4 0 0 1 8 0v3.5" />
        </svg>
      </div>
    {/snippet}

    {#snippet children()}
      <!-- No `use:enhance`: the action is the whole flow, and a plain POST
           means a reset still works with JS off. -->
      <form class="pr-form" method="POST">
        <div class="field">
          <label for="email">Email</label>
          <!-- Shown, not editable: the token is bound to this address, so
               changing it here could only produce a confusing failure. -->
          <input id="email" name="email" type="text" value={data.email} disabled autocomplete="email" />
        </div>

        <div class="field">
          <label for="newPassword">New password</label>
          <input
            id="newPassword"
            name="newPassword"
            type="password"
            required
            placeholder="At least 8 characters"
            autocomplete="new-password"
          />
        </div>

        <div class="field">
          <label for="confirmPassword">Confirm new password</label>
          <input
            id="confirmPassword"
            name="confirmPassword"
            type="password"
            required
            placeholder="Re-enter your new password"
            autocomplete="new-password"
          />
        </div>

        {#if errorMessage}
          <ErrorBanner message={errorMessage} />
        {/if}

        <p class="requirements">At least 8 characters, and both fields must match.</p>

        <Button type="submit" size="lg" fullWidth>Reset password</Button>
      </form>
    {/snippet}

    {#snippet footer()}
      Remembered it? <a href="/auth/login">Sign in</a>
    {/snippet}
  </AuthCard>
{/if}

<style>
  .glyph {
    width: 56px;
    height: 56px;
    border-radius: var(--weeb-radius-full);
    background: color-mix(in oklch, var(--weeb-accent) 16%, transparent);
    color: var(--weeb-accent-text);
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .glyph.good {
    background: color-mix(in oklch, var(--weeb-green) 15%, transparent);
    color: var(--weeb-green);
  }

  .glyph.bad {
    background: color-mix(in oklch, var(--weeb-red) 15%, transparent);
    color: var(--weeb-red);
  }

  .pr-form {
    display: flex;
    flex-direction: column;
    gap: 18px;
  }

  .field {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  /* The only auth screen with plain `<input>`s: it is a no-JS form action, so it
     cannot use FormInput (which owns the value in a rune and has no
     `autocomplete` passthrough). AuthCard used to style these globally, which is
     what silently beat FormInput's error state everywhere else -- so the styling
     lives here, scoped to this form, where it can reach nothing else. */
  .field label {
    font-size: 13px;
    font-weight: 500;
    color: var(--weeb-fg-secondary);
    letter-spacing: 0.01em;
  }

  .field input {
    width: 100%;
    height: 44px;
    padding: 0 16px;
    font-size: 15px;
    font-family: inherit;
    color: var(--weeb-fg);
    background: var(--weeb-surface);
    border: 1.5px solid var(--weeb-border);
    border-radius: var(--weeb-radius);
    outline: none;
    transition: border-color 0.15s, box-shadow 0.15s, background 0.15s;
    -webkit-appearance: none;
    appearance: none;
  }

  .field input::placeholder {
    color: var(--weeb-fg-muted);
  }

  .field input:focus {
    border-color: var(--weeb-accent);
    box-shadow: 0 0 0 3px color-mix(in oklch, var(--weeb-accent) 20%, transparent);
  }

  .field input:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .requirements {
    font-size: 12px;
    color: var(--weeb-fg-muted);
    line-height: 1.45;
    margin: 0;
  }

  .hint {
    font-size: 12.5px;
    color: var(--weeb-fg-muted);
    text-align: center;
    line-height: 1.5;
    margin: 0 0 16px;
  }

  .secondary-actions {
    display: flex;
    flex-direction: column;
    gap: 10px;
    margin-top: 10px;
  }
</style>
