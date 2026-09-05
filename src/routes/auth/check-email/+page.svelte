<script lang="ts">
  import Seo from '$lib/Seo.svelte';
  import QueryProvider from '../../../svelte/components/QueryProvider.svelte';
  import { onDestroy, onMount } from 'svelte';
  import AuthCard from '../../../svelte/components/AuthCard.svelte';
  import ErrorBanner from '../../../svelte/components/ErrorBanner.svelte';
  import { CheckEmailBloc } from '../../../svelte/components/CheckEmail.bloc.svelte';

  /**
   * The screen straight after registering: what to do next, and how to get
   * another link if the first one never arrived.
   *
   * A view over `CheckEmailBloc`, which holds the address from the URL, the
   * webmail deep link for its domain, and the resend cooldown.
   */
  let { bloc = new CheckEmailBloc() }: { bloc?: CheckEmailBloc } = $props();

  onMount(() => bloc.start());
  onDestroy(() => bloc.dispose());
</script>

<Seo
  title="Check your email"
  description="Confirm your email address to finish setting up your WeebVIP account."
  noIndex={true}
/>

<!-- QueryProvider is the one place a TanStack client is made: a fresh one
     per SSR request, the shared one in the browser. -->
<QueryProvider>
<AuthCard title="Check your email">
  {#snippet media()}
    <div class="glyph" aria-hidden="true">
      <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
        <rect x="2.5" y="5" width="19" height="14" rx="2.5" />
        <path d="M3 7l9 6 9-6" />
      </svg>
    </div>
  {/snippet}

  {#snippet children()}
    <p class="sent-to">
      {#if bloc.hasEmail}
        We sent a verification link to<br /><b>{bloc.email}</b>
      {:else}
        We sent a verification link to the address you signed up with.
      {/if}
    </p>

    {#if bloc.resentJustNow}
      <ErrorBanner
        severity="success"
        message="Sent again just now — check your inbox."
        class="ce-alert"
      />
    {:else}
      <ol class="steps">
        <li><span class="num">1</span><span>Open the email from weeb.vip</span></li>
        <li><span class="num">2</span><span>Click <em>Verify my email</em></span></li>
        <li><span class="num">3</span><span>Come back here and log in</span></li>
      </ol>
    {/if}

    {#if bloc.resendError}
      <ErrorBanner message={bloc.resendError} class="ce-alert" />
    {/if}

    {#if bloc.provider.url}
      <a class="btn-primary" href={bloc.provider.url} target="_blank" rel="noopener noreferrer">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
          <rect x="3" y="5" width="18" height="14" rx="2" />
          <path d="M3.5 7l8.5 5.5L20.5 7" />
        </svg>
        {bloc.provider.label}
      </a>
    {:else}
      <a class="btn-primary" href="/auth/login">Go to log in</a>
    {/if}

    <!-- 15 minutes is the token's actual lifetime (exp - iat on the
         EMAIL_VERIFICATION JWT), not a rounded guess. Say it plainly: a link
         this short-lived is otherwise a mystery failure. -->
    <p class="hint">The link expires in 15 minutes. Nothing yet? It's often in spam.</p>

    <div class="resend-row">
      <span>Didn't get it?</span>
      {#if bloc.isCoolingDown}
        <!-- A countdown replaces the button, so repeat taps can't fan out N
             identical emails. -->
        <span class="countdown" aria-live="polite">Resend in {bloc.cooldownLabel}</span>
      {:else}
        <button
          type="button"
          class="link-btn"
          onclick={() => void bloc.resendEmail()}
          disabled={!bloc.canResend}
        >
          {bloc.isResending ? 'Sending…' : 'Resend email'}
        </button>
      {/if}
    </div>
  {/snippet}

  {#snippet footer()}
    Wrong address? <a href="/auth/register">Sign up again</a>
  {/snippet}
</AuthCard>
</QueryProvider>

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

  /* The address is a subtitle in everything but markup: it needs the emphasis
     on the address itself, which AuthCard's plain-text `subtitle` can't carry,
     so it leads the body instead. */
  .sent-to {
    font-size: 14px;
    color: var(--weeb-fg-muted);
    line-height: 1.5;
    text-align: center;
    margin: 0 0 22px;
  }

  .sent-to b {
    color: var(--weeb-fg);
    font-weight: 600;
    word-break: break-all;
  }

  /* --- Numbered steps --- */
  .steps {
    list-style: none;
    margin: 0 0 22px;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: 9px;
  }

  .steps li {
    display: flex;
    gap: 10px;
    align-items: flex-start;
    font-size: 13.5px;
    color: var(--weeb-fg-secondary);
    line-height: 1.45;
  }

  .steps em {
    color: var(--weeb-fg);
    font-style: normal;
  }

  .steps .num {
    flex-shrink: 0;
    width: 19px;
    height: 19px;
    border-radius: var(--weeb-radius-full);
    background: var(--weeb-surface);
    border: 1px solid var(--weeb-border);
    color: var(--weeb-fg-muted);
    font-family: var(--weeb-font-mono);
    font-size: 10.5px;
    display: flex;
    align-items: center;
    justify-content: center;
    margin-top: 1px;
  }

  /* The banners sit in the same rhythm as the step list they replace. */
  :global(.ce-alert) {
    margin-bottom: 20px;
  }

  /* --- Primary action --- */
  .btn-primary {
    width: 100%;
    height: 46px;
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
    gap: 9px;
    text-decoration: none;
    transition: background 0.15s, transform 0.1s;
  }

  .btn-primary:hover {
    background: var(--weeb-accent-hover);
  }

  .btn-primary:active {
    transform: scale(0.99);
  }

  .hint {
    font-size: 12.5px;
    color: var(--weeb-fg-muted);
    text-align: center;
    line-height: 1.5;
    margin-top: 12px;
  }

  /* --- Resend row --- */
  .resend-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    border-top: 1px solid var(--weeb-border);
    margin-top: 20px;
    padding-top: 16px;
    font-size: 13.5px;
    color: var(--weeb-fg-muted);
  }

  .countdown {
    font-family: var(--weeb-font-mono);
    font-size: 12.5px;
    color: var(--weeb-fg-secondary);
    font-variant-numeric: tabular-nums;
  }

  .link-btn {
    background: none;
    border: none;
    padding: 0;
    font-size: 13.5px;
    font-family: inherit;
    font-weight: 500;
    color: var(--weeb-accent-text);
    cursor: pointer;
    transition: color 0.15s;
  }

  .link-btn:hover:not(:disabled) {
    color: var(--weeb-accent-hover);
    text-decoration: underline;
  }

  .link-btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
</style>
