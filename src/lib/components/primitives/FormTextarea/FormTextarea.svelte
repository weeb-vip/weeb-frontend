<script lang="ts" module>
  /** What a keystroke reports back -- the same shape FormInput reports. */
  export type FormTextareaDetail = { value: string; originalEvent: Event };
</script>

<script lang="ts">
  /**
   * FormInput, given more than one line.
   *
   * It exists because the settings form ran three field languages at once: a
   * FormInput at 44px / radius-8 / 15px / 1.5px border, a hand-rolled Tailwind
   * <select> at 42px / rounded-md / 16px / 1px, and a hand-rolled <textarea> at
   * the same 6px/16px as the select. All three now draw from the one
   * `.weeb-form-*` recipe in design-tokens.css, so the only thing this file
   * decides is how many lines the field is and whether it counts them.
   *
   * Presentational -- no bloc. Whoever owns the form owns the value.
   */
  let {
    id,
    name,
    value = $bindable(''),
    placeholder = '',
    label = '',
    rows = 3,
    /** Caps the value AND turns the counter on; the counter is meaningless without a cap. */
    maxlength,
    error = '',
    required = false,
    disabled = false,
    className = '',
    onInput,
  }: {
    id: string;
    name: string;
    value?: string;
    placeholder?: string;
    label?: string;
    rows?: number;
    maxlength?: number;
    error?: string;
    required?: boolean;
    disabled?: boolean;
    className?: string;
    onInput?: (detail: FormTextareaDetail) => void;
  } = $props();

  function handleInput(event: Event) {
    const target = event.target as HTMLTextAreaElement;
    value = target.value;
    onInput?.({ value, originalEvent: event });
  }
</script>

<div class="weeb-form-field">
  {#if label}
    <label for={id} class="weeb-form-label">{label}</label>
  {/if}

  <textarea
    {id}
    {name}
    {rows}
    {maxlength}
    {value}
    oninput={handleInput}
    {placeholder}
    {required}
    {disabled}
    class="weeb-form-textarea {className}"
    class:has-error={error}
    class:is-disabled={disabled}
    aria-describedby={error ? `${id}-error` : undefined}
  ></textarea>

  {#if maxlength !== undefined}
    <!-- Not announced on every keystroke: a live region here would read the
         count out after each letter typed. -->
    <div class="weeb-form-count" aria-hidden="true">{value.length}/{maxlength}</div>
  {/if}

  {#if error}
    <p id="{id}-error" class="weeb-form-error">{error}</p>
  {/if}
</div>
