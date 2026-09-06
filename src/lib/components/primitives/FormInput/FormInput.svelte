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

<!-- No <style> block. The field recipe -- .weeb-form-field / -label /
     .weeb-input-wrapper / .weeb-form-input and its modifiers / .weeb-input-icon-left /
     .weeb-password-toggle / .weeb-form-error -- lives in src/styles/design-tokens.css,
     because FormInput is no longer the only thing that draws a field: FormTextarea and
     Select's `field` variant are the same 44px / radius-8 / 15px / 1.5px control, and a
     rule owned privately by one component is how the settings form ended up with three
     of them. The error tint is --weeb-red-tint / --weeb-red-ring there, not the
     hardcoded oklch(20% 0.03 25) and oklch(40% 0.1 25 / 0.2) this file used to carry. -->
