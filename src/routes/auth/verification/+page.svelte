<script lang="ts">
  import Seo from '$lib/Seo.svelte';
  import QueryProvider from '../../../svelte/components/QueryProvider.svelte';
  import { onDestroy, onMount } from 'svelte';
  import AuthCard from '../../../svelte/components/AuthCard.svelte';
  import ErrorBanner from '../../../svelte/components/ErrorBanner.svelte';
  import { EmailVerificationBloc } from '../../../svelte/components/EmailVerification.bloc.svelte';
  import { VERIFY_BANNER } from '../../../svelte/components/auth-shared';

  /**
   * The screen a verification link lands on.
   *
   * A view over `EmailVerificationBloc`: it redeems the token, decides which of
   * the four states this is, and runs the countdown to login. Everything here
   * is which glyph and which actions go with that state.
   */
  let { bloc = new EmailVerificationBloc() }: { bloc?: EmailVerificationBloc } = $props();

  onMount(() => bloc.start());
  onDestroy(() => bloc.dispose());
</script>

<Seo
  title="Email Verification"
  description="Verify your email address to complete your WeebVIP account setup."
  noIndex={true}
/>

<!-- QueryProvider is the one place a TanStack client is made: a fresh one
     per SSR request, the shared one in the browser. -->
<QueryProvider>
<AuthCard title={bloc.title} subtitle={bloc.subtitle}>
  {#snippet media()}
    {#if bloc.status === 'loading'}
      <span class="loader" aria-hidden="true"></span>
    {:else if bloc.status === 'success'}
      <div class="glyph good" aria-hidden="true">
        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round">
          <path d="M5 13l4 4L19 7" />
        </svg>
      </div>
    {:else if bloc.status === 'failed'}
      <div class="glyph stale" aria-hidden="true">
        <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round">
          <circle cx="12" cy="12" r="8.5" />
          <path d="M12 7.5V12l3 2" />
        </svg>
      </div>
    {:else}
      <div class="glyph bad" aria-hidden="true">
        <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M6 18L18 6M6 6l12 12" />
        </svg>
      </div>
    {/if}
  {/snippet}

  {#snippet children()}
    {#if bloc.status === 'success'}
      <a class="btn-primary" href={bloc.loginHref}>Log in and start tracking</a>
      <p class="hint" aria-live="polite">Taking you to log in in {bloc.redirectIn}…</p>
    {/if}

    {#if bloc.status === 'failed'}
      {#if bloc.resend.isSent}
        <ErrorBanner
          severity="success"
          message="New link sent — check your inbox, and your spam folder."
          class="ev-alert"
        />
      {:else if bloc.canResend}
        {#if bloc.resend.isFailed}
          <ErrorBanner message={VERIFY_BANNER.failed} class="ev-alert" />
        {/if}
        <button
          type="button"
          class="btn-primary"
          onclick={() => void bloc.resendLink()}
          disabled={bloc.resend.isSending}
        >
          {bloc.resend.isSending ? VERIFY_BANNER.sending : VERIFY_BANNER.action}
        </button>
      {/if}

      <p class="hint">Your account and password are unchanged.</p>

      <div class="secondary-actions">
        {#if bloc.token}
          <button type="button" class="btn-ghost" onclick={() => bloc.retry()}>
            Try this link again
          </button>
        {/if}
        <a class="btn-ghost" href="/auth/login">Back to log in</a>
      </div>
    {/if}

    {#if bloc.status === 'incomplete'}
      <div class="secondary-actions">
        <a class="btn-ghost" href="/auth/resend-verification">Send me a new link</a>
        <a class="btn-ghost" href="/auth/login">Back to log in</a>
      </div>
    {/if}
  {/snippet}
</AuthCard>
</QueryProvider>

<style>
  /* --- Status glyphs --- */
  .glyph {
    width: 56px;
    height: 56px;
    border-radius: var(--weeb-radius-full);
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .glyph.good  { background: color-mix(in oklch, var(--weeb-green) 15%, transparent); color: var(--weeb-green); }
  .glyph.stale { background: color-mix(in oklch, var(--weeb-amber) 15%, transparent); color: var(--weeb-amber); }
  .glyph.bad   { background: color-mix(in oklch, var(--weeb-red) 15%, transparent);   color: var(--weeb-red); }

  /* --- Loader --- */
  .loader {
    width: 32px;
    height: 32px;
    border: 3px solid var(--weeb-border);
    border-top-color: var(--weeb-accent);
    border-radius: var(--weeb-radius-full);
    animation: spin 0.8s linear infinite;
  }

  @keyframes spin { to { transform: rotate(360deg); } }

  @media (prefers-reduced-motion: reduce) {
    .loader { animation-duration: 2s; }
  }

  :global(.ev-alert) {
    margin-bottom: 14px;
  }

  /* --- Buttons --- */
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
    gap: 9px;
    text-decoration: none;
    transition: background 0.15s, transform 0.1s;
  }

  .btn-primary:hover:not(:disabled) { background: var(--weeb-accent-hover); }
  .btn-primary:active:not(:disabled) { transform: scale(0.99); }
  .btn-primary:disabled { opacity: 0.5; cursor: not-allowed; }

  .secondary-actions {
    display: flex;
    flex-direction: column;
    gap: 10px;
    margin-top: 14px;
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

  .hint {
    font-size: 12.5px;
    color: var(--weeb-fg-muted);
    text-align: center;
    line-height: 1.5;
    margin-top: 12px;
  }
</style>
