<script lang="ts">
  import type { Snippet } from 'svelte';

  /**
   * The shell every auth screen sits in: the drifting gradient backdrop, the
   * centred column, the logo that doubles as a way home, and the card itself.
   *
   * Login, Register, EmailVerification and CheckEmail each carried an identical
   * copy of this wrapper and ~120 lines of identical CSS; PasswordResetRequest
   * and the password-reset route carried a Tailwind lookalike that had drifted
   * off the same design. One shell so they stop diverging.
   *
   * Presentational -- no bloc. The forms inside keep their own state.
   */
  let {
    title = '',
    subtitle = '',
    media,
    children,
    footer,
    showLogo = true,
    showBackground = true,
    headingId,
  }: {
    /** Card heading. Omit when `media` supplies its own (a verifying spinner, say). */
    title?: string;
    subtitle?: string;
    /** A glyph or spinner above the heading, as EmailVerification and CheckEmail use. */
    media?: Snippet;
    children: Snippet;
    /** The "Don't have an account? Sign up" line under the card body. */
    footer?: Snippet;
    showLogo?: boolean;
    /**
     * The fixed gradient is `position: fixed`, so a screen that renders two of
     * these (a route transition, a story grid) can turn the second one off.
     */
    showBackground?: boolean;
    /** Set when the caller needs to point an `aria-labelledby` at the title. */
    headingId?: string;
  } = $props();
</script>

{#if showBackground}
  <div class="page-bg" aria-hidden="true"></div>
{/if}

<main class="auth-main">
  <div class="auth-wrapper">
    {#if showLogo}
      <a href="/" class="logo-block" aria-label="weeb.vip - back to homepage">
        <div class="logo-mark">
          <svg width="24" height="24" viewBox="0 0 22 22" fill="none" aria-hidden="true">
            <path d="M4 5L8.5 16L11 10L13.5 16L18 5" stroke="white" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" />
            <circle cx="11" cy="11" r="1.2" fill="white" opacity="0.7" />
          </svg>
        </div>
        <span class="logo-wordmark">weeb.vip</span>
      </a>
    {/if}

    <div class="card">
      {#if media}
        <div class="card-media">{@render media()}</div>
      {/if}

      {#if title || subtitle}
        <div class="card-header">
          {#if title}<h1 class="card-title" id={headingId}>{title}</h1>{/if}
          {#if subtitle}<p class="card-subtitle">{subtitle}</p>{/if}
        </div>
      {/if}

      <div class="card-body">
        {@render children()}
      </div>

      {#if footer}
        <div class="card-footer">{@render footer()}</div>
      {/if}
    </div>
  </div>
</main>

<style>
  /* --- Animated backdrop --- */
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
  /* A 30s drift is decorative, not informative -- it goes away for anyone who
     asked for less motion. */
  @media (prefers-reduced-motion: reduce) {
    .page-bg { animation: none; }
  }

  /* --- Layout --- */
  .auth-main {
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

  /* --- Logo --- */
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
    border-radius: var(--weeb-radius-full, 9999px);
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
  .logo-block:focus-visible {
    outline: 2px solid var(--weeb-accent);
    outline-offset: 4px;
    border-radius: var(--weeb-radius, 8px);
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

  .card-media {
    display: flex;
    justify-content: center;
    margin-bottom: 20px;
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
    margin: 0 0 4px;
  }
  .card-subtitle {
    font-size: 14px;
    color: var(--weeb-fg-muted);
    margin: 0;
    line-height: 1.5;
  }

  .card-footer {
    margin-top: 20px;
    text-align: center;
    font-size: 14px;
    color: var(--weeb-fg-muted);
  }
  .card-footer :global(a) {
    color: var(--weeb-accent-text);
    text-decoration: none;
    font-weight: 500;
    transition: color 0.15s;
  }
  .card-footer :global(a:hover) {
    color: var(--weeb-accent-hover);
  }

  /* Inputs rendered by FormInput (or a plain form) inside the card body. Every
     auth screen repeated this block verbatim; it belongs to the shell, so a
     field looks the same whichever screen it lands on. */
  .card-body :global(input[type='text']),
  .card-body :global(input[type='password']),
  .card-body :global(input[type='email']) {
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
    appearance: none;
  }
  .card-body :global(input::placeholder) {
    color: var(--weeb-fg-muted);
  }
  .card-body :global(input:focus) {
    border-color: var(--weeb-accent);
    box-shadow: 0 0 0 3px color-mix(in oklch, var(--weeb-accent) 20%, transparent);
  }
  .card-body :global(label) {
    font-size: 13px;
    font-weight: 500;
    color: var(--weeb-fg-secondary);
    letter-spacing: 0.01em;
  }

  @media (max-width: 480px) {
    .auth-main { padding: 40px 12px 32px; }
    .card { padding: 28px 20px; }
  }
</style>
