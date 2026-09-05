<script lang="ts">
  import Seo from '$lib/Seo.svelte';
  import QueryProvider from '$lib/components/shell/QueryProvider.svelte';
  import { onDestroy, onMount } from 'svelte';
  import AuthCard from '$lib/components/auth/AuthCard.svelte';
  import Button from '$lib/components/primitives/Button.svelte';
  import ErrorBanner from '$lib/components/primitives/ErrorBanner.svelte';
  import { EmailVerificationBloc } from './EmailVerification.bloc.svelte';
  import { VERIFY_BANNER } from '$lib/components/auth/auth-shared';

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
      <Button size="lg" fullWidth href={bloc.loginHref}>Log in and start tracking</Button>
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
        <Button
          size="lg"
          fullWidth
          loading={bloc.resend.isSending}
          onClick={() => void bloc.resendLink()}
        >
          <!-- The label stays put under the spinner, so it is also still the
               button's accessible name while the resend is in flight. -->
          {VERIFY_BANNER.action}
        </Button>
      {/if}

      <p class="hint">Your account and password are unchanged.</p>

      <div class="secondary-actions">
        {#if bloc.token}
          <Button color="transparent" fullWidth onClick={() => bloc.retry()}>
            Try this link again
          </Button>
        {/if}
        <Button color="transparent" fullWidth href="/auth/login">Back to log in</Button>
      </div>
    {/if}

    {#if bloc.status === 'incomplete'}
      <div class="secondary-actions">
        <Button color="transparent" fullWidth href="/auth/resend-verification">Send me a new link</Button>
        <Button color="transparent" fullWidth href="/auth/login">Back to log in</Button>
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

  /* Every action on this screen is a Button; the stack around them is all that
     is left here. */
  .secondary-actions {
    display: flex;
    flex-direction: column;
    gap: 10px;
    margin-top: 14px;
  }

  .hint {
    font-size: 12.5px;
    color: var(--weeb-fg-muted);
    text-align: center;
    line-height: 1.5;
    margin-top: 12px;
  }
</style>
