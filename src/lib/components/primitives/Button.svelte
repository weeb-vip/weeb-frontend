<script lang="ts">
  import Fa from 'svelte-fa';
  import {
    faSpinner,
    faCheckCircle,
    faExclamationCircle,
  } from '@fortawesome/free-solid-svg-icons';

  type ButtonStatus = 'idle' | 'loading' | 'success' | 'error';

  let {
    color = 'blue',
    label = '',
    icon = '',
    onClick = () => {},
    showLabel = true,
    className = '',
    status = 'idle',
    onResetStatus,
    disabled = false,
  }: {
    color?: 'blue' | 'red' | 'transparent' | '';
    label?: string;
    /** Raw SVG markup rendered in place of the label. */
    icon?: string;
    onClick?: () => void;
    showLabel?: boolean;
    className?: string;
    status?: ButtonStatus;
    /** Called once the transient success/error state has been shown. */
    onResetStatus?: () => void;
    disabled?: boolean;
  } = $props();

  // The caller's status shows immediately, including on the first paint; success
  // and error are transient, so after two seconds the button falls back to idle
  // on its own. `expired` is that local override and nothing else.
  let expired = $state(false);
  const internalStatus = $derived<ButtonStatus>(expired ? 'idle' : status);

  $effect(() => {
    expired = false;
    if (status === 'idle') return;

    const timer = setTimeout(() => {
      expired = true;
      onResetStatus?.();
    }, 2000);
    return () => clearTimeout(timer);
  });

  const colorClasses = {
    blue: 'btn-accent',
    red: 'btn-danger',
    transparent: 'btn-ghost',
    '': '',
  };

  function handleClick() {
    if (internalStatus !== 'loading' && !disabled) {
      onClick();
    }
  }
</script>

<button
  onclick={handleClick}
  disabled={internalStatus === 'loading' || disabled}
  class="btn {colorClasses[color]} {className} {internalStatus === 'loading' ? 'cursor-not-allowed' : 'cursor-pointer'}"
>
  {#if internalStatus === 'loading'}
    <Fa icon={faSpinner} class="animate-spin" />
  {:else if internalStatus === 'success'}
    <Fa icon={faCheckCircle} class="text-green-500" />
  {:else if internalStatus === 'error'}
    <Fa icon={faExclamationCircle} class="text-red-500" />
  {:else}
    <!-- Idle state -->
    {#if icon}
      {@html icon}
    {:else if showLabel && label}
      <span>{label}</span>
    {/if}
  {/if}
</button>

<style>
  .btn {
    /* WCAG 2.5.5 at the shared base, so every variant clears it rather than
       each caller remembering to. */
    min-height: 44px;
    padding: 7px 18px;
    border-radius: var(--weeb-radius, 8px);
    /* Body step. 13px is not on the ramp, and it left the shared button a
       pixel adrift from the hero's own primary CTA at 14px. */
    font-size: 14px;
    font-weight: 600;
    font-family: inherit;
    transition: background 0.15s, color 0.15s, border-color 0.15s;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    white-space: nowrap;
    width: fit-content;
    position: relative;
    border: none;
    cursor: pointer;
  }
  .btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
  .btn-accent {
    background: var(--weeb-accent);
    color: white;
  }
  .btn-accent:hover:not(:disabled) {
    background: var(--weeb-accent-hover);
  }
  .btn-danger {
    background: var(--weeb-red);
    color: white;
  }
  .btn-danger:hover:not(:disabled) {
    filter: brightness(1.1);
  }
  .btn-ghost {
    background: transparent;
    color: var(--weeb-fg-secondary);
    border: 1px solid var(--weeb-border);
  }
  .btn-ghost:hover:not(:disabled) {
    color: var(--weeb-fg);
    background: var(--weeb-surface);
  }
</style>