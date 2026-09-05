<script lang="ts">
  import Seo from '$lib/Seo.svelte';
  import QueryProvider from '$lib/components/shell/QueryProvider.svelte';
  import { onDestroy, onMount } from 'svelte';
  import AuthCard from '$lib/components/auth/AuthCard.svelte';
  import Button from '$lib/components/primitives/Button.svelte';
  import ErrorBanner from '$lib/components/primitives/ErrorBanner.svelte';
  import FormInput from '$lib/components/primitives/FormInput.svelte';
  import { LoginBloc } from '$lib/components/auth/Login.bloc.svelte';
  import { VERIFY_BANNER } from '$lib/components/auth/auth-shared';

  /**
   * The sign-in page.
   *
   * A view over `LoginBloc`: it owns the fields, the failure that is really a
   * missing step, and the resend that goes with it. What is left here is the
   * shell (`AuthCard`, shared with every other auth screen) and the form.
   */
  let { bloc = new LoginBloc() }: { bloc?: LoginBloc } = $props();

  // Until hydration completes a submit would be a native form POST that
  // SvelteKit rejects (no form actions), so the button stays inert until here.
  onMount(() => bloc.markHydrated());
  onDestroy(() => bloc.dispose());

  function handleSubmit(event: Event) {
    event.preventDefault();
    void bloc.submit();
  }
</script>

<Seo
  title="Login"
  description="Sign in to your WeebVIP account to access your anime watchlist and get personalized recommendations."
  noIndex={true}
/>

<!-- QueryProvider is the one place a TanStack client is made: a fresh one
     per SSR request, the shared one in the browser. -->
<QueryProvider>
<AuthCard title="Welcome back" subtitle="Sign in to your account">
  {#snippet children()}
    <form class="login-form" onsubmit={handleSubmit} novalidate>
      <div class="field">
        <FormInput
          id="username"
          name="username"
          type="text"
          value={bloc.username}
          onInput={(detail) => bloc.updateField('username', detail.value)}
          placeholder="your_username"
          label="Username or email"
          error={bloc.validationErrors.username}
          required
          className="login-input"
        />
      </div>

      <div class="field">
        <FormInput
          id="password"
          name="password"
          type="password"
          value={bloc.password}
          onInput={(detail) => bloc.updateField('password', detail.value)}
          placeholder="Enter your password"
          label="Password"
          error={bloc.validationErrors.password}
          required
          showPasswordToggle={true}
          className="login-input"
        />
      </div>

      {#if bloc.errorMessage}
        <ErrorBanner message={bloc.errorMessage} />
      {/if}

      <!-- Unverified account: nothing is wrong, there's just a step left, so
           this is amber rather than red. -->
      {#if bloc.needsVerification}
        <ErrorBanner severity="warning" message={VERIFY_BANNER.title}>
          {#snippet children()}
            <p class="verify-body">
              Accounts need a verified email before you can log in. Check
              <b>{bloc.verifyAddress}</b> for the link we sent — it's often in spam.
            </p>
            {#if bloc.resend.isSent}
              <p class="verify-sent">{VERIFY_BANNER.sent}</p>
            {:else if bloc.resend.isFailed}
              <p class="verify-failed">{VERIFY_BANNER.failed}</p>
            {:else}
              <button
                type="button"
                class="verify-action"
                onclick={() => void bloc.resendVerification()}
                disabled={bloc.resend.isSending}
              >
                {bloc.resend.isSending ? VERIFY_BANNER.sending : VERIFY_BANNER.action}
              </button>
            {/if}
          {/snippet}
        </ErrorBanner>
      {/if}

      <div class="field-row">
        <label class="checkbox-wrap">
          <input type="checkbox" name="remember" />
          <span class="checkbox-label">Remember me</span>
        </label>
        <a href="/auth/password-reset-request" class="link-muted">Forgot password?</a>
      </div>

      <div class="submit-row">
        <Button type="submit" size="lg" fullWidth loading={bloc.isSubmitting} disabled={!bloc.canSubmit}>
          Log in
        </Button>
      </div>
    </form>

    <div class="divider">
      <div class="divider-line"></div>
      <span class="divider-text">or</span>
      <div class="divider-line"></div>
    </div>
  {/snippet}

  {#snippet footer()}
    Don't have an account? <a href="/auth/register">Sign up</a>
  {/snippet}
</AuthCard>
</QueryProvider>

<style>
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

  /* --- Unverified-account banner body --- */
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
    margin-top: 10px;
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
    margin: 8px 0 0;
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
  .checkbox-wrap input[type='checkbox'] {
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

  /* The submit is a Button now -- height, spinner and the label that stays put
     under it all live in the primitive. This is only the extra breathing room
     between the last field and the CTA. */
  .submit-row {
    display: flex;
    margin-top: 4px;
  }

  /* --- Divider --- */
  .divider {
    display: flex;
    align-items: center;
    gap: 16px;
    margin: 24px 0 0;
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
</style>
