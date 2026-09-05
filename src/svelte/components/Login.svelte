<script lang="ts">
  import { goto } from '$app/navigation';
  import { onMount } from 'svelte';
  // until hydration completes, a submit would be a native form POST
  // that sveltekit rejects (no form actions) — keep the button inert
  let hydrated = false;
  onMount(() => { hydrated = true; });

  import { page } from '$app/stores';
  import FormInput from './FormInput.svelte';
  import type { LoginInput } from '../../gql/graphql';
  import debug from '../../utils/debug';
  import { isUnverifiedEmailError } from '../../utils/auth-errors';
  import { useLogin, useResendVerificationEmail } from '../services/queries';

  let formData: LoginInput = { username: '', password: '' };
  let errorMessage = '';
  // set instead of errorMessage when the account exists but isn't verified —
  // the password is fine, so saying "check your credentials" sends people off
  // to reset a password that was never wrong
  let needsVerification = false;
  let resendState: 'idle' | 'sending' | 'sent' | 'failed' = 'idle';

  const loginMutation = useLogin();
  const resendMutation = useResendVerificationEmail();

  // Arriving from the verification success screen, which can't mint a session
  // itself — pre-fill so only the password is left to type.
  onMount(() => {
    const prefill = $page.url.searchParams.get('email');
    if (prefill) {
      formData = { ...formData, username: prefill };
    }
  });

  // Handle login state changes
  $: if ($loginMutation.isSuccess) {
    debug.auth('Login successful');
    errorMessage = '';
    needsVerification = false;
    // Navigate to home page
    goto('/');
  }

  $: if ($loginMutation.isError) {
    debug.error('Login failed', $loginMutation.error);
    if (isUnverifiedEmailError($loginMutation.error)) {
      needsVerification = true;
      errorMessage = '';
    } else {
      needsVerification = false;
      errorMessage = 'Unable to sign in. Please check your credentials and try again.';
    }
  }

  $: if ($resendMutation.isSuccess) {
    resendState = 'sent';
  }

  $: if ($resendMutation.isError) {
    debug.error('Failed to resend verification email', $resendMutation.error);
    resendState = 'failed';
  }

  function handleResend() {
    if (!formData.username.trim() || $resendMutation.isPending) return;
    resendState = 'sending';
    $resendMutation.mutate({ username: formData.username });
  }

  function handleInputChange(detail: { value: string; originalEvent: Event }) {
    const { value, originalEvent } = detail;
    const target = originalEvent?.target as HTMLInputElement;

    if (!target) return;

    const name = target.name;

    formData = {
      ...formData,
      [name]: value
    };

    // Clear error when user starts typing
    if (errorMessage) {
      errorMessage = '';
    }
    // Editing the email invalidates the banner it was addressed to
    if (needsVerification && name === 'username') {
      needsVerification = false;
      resendState = 'idle';
    }
  }

  function handleSubmit(event: Event) {
    event.preventDefault();

    if (!formData.username.trim() || !formData.password.trim()) {
      errorMessage = 'Please fill in all fields.';
      return;
    }

    errorMessage = '';
    needsVerification = false;
    resendState = 'idle';

    // Use the reactive mutation pattern like the modal
    $loginMutation.mutate(formData);
  }

  $: isLoading = $loginMutation.isPending;
</script>

<!-- Animated gradient background -->
<div class="page-bg"></div>

<main class="login-main">
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
      <div class="card-header">
        <h1 class="card-title">Welcome back</h1>
        <p class="card-subtitle">Sign in to your account</p>
      </div>

      <form class="login-form" on:submit={handleSubmit} novalidate>

        <!-- Username / Email -->
        <div class="field">
          <FormInput
            id="username"
            name="username"
            type="text"
            value={formData.username}
            onInput={handleInputChange}
            placeholder="your_username"
            label="Username or email"
            required
            className="login-input"
          />
        </div>

        <!-- Password -->
        <div class="field">
          <FormInput
            id="password"
            name="password"
            type="password"
            value={formData.password}
            onInput={handleInputChange}
            placeholder="Enter your password"
            label="Password"
            required
            showPasswordToggle={true}
            className="login-input"
          />
        </div>

        <!-- Error message -->
        {#if errorMessage}
          <div class="error-banner">
            <p>{errorMessage}</p>
          </div>
        {/if}

        <!-- Unverified account: nothing is wrong, there's just a step left -->
        {#if needsVerification}
          <div class="verify-banner" role="alert">
            <div class="verify-head">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                <rect x="2.5" y="5" width="19" height="14" rx="2.5"/>
                <path d="M3 7l9 6 9-6"/>
              </svg>
              Verify your email to continue
            </div>
            <!-- Deliberately does not assert the account exists: the backend
                 returns INACTIVE_CREDENTIALS for an unknown address too, so
                 claiming "we sent you a link" would be wrong for a typo — and
                 would turn login into a user-enumeration oracle. -->
            <p class="verify-body">
              Accounts need a verified email before you can log in. Check
              <b>{formData.username}</b> for the link we sent — it's often in spam.
            </p>
            {#if resendState === 'sent'}
              <p class="verify-sent">Sent — check your inbox, and your spam folder.</p>
            {:else if resendState === 'failed'}
              <p class="verify-failed">We couldn't send that just now. Try again in a moment.</p>
            {:else}
              <button
                type="button"
                class="verify-action"
                on:click={handleResend}
                disabled={resendState === 'sending'}
              >
                {resendState === 'sending' ? 'Sending…' : 'Send a new link'}
              </button>
            {/if}
          </div>
        {/if}

        <!-- Remember me + Forgot password -->
        <div class="field-row">
          <label class="checkbox-wrap">
            <input type="checkbox" name="remember" />
            <span class="checkbox-label">Remember me</span>
          </label>
          <a href="/auth/password-reset-request" class="link-muted">Forgot password?</a>
        </div>

        <!-- Submit button -->
        <button type="submit" class="btn-primary" class:loading={isLoading} disabled={isLoading || !hydrated}>
          <span class="btn-label">Log in</span>
          {#if isLoading}
            <span class="spinner" aria-hidden="true"></span>
          {/if}
        </button>

      </form>

      <!-- Divider -->
      <div class="divider">
        <div class="divider-line"></div>
        <span class="divider-text">or</span>
        <div class="divider-line"></div>
      </div>

      <!-- Card footer -->
      <div class="card-footer">
        Don't have an account? <a href="/auth/register">Sign up</a>
      </div>
    </div>

  </div>
</main>

<style>
  /* --- Animated Background --- */
  .page-bg {
    position: fixed;
    inset: 0;
    z-index: -1;
    background: linear-gradient(135deg, oklch(16% 0.025 280), oklch(14% 0.015 270), oklch(15% 0.02 295));
    background-size: 400% 400%;
    animation: bgShift 30s ease infinite;
  }
  @keyframes bgShift {
    0%, 100% { background-position: 0% 50%; }
    50% { background-position: 100% 50%; }
  }

  /* --- Main layout --- */
  .login-main {
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

  .card-header {
    margin-bottom: 28px;
    text-align: center;
  }
  .card-title {
    font-size: 24px;
    font-weight: 700;
    letter-spacing: -0.02em;
    color: var(--weeb-fg);
    margin-bottom: 4px;
  }
  .card-subtitle {
    font-size: 14px;
    color: var(--weeb-fg-muted);
  }

  /* --- Form --- */
  .login-form {
    display: flex;
    flex-direction: column;
    gap: 18px;
  }

  .field {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  /* Style inputs rendered by FormInput via global scoping */
  .login-form :global(input[type="text"]),
  .login-form :global(input[type="password"]),
  .login-form :global(input[type="email"]) {
    width: 100%;
    height: 44px;
    padding: 0 16px;
    font-size: 15px;
    color: var(--weeb-fg);
    background: var(--weeb-surface);
    border: 1.5px solid var(--weeb-border);
    border-radius: var(--weeb-radius);
    outline: none;
    transition: border-color 0.15s, box-shadow 0.15s, background 0.15s;
    -webkit-appearance: none;
    appearance: none;
  }
  .login-form :global(input::placeholder) {
    color: var(--weeb-fg-muted);
  }
  .login-form :global(input:focus) {
    border-color: var(--weeb-accent);
    box-shadow: 0 0 0 3px color-mix(in oklch, var(--weeb-accent) 20%, transparent);
  }

  .login-form :global(label) {
    font-size: 13px;
    font-weight: 500;
    color: var(--weeb-fg-secondary);
    letter-spacing: 0.01em;
  }

  /* --- Error banner --- */
  .error-banner {
    background: oklch(20% 0.03 25);
    border: 1.5px solid var(--weeb-red);
    border-radius: var(--weeb-radius);
    padding: 10px 14px;
  }
  .error-banner p {
    font-size: 13px;
    color: var(--weeb-red);
    margin: 0;
  }

  /* --- Unverified-account banner --- */
  /* Amber, not red: the credentials were correct, there's just a step left. */
  .verify-banner {
    background: oklch(22% 0.04 85 / 0.45);
    border: 1.5px solid var(--weeb-amber);
    border-radius: var(--weeb-radius);
    padding: 12px 14px;
    display: flex;
    flex-direction: column;
    gap: 11px;
  }

  .verify-head {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 13.5px;
    font-weight: 600;
    color: var(--weeb-amber);
  }

  .verify-body {
    font-size: 13px;
    line-height: 1.5;
    color: var(--weeb-fg-secondary);
    margin: 0;
  }

  .verify-body b {
    color: var(--weeb-fg);
    font-weight: 600;
    word-break: break-all;
  }

  .verify-action {
    align-self: flex-start;
    background: var(--weeb-amber);
    color: oklch(20% 0.04 85);
    font-size: 12.5px;
    font-weight: 700;
    font-family: inherit;
    padding: 7px 13px;
    border: none;
    border-radius: var(--weeb-radius-sm);
    cursor: pointer;
    transition: filter 0.15s;
  }

  .verify-action:hover:not(:disabled) {
    filter: brightness(1.08);
  }

  .verify-action:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }

  .verify-sent,
  .verify-failed {
    font-size: 12.5px;
    margin: 0;
  }

  .verify-sent {
    color: var(--weeb-green);
  }

  .verify-failed {
    color: var(--weeb-red);
  }

  /* --- Remember me / Forgot row --- */
  .field-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
  }
  .checkbox-wrap {
    display: flex;
    align-items: center;
    gap: 8px;
    cursor: pointer;
  }
  .checkbox-wrap input[type="checkbox"] {
    width: 16px;
    height: 16px;
    accent-color: var(--weeb-accent);
    cursor: pointer;
  }
  .checkbox-label {
    font-size: 13px;
    color: var(--weeb-fg-secondary);
    cursor: pointer;
    user-select: none;
  }
  .link-muted {
    font-size: 13px;
    color: var(--weeb-accent-text);
    text-decoration: none;
    transition: color 0.15s;
  }
  .link-muted:hover {
    color: var(--weeb-accent-hover);
    text-decoration: underline;
  }

  /* --- Submit button --- */
  .btn-primary {
    width: 100%;
    height: 46px;
    margin-top: 4px;
    background: var(--weeb-accent);
    color: white;
    font-size: 15px;
    font-weight: 600;
    letter-spacing: 0.01em;
    border: none;
    border-radius: var(--weeb-radius);
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    transition: background 0.15s, transform 0.1s;
    position: relative;
    overflow: hidden;
  }
  .btn-primary:hover:not(:disabled) { background: var(--weeb-accent-hover); }
  .btn-primary:active:not(:disabled) { transform: scale(0.99); }
  .btn-primary:disabled { opacity: 0.5; cursor: not-allowed; }
  .btn-primary.loading .btn-label { opacity: 0; }
  .spinner {
    display: block;
    position: absolute;
    width: 18px;
    height: 18px;
    border: 2px solid oklch(100% 0 0 / 0.3);
    border-top-color: white;
    border-radius: 50%;
    animation: spin 0.7s linear infinite;
  }
  @keyframes spin { to { transform: rotate(360deg); } }

  /* --- Divider --- */
  .divider {
    display: flex;
    align-items: center;
    gap: 16px;
    margin: 24px 0 20px;
  }
  .divider-line {
    flex: 1;
    height: 1px;
    background: var(--weeb-border);
  }
  .divider-text {
    font-size: 12px;
    color: var(--weeb-fg-muted);
    letter-spacing: 0.06em;
    text-transform: uppercase;
  }

  /* --- Card footer --- */
  .card-footer {
    text-align: center;
    font-size: 14px;
    color: var(--weeb-fg-muted);
  }
  .card-footer a {
    color: var(--weeb-accent-text);
    text-decoration: none;
    font-weight: 500;
    transition: color 0.15s;
  }
  .card-footer a:hover {
    color: var(--weeb-accent-hover);
    text-decoration: underline;
  }

  /* --- Responsive --- */
  @media (max-width: 480px) {
    .login-main {
      padding: 40px 16px 24px;
    }
    .card {
      padding: 24px;
    }
    .card-title {
      font-size: 20px;
    }
  }
</style>