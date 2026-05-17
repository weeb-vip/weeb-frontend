<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import Fa from 'svelte-fa';
  import { faEye, faEyeSlash } from '@fortawesome/free-solid-svg-icons';
  import type { IconDefinition } from '@fortawesome/fontawesome-svg-core';

  export let id: string;
  export let name: string;
  export let type: 'text' | 'email' | 'password' = 'text';
  export let value: string = '';
  export let placeholder: string = '';
  export let label: string = '';
  export let icon: IconDefinition | null = null;
  export let error: string = '';
  export let required: boolean = false;
  export let disabled: boolean = false;
  export let className: string = '';
  export let showPasswordToggle: boolean = false;

  let isPasswordVisible = false;

  const dispatch = createEventDispatcher();

  function togglePasswordVisibility() {
    isPasswordVisible = !isPasswordVisible;
  }

  function handleInput(event: Event) {
    const target = event.target as HTMLInputElement;
    value = target.value;
    dispatch('input', { value, originalEvent: event });
  }

  // Computed values
  $: hasIcon = icon || showPasswordToggle;
  $: iconPaddingClass = icon ? 'pl-10' : 'pl-4';
  $: passwordTogglePaddingClass = showPasswordToggle ? 'pr-10' : 'pr-4';

  // Base classes for all inputs
  $: baseInputClasses = `
    w-full px-4 py-3 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-400 transition-all duration-300
    bg-weeb-surface text-weeb-fg
    ${disabled ? 'opacity-50 cursor-not-allowed' : ''}
  `.trim();

  // Error and normal state classes
  $: stateClasses = error
    ? 'border-weeb-red focus:ring-red-400'
    : 'border-weeb-border focus:border-weeb-accent';

  // Label classes - show label if provided, otherwise use sr-only
  $: labelClasses = label
    ? 'block text-sm font-medium mb-2 text-weeb-fg-secondary'
    : 'sr-only';

  $: inputClasses = `
    ${baseInputClasses}
    ${stateClasses}
    ${iconPaddingClass}
    ${passwordTogglePaddingClass}
    ${className}
  `.trim();

  $: inputType = showPasswordToggle && isPasswordVisible ? 'text' : type;
</script>

<div>
  {#if label}
    <label
      for={id}
      class={labelClasses}
    >
      {label}
    </label>
  {/if}

  <div class="relative">
    <!-- Left icon -->
    {#if icon}
      <div class="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
        <Fa {icon} class="h-5 w-5 text-weeb-fg-muted" />
      </div>
    {/if}

    <!-- Input field -->
    <input
      {id}
      {name}
      type={inputType}
      {value}
      on:input={handleInput}
      {placeholder}
      {required}
      {disabled}
      class={inputClasses}
      aria-describedby={error ? `${id}-error` : undefined}
    />

    <!-- Password toggle button -->
    {#if showPasswordToggle}
      <button
        type="button"
        class="absolute inset-y-0 right-0 pr-3 flex items-center"
        on:click={togglePasswordVisibility}
        tabindex="-1"
      >
        <Fa
          icon={isPasswordVisible ? faEyeSlash : faEye}
          class="h-5 w-5 text-weeb-fg-muted hover:text-weeb-fg-muted hover:text-weeb-fg-secondary transition-colors"
        />
      </button>
    {/if}
  </div>

  <!-- Error message -->
  {#if error}
    <p id="{id}-error" class="mt-1 text-sm text-weeb-red">
      {error}
    </p>
  {/if}
</div>