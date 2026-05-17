<script lang="ts">
  import { onMount } from 'svelte';
  import Fa from 'svelte-fa';
  import { faSpinner, faCheckCircle, faExclamationCircle } from '@fortawesome/free-solid-svg-icons';

  export let color: 'blue' | 'red' | 'transparent' | '' = 'blue';
  export let label: string = '';
  export let icon: string = '';
  export let onClick: () => void = () => {};
  export let showLabel: boolean = true;
  export let className: string = '';
  export let status: 'idle' | 'loading' | 'success' | 'error' = 'idle';
  export let onResetStatus: (() => void) | undefined = undefined;
  export let disabled: boolean = false;

  let internalStatus: 'idle' | 'loading' | 'success' | 'error' = 'idle';
  let buttonRef: HTMLButtonElement;

  $: {
    if (status) {
      internalStatus = status;
      if (status !== 'idle') {
        setTimeout(() => {
          internalStatus = 'idle';
          onResetStatus?.();
        }, 2000);
      }
    }
  }

  const colorClasses = {
    blue: 'btn-accent',
    red: 'btn-danger',
    transparent: 'btn-ghost',
    '': ''
  };

  function handleClick() {
    if (internalStatus !== 'loading' && !disabled) {
      onClick();
    }
  }
</script>

<button
  bind:this={buttonRef}
  on:click={handleClick}
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
    padding: 7px 18px;
    border-radius: var(--weeb-radius, 8px);
    font-size: 13px;
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