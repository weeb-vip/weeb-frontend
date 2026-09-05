<script lang="ts">
  import { scale } from 'svelte/transition';
  import { clickOutside } from '../actions/clickOutside';
  import { anchoredPosition } from '../actions/anchoredPosition';
  import {
    AnimeStatusDropdownBloc,
    type AnimeStatusDropdownEntry,
    type AnimeStatusDropdownVariant
  } from './AnimeStatusDropdown.bloc.svelte';
  import '@fortawesome/fontawesome-free/css/all.min.css';

  let {
    entry,
    variant = 'default',
    className = '',
    buttonClassName = '',
    /** The reader picked a new status for this entry. */
    onStatusChange,
    /** The reader asked for this entry to leave their list. */
    onDelete,
    bloc: injected
  }: {
    entry: AnimeStatusDropdownEntry;
    variant?: AnimeStatusDropdownVariant;
    className?: string;
    buttonClassName?: string;
    onStatusChange?: (detail: { animeId: string; status: string }) => void;
    onDelete?: (detail: { animeId: string }) => void;
    bloc?: AnimeStatusDropdownBloc;
  } = $props();

  const ownBloc = new AnimeStatusDropdownBloc({
    get entry() {
      return entry;
    },
    get variant() {
      return variant;
    },
    get buttonClassName() {
      return buttonClassName;
    },
    get onStatusChange() {
      return onStatusChange;
    },
    get onDelete() {
      return onDelete;
    }
  });
  const bloc = $derived(injected ?? ownBloc);

  let buttonElement = $state<HTMLButtonElement | undefined>();

  $effect(() => bloc.init());

  // The menu is portalled to <body> so `position: fixed` survives any
  // transformed ancestor; both actions below are told about that explicitly --
  // the trigger is `ignore`d rather than being a DOM ancestor, and the anchor
  // is passed as a getter because it binds after this element is configured.
  function portalMenu(node: HTMLElement) {
    document.body.appendChild(node);
    return {
      destroy() {
        node.parentNode?.removeChild(node);
      }
    };
  }
</script>

{#snippet menu(showHeader: boolean)}
  <div
    use:portalMenu
    use:clickOutside={{ handler: () => bloc.closeMenu(), ignore: () => buttonElement }}
    use:anchoredPosition={{ anchor: () => buttonElement, minWidth: 180, margin: 8 }}
    class="asd-menu"
    transition:scale={{ duration: 100, start: 0.95 }}
  >
    {#if showHeader}
      <div class="asd-menu-header">Change Status</div>
    {/if}
    {#each bloc.statusOptions as statusOption}
      <button
        class="asd-menu-item"
        class:asd-menu-item--active={bloc.isSelected(statusOption)}
        onclick={(event) => {
          event.stopPropagation();
          bloc.selectStatus(statusOption);
        }}
      >
        <span>{bloc.labelFor(statusOption)}</span>
        {#if bloc.isSelected(statusOption)}
          <svg class="asd-check" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 8l4 4 6-7"/></svg>
        {/if}
      </button>
    {/each}
    <div class="asd-menu-divider"></div>
    <button
      class="asd-menu-item asd-menu-item--danger"
      onclick={(event) => {
        event.stopPropagation();
        bloc.removeFromList();
      }}
    >
      <svg class="asd-trash" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M2 4h12M5.3 4V2.7a1 1 0 011-1h3.4a1 1 0 011 1V4m1.6 0v8.7a1.3 1.3 0 01-1.3 1.3H5a1.3 1.3 0 01-1.3-1.3V4h8.6z"/></svg>
      Remove from list
    </button>
  </div>
{/snippet}

<div class="{bloc.containerClasses} {className}">
  <div class="asd-wrap">
    {#if bloc.variant === 'icon-only'}
      <button
        bind:this={buttonElement}
        class={bloc.buttonClasses}
        title="Status: {bloc.currentLabel}"
        aria-haspopup="menu"
        aria-expanded={bloc.isMenuOpen}
        onclick={() => bloc.toggleMenu()}
      >
        <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2"><circle cx="8" cy="3" r="1"/><circle cx="8" cy="8" r="1"/><circle cx="8" cy="13" r="1"/></svg>
      </button>

      {#if bloc.isMenuOpen}
        {@render menu(true)}
      {/if}
    {:else}
      <button
        bind:this={buttonElement}
        class={bloc.buttonClasses}
        aria-haspopup="menu"
        aria-expanded={bloc.isMenuOpen}
        onclick={() => bloc.toggleMenu()}
      >
        <span class="asd-label">{bloc.currentLabel}</span>
        <svg class="asd-chevron" class:asd-chevron--open={bloc.isMenuOpen} viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 6l4 4 4-4"/></svg>
      </button>

      {#if bloc.isMenuOpen}
        {@render menu(false)}
      {/if}
    {/if}
  </div>
</div>

<style>
  .asd-wrap {
    position: relative;
    display: inline-block;
  }

  .asd-btn {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    height: 32px;
    padding: 0 12px;
    background: var(--weeb-surface);
    border: 1px solid var(--weeb-border);
    border-radius: var(--weeb-radius, 8px);
    color: var(--weeb-fg);
    font-size: 13px;
    font-weight: 600;
    cursor: pointer;
    transition: border-color 0.15s, background 0.15s;
    white-space: nowrap;
  }
  .asd-btn:hover {
    border-color: var(--weeb-accent);
    background: var(--weeb-surface-hover);
  }

  .asd-btn--compact {
    height: 28px;
    padding: 0 8px;
    font-size: 11px;
  }
  .asd-btn--hero {
    height: 36px;
    padding: 0 16px;
    font-size: 14px;
  }
  .asd-btn--icon {
    width: 32px;
    height: 32px;
    padding: 0;
    justify-content: center;
  }

  .asd-label {
    flex: 1;
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .asd-chevron {
    width: 12px;
    height: 12px;
    flex-shrink: 0;
    color: var(--weeb-fg-muted);
    transition: transform 0.15s;
  }
  .asd-chevron--open {
    transform: rotate(180deg);
  }

  .asd-menu {
    position: fixed;
    min-width: 180px;
    max-height: calc(100vh - 16px);
    overflow-y: auto;
    background: var(--weeb-surface);
    border: 1px solid var(--weeb-border);
    border-radius: var(--weeb-radius, 8px);
    box-shadow: 0 8px 24px oklch(0% 0 0 / 0.4);
    z-index: 9999;
    padding: 4px;
  }

  .asd-menu-header {
    padding: 6px 12px;
    font-size: 10px;
    font-weight: 700;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    color: var(--weeb-fg-muted);
    font-family: var(--weeb-font-mono);
  }

  .asd-menu-item {
    display: flex;
    align-items: center;
    justify-content: space-between;
    width: 100%;
    padding: 8px 12px;
    background: none;
    border: none;
    border-radius: calc(var(--weeb-radius, 8px) - 2px);
    color: var(--weeb-fg-secondary);
    font-size: 13px;
    cursor: pointer;
    transition: background 0.1s, color 0.1s;
    text-align: left;
  }
  .asd-menu-item:hover {
    background: var(--weeb-surface-hover);
    color: var(--weeb-fg);
  }
  .asd-menu-item--active {
    color: var(--weeb-accent-text);
    font-weight: 600;
  }
  .asd-menu-item--danger {
    color: var(--weeb-red);
  }
  .asd-menu-item--danger:hover {
    background: color-mix(in oklch, var(--weeb-red), transparent 90%);
    color: var(--weeb-red);
  }

  .asd-menu-divider {
    height: 1px;
    background: var(--weeb-border);
    margin: 4px 0;
  }

  .asd-check {
    width: 14px;
    height: 14px;
    color: var(--weeb-accent-text);
    flex-shrink: 0;
  }

  .asd-trash {
    width: 14px;
    height: 14px;
    flex-shrink: 0;
    margin-right: 6px;
  }
</style>
