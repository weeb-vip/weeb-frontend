<script lang="ts">
  import { onMount } from 'svelte';
  import type { LoginInput } from "../../gql/graphql";
  import { useLogin, useRegister } from '../services/queries';
  import { loggedInStore, loginModalStore } from '../stores/auth';
  import { navigateWithTransition } from '../../utils/astro-navigation';
  import FormInput from './FormInput.svelte';

  export let closeFn: (() => void) | undefined = undefined;

  let registerState = false;
  let isRegisterState = registerState;
  let formData = {
    username: "",
    password: "",
    confirmPassword: "", // for registration validation
  };
  let errorMessage = "";
  let successMessage = "";
  let validationErrors: Record<string, string> = {};

  const loginMutation = useLogin();
  const registerMutation = useRegister();

  // Subscribe to login modal state
  onMount(() => {
    const unsubscribe = loginModalStore.subscribe(state => {
      registerState = state.register;
      isRegisterState = state.register;
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

    // Dispatch custom event to trigger data refresh
    console.log('🎉 Login successful - dispatching loginSuccess event');
    window.dispatchEvent(new CustomEvent('loginSuccess'));

    if (closeFn) {
      closeFn();
    }
  }

  $: if ($loginMutation.isError) {
    errorMessage = 'Unable to sign in. Please check your credentials and try again.';
  }

  // Handle register state changes
  $: if ($registerMutation.isSuccess) {
    errorMessage = "";
    successMessage = "Registration successful! Please check your email to verify your account before logging in.";
  }

  $: if ($registerMutation.isError) {
    errorMessage = 'Unable to create account. Please try again.';
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
    if (successMessage) {
      successMessage = "";
    }
  }

  function handleSubmit(e: Event) {
    e.preventDefault();

    if (!validateForm()) {
      return;
    }

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
    successMessage = "";
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
    <h2 class="modal-title">{!isRegisterState ? 'Welcome back' : 'Create account'}</h2>
    <p class="modal-subtitle">{!isRegisterState ? 'Sign in to your account' : 'Start tracking your anime'}</p>
  </div>

  <!-- Alerts -->
  {#if errorMessage}
    <div class="alert alert-error">
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>
      <p>{errorMessage}</p>
    </div>
  {/if}
  {#if successMessage}
    <div class="alert alert-success">
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="16 12 12 16 8 12"/></svg>
      <p>{successMessage}</p>
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
    <button type="submit" class="btn-submit" class:loading={isLoading} disabled={isLoading}>
      <span class="btn-label">{!isRegisterState ? 'Log in' : 'Create account'}</span>
      {#if isLoading}
        <span class="spinner" aria-hidden="true"></span>
      {/if}
    </button>

  </form>

  <!-- Login-only: resend verification -->
  {#if !isRegisterState}
    <div class="resend-link">
      <a href="/auth/resend-verification" on:click={() => handleLinkClick(closeFn)} class="link-accent">Resend email verification</a>
    </div>
  {/if}

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
  :global(.weeb-auth-modal .alert-success) {
    color: var(--weeb-green);
    background: oklch(20% 0.03 155 / 0.5);
    border-color: oklch(65% 0.15 155 / 0.4);
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
    color: var(--weeb-accent);
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

  /* Resend verification link */
  :global(.weeb-auth-modal .resend-link) {
    text-align: center;
    margin-top: 12px;
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