<script lang="ts">
  import { faUser, faLock, faArrowLeft } from '@fortawesome/free-solid-svg-icons';
  import Fa from 'svelte-fa';
  import FormInput from './FormInput.svelte';
  import type { RegisterInput } from '../../gql/graphql';
  import debug from '../../utils/debug';
  import { useRegister } from '../services/queries';

  let formData: RegisterInput & { confirmPassword: string } = {
    username: '',
    password: '',
    confirmPassword: ''
  };
  let errorMessage = '';
  let successMessage = '';
  let validationErrors: Record<string, string> = {};

  const registerMutation = useRegister();

  // Handle register state changes
  $: if ($registerMutation.isSuccess) {
    debug.success('Registration successful!');
    errorMessage = '';
    successMessage = 'Registration successful! Please check your email to verify your account before logging in.';
    formData = { username: '', password: '', confirmPassword: '' };
  }

  $: if ($registerMutation.isError) {
    debug.error('Registration failed', $registerMutation.error);
    let errorMsg = 'Registration failed. Please try again.';

    if ($registerMutation.error?.message?.includes('already exists') || $registerMutation.error?.message?.includes('exists')) {
      errorMsg = 'An account with this email already exists. Please try logging in or use a different email.';
    } else if ($registerMutation.error?.message?.includes('invalid email') || $registerMutation.error?.message?.includes('email')) {
      errorMsg = 'Please enter a valid email address.';
    } else if ($registerMutation.error?.message?.includes('password')) {
      errorMsg = 'Password requirements not met. Please ensure it\'s at least 6 characters long.';
    } else if ($registerMutation.error?.message?.includes('network') || $registerMutation.error?.message?.includes('fetch')) {
      errorMsg = 'Network error. Please check your connection and try again.';
    } else if ($registerMutation.error?.message) {
      errorMsg = $registerMutation.error.message;
    }

    errorMessage = errorMsg;
    successMessage = '';
  }

  function validateForm() {
    const errors: Record<string, string> = {};

    if (!formData.username.trim()) {
      errors.username = 'Email is required';
    } else if (formData.username.length < 3) {
      errors.username = 'Email must be at least 3 characters';
    }

    if (!formData.password) {
      errors.password = 'Password is required';
    } else if (formData.password.length < 6) {
      errors.password = 'Password must be at least 6 characters';
    }

    if (!formData.confirmPassword) {
      errors.confirmPassword = 'Please confirm your password';
    } else if (formData.password !== formData.confirmPassword) {
      errors.confirmPassword = 'Passwords do not match';
    }

    validationErrors = errors;
    return Object.keys(errors).length === 0;
  }

  function handleInputChange(event: CustomEvent) {
    const { value, originalEvent } = event.detail;
    const target = originalEvent?.target as HTMLInputElement;

    if (!target) return;

    const name = target.name;

    formData = {
      ...formData,
      [name]: value
    };

    // Clear validation error when user starts typing
    if (validationErrors[name]) {
      validationErrors = { ...validationErrors, [name]: '' };
    }
    // Clear messages
    if (errorMessage) {
      errorMessage = '';
    }
    if (successMessage) {
      successMessage = '';
    }
  }

  function handleSubmit(event: Event) {
    event.preventDefault();

    if (!validateForm()) {
      return;
    }

    errorMessage = '';
    successMessage = '';
    const data: RegisterInput = { username: formData.username, password: formData.password };

    // Use the reactive mutation pattern like the modal
    $registerMutation.mutate(data);
  }

  $: isLoading = $registerMutation.isPending;
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
      <div class="card-header">
        <h1 class="card-title">Create account</h1>
        <p class="card-subtitle">Join the community</p>
      </div>

      <form on:submit={handleSubmit} novalidate>

        <!-- Email -->
        <div class="field">
          <FormInput
            id="username"
            name="username"
            type="email"
            value={formData.username}
            on:input={handleInputChange}
            placeholder="you@example.com"
            label="Email"
            error={validationErrors.username}
            required
          />
        </div>

        <!-- Password -->
        <div class="field">
          <FormInput
            id="password"
            name="password"
            type="password"
            value={formData.password}
            on:input={handleInputChange}
            placeholder="At least 6 characters"
            label="Password"
            error={validationErrors.password}
            required
            showPasswordToggle={true}
          />

          <!-- Password strength indicator -->
          {#if formData.password.length > 0}
            {@const strength = formData.password.length >= 12 && /[A-Z]/.test(formData.password) && /[0-9]/.test(formData.password) && /[^A-Za-z0-9]/.test(formData.password) ? 'strong' : formData.password.length >= 8 && /[A-Z]/.test(formData.password) ? 'medium' : formData.password.length >= 6 ? 'weak' : 'none'}
            <div class="strength-wrap" data-level={strength} aria-live="polite">
              <div class="strength-bars">
                <div class="strength-bar"></div>
                <div class="strength-bar"></div>
                <div class="strength-bar"></div>
                <div class="strength-bar"></div>
              </div>
              <span class="strength-label">
                {#if strength === 'weak'}Weak{:else if strength === 'medium'}Medium{:else if strength === 'strong'}Strong{/if}
              </span>
            </div>
          {/if}
        </div>

        <!-- Confirm Password -->
        <div class="field">
          <FormInput
            id="confirmPassword"
            name="confirmPassword"
            type="password"
            value={formData.confirmPassword}
            on:input={handleInputChange}
            placeholder="Re-enter your password"
            label="Confirm password"
            error={validationErrors.confirmPassword}
            required
            showPasswordToggle={true}
          />
        </div>

        {#if errorMessage}
          <div class="alert alert-error">
            <p>{errorMessage}</p>
          </div>
        {/if}

        {#if successMessage}
          <div class="alert alert-success">
            <p>{successMessage}</p>
          </div>
        {/if}

        <!-- Submit -->
        <button
          type="submit"
          class="btn-primary"
          class:loading={isLoading}
          disabled={isLoading}
        >
          <span class="btn-label">Create account</span>
          {#if isLoading}
            <span class="spinner" aria-hidden="true"></span>
          {/if}
        </button>

      </form>

      <!-- Card footer -->
      <div class="card-footer">
        Already have an account? <a href="/auth/login">Log in</a>
      </div>
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
    background: linear-gradient(135deg, var(--weeb-accent), var(--weeb-violet, oklch(62% 0.14 300)));
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .logo-wordmark {
    font-family: ui-monospace, 'JetBrains Mono', Menlo, monospace;
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
    border-radius: 12px;
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

  /* --- Form layout --- */
  form {
    display: flex;
    flex-direction: column;
    gap: 18px;
  }

  .field {
    display: flex;
    flex-direction: column;
    gap: 0;
  }

  /* --- Password strength indicator --- */
  .strength-wrap {
    display: flex;
    flex-direction: column;
    gap: 6px;
    margin-top: 8px;
  }

  .strength-bars {
    display: flex;
    gap: 4px;
  }

  .strength-bar {
    flex: 1;
    height: 4px;
    background: var(--weeb-border);
    border-radius: 99px;
    transition: background 0.25s;
  }

  .strength-label {
    font-size: 11px;
    color: var(--weeb-fg-muted);
    font-family: ui-monospace, 'JetBrains Mono', Menlo, monospace;
    letter-spacing: 0.04em;
  }

  /* Strength levels */
  .strength-wrap[data-level="weak"] .strength-bar:nth-child(1) {
    background: var(--weeb-red);
  }
  .strength-wrap[data-level="weak"] .strength-label {
    color: var(--weeb-red);
  }

  .strength-wrap[data-level="medium"] .strength-bar:nth-child(1),
  .strength-wrap[data-level="medium"] .strength-bar:nth-child(2) {
    background: var(--weeb-amber, oklch(72% 0.14 85));
  }
  .strength-wrap[data-level="medium"] .strength-label {
    color: var(--weeb-amber, oklch(72% 0.14 85));
  }

  .strength-wrap[data-level="strong"] .strength-bar:nth-child(1),
  .strength-wrap[data-level="strong"] .strength-bar:nth-child(2),
  .strength-wrap[data-level="strong"] .strength-bar:nth-child(3) {
    background: var(--weeb-green);
  }
  .strength-wrap[data-level="strong"] .strength-label {
    color: var(--weeb-green);
  }

  /* --- Alert messages --- */
  .alert {
    font-size: 13px;
    padding: 10px 14px;
    border-radius: 8px;
    border: 1px solid;
  }

  .alert-error {
    color: var(--weeb-red);
    background: oklch(20% 0.03 25 / 0.5);
    border-color: var(--weeb-red, oklch(60% 0.18 25));
  }

  .alert-success {
    color: var(--weeb-green);
    background: oklch(20% 0.03 155 / 0.5);
    border-color: var(--weeb-green);
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
    border-radius: 8px;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    transition: background 0.15s, transform 0.1s;
    position: relative;
    overflow: hidden;
  }

  .btn-primary:hover:not(:disabled) {
    background: var(--weeb-accent-hover);
  }

  .btn-primary:active:not(:disabled) {
    transform: scale(0.99);
  }

  .btn-primary:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .btn-primary.loading .btn-label {
    opacity: 0;
  }

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

  @keyframes spin {
    to { transform: rotate(360deg); }
  }

  /* --- Card footer --- */
  .card-footer {
    text-align: center;
    font-size: 14px;
    color: var(--weeb-fg-muted);
    margin-top: 20px;
  }

  .card-footer a {
    color: var(--weeb-accent);
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
    .main {
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