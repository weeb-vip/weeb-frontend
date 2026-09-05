<script lang="ts">
  import Fa from 'svelte-fa';
  import { faEye, faEyeSlash } from '@fortawesome/free-solid-svg-icons';
  import type { IconDefinition } from '@fortawesome/fontawesome-svg-core';

  /** What a keystroke reports back: the new value, plus the raw DOM event so a
   * caller with several fields can still read `target.name`. */
  export type FormInputDetail = { value: string; originalEvent: Event };

  let {
    id,
    name,
    type = 'text',
    value = $bindable(''),
    placeholder = '',
    label = '',
    icon = null,
    error = '',
    required = false,
    disabled = false,
    className = '',
    showPasswordToggle = false,
    onInput,
  }: {
    id: string;
    name: string;
    type?: 'text' | 'email' | 'password';
    value?: string;
    placeholder?: string;
    label?: string;
    icon?: IconDefinition | null;
    error?: string;
    required?: boolean;
    disabled?: boolean;
    className?: string;
    showPasswordToggle?: boolean;
    onInput?: (detail: FormInputDetail) => void;
  } = $props();

  let isPasswordVisible = $state(false);

  function togglePasswordVisibility() {
    isPasswordVisible = !isPasswordVisible;
  }

  function handleInput(event: Event) {
    const target = event.target as HTMLInputElement;
    value = target.value;
    onInput?.({ value, originalEvent: event });
  }

  const inputType = $derived(showPasswordToggle && isPasswordVisible ? 'text' : type);
</script>

<div class="weeb-form-field">
  {#if label}
    <label
      for={id}
      class="weeb-form-label"
    >
      {label}
    </label>
  {/if}

  <div class="weeb-input-wrapper">
    <!-- Left icon -->
    {#if icon}
      <div class="weeb-input-icon-left">
        <Fa {icon} />
      </div>
    {/if}

    <!-- Input field -->
    <input
      {id}
      {name}
      type={inputType}
      {value}
      oninput={handleInput}
      {placeholder}
      {required}
      {disabled}
      class="weeb-form-input {className}"
      class:has-icon={icon}
      class:has-toggle={showPasswordToggle}
      class:has-error={error}
      class:is-disabled={disabled}
      aria-describedby={error ? `${id}-error` : undefined}
    />

    <!-- Password toggle button -->
    {#if showPasswordToggle}
      <button
        type="button"
        class="weeb-password-toggle"
        onclick={togglePasswordVisibility}
        tabindex="-1"
      >
        <Fa icon={isPasswordVisible ? faEyeSlash : faEye} />
      </button>
    {/if}
  </div>

  <!-- Error message -->
  {#if error}
    <p id="{id}-error" class="weeb-form-error">
      {error}
    </p>
  {/if}
</div>

<style>
  /* Global styles for portal compatibility */
  :global(.weeb-form-field) {
    display: flex;
    flex-direction: column;
  }

  :global(.weeb-form-label) {
    font-size: 13px;
    font-weight: 500;
    color: var(--weeb-fg-secondary);
    letter-spacing: 0.01em;
    margin-bottom: 6px;
  }

  :global(.weeb-input-wrapper) {
    position: relative;
    display: flex;
    align-items: center;
  }

  :global(.weeb-form-input) {
    width: 100%;
    height: 44px;
    padding: 0 16px;
    background: var(--weeb-surface);
    border: 1.5px solid var(--weeb-border);
    border-radius: var(--weeb-radius);
    font-size: 15px;
    color: var(--weeb-fg);
    outline: none;
    transition: border-color 0.2s, box-shadow 0.2s;
  }

  :global(.weeb-form-input::placeholder) {
    color: var(--weeb-fg-muted);
  }

  :global(.weeb-form-input:focus) {
    border-color: var(--weeb-accent);
    box-shadow: 0 0 0 3px color-mix(in oklch, var(--weeb-accent) 20%, transparent);
  }

  :global(.weeb-form-input.has-icon) {
    padding-left: 40px;
  }

  :global(.weeb-form-input.has-toggle) {
    padding-right: 44px;
  }

  :global(.weeb-form-input.has-error) {
    border-color: var(--weeb-red);
    background: oklch(20% 0.03 25);
  }

  :global(.weeb-form-input.has-error:focus) {
    border-color: var(--weeb-red);
    box-shadow: 0 0 0 3px oklch(40% 0.1 25 / 0.2);
  }

  :global(.weeb-form-input.is-disabled) {
    opacity: 0.5;
    cursor: not-allowed;
  }

  :global(.weeb-input-icon-left) {
    position: absolute;
    left: 12px;
    top: 50%;
    transform: translateY(-50%);
    display: flex;
    align-items: center;
    pointer-events: none;
    color: var(--weeb-fg-muted);
  }

  :global(.weeb-password-toggle) {
    position: absolute;
    right: 0;
    top: 0;
    width: 44px;
    height: 44px;
    display: flex;
    align-items: center;
    justify-content: center;
    background: none;
    border: none;
    cursor: pointer;
    color: var(--weeb-fg-muted);
    transition: color 0.2s;
    padding: 0;
  }

  :global(.weeb-password-toggle:hover) {
    color: var(--weeb-fg-secondary);
  }

  :global(.weeb-form-error) {
    font-size: 12px;
    color: var(--weeb-red);
    margin-top: 4px;
  }
</style>