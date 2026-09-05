<script lang="ts" module>
  import type { Snippet } from 'svelte';

  /**
   * Red is "this failed"; amber is "this didn't fail, there's a step left"
   * (Login's unverified-account banner); the other two carry the same box for
   * the confirmations that sit next to it in the same forms.
   */
  export type ErrorBannerSeverity = 'error' | 'warning' | 'info' | 'success';
</script>

<script lang="ts">
  /**
   * The "something failed, try again" banner. There were ~12 near-copies of
   * this box -- three different CSS spellings and two different
   * markup shapes -- so the point of this one is that they stop drifting.
   *
   * Presentational -- no bloc. Whoever caught the failure owns the retry.
   */
  let {
    message,
    detail = '',
    severity = 'error',
    onRetry,
    retryLabel = 'Try again',
    retrying = false,
    showIcon = true,
    children,
    class: className = '',
  }: {
    message: string;
    /** Second line: the specific cause, when there is one worth showing. */
    detail?: string;
    severity?: ErrorBannerSeverity;
    /** Omit and no retry control is drawn -- most form errors have nothing to retry. */
    onRetry?: () => void;
    retryLabel?: string;
    /** Disables the retry control and swaps its label while a retry is in flight. */
    retrying?: boolean;
    showIcon?: boolean;
    /** Extra actions or copy below the message, e.g. a "resend the email" link. */
    children?: Snippet;
    class?: string;
  } = $props();

  /**
   * A failure interrupts; a confirmation does not. `alert` is announced
   * immediately, `status` waits for a pause -- getting this backwards is the
   * usual reason a success toast talks over the user.
   */
  const liveRole = $derived(severity === 'error' || severity === 'warning' ? 'alert' : 'status');
</script>

<div class="eb eb--{severity} {className}" role={liveRole}>
  {#if showIcon}
    <span class="eb-icon" aria-hidden="true">
      {#if severity === 'success'}
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <circle cx="12" cy="12" r="10" /><path d="m8 12 3 3 5-6" />
        </svg>
      {:else if severity === 'info'}
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <circle cx="12" cy="12" r="10" /><path d="M12 16v-5M12 8h.01" />
        </svg>
      {:else if severity === 'warning'}
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z" />
          <path d="M12 9v4M12 17h.01" />
        </svg>
      {:else}
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <circle cx="12" cy="12" r="10" /><line x1="15" y1="9" x2="9" y2="15" /><line x1="9" y1="9" x2="15" y2="15" />
        </svg>
      {/if}
    </span>
  {/if}

  <div class="eb-body">
    <p class="eb-message">{message}</p>
    {#if detail}
      <p class="eb-detail">{detail}</p>
    {/if}
    {#if children}
      <div class="eb-extra">{@render children()}</div>
    {/if}
  </div>

  {#if onRetry}
    <button type="button" class="eb-retry" onclick={onRetry} disabled={retrying}>
      {retrying ? 'Retrying…' : retryLabel}
    </button>
  {/if}
</div>

<style>
  .eb {
    display: flex;
    align-items: flex-start;
    gap: 10px;
    padding: 11px 14px;
    border: 1px solid;
    border-radius: var(--weeb-radius, 8px);
    font-size: 13px;
    line-height: 1.5;
  }

  /* The tint is the same hue as the border at low alpha, so the box reads as
     one object rather than a coloured rule around neutral copy. */
  .eb--error {
    color: var(--weeb-red);
    background: color-mix(in oklch, var(--weeb-red) 12%, transparent);
    border-color: color-mix(in oklch, var(--weeb-red) 45%, transparent);
  }
  .eb--warning {
    color: var(--weeb-amber);
    background: color-mix(in oklch, var(--weeb-amber) 12%, transparent);
    border-color: color-mix(in oklch, var(--weeb-amber) 45%, transparent);
  }
  .eb--success {
    color: var(--weeb-green);
    background: color-mix(in oklch, var(--weeb-green) 12%, transparent);
    border-color: color-mix(in oklch, var(--weeb-green) 45%, transparent);
  }
  .eb--info {
    color: var(--weeb-accent-text);
    background: color-mix(in oklch, var(--weeb-accent) 12%, transparent);
    border-color: color-mix(in oklch, var(--weeb-accent) 45%, transparent);
  }

  .eb-icon {
    display: flex;
    flex-shrink: 0;
    /* Optically centred on the first line of text rather than the box. */
    margin-top: 2px;
  }

  .eb-body {
    flex: 1;
    min-width: 0;
  }

  .eb-message {
    margin: 0;
    font-weight: 500;
  }
  /* The cause is supporting detail, so it steps back to the neutral text
     colour instead of shouting in the severity hue a second time. */
  .eb-detail {
    margin: 4px 0 0;
    color: var(--weeb-fg-secondary);
    font-size: 12px;
  }
  .eb-extra { margin-top: 8px; }

  .eb-retry {
    flex-shrink: 0;
    align-self: center;
    height: 28px;
    padding: 0 12px;
    background: none;
    border: 1px solid currentColor;
    border-radius: var(--weeb-radius-sm, 4px);
    color: inherit;
    font-family: inherit;
    font-size: 12px;
    font-weight: 600;
    cursor: pointer;
    transition: background 0.15s, opacity 0.15s;
  }
  .eb-retry:hover:not(:disabled) {
    background: color-mix(in oklch, currentColor 15%, transparent);
  }
  .eb-retry:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
  .eb-retry:focus-visible {
    outline: 2px solid currentColor;
    outline-offset: 2px;
  }

  @media (max-width: 480px) {
    .eb {
      flex-wrap: wrap;
    }
    .eb-retry {
      width: 100%;
      margin-top: 4px;
    }
  }
</style>
