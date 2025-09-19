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
    blue: 'bg-blue-600 hover:bg-blue-700 text-white',
    red: 'bg-red-600 hover:bg-red-700 text-white',
    transparent: 'bg-transparent hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-200 border border-gray-300 dark:border-gray-600',
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
  class="px-4 py-2 relative rounded-full font-medium transition-colors duration-300 flex items-center justify-center whitespace-nowrap w-fit {colorClasses[color]} {className} {internalStatus === 'loading' ? 'cursor-not-allowed' : 'cursor-pointer'}"
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