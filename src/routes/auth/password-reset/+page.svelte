<script lang="ts">
  import Seo from '$lib/Seo.svelte';
  import { goto } from '$app/navigation';
  import AuthCard from '../../../svelte/components/AuthCard.svelte';
  import ErrorBanner from '../../../svelte/components/ErrorBanner.svelte';
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
      <a class="btn-primary" href="/auth/login">Log in now</a>
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
      <a class="btn-primary" href="/auth/password-reset-request">Request a new link</a>
      <div class="secondary-actions">
        <a class="btn-ghost" href="/">Back to home</a>
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

        <button type="submit" class="btn-primary">Reset password</button>
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

  .btn-primary {
    width: 100%;
    height: 46px;
    background: var(--weeb-accent);
    color: white;
    font-size: 15px;
    font-weight: 600;
    font-family: inherit;
    letter-spacing: 0.01em;
    border: none;
    border-radius: var(--weeb-radius);
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    text-decoration: none;
    transition: background 0.15s, transform 0.1s;
  }

  .btn-primary:hover { background: var(--weeb-accent-hover); }
  .btn-primary:active { transform: scale(0.99); }

  .secondary-actions {
    display: flex;
    flex-direction: column;
    gap: 10px;
    margin-top: 10px;
  }

  .btn-ghost {
    width: 100%;
    height: 42px;
    background: var(--weeb-surface);
    color: var(--weeb-fg-secondary);
    font-size: 14px;
    font-weight: 500;
    font-family: inherit;
    border: 1px solid var(--weeb-border);
    border-radius: var(--weeb-radius);
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    text-decoration: none;
    transition: background 0.15s, color 0.15s;
  }

  .btn-ghost:hover {
    background: var(--weeb-surface-hover);
    color: var(--weeb-fg);
  }
</style>
