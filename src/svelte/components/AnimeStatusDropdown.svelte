<script lang="ts">
  import { onMount, createEventDispatcher } from 'svelte';
  import { fade, scale } from 'svelte/transition';
  import { initializeQueryClient } from '../services/query-client';
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

  const statusLabels: Record<string, string> = {
    'COMPLETED': "Completed",
    'DROPPED': "Dropped",
    'ONHOLD': "On Hold",
    'PLANTOWATCH': "Watchlist",
    'WATCHING': "Watching",
  };

  const statusOptions = ['WATCHING', 'COMPLETED', 'ONHOLD', 'DROPPED', 'PLANTOWATCH'];

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
    const base = "flex flex-row relative z-20 items-center gap-2 justify-center";
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
      return `inline-flex items-center justify-between rounded-full bg-gray-200 dark:bg-gray-600 text-gray-800 dark:text-gray-200 shadow-sm hover:bg-gray-300 dark:hover:bg-gray-500 transition-colors duration-300 ${buttonClassName}`;
    }
    const baseClasses = "inline-flex items-center justify-between rounded-full bg-gray-200 dark:bg-gray-600 px-2 py-2 text-base font-medium text-gray-800 dark:text-gray-200 shadow-sm hover:bg-gray-300 dark:hover:bg-gray-500 transition-colors duration-300";
    switch (variant) {
      case 'compact':
        return `${baseClasses} flex-1 min-w-0 px-4 py-2 text-xs`;
      case 'hero':
        return `${baseClasses} flex-grow min-w-[140px] px-4 py-2 text-base`;
      case 'icon-only':
        return "inline-flex items-center justify-center rounded-full bg-gray-200 dark:bg-gray-600 text-gray-800 dark:text-gray-200 shadow-sm hover:bg-gray-300 dark:hover:bg-gray-500 transition-colors duration-300 w-8 h-8";
      default:
        return `${baseClasses} flex-grow min-w-[120px] px-4 py-2 text-base`;
    }
  }

  function getDeleteButtonClasses() {
    if (deleteButtonClassName) return `flex-shrink-0 ${deleteButtonClassName}`;
    const baseClasses = "flex-shrink-0 px-2 py-2 min-w-[32px] h-[32px] text-base bg-red-500 hover:bg-red-600 text-white rounded-full transition-colors duration-300 inline-flex items-center justify-center";
    switch (variant) {
      case 'compact':
        return `${baseClasses} px-1 py-1 min-w-[24px] h-[24px] text-xs`;
      case 'hero':
        return `${baseClasses} px-4 py-4 min-w-[40px] h-[40px] text-base`;
      default:
        return `${baseClasses} px-4 py-4 min-w-[40px] h-[40px] text-base`;
    }
  }

  function getMenuItemClasses(isActive = false, isCurrentStatus = false) {
    let baseClasses = `block w-full text-left text-gray-700 dark:text-gray-200 transition-colors duration-300 cursor-pointer border-none`;

    if (isCurrentStatus) {
      baseClasses += ' bg-blue-50 dark:bg-blue-900/30 font-medium';
    } else if (isActive) {
      baseClasses += ' bg-blue-100 dark:bg-blue-900/50';
    } else {
      baseClasses += ' hover:bg-gray-50 dark:hover:bg-gray-700';
    }

    switch (variant) {
      case 'compact':
        return `${baseClasses} px-2 py-2 text-xs`;
      case 'hero':
        return `${baseClasses} px-4 py-3 text-base`;
      case 'icon-only':
        return `${baseClasses} px-3 py-2 text-sm`;
      default:
        return `${baseClasses} px-4 py-3 text-base`;
    }
  }

  function toggleMenu() {
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
    <div class="relative inline-block text-left">
      <button
        bind:this={buttonElement}
        class={getButtonClasses()}
        title="Status: {statusLabels[entry.status ?? 'PLANTOWATCH']}"
        on:click={toggleMenu}
      >
        <i class="fas fa-ellipsis-v w-3 h-3 text-gray-600 dark:text-gray-300" style="display: flex; align-items: center; justify-content: center; line-height: 1;"></i>
      </button>

      {#if isMenuOpen}
        <div
          bind:this={menuElement}
          class="absolute top-full right-0 mt-1 w-44 origin-top-right rounded-md bg-white dark:bg-gray-800 shadow-lg ring-1 ring-black dark:ring-gray-600 ring-opacity-5 dark:ring-opacity-20 focus:outline-none z-[999]"
          transition:scale={{duration: 100, start: 0.95}}
        >
          <!-- Status options -->
          <div class="px-3 py-2 text-xs font-medium text-gray-500 dark:text-gray-400 border-b border-gray-200 dark:border-gray-600">
            Change Status
          </div>
          {#each statusOptions as statusOption, index}
            <button
              class={getMenuItemClasses(activeIndex === index, entry.status === statusOption)}
              on:click={() => onChangeStatus(statusOption)}
              on:mouseenter={() => handleMouseEnter(index)}
              on:mouseleave={handleMouseLeave}
            >
              {statusLabels[statusOption]}
              {#if entry.status === statusOption}
                <span class="ml-2 text-blue-600 dark:text-blue-400">✓</span>
              {/if}
            </button>
          {/each}
          <!-- Remove option -->
          <div class="border-t border-gray-200 dark:border-gray-600">
            <button
              class="{getMenuItemClasses(activeIndex === statusOptions.length)} text-red-600 dark:text-red-400 font-medium"
              on:click={onDeleteAnime}
              on:mouseenter={() => handleMouseEnter(statusOptions.length)}
              on:mouseleave={handleMouseLeave}
            >
              <i class="fas fa-trash w-3 h-3 mr-2 inline"></i>
              Remove from list
            </button>
          </div>
        </div>
      {/if}
    </div>
  </div>
{:else}
  <div class="{getContainerClasses()} {className}">
    <div class="relative inline-block text-left">
      <button
        bind:this={buttonElement}
        class={getButtonClasses()}
        on:click={toggleMenu}
      >
        <span>{statusLabels[entry.status ?? 'PLANTOWATCH']}</span>
        <i class="fas fa-chevron-down w-3 h-3 ml-2 text-gray-500 dark:text-gray-400"></i>
      </button>

      {#if isMenuOpen}
        <div
          bind:this={menuElement}
          class="absolute top-full left-0 mt-1 w-44 origin-top-left rounded-md bg-white dark:bg-gray-800 shadow-lg ring-1 ring-black dark:ring-gray-600 ring-opacity-5 dark:ring-opacity-20 focus:outline-none z-[999]"
          transition:scale={{duration: 100, start: 0.95}}
        >
          {#each statusOptions as statusOption, index}
            <button
              class={getMenuItemClasses(activeIndex === statusOptions.length + 1 + index, entry.status === statusOption)}
              on:click={() => onChangeStatus(statusOption)}
              on:mouseenter={() => handleMouseEnter(statusOptions.length + 1 + index)}
              on:mouseleave={handleMouseLeave}
            >
              {statusLabels[statusOption]}
            </button>
          {/each}
        </div>
      {/if}
    </div>

    <button
      class={getDeleteButtonClasses()}
      on:click={onDeleteAnime}
      title="Remove from list"
    >
      <i class="fas fa-trash text-white w-3 h-3"></i>
    </button>
  </div>
{/if}
