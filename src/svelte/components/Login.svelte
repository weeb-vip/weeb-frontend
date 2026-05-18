<script lang="ts">
  import FormInput from './FormInput.svelte';
  import type { LoginInput } from '../../gql/graphql';
  import debug from '../../utils/debug';
  import { useLogin } from '../services/queries';
  import { navigateWithTransition } from '../../utils/astro-navigation';

  let formData: LoginInput = { username: '', password: '' };
  let errorMessage = '';

  const loginMutation = useLogin();

  // Handle login state changes
  $: if ($loginMutation.isSuccess) {
    debug.auth('Login successful');
    errorMessage = '';
    // Navigate to home page
    navigateWithTransition('/');
  }

  $: if ($loginMutation.isError) {
    debug.error('Login failed', $loginMutation.error);
    errorMessage = 'Unable to sign in. Please check your credentials and try again.';
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

    // Clear error when user starts typing
    if (errorMessage) {
      errorMessage = '';
    }
  }

  function handleSubmit(event: Event) {
    event.preventDefault();

    if (!formData.username.trim() || !formData.password.trim()) {
      errorMessage = 'Please fill in all fields.';
      return;
    }

    errorMessage = '';

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
            on:input={handleInputChange}
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
            on:input={handleInputChange}
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

        <!-- Remember me + Forgot password -->
        <div class="field-row">
          <label class="checkbox-wrap">
            <input type="checkbox" name="remember" />
            <span class="checkbox-label">Remember me</span>
          </label>
          <a href="/auth/password-reset-request" class="link-muted">Forgot password?</a>
        </div>

        <!-- Submit button -->
        <button type="submit" class="btn-primary" class:loading={isLoading} disabled={isLoading}>
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
  }
  .login-form :global(input::placeholder) {
    color: var(--weeb-fg-muted);
  }
  .login-form :global(input:focus) {
    border-color: var(--weeb-accent);
    box-shadow: 0 0 0 3px oklch(55% 0.15 280 / 0.2);
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
    color: var(--weeb-accent);
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