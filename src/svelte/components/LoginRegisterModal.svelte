<script lang="ts">
  import { onMount } from 'svelte';
  // until hydration completes, a submit would be a native form POST
  // that sveltekit rejects (no form actions) — keep the button inert
  let hydrated = false;
  onMount(() => { hydrated = true; });

  import { goto } from '$app/navigation';
  import type { LoginInput } from "../../gql/graphql";
  import { isUnverifiedEmailError } from '../../utils/auth-errors';
  import { useLogin, useRegister, useResendVerificationEmail } from '../services/queries';
  import { loggedInStore, loginModalStore } from '../stores/auth';
  import FormInput from './FormInput.svelte';

  export let closeFn: (() => void) | undefined = undefined;

  let registerState = false;
  let isRegisterState = registerState;
  let reason: string | null = null;
  let formData = {
    username: "",
    password: "",
    confirmPassword: "", // for registration validation
  };
  let errorMessage = "";
  let validationErrors: Record<string, string> = {};
  // login failed because the account exists but isn't verified — see Login.svelte
  let needsVerification = false;
  let resendState: 'idle' | 'sending' | 'sent' | 'failed' = 'idle';
  // kept so the post-register redirect can carry the address
  let submittedEmail = "";

  const loginMutation = useLogin();
  const registerMutation = useRegister();
  const resendMutation = useResendVerificationEmail();

  // Subscribe to login modal state
  onMount(() => {
    const unsubscribe = loginModalStore.subscribe(state => {
      registerState = state.register;
      isRegisterState = state.register;
      reason = state.reason ?? null;
    });
    return unsubscribe;
  });

  $: isLoading = $loginMutation.isPending || $registerMutation.isPending;

  // Handle login state changes
  $: if ($loginMutation.isSuccess && $loginMutation.data) {
    loggedInStore.setLoggedIn({
      id: $loginMutation.data.id
    });
    errorMessage = "";
    needsVerification = false;

    // Dispatch custom event to trigger data refresh
    console.log('🎉 Login successful - dispatching loginSuccess event');
    window.dispatchEvent(new CustomEvent('loginSuccess'));

    if (closeFn) {
      closeFn();
    }
  }

  $: if ($loginMutation.isError) {
    if (isUnverifiedEmailError($loginMutation.error)) {
      needsVerification = true;
      errorMessage = "";
    } else {
      needsVerification = false;
      errorMessage = 'Unable to sign in. Please check your credentials and try again.';
    }
  }

  // Registration leaves the modal for the dedicated "check your email" screen,
  // so the modal path doesn't diverge from /auth/register.
  $: if ($registerMutation.isSuccess) {
    errorMessage = "";
    const email = submittedEmail;
    if (closeFn) {
      closeFn();
    }
    goto(`/auth/check-email?email=${encodeURIComponent(email)}`);
  }

  $: if ($registerMutation.isError) {
    errorMessage = 'Unable to create account. Please try again.';
  }

  $: if ($resendMutation.isSuccess) {
    resendState = 'sent';
  }

  $: if ($resendMutation.isError) {
    resendState = 'failed';
  }

  function handleResend() {
    if (!formData.username.trim() || $resendMutation.isPending) return;
    resendState = 'sending';
    $resendMutation.mutate({ username: formData.username });
  }

  function validateForm() {
    const errors: Record<string, string> = {};

    if (!formData.username.trim()) {
      errors.username = "Username is required";
    } else if (formData.username.length < 3) {
      errors.username = "Username must be at least 3 characters";
    }

    if (!formData.password) {
      errors.password = "Password is required";
    } else if (formData.password.length < 6) {
      errors.password = "Password must be at least 6 characters";
    }

    if (isRegisterState) {
      if (!formData.confirmPassword) {
        errors.confirmPassword = "Please confirm your password";
      } else if (formData.password !== formData.confirmPassword) {
        errors.confirmPassword = "Passwords do not match";
      }
    }

    validationErrors = errors;
    return Object.keys(errors).length === 0;
  }

  function handleChange(field: string, value: string) {
    formData = { ...formData, [field]: value };

    // Clear validation error when user starts typing
    if (validationErrors[field]) {
      validationErrors = { ...validationErrors, [field]: "" };
    }
    // Clear global messages
    if (errorMessage) {
      errorMessage = "";
    }
    // Editing the email invalidates the banner it was addressed to
    if (needsVerification && field === 'username') {
      needsVerification = false;
      resendState = 'idle';
    }
  }

  function handleSubmit(e: Event) {
    e.preventDefault();

    if (!validateForm()) {
      return;
    }

    needsVerification = false;
    resendState = 'idle';
    submittedEmail = formData.username;

    const data: LoginInput = { username: formData.username, password: formData.password };

    if (!isRegisterState) {
      $loginMutation.mutate(data);
    } else {
      $registerMutation.mutate(data);
    }
  }

  function toggleMode() {
    isRegisterState = !isRegisterState;
    errorMessage = "";
    needsVerification = false;
    resendState = 'idle';
    validationErrors = {};
  }

  function handleLinkClick(closeFn?: () => void) {
    if (closeFn) {
      closeFn();
    }
  }
</script>

<div class="weeb-auth-modal">

  <!-- Header -->
  <div class="modal-header">
    <div class="logo-mark">
      <svg width="20" height="20" viewBox="0 0 22 22" fill="none" aria-hidden="true">
        <path d="M4 5L8.5 16L11 10L13.5 16L18 5" stroke="white" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/>
        <circle cx="11" cy="11" r="1.2" fill="white" opacity="0.7"/>
      </svg>
    </div>
    <h2 class="modal-title">{reason ? (!isRegisterState ? 'Sign in to keep track' : 'Create your account') : (!isRegisterState ? 'Welcome back' : 'Create account')}</h2>
    <!-- When the visitor was gated mid-action, say which action. The generic
         subtitle only applies when they opened this deliberately. -->
    <p class="modal-subtitle">{reason ?? (!isRegisterState ? 'Sign in to your account' : 'Start tracking your anime')}</p>
  </div>

  <!-- Alerts -->
  {#if errorMessage}
    <div class="alert alert-error">
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>
      <p>{errorMessage}</p>
    </div>
  {/if}
  {#if needsVerification}
    <div class="verify-banner" role="alert">
      <div class="verify-head">
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="2.5" y="5" width="19" height="14" rx="2.5"/><path d="M3 7l9 6 9-6"/></svg>
        Verify your email to continue
      </div>
      <!-- See Login.svelte: must not assert the account exists. -->
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

  <!-- Form -->
  <form on:submit={handleSubmit} class="auth-form">

    <div class="form-group">
      <FormInput
        id="modal-username"
        name="username"
        type="text"
        value={formData.username}
        placeholder={!isRegisterState ? 'your_username' : 'you@example.com'}
        label={!isRegisterState ? 'Username or email' : 'Email'}
        error={validationErrors.username}
        required={true}
        on:input={(e) => handleChange('username', e.detail.value)}
      />
    </div>

    <div class="form-group">
      <FormInput
        id="modal-password"
        name="password"
        type="password"
        value={formData.password}
        placeholder={!isRegisterState ? 'Enter your password' : 'At least 6 characters'}
        label="Password"
        error={validationErrors.password}
        required={true}
        showPasswordToggle={true}
        on:input={(e) => handleChange('password', e.detail.value)}
      />
    </div>

    {#if isRegisterState}
      <div class="form-group">
        <FormInput
          id="modal-confirmPassword"
          name="confirmPassword"
          type="password"
          value={formData.confirmPassword}
          placeholder="Re-enter your password"
          label="Confirm password"
          error={validationErrors.confirmPassword}
          required={true}
          showPasswordToggle={true}
          on:input={(e) => handleChange('confirmPassword', e.detail.value)}
        />
      </div>
    {/if}

    <!-- Login-only: remember me + forgot password -->
    {#if !isRegisterState}
      <div class="field-row">
        <label class="checkbox-wrap">
          <input type="checkbox" name="remember" />
          <span class="checkbox-label">Remember me</span>
        </label>
        <a href="/auth/password-reset-request" on:click={() => handleLinkClick(closeFn)} class="link-accent">Forgot password?</a>
      </div>
    {/if}

    <!-- Submit -->
    <button type="submit" class="btn-submit" class:loading={isLoading} disabled={isLoading || !hydrated}>
      <span class="btn-label">{!isRegisterState ? 'Log in' : 'Create account'}</span>
      {#if isLoading}
        <span class="spinner" aria-hidden="true"></span>
      {/if}
    </button>

  </form>

  <!-- No standing "resend verification" link: an unverified login now surfaces
       the banner above, which resends to the address already typed in.
       /auth/resend-verification stays reachable for anyone who needs it. -->

  <!-- Divider -->
  <div class="divider">
    <div class="divider-line"></div>
    <span class="divider-text">or</span>
    <div class="divider-line"></div>
  </div>

  <!-- Toggle mode -->
  <div class="mode-toggle">
    {!isRegisterState ? "Don't have an account?" : "Already have an account?"}
    <button type="button" on:click={toggleMode} class="link-accent">{!isRegisterState ? 'Sign up' : 'Log in'}</button>
  </div>
</div>

<style>
  /* Global styles for portal - rendered in document.body */
  :global(.weeb-auth-modal) {
    padding: 36px;
  }

  /* Header */
  :global(.weeb-auth-modal .modal-header) {
    text-align: center;
    margin-bottom: 28px;
  }
  :global(.weeb-auth-modal .logo-mark) {
    width: 40px;
    height: 40px;
    border-radius: 50%;
    background: linear-gradient(135deg, var(--weeb-accent), var(--weeb-violet, oklch(62% 0.14 300)));
    display: flex;
    align-items: center;
    justify-content: center;
    margin: 0 auto 12px;
  }
  :global(.weeb-auth-modal .modal-title) {
    font-size: 22px;
    font-weight: 700;
    letter-spacing: -0.02em;
    color: var(--weeb-fg);
    margin-bottom: 4px;
  }
  :global(.weeb-auth-modal .modal-subtitle) {
    font-size: 14px;
    color: var(--weeb-fg-muted);
  }

  /* Alerts */
  :global(.weeb-auth-modal .alert) {
    display: flex;
    align-items: flex-start;
    gap: 10px;
    padding: 10px 14px;
    border-radius: var(--weeb-radius, 8px);
    border: 1px solid;
    font-size: 13px;
    margin-bottom: 20px;
  }
  :global(.weeb-auth-modal .alert svg) {
    flex-shrink: 0;
    margin-top: 1px;
  }
  :global(.weeb-auth-modal .alert p) {
    margin: 0;
    line-height: 1.4;
  }
  :global(.weeb-auth-modal .alert-error) {
    color: var(--weeb-red);
    background: oklch(20% 0.03 25 / 0.5);
    border-color: oklch(60% 0.18 25 / 0.4);
  }
  /* Unverified-account banner — amber, not red: the credentials were correct,
     there's just a step left. Mirrors Login.svelte. */
  :global(.weeb-auth-modal .verify-banner) {
    background: oklch(22% 0.04 85 / 0.45);
    border: 1.5px solid var(--weeb-amber);
    border-radius: var(--weeb-radius, 8px);
    padding: 12px 14px;
    margin-bottom: 20px;
    display: flex;
    flex-direction: column;
    gap: 11px;
  }
  :global(.weeb-auth-modal .verify-head) {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 13.5px;
    font-weight: 600;
    color: var(--weeb-amber);
  }
  :global(.weeb-auth-modal .verify-head svg) {
    flex-shrink: 0;
  }
  :global(.weeb-auth-modal .verify-body) {
    font-size: 13px;
    line-height: 1.5;
    color: var(--weeb-fg-secondary);
    margin: 0;
  }
  :global(.weeb-auth-modal .verify-body b) {
    color: var(--weeb-fg);
    font-weight: 600;
    word-break: break-all;
  }
  :global(.weeb-auth-modal .verify-action) {
    align-self: flex-start;
    background: var(--weeb-amber);
    color: oklch(20% 0.04 85);
    font-size: 12.5px;
    font-weight: 700;
    font-family: inherit;
    padding: 7px 13px;
    border: none;
    border-radius: var(--weeb-radius-sm, 4px);
    cursor: pointer;
    transition: filter 0.15s;
  }
  :global(.weeb-auth-modal .verify-action:hover:not(:disabled)) {
    filter: brightness(1.08);
  }
  :global(.weeb-auth-modal .verify-action:disabled) {
    opacity: 0.6;
    cursor: not-allowed;
  }
  :global(.weeb-auth-modal .verify-sent),
  :global(.weeb-auth-modal .verify-failed) {
    font-size: 12.5px;
    margin: 0;
  }
  :global(.weeb-auth-modal .verify-sent) {
    color: var(--weeb-green);
  }
  :global(.weeb-auth-modal .verify-failed) {
    color: var(--weeb-red);
  }

  /* Form */
  :global(.weeb-auth-modal .auth-form) {
    display: flex;
    flex-direction: column;
    gap: 18px;
  }
  :global(.weeb-auth-modal .form-group) {
    display: flex;
    flex-direction: column;
  }

  /* Remember me / Forgot password row */
  :global(.weeb-auth-modal .field-row) {
    display: flex;
    align-items: center;
    justify-content: space-between;
  }
  :global(.weeb-auth-modal .checkbox-wrap) {
    display: flex;
    align-items: center;
    gap: 8px;
    cursor: pointer;
  }
  :global(.weeb-auth-modal .checkbox-wrap input[type="checkbox"]) {
    width: 16px;
    height: 16px;
    accent-color: var(--weeb-accent);
    cursor: pointer;
  }
  :global(.weeb-auth-modal .checkbox-label) {
    font-size: 13px;
    color: var(--weeb-fg-secondary);
    cursor: pointer;
    user-select: none;
  }

  /* Accent links */
  :global(.weeb-auth-modal .link-accent) {
    font-size: 13px;
    color: var(--weeb-accent-text);
    text-decoration: none;
    background: none;
    border: none;
    cursor: pointer;
    font-weight: 500;
    transition: color 0.15s;
    padding: 0;
  }
  :global(.weeb-auth-modal .link-accent:hover) {
    color: var(--weeb-accent-hover, oklch(62% 0.16 280));
    text-decoration: underline;
  }

  /* Submit button */
  :global(.weeb-auth-modal .btn-submit) {
    width: 100%;
    height: 46px;
    margin-top: 4px;
    background: var(--weeb-accent);
    color: white;
    font-size: 15px;
    font-weight: 600;
    letter-spacing: 0.01em;
    border: none;
    border-radius: var(--weeb-radius, 8px);
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    transition: background 0.15s, transform 0.1s;
    position: relative;
    overflow: hidden;
  }
  :global(.weeb-auth-modal .btn-submit:hover:not(:disabled)) {
    background: var(--weeb-accent-hover, oklch(62% 0.16 280));
  }
  :global(.weeb-auth-modal .btn-submit:active:not(:disabled)) {
    transform: scale(0.99);
  }
  :global(.weeb-auth-modal .btn-submit:disabled) {
    opacity: 0.5;
    cursor: not-allowed;
  }
  :global(.weeb-auth-modal .btn-submit.loading .btn-label) {
    opacity: 0;
  }
  :global(.weeb-auth-modal .spinner) {
    display: block;
    position: absolute;
    width: 18px;
    height: 18px;
    border: 2px solid oklch(100% 0 0 / 0.3);
    border-top-color: white;
    border-radius: 50%;
    animation: weeb-auth-spin 0.7s linear infinite;
  }
  @keyframes -global-weeb-auth-spin {
    to { transform: rotate(360deg); }
  }

  /* Divider */
  :global(.weeb-auth-modal .divider) {
    display: flex;
    align-items: center;
    gap: 16px;
    margin: 20px 0 16px;
  }
  :global(.weeb-auth-modal .divider-line) {
    flex: 1;
    height: 1px;
    background: var(--weeb-border);
  }
  :global(.weeb-auth-modal .divider-text) {
    font-size: 12px;
    color: var(--weeb-fg-muted);
    letter-spacing: 0.06em;
    text-transform: uppercase;
  }

  /* Mode toggle footer */
  :global(.weeb-auth-modal .mode-toggle) {
    text-align: center;
    font-size: 14px;
    color: var(--weeb-fg-muted);
  }

  @media (max-width: 480px) {
    :global(.weeb-auth-modal) {
      padding: 24px;
    }
    :global(.weeb-auth-modal .modal-title) {
      font-size: 20px;
    }
  }
</style>