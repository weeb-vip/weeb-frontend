<script lang="ts">
  import Seo from '$lib/Seo.svelte';
  import { faEnvelope, faUser } from '@fortawesome/free-solid-svg-icons';
  import AuthCard from '$lib/components/auth/AuthCard';
  import Button from '$lib/components/primitives/Button';
  import ErrorBanner from '$lib/components/primitives/ErrorBanner';
  import FormInput from '$lib/components/primitives/FormInput';
  import { PasswordResetRequestBloc } from './PasswordResetRequest.bloc.svelte';

  /**
   * "I forgot my password".
   *
   * A view over `PasswordResetRequestBloc`. It used to hand-roll a Tailwind
   * lookalike of the auth shell and boot its own TanStack client through a
   * dynamic import before it could render anything; the request is one call
   * with nothing observing it, so it goes direct and the form renders on the
   * server like every other auth screen.
   */
  let { bloc = new PasswordResetRequestBloc() }: { bloc?: PasswordResetRequestBloc } = $props();

  const iconUser = faUser;
  const iconEnvelope = faEnvelope;

  function handleSubmit(event: Event) {
    event.preventDefault();
    void bloc.submit();
  }
</script>

<Seo title="Reset Password" />

<svelte:document onkeydown={(event) => bloc.handleKeyDown(event)} />

{#if bloc.submitted}
  <AuthCard title="Check your email">
    {#snippet media()}
      <div class="glyph good" aria-hidden="true">
        <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
          <rect x="2.5" y="5" width="19" height="14" rx="2.5" />
          <path d="M3 7l9 6 9-6" />
        </svg>
      </div>
    {/snippet}

    {#snippet children()}
      <p class="lede">
        We've sent a password reset link to <b>{bloc.email}</b>
      </p>
      <p class="hint">
        Please check your email and follow the instructions to reset your password.
      </p>
      <Button color="transparent" fullWidth href="/">Back to home</Button>
    {/snippet}
  </AuthCard>
{:else}
  <AuthCard
    title="Reset your password"
    subtitle="Enter your username and email address to receive a password reset link"
  >
    {#snippet media()}
      <div class="glyph" aria-hidden="true">
        <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
          <rect x="2.5" y="5" width="19" height="14" rx="2.5" />
          <path d="M3 7l9 6 9-6" />
        </svg>
      </div>
    {/snippet}

    {#snippet children()}
      <form class="pr-form" onsubmit={handleSubmit} aria-busy={bloc.isSubmitting} novalidate>
        <!-- One fieldset rather than a per-control `disabled`: it also takes
             the fields out of the tab order while the request is in flight,
             which is how the old screen let a second Enter send a second email. -->
        <fieldset disabled={bloc.isDisabled}>
          <FormInput
            id="username"
            name="username"
            type="text"
            value={bloc.username}
            onInput={(detail) => bloc.updateField('username', detail.value)}
            placeholder="Username"
            label="Username"
            icon={iconUser}
            required
            disabled={bloc.isDisabled}
          />

          <FormInput
            id="email"
            name="email"
            type="email"
            value={bloc.email}
            onInput={(detail) => bloc.updateField('email', detail.value)}
            placeholder="Email address"
            label="Email address"
            icon={iconEnvelope}
            required
            disabled={bloc.isDisabled}
          />

          {#if bloc.errorMessage}
            <ErrorBanner message={bloc.errorMessage} />
          {/if}

          <div class="submit-row">
            <Button type="submit" size="lg" fullWidth loading={bloc.isSubmitting} disabled={bloc.isDisabled}>
              {bloc.isSubmitting ? 'Sending…' : 'Send Reset Link'}
            </Button>
          </div>
        </fieldset>
      </form>
    {/snippet}

    {#snippet footer()}
      Remembered it? <a href="/auth/login">Sign in</a>
    {/snippet}
  </AuthCard>
{/if}

<style>
  .glyph {
    width: 56px;
    height: 56px;
    border-radius: var(--weeb-radius-full);
    background: color-mix(in oklch, var(--weeb-accent) 16%, transparent);
    color: var(--weeb-accent-text);
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .glyph.good {
    background: color-mix(in oklch, var(--weeb-green) 15%, transparent);
    color: var(--weeb-green);
  }

  .lede {
    font-size: 14px;
    color: var(--weeb-fg-secondary);
    line-height: 1.5;
    text-align: center;
    margin: 0 0 8px;
  }

  .lede b {
    color: var(--weeb-fg);
    font-weight: 600;
    word-break: break-all;
  }

  .hint {
    font-size: 12.5px;
    color: var(--weeb-fg-muted);
    text-align: center;
    line-height: 1.5;
    margin: 0 0 20px;
  }

  .pr-form fieldset {
    display: flex;
    flex-direction: column;
    gap: 18px;
    border: none;
    padding: 0;
    margin: 0;
    min-width: 0;
  }

  .pr-form fieldset:disabled {
    opacity: 0.6;
  }

  /* Both actions are Buttons; only the gap above the submit belongs here. */
  .submit-row {
    display: flex;
    margin-top: 4px;
  }
</style>
