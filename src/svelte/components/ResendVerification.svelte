<script lang="ts">
  import { onDestroy } from 'svelte';
  import { faUser } from '@fortawesome/free-solid-svg-icons';
  import AuthCard from './AuthCard.svelte';
  import ErrorBanner from './ErrorBanner.svelte';
  import FormInput from './FormInput.svelte';
  import { ResendVerificationBloc } from './ResendVerification.bloc.svelte';

  /**
   * The standalone "send me another verification link" page.
   *
   * A view over `ResendVerificationBloc`, which shares its send with the
   * banners on the login form, the modal and the check-email screen.
   */
  let { bloc = new ResendVerificationBloc() }: { bloc?: ResendVerificationBloc } = $props();

  const iconUser = faUser;

  onDestroy(() => bloc.dispose());

  function handleSubmit(event: Event) {
    event.preventDefault();
    void bloc.submit();
  }
</script>

<AuthCard>
  {#snippet children()}
    <!-- The heading lives in the body rather than in AuthCard's `title` so it
         stays an <h2>: the e2e suite pins this page by that tag. -->
    <header class="rv-header">
      <h2 class="rv-title">Resend Email Verification</h2>
      <p class="rv-subtitle">Enter your email address to receive a new verification link</p>
    </header>

    <form class="rv-form" onsubmit={handleSubmit} novalidate>
      <FormInput
        id="username"
        name="username"
        type="email"
        value={bloc.username}
        onInput={(detail) => bloc.updateField('username', detail.value)}
        placeholder="Email address"
        label="Email address"
        icon={iconUser}
        required
      />

      {#if bloc.errorMessage}
        <ErrorBanner message={bloc.errorMessage} />
      {/if}

      {#if bloc.successMessage}
        <ErrorBanner severity="success" message={bloc.successMessage} />
      {/if}

      <button
        type="submit"
        class="btn-primary"
        class:loading={bloc.isSubmitting}
        disabled={bloc.isSubmitting}
      >
        <span class="btn-label">Send Verification Email</span>
        {#if bloc.isSubmitting}
          <span class="spinner" aria-hidden="true"></span>
        {/if}
      </button>
    </form>
  {/snippet}

  {#snippet footer()}
    <p class="rv-link">Already verified? <a href="/auth/login">Sign in here</a></p>
    <p class="rv-link">Need help? <a href="/auth/password-reset-request">Reset your password</a></p>
  {/snippet}
</AuthCard>

<style>
  .rv-header {
    margin-bottom: 28px;
    text-align: center;
  }

  .rv-title {
    font-size: 24px;
    font-weight: 700;
    letter-spacing: -0.02em;
    color: var(--weeb-fg);
    margin: 0 0 4px;
  }

  .rv-subtitle {
    font-size: 14px;
    color: var(--weeb-fg-muted);
    line-height: 1.5;
    margin: 0;
  }

  .rv-form {
    display: flex;
    flex-direction: column;
    gap: 18px;
  }

  .rv-link {
    margin: 0 0 4px;
  }

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
    border-radius: var(--weeb-radius-full);
    animation: spin 0.7s linear infinite;
  }

  @keyframes spin { to { transform: rotate(360deg); } }
  @media (prefers-reduced-motion: reduce) {
    .spinner { animation-duration: 2s; }
  }
</style>
