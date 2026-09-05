<script lang="ts">
  import { onMount } from 'svelte';
  import AuthCard from './AuthCard.svelte';
  import ErrorBanner from './ErrorBanner.svelte';
  import FormInput from './FormInput.svelte';
  import { RegisterBloc } from './Register.bloc.svelte';

  /**
   * The sign-up page.
   *
   * A view over `RegisterBloc`: it owns the fields, the rules (shared with the
   * modal's register mode) and where a new account goes next. The shell is
   * `AuthCard`, the same one every auth screen sits in.
   */
  let { bloc = new RegisterBloc() }: { bloc?: RegisterBloc } = $props();

  // See Login: the submit stays inert until the form can be handled in JS.
  onMount(() => bloc.markHydrated());

  function handleSubmit(event: Event) {
    event.preventDefault();
    void bloc.submit();
  }
</script>

<AuthCard title="Create account" subtitle="Join the community">
  {#snippet children()}
    <form class="register-form" onsubmit={handleSubmit} novalidate>
      <div class="field">
        <FormInput
          id="username"
          name="username"
          type="email"
          value={bloc.username}
          onInput={(detail) => bloc.updateField('username', detail.value)}
          placeholder="you@example.com"
          label="Email"
          error={bloc.validationErrors.username}
          required
        />
        <!-- Sets the expectation before submitting, so the check-email screen
             that follows is expected rather than a surprise. -->
        {#if !bloc.validationErrors.username}
          <p class="field-hint">We'll send a link here to confirm it's yours.</p>
        {/if}
      </div>

      <div class="field">
        <FormInput
          id="password"
          name="password"
          type="password"
          value={bloc.password}
          onInput={(detail) => bloc.updateField('password', detail.value)}
          placeholder="At least 6 characters"
          label="Password"
          error={bloc.validationErrors.password}
          required
          showPasswordToggle={true}
        />

        {#if bloc.showStrength}
          <div class="strength-wrap" data-level={bloc.strength} aria-live="polite">
            <div class="strength-bars">
              <div class="strength-bar"></div>
              <div class="strength-bar"></div>
              <div class="strength-bar"></div>
              <div class="strength-bar"></div>
            </div>
            <span class="strength-label">{bloc.strengthLabel}</span>
          </div>
        {/if}
      </div>

      <div class="field">
        <FormInput
          id="confirmPassword"
          name="confirmPassword"
          type="password"
          value={bloc.confirmPassword}
          onInput={(detail) => bloc.updateField('confirmPassword', detail.value)}
          placeholder="Re-enter your password"
          label="Confirm password"
          error={bloc.validationErrors.confirmPassword}
          required
          showPasswordToggle={true}
        />
      </div>

      {#if bloc.errorMessage}
        <ErrorBanner message={bloc.errorMessage} />
      {/if}

      <button
        type="submit"
        class="btn-primary"
        class:loading={bloc.isSubmitting}
        disabled={!bloc.canSubmit}
      >
        <span class="btn-label">Create account</span>
        {#if bloc.isSubmitting}
          <span class="spinner" aria-hidden="true"></span>
        {/if}
      </button>
    </form>
  {/snippet}

  {#snippet footer()}
    Already have an account? <a href="/auth/login">Log in</a>
  {/snippet}
</AuthCard>

<style>
  .register-form {
    display: flex;
    flex-direction: column;
    gap: 18px;
  }

  .field {
    display: flex;
    flex-direction: column;
    gap: 0;
  }

  .field-hint {
    font-size: 12px;
    color: var(--weeb-fg-muted);
    line-height: 1.45;
    margin-top: 6px;
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
    border-radius: var(--weeb-radius-full);
    transition: background 0.25s;
  }

  .strength-label {
    font-size: 11px;
    color: var(--weeb-fg-muted);
    font-family: var(--weeb-font-mono);
    letter-spacing: 0.04em;
  }

  .strength-wrap[data-level='weak'] .strength-bar:nth-child(1) {
    background: var(--weeb-red);
  }
  .strength-wrap[data-level='weak'] .strength-label {
    color: var(--weeb-red);
  }

  .strength-wrap[data-level='medium'] .strength-bar:nth-child(1),
  .strength-wrap[data-level='medium'] .strength-bar:nth-child(2) {
    background: var(--weeb-amber);
  }
  .strength-wrap[data-level='medium'] .strength-label {
    color: var(--weeb-amber);
  }

  .strength-wrap[data-level='strong'] .strength-bar:nth-child(1),
  .strength-wrap[data-level='strong'] .strength-bar:nth-child(2),
  .strength-wrap[data-level='strong'] .strength-bar:nth-child(3) {
    background: var(--weeb-green);
  }
  .strength-wrap[data-level='strong'] .strength-label {
    color: var(--weeb-green);
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
    border-radius: var(--weeb-radius-full);
    animation: spin 0.7s linear infinite;
  }

  @keyframes spin { to { transform: rotate(360deg); } }
  @media (prefers-reduced-motion: reduce) {
    .spinner { animation-duration: 2s; }
  }
</style>
