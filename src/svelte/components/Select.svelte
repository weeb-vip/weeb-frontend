<script lang="ts">
  import { createEventDispatcher, tick } from 'svelte';

  /**
   * A select that looks like the rest of the product.
   *
   * A native <select> renders its closed state from CSS and its open list from
   * the operating system. The pill matched the design; the list that dropped
   * out of it was a white OS menu with a blue highlight, sitting on a dark
   * page. That half cannot be styled at all, which is the whole reason this
   * exists.
   *
   * The trigger deliberately keeps the native pill's exact measurements -- 32px
   * tall, 16px radius, 13px/500 -- so replacing a <select> changes only what
   * happens when it opens.
   */

  export let value: string | number = '';
  export let options: Array<{ value: string | number; label: string }> = [];
  export let ariaLabel: string = 'Select an option';
  /** Rendered when nothing matches `value`, e.g. a cleared filter. */
  export let placeholder: string = 'Select';
  export let disabled: boolean = false;
  export let className: string = '';
  /** Which edge the menu lines up with when it would otherwise leave the viewport. */
  export let align: 'left' | 'right' = 'left';

  const dispatch = createEventDispatcher();

  let open = false;
  let triggerEl: HTMLButtonElement;
  let menuEl: HTMLDivElement;
  // Which option the keyboard is on. Separate from the selected value, because
  // arrowing through a list should not commit anything until Enter.
  let activeIndex = -1;
  let menuTop = 0;
  let menuLeft = 0;
  let menuMinWidth = 0;

  $: selected = options.find((o) => String(o.value) === String(value));
  $: label = selected?.label ?? placeholder;

  // Menus are placed as fixed and portalled to <body>. An absolutely positioned
  // menu is clipped by any ancestor with overflow, and these sit inside a
  // horizontally scrolling filter row -- the list would be cut off at the row's
  // edge rather than overlaying the page.
  function portal(node: HTMLElement) {
    document.body.appendChild(node);

    return {
      destroy() {
        node.parentNode?.removeChild(node);
      },
    };
  }

  function position() {
    if (!triggerEl) return;
    const rect = triggerEl.getBoundingClientRect();
    menuMinWidth = rect.width;
    menuTop = rect.bottom + 6;
    menuLeft = align === 'right' ? rect.right - Math.max(rect.width, 180) : rect.left;

    // Keep it on screen. A filter at the right-hand edge would otherwise open
    // a menu that runs off the page.
    const width = Math.max(rect.width, 180);
    if (menuLeft + width > window.innerWidth - 8) {
      menuLeft = window.innerWidth - width - 8;
    }
    if (menuLeft < 8) menuLeft = 8;
  }

  async function openMenu() {
    if (disabled) return;
    open = true;
    // Start on the current value so arrowing continues from where the user is,
    // not from the top of the list.
    activeIndex = options.findIndex((o) => String(o.value) === String(value));
    position();
    await tick();
    scrollActiveIntoView();
  }

  function closeMenu(refocus = true) {
    open = false;
    activeIndex = -1;
    if (refocus) triggerEl?.focus();
  }

  function choose(index: number) {
    const option = options[index];
    if (!option) return;
    value = option.value;
    dispatch('change', { value: option.value });
    closeMenu();
  }

  function scrollActiveIntoView() {
    if (activeIndex < 0 || !menuEl) return;
    const el = menuEl.querySelector(`[data-index="${activeIndex}"]`) as HTMLElement | null;
    el?.scrollIntoView({ block: 'nearest' });
  }

  function move(delta: number) {
    if (options.length === 0) return;
    const next = activeIndex < 0 ? 0 : activeIndex + delta;
    activeIndex = Math.max(0, Math.min(options.length - 1, next));
    scrollActiveIntoView();
  }

  function onTriggerKeydown(event: KeyboardEvent) {
    if (disabled) return;

    if (!open) {
      // Down, Up, Enter and Space all open a native select; matching that is
      // what makes this feel like the control it replaced.
      if (['ArrowDown', 'ArrowUp', 'Enter', ' '].includes(event.key)) {
        event.preventDefault();
        openMenu();
      }
      return;
    }

    switch (event.key) {
      case 'ArrowDown':
        event.preventDefault();
        move(1);
        break;
      case 'ArrowUp':
        event.preventDefault();
        move(-1);
        break;
      case 'Home':
        event.preventDefault();
        activeIndex = 0;
        scrollActiveIntoView();
        break;
      case 'End':
        event.preventDefault();
        activeIndex = options.length - 1;
        scrollActiveIntoView();
        break;
      case 'Enter':
      case ' ':
        event.preventDefault();
        choose(activeIndex);
        break;
      case 'Escape':
        event.preventDefault();
        closeMenu();
        break;
      case 'Tab':
        // Tab commits nothing and moves on, as a native select does.
        closeMenu(false);
        break;
    }
  }

  function onWindowPointerDown(event: PointerEvent) {
    if (!open) return;
    const target = event.target as Node;
    if (triggerEl?.contains(target) || menuEl?.contains(target)) return;
    closeMenu(false);
  }

  // Reposition rather than close on scroll: these live in a sticky filter bar,
  // so closing on any scroll would make the menu feel broken on a trackpad.
  function onWindowScroll() {
    if (open) position();
  }
</script>

<svelte:window
  on:pointerdown={onWindowPointerDown}
  on:scroll|capture={onWindowScroll}
  on:resize={onWindowScroll}
/>

<button
  bind:this={triggerEl}
  type="button"
  class="wv-select-trigger {className}"
  class:wv-select-trigger--open={open}
  {disabled}
  aria-haspopup="listbox"
  aria-expanded={open}
  aria-label={ariaLabel}
  on:click={() => (open ? closeMenu(false) : openMenu())}
  on:keydown={onTriggerKeydown}
>
  <span class="wv-select-label">{label}</span>
  <svg class="wv-select-chevron" class:wv-select-chevron--open={open} width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" aria-hidden="true">
    <path d="m6 9 6 6 6-6" />
  </svg>
</button>

{#if open}
  <div
    bind:this={menuEl}
    use:portal
    class="wv-select-menu"
    style="top: {menuTop}px; left: {menuLeft}px; min-width: {menuMinWidth}px;"
    role="listbox"
    aria-label={ariaLabel}
    tabindex="-1"
  >
    {#each options as option, i (option.value)}
      <button
        type="button"
        class="wv-select-option"
        class:wv-select-option--active={i === activeIndex}
        class:wv-select-option--selected={String(option.value) === String(value)}
        data-index={i}
        role="option"
        aria-selected={String(option.value) === String(value)}
        on:click={() => choose(i)}
        on:mouseenter={() => (activeIndex = i)}
      >
        <span class="wv-select-option-label">{option.label}</span>
        {#if String(option.value) === String(value)}
          <svg class="wv-select-check" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" aria-hidden="true">
            <path d="M20 6 9 17l-5-5" />
          </svg>
        {/if}
      </button>
    {/each}
  </div>
{/if}

<style>
  /* Trigger: the native pill's measurements exactly, so swapping a <select>
     for this changes nothing until it opens. */
  .wv-select-trigger {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    height: 32px;
    padding: 0 10px 0 12px;
    border: 1px solid var(--weeb-border);
    border-radius: 16px;
    font-family: var(--weeb-font);
    font-size: 13px;
    font-weight: 500;
    color: var(--weeb-fg-secondary);
    background: transparent;
    cursor: pointer;
    white-space: nowrap;
    transition: border-color 0.15s, color 0.15s;
  }
  .wv-select-trigger:hover:not(:disabled) {
    border-color: var(--weeb-fg-muted);
    color: var(--weeb-fg);
  }
  .wv-select-trigger:focus-visible {
    outline: none;
    border-color: var(--weeb-accent);
  }
  /* Open reads as accent rather than merely hovered: the menu is a modal-ish
     surface and the trigger is what it belongs to. */
  .wv-select-trigger--open {
    border-color: var(--weeb-accent);
    color: var(--weeb-fg);
  }
  .wv-select-trigger:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .wv-select-label {
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .wv-select-chevron {
    flex-shrink: 0;
    color: var(--weeb-fg-muted);
    transition: transform 0.18s ease, color 0.15s;
  }
  .wv-select-chevron--open {
    transform: rotate(180deg);
    color: var(--weeb-accent-text);
  }

  /* Menu: the same floating-surface language as the search panel -- elevated
     background, hairline border, downward shadow. */
  .wv-select-menu {
    position: fixed;
    z-index: 70;
    max-height: 320px;
    overflow-y: auto;
    padding: 4px;
    background: var(--weeb-bg-elevated);
    border: 1px solid var(--weeb-border);
    border-radius: var(--weeb-radius-lg, 12px);
    box-shadow:
      0 20px 40px -8px oklch(0% 0 0 / 0.45),
      0 8px 16px -4px oklch(0% 0 0 / 0.3);
    animation: wv-select-in 0.16s ease-out forwards;
    transform-origin: center top;
  }

  @keyframes wv-select-in {
    from { opacity: 0; transform: translateY(-4px) scale(0.98); }
    to   { opacity: 1; transform: translateY(0) scale(1); }
  }

  .wv-select-option {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    width: 100%;
    padding: 8px 10px;
    border: none;
    border-radius: var(--weeb-radius-sm, 8px);
    background: transparent;
    font-family: var(--weeb-font);
    font-size: 13px;
    font-weight: 500;
    color: var(--weeb-fg-secondary);
    text-align: left;
    cursor: pointer;
    transition: background 0.12s, color 0.12s;
  }
  /* One highlight, driven by activeIndex, which the pointer and the keyboard
     both write to. Using :hover as well would light two rows at once when the
     mouse rests over the list while arrowing through it. */
  .wv-select-option--active {
    background: var(--weeb-surface-hover, rgba(255, 255, 255, 0.06));
    color: var(--weeb-fg);
  }
  .wv-select-option--selected {
    color: var(--weeb-accent-text);
  }
  .wv-select-option:focus-visible {
    outline: none;
    background: var(--weeb-surface-hover, rgba(255, 255, 255, 0.06));
  }

  .wv-select-check {
    flex-shrink: 0;
    color: var(--weeb-accent-text);
  }

  @media (prefers-reduced-motion: reduce) {
    .wv-select-menu { animation: none; }
    .wv-select-chevron { transition: none; }
  }
</style>
