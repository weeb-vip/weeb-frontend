<script lang="ts">
  import { onDestroy, onMount } from 'svelte';
  import ErrorBanner from './ErrorBanner.svelte';
  import FormInput from './FormInput.svelte';
  import { LoginRegisterModalBloc } from './LoginRegisterModal.bloc.svelte';
  import { VERIFY_BANNER } from './auth-shared';

  /**
   * The auth modal: the login form and the register form on one surface.
   *
   * A view over `LoginRegisterModalBloc`, which holds one `LoginBloc` and one
   * `RegisterBloc` rather than a third copy of their rules -- being that third
   * copy is how this file's register errors drifted away from the page's.
   */
  let {
    closeFn,
    bloc = new LoginRegisterModalBloc({ source: () => ({ closeFn }) })
  }: {
    /** Dismisses the modal. Supplied by whoever opened it. */
    closeFn?: () => void;
    bloc?: LoginRegisterModalBloc;
  } = $props();

  // Until hydration completes a submit would be a native form POST that
  // SvelteKit rejects (no form actions), so the button stays inert until here.
  onMount(() => bloc.markHydrated());
  onDestroy(() => bloc.dispose());

  function handleSubmit(event: Event) {
    event.preventDefault();
    void bloc.submit();
  }
</script>

<div class="weeb-auth-modal">
  <div class="modal-header">
    <div class="logo-mark">
      <svg width="20" height="20" viewBox="0 0 22 22" fill="none" aria-hidden="true">
        <path d="M4 5L8.5 16L11 10L13.5 16L18 5" stroke="white" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/>
        <circle cx="11" cy="11" r="1.2" fill="white" opacity="0.7"/>
      </svg>
    </div>
    <h2 class="modal-title">{bloc.title}</h2>
    <p class="modal-subtitle">{bloc.subtitle}</p>
  </div>

  {#if bloc.errorMessage}
    <ErrorBanner message={bloc.errorMessage} class="modal-alert" />
  {/if}

  <!-- Unverified account: amber, not red -- the credentials were correct,
       there's just a step left. Same wording as the login page. -->
  {#if bloc.needsVerification}
    <ErrorBanner severity="warning" message={VERIFY_BANNER.title} class="modal-alert">
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

  <form onsubmit={handleSubmit} class="auth-form" novalidate>
    <div class="form-group">
      <FormInput
        id="modal-username"
        name="username"
        type="text"
        value={bloc.username}
        placeholder={bloc.usernamePlaceholder}
        label={bloc.usernameLabel}
        error={bloc.validationErrors.username}
        required={true}
        onInput={(detail) => bloc.updateField('username', detail.value)}
      />
    </div>

    <div class="form-group">
      <FormInput
        id="modal-password"
        name="password"
        type="password"
        value={bloc.password}
        placeholder={bloc.passwordPlaceholder}
        label="Password"
        error={bloc.validationErrors.password}
        required={true}
        showPasswordToggle={true}
        onInput={(detail) => bloc.updateField('password', detail.value)}
      />
    </div>

    {#if bloc.isRegister}
      <div class="form-group">
        <FormInput
          id="modal-confirmPassword"
          name="confirmPassword"
          type="password"
          value={bloc.confirmPassword}
          placeholder="Re-enter your password"
          label="Confirm password"
          error={bloc.validationErrors.confirmPassword}
          required={true}
          showPasswordToggle={true}
          onInput={(detail) => bloc.updateField('confirmPassword', detail.value)}
        />
      </div>
    {:else}
      <div class="field-row">
        <label class="checkbox-wrap">
          <input type="checkbox" name="remember" />
          <span class="checkbox-label">Remember me</span>
        </label>
        <a href="/auth/password-reset-request" onclick={() => bloc.close()} class="link-accent">
          Forgot password?
        </a>
      </div>
    {/if}

    <button
      type="submit"
      class="btn-submit"
      class:loading={bloc.isSubmitting}
      disabled={!bloc.canSubmit}
    >
      <span class="btn-label">{bloc.submitLabel}</span>
      {#if bloc.isSubmitting}
        <span class="spinner" aria-hidden="true"></span>
      {/if}
    </button>
  </form>

  <!-- No standing "resend verification" link: an unverified login now surfaces
       the banner above, which resends to the address already typed in.
       /auth/resend-verification stays reachable for anyone who needs it. -->

  <div class="divider">
    <div class="divider-line"></div>
    <span class="divider-text">or</span>
    <div class="divider-line"></div>
  </div>

  <div class="mode-toggle">
    {bloc.togglePrompt}
    <button type="button" onclick={() => bloc.toggleMode()} class="link-accent">
      {bloc.toggleLabel}
    </button>
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
    border-radius: var(--weeb-radius-full, 9999px);
    background: linear-gradient(135deg, var(--weeb-accent), var(--weeb-violet));
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

  /* The banners keep the spacing the modal's own alerts had. */
  :global(.weeb-auth-modal .modal-alert) {
    margin-bottom: 20px;
  }

  /* Unverified-account banner body. Mirrors Login.svelte. */
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
    margin-top: 10px;
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
    margin: 8px 0 0;
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
    color: var(--weeb-accent-hover);
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
    background: var(--weeb-accent-hover);
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
    border-radius: var(--weeb-radius-full, 9999px);
    animation: weeb-auth-spin 0.7s linear infinite;
  }
  @keyframes -global-weeb-auth-spin {
    to { transform: rotate(360deg); }
  }
  @media (prefers-reduced-motion: reduce) {
    :global(.weeb-auth-modal .spinner) { animation-duration: 2s; }
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
