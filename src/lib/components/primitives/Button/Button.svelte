
<script lang="ts">
  import Fa from 'svelte-fa';
  import { faCheckCircle, faExclamationCircle } from '@fortawesome/free-solid-svg-icons';
  import {
    buttonClasses,
    isTransient,
    phaseOf,
    requestedStatus,
    STATUS_HOLD_MS,
    type ButtonProps
  } from './Button.logic';

  /**
   * The one action control.
   *
   * It renders a `<button>` or, with `href`, an `<a>` that looks and focuses the
   * same, so a link CTA never has to be hand-rolled. The transient states
   * (loading / success / error) overlay the label rather than replacing it:
   * swapping the content collapsed the button mid-request (167px -> 49px), which
   * every hand-rolled copy had already worked around by keeping its label at
   * `opacity: 0` under the spinner. The copies were right.
   *
   * Presentational -- no bloc.
   */
  let {
    color = 'blue',
    size = 'md',
    fullWidth = false,
    href,
    target,
    rel,
    type = 'button',
    icon = null,
    children,
    onClick = () => {},
    className = '',
    status = 'idle',
    loading = false,
    onResetStatus,
    disabled = false,
    ariaLabel,
  }: ButtonProps = $props();

  // The caller's status shows immediately, including on the first paint; success
  // and error are transient, so after two seconds the button falls back to idle
  // on its own. `expired` is that local override and nothing else.
  let expired = $state(false);
  const requested = $derived(requestedStatus(status, loading));
  const phase = $derived(phaseOf(requested, expired));
  const isLoading = $derived(phase === 'loading');
  const isInert = $derived(isLoading || disabled);

  $effect(() => {
    expired = false;
    if (!isTransient(requested)) return;

    const timer = setTimeout(() => {
      expired = true;
      onResetStatus?.();
    }, STATUS_HOLD_MS);
    return () => clearTimeout(timer);
  });

  const classes = $derived(buttonClasses(size, color, fullWidth, className));

  function handleClick(event: MouseEvent) {
    if (isInert) {
      event.preventDefault();
      return;
    }
    onClick();
  }
</script>

{#snippet inner()}
  {#if phase !== 'idle'}
    <span class="btn-state" aria-hidden="true">
      {#if phase === 'loading'}
        <span class="btn-spinner"></span>
      {:else if phase === 'success'}
        <Fa icon={faCheckCircle} />
      {:else}
        <Fa icon={faExclamationCircle} />
      {/if}
    </span>
  {/if}

  <!-- Kept in the flow, just invisible: the button must not resize mid-request,
       and the accessible name has to survive the spinner. -->
  <span class="btn-content" class:btn-content--under={phase !== 'idle'}>
    {#if icon}
      <Fa {icon} />
    {/if}
    {@render children?.()}
  </span>
{/snippet}

{#if href}
  <a
    {href}
    {target}
    {rel}
    class={classes}
    aria-label={ariaLabel}
    aria-disabled={isInert ? 'true' : undefined}
    aria-busy={isLoading ? 'true' : undefined}
    onclick={handleClick}
  >
    {@render inner()}
  </a>
{:else}
  <button
    {type}
    onclick={handleClick}
    disabled={isInert}
    aria-label={ariaLabel}
    aria-busy={isLoading ? 'true' : undefined}
    class={classes}
  >
    {@render inner()}
  </button>
{/if}

<style>
  .btn {
    /* WCAG 2.5.5 at the shared base, so every variant clears it rather than
       each caller remembering to. */
    min-height: 44px;
    padding: 7px 18px;
    border-radius: var(--weeb-radius);
    /* Body step. 13px is not on the ramp, and it left the shared button a
       pixel adrift from the hero's own primary CTA at 14px. */
    font-size: 14px;
    font-weight: 600;
    font-family: inherit;
    text-decoration: none;
    transition: background 0.15s, color 0.15s, border-color 0.15s, transform 0.1s;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    white-space: nowrap;
    width: fit-content;
    position: relative;
    border: none;
    cursor: pointer;
  }
  .btn:disabled,
  .btn[aria-disabled='true'] {
    opacity: 0.5;
    cursor: not-allowed;
  }
  /* A link cannot be `disabled`, so an inert one has to stop navigating too. */
  a.btn[aria-disabled='true'] {
    pointer-events: none;
  }
  .btn:active:not(:disabled):not([aria-disabled='true']) {
    transform: scale(0.99);
  }
  .btn--full {
    width: 100%;
  }

  /* --- Sizes --- */
  .btn--sm {
    min-height: 36px;
    padding: 0 20px;
    font-size: 13.6px;
    gap: 6px;
  }
  .btn--lg {
    min-height: 46px;
    padding: 7px 20px;
    font-size: 15px;
    letter-spacing: 0.01em;
  }
  .btn--hero {
    padding: 10px 24px;
  }
  .btn--icon {
    width: 32px;
    height: 32px;
    min-height: 32px;
    padding: 0;
    font-size: 12px;
    border-radius: var(--weeb-radius-full);
  }

  /* --- Colours --- */
  .btn-accent {
    background: var(--weeb-accent);
    color: white;
  }
  .btn-accent:hover:not(:disabled):not([aria-disabled='true']) {
    background: var(--weeb-accent-hover);
  }
  .btn-danger {
    background: var(--weeb-red);
    color: white;
  }
  .btn-danger:hover:not(:disabled):not([aria-disabled='true']) {
    filter: brightness(1.1);
  }
  .btn-ghost {
    background: transparent;
    color: var(--weeb-fg-secondary);
    border: 1px solid var(--weeb-border);
  }
  .btn-ghost:hover:not(:disabled):not([aria-disabled='true']) {
    color: var(--weeb-fg);
    background: var(--weeb-surface);
  }
  /* On the banner the ghost sits next to a filled accent CTA on artwork, so it
     carries full-strength text on a surface rather than the secondary grey. */
  .btn--hero.btn-ghost {
    color: var(--weeb-fg);
    background: var(--weeb-surface);
  }
  .btn--hero.btn-ghost:hover:not(:disabled):not([aria-disabled='true']) {
    background: var(--weeb-surface-hover);
  }

  /* --- Transient states --- */
  .btn-content {
    display: inline-flex;
    align-items: center;
    gap: inherit;
    transition: opacity 0.12s;
  }
  .btn-content--under {
    opacity: 0;
  }
  .btn-state {
    position: absolute;
    inset: 0;
    display: flex;
    align-items: center;
    justify-content: center;
  }
  .btn-spinner {
    display: block;
    width: 18px;
    height: 18px;
    /* currentColor, so one spinner serves the accent, danger and ghost variants
       without any of them hardcoding a colour. */
    border: 2px solid color-mix(in oklch, currentColor 30%, transparent);
    border-top-color: currentColor;
    border-radius: var(--weeb-radius-full);
    animation: spin 0.7s linear infinite;
  }
  .btn--sm .btn-spinner,
  .btn--icon .btn-spinner {
    width: 14px;
    height: 14px;
  }
  @keyframes spin {
    to {
      transform: rotate(360deg);
    }
  }
  @media (prefers-reduced-motion: reduce) {
    .btn-spinner {
      animation-duration: 2s;
    }
  }
</style>
