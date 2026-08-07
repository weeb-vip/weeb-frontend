<script lang="ts">
  import { onDestroy, onMount } from 'svelte';
  import { page } from '$app/stores';
  import debug from '../../utils/debug';
  import { emailProviderFor } from '../../utils/email-provider';
  import { useResendVerificationEmail } from '../services/queries';

  const RESEND_COOLDOWN_SECONDS = 60;

  let email = '';
  let resendError = '';
  let resentJustNow = false;
  let cooldown = 0;
  let timer: ReturnType<typeof setInterval> | undefined;

  const resendMutation = useResendVerificationEmail();

  // The address arrives as a query param from register, so the form is gone by
  // the time the user reads this and a typo is still visible and fixable.
  $: email = $page.url.searchParams.get('email') ?? '';
  $: provider = emailProviderFor(email);

  onMount(() => {
    if (!email) {
      debug.warn('CheckEmail rendered without an email query param');
    }
  });

  onDestroy(() => {
    if (timer) clearInterval(timer);
  });

  function startCooldown() {
    cooldown = RESEND_COOLDOWN_SECONDS;
    if (timer) clearInterval(timer);
    timer = setInterval(() => {
      cooldown -= 1;
      if (cooldown <= 0 && timer) {
        clearInterval(timer);
        timer = undefined;
      }
    }, 1000);
  }

  $: if ($resendMutation.isSuccess && !resentJustNow) {
    debug.success('Verification email resent');
    resentJustNow = true;
    resendError = '';
    startCooldown();
  }

  $: if ($resendMutation.isError) {
    debug.error('Failed to resend verification email', $resendMutation.error);
    resendError = 'We couldn\'t send that again just now. Try once more in a moment.';
    resentJustNow = false;
  }

  function handleResend() {
    if (cooldown > 0 || !email || $resendMutation.isPending) return;
    resentJustNow = false;
    resendError = '';
    $resendMutation.mutate({ username: email });
  }

  function formatCooldown(seconds: number): string {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${String(s).padStart(2, '0')}`;
  }

  $: isResending = $resendMutation.isPending;
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
      <div class="glyph" aria-hidden="true">
        <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
          <rect x="2.5" y="5" width="19" height="14" rx="2.5"/>
          <path d="M3 7l9 6 9-6"/>
        </svg>
      </div>

      <div class="card-header">
        <h1 class="card-title">Check your email</h1>
        <p class="card-subtitle">
          {#if email}
            We sent a verification link to<br /><b>{email}</b>
          {:else}
            We sent a verification link to the address you signed up with.
          {/if}
        </p>
      </div>

      {#if resentJustNow}
        <div class="alert alert-success" role="status">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <path d="M5 13l4 4L19 7"/>
          </svg>
          <p>Sent again just now — check your inbox.</p>
        </div>
      {:else}
        <ol class="steps">
          <li><span class="num">1</span><span>Open the email from weeb.vip</span></li>
          <li><span class="num">2</span><span>Click <em>Verify my email</em></span></li>
          <li><span class="num">3</span><span>Come back here and log in</span></li>
        </ol>
      {/if}

      {#if resendError}
        <div class="alert alert-error" role="alert">
          <p>{resendError}</p>
        </div>
      {/if}

      {#if provider.url}
        <a class="btn-primary" href={provider.url} target="_blank" rel="noopener noreferrer">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <rect x="3" y="5" width="18" height="14" rx="2"/>
            <path d="M3.5 7l8.5 5.5L20.5 7"/>
          </svg>
          {provider.label}
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
        {#if cooldown > 0}
          <span class="countdown" aria-live="polite">Resend in {formatCooldown(cooldown)}</span>
        {:else}
          <button type="button" class="link-btn" on:click={handleResend} disabled={isResending || !email}>
            {isResending ? 'Sending…' : 'Resend email'}
          </button>
        {/if}
      </div>

      <div class="card-footer">
        Wrong address? <a href="/auth/register">Sign up again</a>
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

  .glyph {
    width: 56px;
    height: 56px;
    border-radius: 50%;
    background: oklch(55% 0.15 280 / 0.16);
    color: var(--weeb-accent);
    display: flex;
    align-items: center;
    justify-content: center;
    margin: 0 auto 18px;
  }

  .card-header {
    margin-bottom: 22px;
    text-align: center;
  }

  .card-title {
    font-size: 24px;
    font-weight: 700;
    letter-spacing: -0.02em;
    color: var(--weeb-fg);
    margin-bottom: 5px;
  }

  .card-subtitle {
    font-size: 14px;
    color: var(--weeb-fg-muted);
    line-height: 1.5;
  }

  .card-subtitle b {
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
    border-radius: 50%;
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

  /* --- Alerts --- */
  .alert {
    font-size: 13px;
    padding: 11px 14px;
    border-radius: var(--weeb-radius);
    border: 1px solid;
    line-height: 1.5;
    display: flex;
    align-items: center;
    gap: 8px;
    margin-bottom: 20px;
  }

  .alert p {
    margin: 0;
  }

  .alert-success {
    color: var(--weeb-green);
    background: oklch(20% 0.03 155 / 0.5);
    border-color: var(--weeb-green);
  }

  .alert-error {
    color: var(--weeb-red);
    background: oklch(20% 0.03 25 / 0.5);
    border-color: var(--weeb-red);
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
    color: var(--weeb-accent);
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

  /* --- Card footer --- */
  .card-footer {
    text-align: center;
    font-size: 13px;
    color: var(--weeb-fg-muted);
    margin-top: 14px;
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
