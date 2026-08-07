<script lang="ts">
  import { onDestroy, onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import debug from '../../utils/debug';
  import { useResendVerificationEmail, useVerifyEmail } from '../services/queries';

  // No separate 'expired' state: the gateway returns the same
  // "Access denied" / DOWNSTREAM_SERVICE_ERROR for an expired token, a
  // malformed one, and one signed by an unknown key. Splitting them would mean
  // guessing, so the one failure state covers all of them honestly and offers
  // the same one-tap recovery.
  type Status = 'loading' | 'success' | 'incomplete' | 'failed';

  const REDIRECT_SECONDS = 3;

  let status: Status = 'loading';
  let email: string | null = null;
  let token: string | null = null;

  let resendState: 'idle' | 'sending' | 'sent' | 'failed' = 'idle';
  let redirectIn = REDIRECT_SECONDS;
  let redirectTimer: ReturnType<typeof setInterval> | undefined;

  const verifyEmailMutation = useVerifyEmail();
  const resendMutation = useResendVerificationEmail();

  $: decodedEmail = email ? decodeURIComponent(email) : '';
  // Verification proves ownership of the address but doesn't return credentials,
  // so we can't mint a session here — the next best thing is handing login an
  // email it doesn't have to be typed into.
  $: loginHref = decodedEmail ? `/auth/login?email=${encodeURIComponent(decodedEmail)}` : '/auth/login';

  // The mutation can resolve with success=false (verification didn't actually
  // happen), so treat that as a failure rather than showing the success screen.
  $: if ($verifyEmailMutation.isSuccess) {
    if ($verifyEmailMutation.data?.success) {
      debug.success('Email verification successful');
      if (status !== 'success') {
        status = 'success';
        startRedirect();
      }
    } else {
      debug.error('Email verification returned unsuccessful');
      status = 'failed';
    }
  }

  $: if ($verifyEmailMutation.isError) {
    debug.error('Email verification failed', $verifyEmailMutation.error);
    status = 'failed';
  }

  $: if ($resendMutation.isSuccess) {
    resendState = 'sent';
  }

  $: if ($resendMutation.isError) {
    debug.error('Failed to resend verification email', $resendMutation.error);
    resendState = 'failed';
  }

  onMount(() => {
    const searchParams = new URLSearchParams(window.location.search);
    email = searchParams.get('email');
    token = searchParams.get('token');

    if (!email || !token) {
      status = 'incomplete';
      return;
    }

    $verifyEmailMutation.mutate(token);
  });

  onDestroy(() => {
    if (redirectTimer) clearInterval(redirectTimer);
  });

  function startRedirect() {
    redirectIn = REDIRECT_SECONDS;
    redirectTimer = setInterval(() => {
      redirectIn -= 1;
      if (redirectIn <= 0) {
        if (redirectTimer) clearInterval(redirectTimer);
        redirectTimer = undefined;
        goto(loginHref);
      }
    }, 1000);
  }

  function handleResend() {
    if (!decodedEmail || $resendMutation.isPending) return;
    resendState = 'sending';
    $resendMutation.mutate({ username: decodedEmail });
  }

  function handleRetry() {
    if (!token) return;
    status = 'loading';
    $verifyEmailMutation.mutate(token);
  }
</script>

<!-- Animated background -->
<div class="page-bg"></div>

<main class="main">
  <div class="auth-wrapper">

    <!-- Logo block -->
    <a href="/" class="logo-block" aria-label="weeb.vip - back to homepage">
      <div class="logo-mark">
        <svg width="24" height="24" viewBox="0 0 22 22" fill="none" aria-hidden="true">
          <path d="M4 5L8.5 16L11 10L13.5 16L18 5" stroke="white" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/>
          <circle cx="11" cy="11" r="1.2" fill="white" opacity="0.7"/>
        </svg>
      </div>
      <span class="logo-wordmark">weeb.vip</span>
    </a>

    <!-- Card -->
    <div class="card">

      {#if status === 'loading'}
        <div class="centered">
          <span class="loader" aria-hidden="true"></span>
          <h1 class="card-title">Verifying your email</h1>
          <p class="card-subtitle" aria-live="polite">
            {#if decodedEmail}Confirming <b>{decodedEmail}</b>…{:else}One moment…{/if}
          </p>
        </div>
      {/if}

      {#if status === 'success'}
        <div class="glyph good" aria-hidden="true">
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round">
            <path d="M5 13l4 4L19 7"/>
          </svg>
        </div>
        <div class="card-header">
          <h1 class="card-title">You're verified</h1>
          <p class="card-subtitle">
            {#if decodedEmail}<b>{decodedEmail}</b> is confirmed and your account is active.
            {:else}Your email is confirmed and your account is active.{/if}
          </p>
        </div>
        <a class="btn-primary" href={loginHref}>Log in and start tracking</a>
        <p class="hint" aria-live="polite">Taking you to log in in {redirectIn}…</p>
      {/if}

      {#if status === 'failed'}
        <div class="glyph stale" aria-hidden="true">
          <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round">
            <circle cx="12" cy="12" r="8.5"/>
            <path d="M12 7.5V12l3 2"/>
          </svg>
        </div>
        <div class="card-header">
          <h1 class="card-title">This link didn't work</h1>
          <p class="card-subtitle">
            Verification links expire 15 minutes after they're sent.
            {#if decodedEmail}
              We can send a fresh one to <b>{decodedEmail}</b>.
            {:else}
              Request a new one from the log in page.
            {/if}
          </p>
        </div>

        {#if resendState === 'sent'}
          <div class="alert alert-success" role="status">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
              <path d="M5 13l4 4L19 7"/>
            </svg>
            <p>New link sent — check your inbox, and your spam folder.</p>
          </div>
        {:else if decodedEmail}
          {#if resendState === 'failed'}
            <div class="alert alert-error" role="alert">
              <p>We couldn't send that just now. Try again in a moment.</p>
            </div>
          {/if}
          <button
            type="button"
            class="btn-primary"
            on:click={handleResend}
            disabled={resendState === 'sending'}
          >
            {resendState === 'sending' ? 'Sending…' : 'Send a new link'}
          </button>
        {/if}

        <p class="hint">Your account and password are unchanged.</p>

        <div class="secondary-actions">
          {#if token}
            <button type="button" class="btn-ghost" on:click={handleRetry}>Try this link again</button>
          {/if}
          <a class="btn-ghost" href="/auth/login">Back to log in</a>
        </div>
      {/if}

      {#if status === 'incomplete'}
        <div class="glyph bad" aria-hidden="true">
          <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M6 18L18 6M6 6l12 12"/>
          </svg>
        </div>
        <div class="card-header">
          <h1 class="card-title">This link is incomplete</h1>
          <p class="card-subtitle">
            Some email clients cut long links in half. Open the message again and
            use the <em>Verify my email</em> button rather than copying the address.
          </p>
        </div>

        <div class="secondary-actions">
          <a class="btn-ghost" href="/auth/resend-verification">Send me a new link</a>
          <a class="btn-ghost" href="/auth/login">Back to log in</a>
        </div>
      {/if}

    </div>

  </div>
</main>

<style>
  /* --- Animated background --- */
  .page-bg {
    position: fixed;
    inset: 0;
    z-index: -1;
    background: linear-gradient(135deg,
      oklch(16% 0.025 280),
      oklch(14% 0.015 270),
      oklch(15% 0.02 295));
    background-size: 400% 400%;
    animation: bgShift 30s ease infinite;
  }

  @keyframes bgShift {
    0%, 100% { background-position: 0% 50%; }
    50% { background-position: 100% 50%; }
  }

  /* --- Main layout --- */
  .main {
    min-height: 100vh;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 60px 16px 40px;
  }

  .auth-wrapper {
    width: 100%;
    max-width: 400px;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 32px;
  }

  /* --- Logo block --- */
  .logo-block {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 8px;
    text-decoration: none;
    color: inherit;
  }

  .logo-mark {
    width: 48px;
    height: 48px;
    border-radius: 50%;
    background: linear-gradient(135deg, var(--weeb-accent), var(--weeb-violet));
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .logo-wordmark {
    font-family: var(--weeb-font-mono);
    font-size: 15px;
    font-weight: 600;
    letter-spacing: 0.04em;
    color: var(--weeb-fg);
  }

  /* --- Card --- */
  .card {
    width: 100%;
    background: var(--weeb-bg-elevated);
    border: 1px solid var(--weeb-border);
    border-radius: var(--weeb-radius-lg);
    padding: 36px;
    box-shadow: 0 4px 24px oklch(0% 0 0 / 0.3), 0 1px 3px oklch(0% 0 0 / 0.2);
  }

  .centered {
    display: flex;
    flex-direction: column;
    align-items: center;
    text-align: center;
    gap: 6px;
  }

  .card-header {
    margin-bottom: 22px;
    text-align: center;
  }

  .card-title {
    font-size: 24px;
    font-weight: 700;
    letter-spacing: -0.02em;
    color: var(--weeb-fg);
    margin-bottom: 5px;
  }

  .card-subtitle {
    font-size: 14px;
    color: var(--weeb-fg-muted);
    line-height: 1.5;
  }

  .card-subtitle b {
    color: var(--weeb-fg);
    font-weight: 600;
    word-break: break-all;
  }

  /* --- Status glyphs --- */
  .glyph {
    width: 56px;
    height: 56px;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    margin: 0 auto 18px;
  }

  .glyph.good  { background: oklch(65% 0.15 155 / 0.15); color: var(--weeb-green); }
  .glyph.stale { background: oklch(72% 0.14 85 / 0.15);  color: var(--weeb-amber); }
  .glyph.bad   { background: oklch(60% 0.18 25 / 0.15);  color: var(--weeb-red); }

  /* --- Loader --- */
  .loader {
    width: 32px;
    height: 32px;
    border: 3px solid var(--weeb-border);
    border-top-color: var(--weeb-accent);
    border-radius: 50%;
    animation: spin 0.8s linear infinite;
    margin-bottom: 14px;
  }

  @keyframes spin { to { transform: rotate(360deg); } }

  @media (prefers-reduced-motion: reduce) {
    .loader { animation-duration: 2s; }
    .page-bg { animation: none; }
  }

  /* --- Alerts --- */
  .alert {
    font-size: 13px;
    padding: 11px 14px;
    border-radius: var(--weeb-radius);
    border: 1px solid;
    line-height: 1.5;
    display: flex;
    align-items: center;
    gap: 8px;
    margin-bottom: 14px;
  }

  .alert p { margin: 0; }

  .alert-success {
    color: var(--weeb-green);
    background: oklch(20% 0.03 155 / 0.5);
    border-color: var(--weeb-green);
  }

  .alert-error {
    color: var(--weeb-red);
    background: oklch(20% 0.03 25 / 0.5);
    border-color: var(--weeb-red);
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

  /* --- Responsive --- */
  @media (max-width: 480px) {
    .main { padding: 40px 16px 24px; }
    .card { padding: 24px; }
    .card-title { font-size: 20px; }
  }
</style>
