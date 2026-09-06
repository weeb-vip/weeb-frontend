<script lang="ts">
  import Seo from '$lib/Seo.svelte';
  import QueryProvider from '$lib/components/shell/QueryProvider';
  import { onDestroy } from 'svelte';
  import { faUser } from '@fortawesome/free-solid-svg-icons';
  import AuthCard from '$lib/components/auth/AuthCard';
  import Button from '$lib/components/primitives/Button';
  import ErrorBanner from '$lib/components/primitives/ErrorBanner';
  import FormInput from '$lib/components/primitives/FormInput';
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

<Seo
  title="Resend Verification"
  description="Resend email verification to complete your WeebVIP account setup."
  noIndex={true}
/>

<!-- QueryProvider is the one place a TanStack client is made: a fresh one
     per SSR request, the shared one in the browser. -->
<QueryProvider>
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

      <div class="submit-row">
        <Button type="submit" size="lg" fullWidth loading={bloc.isSubmitting}>
          Send Verification Email
        </Button>
      </div>
    </form>
  {/snippet}

  {#snippet footer()}
    <p class="rv-link">Already verified? <a href="/auth/login">Sign in here</a></p>
    <p class="rv-link">Need help? <a href="/auth/password-reset-request">Reset your password</a></p>
  {/snippet}
</AuthCard>
</QueryProvider>

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

  /* The submit is a Button; only the gap above it belongs to this page. */
  .submit-row {
    display: flex;
    margin-top: 4px;
  }
</style>
