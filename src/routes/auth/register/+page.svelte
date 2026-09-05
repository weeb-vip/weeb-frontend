<script lang="ts">
  import Seo from '$lib/Seo.svelte';
  import QueryProvider from '$lib/components/shell/QueryProvider';
  import { onMount } from 'svelte';
  import AuthCard from '$lib/components/auth/AuthCard';
  import Button from '$lib/components/primitives/Button';
  import ErrorBanner from '$lib/components/primitives/ErrorBanner';
  import FormInput from '$lib/components/primitives/FormInput';
  import { RegisterBloc } from '$lib/components/auth/Register.bloc.svelte';

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

<Seo
  title="Register"
  description="Create your WeebVIP account to start tracking anime, get episode notifications, and discover new shows."
  noIndex={true}
/>

<!-- QueryProvider is the one place a TanStack client is made: a fresh one
     per SSR request, the shared one in the browser. -->
<QueryProvider>
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

      <div class="submit-row">
        <Button type="submit" size="lg" fullWidth loading={bloc.isSubmitting} disabled={!bloc.canSubmit}>
          Create account
        </Button>
      </div>
    </form>
  {/snippet}

  {#snippet footer()}
    Already have an account? <a href="/auth/login">Log in</a>
  {/snippet}
</AuthCard>
</QueryProvider>

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

  /* The submit is a Button; only the gap above it belongs to this page. */
  .submit-row {
    display: flex;
    margin-top: 4px;
  }
</style>
