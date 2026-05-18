<script lang="ts">
  import { onMount, createEventDispatcher } from 'svelte';
  import { fade, scale } from 'svelte/transition';
  import { initializeQueryClient } from '../services/query-client';
  import { STATUS_LABELS, STATUS_OPTIONS } from '../utils/status';
  import '@fortawesome/fontawesome-free/css/all.min.css';

  export let entry: {
    id: string;
    anime?: {
      id?: string;
    };
    status?: string;
  };
  export let variant: 'default' | 'compact' | 'hero' | 'icon-only' = 'default';
  export let className: string = '';
  export let buttonClassName: string = '';
  export let deleteButtonClassName: string = '';

  const dispatch = createEventDispatcher();

  let isMenuOpen = false;
  let buttonElement: HTMLButtonElement;
  let menuElement: HTMLDivElement;
  let queryClient: any = null;
  let isClient = false;
  let activeIndex: number | null = null;
  let menuTop = 0;
  let menuLeft = 0;
  let menuPortalTarget: HTMLElement | null = null;

  // Portal action — moves menu to document.body so position:fixed works
  // regardless of parent transforms/stacking contexts
  function portalMenu(node: HTMLElement) {
    menuPortalTarget = document.body;
    menuPortalTarget.appendChild(node);
    return {
      destroy() {
        if (node.parentNode) {
          node.parentNode.removeChild(node);
        }
      }
    };
  }

  const statusLabels = STATUS_LABELS;
  const statusOptions = STATUS_OPTIONS;

  onMount(async () => {
    try {
      queryClient = initializeQueryClient();
      isClient = true;
    } catch (error) {
      console.warn('Failed to initialize query client:', error);
      isClient = true;
    }
  });

  function getContainerClasses() {
    const base = "flex flex-row relative items-center gap-2 justify-center";
    switch (variant) {
      case 'compact':
        return `${base} w-full`;
      case 'hero':
        return base;
      case 'icon-only':
        return "relative inline-block text-left";
      default:
        return base;
    }
  }

  function getButtonClasses() {
    if (buttonClassName) {
      return `asd-btn ${buttonClassName}`;
    }
    switch (variant) {
      case 'compact':
        return 'asd-btn asd-btn--compact';
      case 'hero':
        return 'asd-btn asd-btn--hero';
      case 'icon-only':
        return 'asd-btn asd-btn--icon';
      default:
        return 'asd-btn';
    }
  }

  // getMenuItemClasses removed — now using scoped .asd-menu-item CSS

  let menuOpenAbove = false;

  function toggleMenu(e?: MouseEvent) {
    if (!isMenuOpen) {
      // Try multiple strategies to find the button element
      let btn: HTMLElement | null = null;

      // Strategy 1: event.currentTarget (most reliable during event handling)
      if (e?.currentTarget instanceof HTMLElement) {
        btn = e.currentTarget;
      }
      // Strategy 2: event.target — walk up to find the button
      if (!btn && e?.target instanceof HTMLElement) {
        btn = (e.target as HTMLElement).closest('button');
      }
      // Strategy 3: bind:this fallback
      if (!btn) {
        btn = buttonElement;
      }

      if (btn) {
        const rect = btn.getBoundingClientRect();

        const menuHeight = 280;
        const viewportHeight = window.innerHeight;
        const spaceBelow = viewportHeight - rect.bottom;
        const spaceAbove = rect.top;

        if (spaceBelow < menuHeight && spaceAbove > spaceBelow) {
          menuTop = rect.top - menuHeight;
          menuOpenAbove = true;
        } else {
          menuTop = rect.bottom;
          menuOpenAbove = false;
        }

        if (menuTop < 8) menuTop = 8;
        if (menuTop + menuHeight > viewportHeight - 8) {
          menuTop = viewportHeight - menuHeight - 8;
        }

        menuLeft = rect.left;
        const menuWidth = 200;
        if (menuLeft + menuWidth > window.innerWidth - 8) {
          menuLeft = window.innerWidth - menuWidth - 8;
        }

      }
    }
    isMenuOpen = !isMenuOpen;
  }

  function closeMenu() {
    isMenuOpen = false;
  }

  function handleClickOutside(event: MouseEvent) {
    if (buttonElement && menuElement) {
      if (!buttonElement.contains(event.target as Node) && !menuElement.contains(event.target as Node)) {
        closeMenu();
      }
    }
  }

  function onChangeStatus(newStatus: string) {
    dispatch('statusChange', {
      animeId: entry.anime?.id || '',
      status: newStatus
    });
    closeMenu();
  }

  function onDeleteAnime() {
    console.log('🗑️ AnimeStatusDropdown onDeleteAnime called - entry ID:', entry.id, 'anime ID:', entry.anime?.id);
    dispatch('delete', {
      animeId: entry.anime?.id || ''  // Pass entry.id which is now the anime ID from AnimeActions
    });
    console.log('🗑️ Delete event dispatched with ID:', entry.anime?.id);
  }

  function handleMouseEnter(index: number) {
    activeIndex = index;
  }

  function handleMouseLeave() {
    activeIndex = null;
  }

  $: if (typeof window !== 'undefined') {
    if (isMenuOpen) {
      document.addEventListener('click', handleClickOutside);
    } else {
      document.removeEventListener('click', handleClickOutside);
    }
  }
</script>

<svelte:window on:click={handleClickOutside} />

{#if variant === 'icon-only'}
  <div class="{getContainerClasses()} {className}">
    <div class="asd-wrap">
      <button
        bind:this={buttonElement}
        class={getButtonClasses()}
        title="Status: {statusLabels[entry.status ?? 'PLANTOWATCH']}"
        on:click={toggleMenu}
      >
        <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2"><circle cx="8" cy="3" r="1"/><circle cx="8" cy="8" r="1"/><circle cx="8" cy="13" r="1"/></svg>
      </button>

      {#if isMenuOpen}
        <div
          bind:this={menuElement}
          use:portalMenu
          class="asd-menu"
          style="position: fixed; z-index: 9999; top: {menuTop}px; left: {menuLeft}px; min-width: 180px; max-height: calc(100vh - 16px); overflow-y: auto; background: var(--weeb-surface, oklch(22% 0.02 275)); border: 1px solid var(--weeb-border, oklch(28% 0.015 275)); border-radius: 8px; padding: 4px; box-shadow: 0 8px 32px oklch(0% 0 0 / 0.5); font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif; color: var(--weeb-fg, oklch(95% 0.005 265));"
          transition:scale={{duration: 100, start: 0.95}}
        >
          <div class="asd-menu-header" style="font-size: 10px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.06em; color: var(--weeb-fg-muted, oklch(45% 0.01 270)); padding: 8px 10px 4px;">Change Status</div>
          {#each statusOptions as statusOption, index}
            <button
              style="display: flex; align-items: center; justify-content: space-between; width: 100%; padding: 8px 10px; border: none; background: transparent; color: inherit; font-size: 13px; cursor: pointer; border-radius: 6px; text-align: left; {entry.status === statusOption ? 'background: oklch(55% 0.15 280 / 0.08); color: var(--weeb-accent, oklch(55% 0.15 280));' : ''}"
              on:click={() => onChangeStatus(statusOption)}
              on:mouseenter={() => handleMouseEnter(index)}
              on:mouseleave={handleMouseLeave}
            >
              <span>{statusLabels[statusOption]}</span>
              {#if entry.status === statusOption}
                <svg style="width: 14px; height: 14px;" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 8l4 4 6-7"/></svg>
              {/if}
            </button>
          {/each}
          <div style="height: 1px; background: var(--weeb-border, oklch(28% 0.015 275)); margin: 4px 0;"></div>
          <button
            style="display: flex; align-items: center; gap: 8px; width: 100%; padding: 8px 10px; border: none; background: transparent; color: var(--weeb-red, oklch(55% 0.2 25)); font-size: 13px; cursor: pointer; border-radius: 6px; text-align: left;"
            on:click={onDeleteAnime}
          >
            <svg style="width: 14px; height: 14px;" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M2 4h12M5.3 4V2.7a1 1 0 011-1h3.4a1 1 0 011 1V4m1.6 0v8.7a1.3 1.3 0 01-1.3 1.3H5a1.3 1.3 0 01-1.3-1.3V4h8.6z"/></svg>
            Remove from list
          </button>
        </div>
      {/if}
    </div>
  </div>
{:else}
  <div class="{getContainerClasses()} {className}">
    <div class="asd-wrap">
      <button
        bind:this={buttonElement}
        class={getButtonClasses()}
        on:click={toggleMenu}
      >
        <span class="asd-label">{statusLabels[entry.status ?? 'PLANTOWATCH']}</span>
        <svg class="asd-chevron" class:asd-chevron--open={isMenuOpen} viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 6l4 4 4-4"/></svg>
      </button>

      {#if isMenuOpen}
        <div
          bind:this={menuElement}
          use:portalMenu
          class="asd-menu"
          style="position: fixed; z-index: 9999; top: {menuTop}px; left: {menuLeft}px; min-width: 180px; max-height: calc(100vh - 16px); overflow-y: auto; background: var(--weeb-surface, oklch(22% 0.02 275)); border: 1px solid var(--weeb-border, oklch(28% 0.015 275)); border-radius: 8px; padding: 4px; box-shadow: 0 8px 32px oklch(0% 0 0 / 0.5); font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif; color: var(--weeb-fg, oklch(95% 0.005 265));"
          transition:scale={{duration: 100, start: 0.95}}
        >
          {#each statusOptions as statusOption, index}
            <button
              style="display: flex; align-items: center; justify-content: space-between; width: 100%; padding: 8px 10px; border: none; background: transparent; color: inherit; font-size: 13px; cursor: pointer; border-radius: 6px; text-align: left; {entry.status === statusOption ? 'background: oklch(55% 0.15 280 / 0.08); color: var(--weeb-accent, oklch(55% 0.15 280));' : ''}"
              on:click|stopPropagation={() => onChangeStatus(statusOption)}
              on:mouseenter={() => handleMouseEnter(statusOptions.length + 1 + index)}
              on:mouseleave={handleMouseLeave}
            >
              <span>{statusLabels[statusOption]}</span>
              {#if entry.status === statusOption}
                <svg style="width: 14px; height: 14px;" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 8l4 4 6-7"/></svg>
              {/if}
            </button>
          {/each}
          <div style="height: 1px; background: var(--weeb-border, oklch(28% 0.015 275)); margin: 4px 0;"></div>
          <button
            style="display: flex; align-items: center; gap: 8px; width: 100%; padding: 8px 10px; border: none; background: transparent; color: var(--weeb-red, oklch(55% 0.2 25)); font-size: 13px; cursor: pointer; border-radius: 6px; text-align: left;"
            on:click|stopPropagation={onDeleteAnime}
          >
            <svg style="width: 14px; height: 14px;" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M2 4h12M5.3 4V2.7a1 1 0 011-1h3.4a1 1 0 011 1V4m1.6 0v8.7a1.3 1.3 0 01-1.3 1.3H5a1.3 1.3 0 01-1.3-1.3V4h8.6z"/></svg>
            Remove from list
          </button>
        </div>
      {/if}
    </div>
  </div>
{/if}

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
    color: var(--weeb-accent);
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
    color: var(--weeb-accent);
    flex-shrink: 0;
  }

  .asd-trash {
    width: 14px;
    height: 14px;
    flex-shrink: 0;
    margin-right: 6px;
  }
</style>
