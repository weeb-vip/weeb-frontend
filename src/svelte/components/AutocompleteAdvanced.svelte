<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { isValid } from 'date-fns';
  import { animate, stagger, spring } from 'motion';
  import AutocompleteItem from './AutocompleteItem.svelte';
  import { configStore } from '../stores/config';
  import { navigateWithTransition } from '../../utils/astro-navigation';
  import { analytics } from '../../utils/analytics';

  // Dynamic imports for SSR compatibility
  let algoliasearch: any = null;
  let createAutocomplete: any = null;
  let getAlgoliaResults: any = null;
  let searchClient: any = null;

  let autocompleteInstance: any = null;
  let isClient = false;
  let isFocused = false;
  let isLoading = true;
  let autocompleteState: any = { isOpen: false, collections: [] };

  let desktopInputRef: HTMLInputElement;
  let mobileInputRef: HTMLInputElement;
  let desktopFormRef: HTMLDivElement;
  let mobileFormRef: HTMLDivElement;
  let desktopPanelRef: HTMLDivElement;
  let mobilePanelRef: HTMLDivElement;
  let resultsListRefs: HTMLElement[] = [];


  onMount(async () => {
    // Only run on client-side
    if (typeof window === 'undefined') return;

    try {
      // Initialize config store - fetch from HTTP and wait for it
      await configStore.init();
    } catch (error) {
      console.error('Failed to initialize config store:', error);
    }

    const initializeAlgolia = async () => {

      try {
        const algoliasearchModule = await import('algoliasearch/lite');
        const autocompleteModule = await import('@algolia/autocomplete-core');
        const presetModule = await import('@algolia/autocomplete-preset-algolia');

        // Handle both default and named exports for algoliasearch
        if (typeof algoliasearchModule.default === 'function') {
          algoliasearch = algoliasearchModule.default;
        } else if (typeof algoliasearchModule === 'function') {
          algoliasearch = algoliasearchModule;
        } else if (algoliasearchModule.liteClient) {
          algoliasearch = algoliasearchModule.liteClient;
        } else {
          throw new Error('Unable to find algoliasearch function in module');
        }

        createAutocomplete = autocompleteModule.createAutocomplete;
        getAlgoliaResults = presetModule.getAlgoliaResults;

        // Modules loaded successfully

        if (typeof algoliasearch !== 'function') {
          throw new Error('algoliasearch is not a function: ' + typeof algoliasearch);
        }

        searchClient = algoliasearch("A2HF2P5C6X", "45216ed5ac3f9e0a478d3c354d353d58");
        // Search client created successfully

        autocompleteInstance = createAutocomplete({
          onStateChange({ state }) {
            autocompleteState = state;
          },
          getSources() {
            return [
              {
                sourceId: "data",
                getItemInputValue({ item }) {
                  return item.title_en;
                },
                getItems({ query }) {
                  if (!query) {
                    return [];
                  }

                  // Get config from the Svelte store with fallback
                  const config = configStore.get();
                  const indexName = config?.algolia_index || 'anime-staging';

                  return getAlgoliaResults({
                    searchClient,
                    queries: [
                      {
                        indexName,
                        query,
                        params: {
                          hitsPerPage: 20,
                        },
                      },
                    ],
                  });
                },
              },
            ];
          },
        });

        // Autocomplete instance created successfully

        isClient = true;
        isLoading = false;
        // Algolia initialized successfully

        // Add environment event listeners for both mobile and desktop
        const cleanupFunctions = [];

        // Setup mobile environment props
        if (mobileFormRef && mobileInputRef && mobilePanelRef) {
          const mobileEnvProps = autocompleteInstance.getEnvironmentProps({
            formElement: mobileFormRef,
            inputElement: mobileInputRef,
            panelElement: mobilePanelRef,
          });

          window.addEventListener("touchstart", mobileEnvProps.onTouchStart);
          window.addEventListener("touchmove", mobileEnvProps.onTouchMove);

          cleanupFunctions.push(() => {
            window.removeEventListener("touchstart", mobileEnvProps.onTouchStart);
            window.removeEventListener("touchmove", mobileEnvProps.onTouchMove);
          });
        }

        // Setup desktop environment props
        if (desktopFormRef && desktopInputRef && desktopPanelRef) {
          const desktopEnvProps = autocompleteInstance.getEnvironmentProps({
            formElement: desktopFormRef,
            inputElement: desktopInputRef,
            panelElement: desktopPanelRef,
          });

          window.addEventListener("mousedown", desktopEnvProps.onMouseDown);

          cleanupFunctions.push(() => {
            window.removeEventListener("mousedown", desktopEnvProps.onMouseDown);
          });
        }

        return () => {
          cleanupFunctions.forEach(cleanup => cleanup());
        };
      } catch (error) {
        console.error('Failed to initialize Algolia (Svelte):', error);
        // Still set isClient to true to show a non-disabled input
        isClient = true;
      }
    };

    console.log('Autocomplete component mounting (Svelte), isClient:', isClient);
    initializeAlgolia();
  });

  onDestroy(() => {
    // Clean up desktop backdrop when component is destroyed
    removeDesktopBackdrop();
  });

  function handleItemClick(item: any) {
    if (autocompleteInstance) {
      autocompleteInstance.setIsOpen(false);
      autocompleteInstance.setQuery('');
    }
    // Navigate to show page
    if (typeof window !== 'undefined') {
      navigateWithTransition(`/show/${item.id ? encodeURIComponent(item.id) : ''}`);
    }
    if (desktopInputRef) desktopInputRef.blur();
    if (mobileInputRef) mobileInputRef.blur();
  }

  function createDesktopBackdrop() {
    if (typeof window === 'undefined') return;

    // Remove existing backdrop
    const existing = document.getElementById('desktop-search-backdrop');
    if (existing) existing.remove();

    // Create backdrop element at body level (outside header constraints)
    const backdrop = document.createElement('div');
    backdrop.id = 'desktop-search-backdrop';
    backdrop.className = 'fixed inset-0 bg-white/50 dark:bg-gray-900/50 backdrop-blur-sm';
    backdrop.style.cssText = 'z-index: 35; backdrop-filter: blur(12px); -webkit-backdrop-filter: blur(12px); opacity: 0;'; // Start invisible
    backdrop.setAttribute('role', 'presentation');

    backdrop.addEventListener('click', () => {
      if (desktopInputRef) desktopInputRef.blur();
    });

    // Add to body (bypasses header container constraints)
    document.body.appendChild(backdrop);

    // Animate backdrop in with Motion
    animate(backdrop,
      { opacity: [0, 1] },
      { duration: 0.3, easing: 'ease-out' }
    );
  }

  function removeDesktopBackdrop() {
    if (typeof window === 'undefined') return;
    const backdrop = document.getElementById('desktop-search-backdrop');
    if (backdrop) {
      // Animate backdrop out before removing
      animate(backdrop,
        { opacity: [1, 0] },
        { duration: 0.2, easing: 'ease-in' }
      ).then(() => {
        backdrop.remove();
      });
    }
  }

  function handleFocus() {
    isFocused = true;
    if (autocompleteInstance) {
      autocompleteInstance.setIsOpen(true);
    }
    // Create backdrop for desktop only, bypassing header constraints
    if (typeof window !== 'undefined' && window.innerWidth >= 1024) { // lg breakpoint
      createDesktopBackdrop();
    }

    // Animate search input container on focus
    const container = window.innerWidth >= 640 ? desktopFormRef : mobileFormRef;
    if (container) {
      animate(container,
        { scale: [1, 1.02, 1] },
        { duration: 0.4, easing: spring({ stiffness: 300, damping: 25 }) }
      );
    }

    // Animate panel opening when results appear
    setTimeout(() => {
      const panel = window.innerWidth >= 640 ? desktopPanelRef : mobilePanelRef;
      if (panel && autocompleteState.isOpen) {
        animate(panel,
          { opacity: [0, 1], y: [-10, 0], scale: [0.95, 1] },
          { duration: 0.3, easing: spring({ stiffness: 400, damping: 30 }) }
        );
      }
    }, 10);
  }

  function handleBlur() {
    // Animate panel closing before hiding
    const panel = window.innerWidth >= 640 ? desktopPanelRef : mobilePanelRef;
    if (panel && autocompleteState.isOpen) {
      animate(panel,
        { opacity: [1, 0], y: [0, -10] },
        { duration: 0.2, easing: 'ease-out' }
      );
    }

    // Delay to allow click events to fire and animation to complete
    setTimeout(() => {
      isFocused = false;
      if (autocompleteInstance) {
        autocompleteInstance.setIsOpen(false);
      }
      removeDesktopBackdrop();
    }, 200);
  }

  function handleKeyDown(event: KeyboardEvent) {
    if (event.key === 'Escape') {
      // Animate panel closing on escape
      const panel = window.innerWidth >= 640 ? desktopPanelRef : mobilePanelRef;
      if (panel && autocompleteState.isOpen) {
        animate(panel,
          { opacity: [1, 0], y: [0, -10] },
          { duration: 0.2, easing: 'ease-out' }
        );
      }

      setTimeout(() => {
        isFocused = false;
        if (autocompleteInstance) {
          autocompleteInstance.setIsOpen(false);
        }
        removeDesktopBackdrop();
        (event.target as HTMLInputElement).blur();
      }, 200);
    }
  }

  function handleInputChange(event: Event) {
    const value = (event.target as HTMLInputElement).value;
    console.log('Input changed:', value);
    if (autocompleteInstance) {
      console.log('Setting query on autocomplete instance');
      autocompleteInstance.setQuery(value);
      autocompleteInstance.refresh();
    } else {
      console.log('No autocomplete instance available');
    }
  }

  function filterValidItems(items: any[]): any[] {
    return items.filter((item) => {
      if (!item || !item.start_date) return false;
      try {
        let dateStr = item.start_date.toString();
        dateStr = dateStr.replace(/(\.\d{6})?\s(\+\d{2}:\d{2})$/, '$2');
        const date = new Date(dateStr);
        return isValid(date) && !isNaN(date.getTime()) && date.getFullYear() > 1900;
      } catch {
        return false;
      }
    });
  }

  $: inputProps = autocompleteInstance?.getInputProps({}) || {};
  $: rootProps = autocompleteInstance?.getRootProps({}) || {};

  // Animate search results when they change
  $: if (autocompleteState.collections && autocompleteState.collections.length > 0) {
    setTimeout(() => {
      const items = document.querySelectorAll('[data-autocomplete-item]');
      if (items.length > 0) {
        animate(
          items,
          { opacity: [0, 1], y: [20, 0] },
          {
            duration: 0.4,
            delay: stagger(0.05),
            easing: spring({ stiffness: 300, damping: 25 })
          }
        );
      }
    }, 50);
  }

  // Svelte action for mobile backdrop animation
  function animateBackdrop(node: HTMLElement) {
    // Animate in
    animate(node,
      { opacity: [0, 1] },
      { duration: 0.3, easing: 'ease-out' }
    );

    return {
      destroy() {
        // Animate out (if still mounted)
        if (node.parentNode) {
          animate(node,
            { opacity: [1, 0] },
            { duration: 0.2, easing: 'ease-in' }
          );
        }
      }
    };
  }
</script>

{#if isLoading}
  <!-- Loading skeleton -->
  <div class="relative">
    <div class="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-full bg-gray-100 dark:bg-gray-700 transition-colors duration-300 animate-pulse">
      <div class="flex items-center">
        <div class="h-4 bg-gray-300 dark:bg-gray-600 rounded w-32 animate-pulse"></div>
        <div class="ml-auto">
          <div class="animate-spin h-4 w-4 border-2 border-gray-300 border-t-gray-600 rounded-full"></div>
        </div>
      </div>
    </div>
  </div>
{:else if !isClient}
  <!-- Fallback placeholder -->
  <div class="relative">
    <input
      type="text"
      placeholder="Search anime..."
      disabled
      class="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-gray-50 dark:bg-gray-700 text-gray-500 dark:text-gray-400"
    />
    <svg class="absolute right-3 top-3 h-5 w-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
    </svg>
  </div>
{:else if !autocompleteInstance}
  <!-- If Algolia failed to load, show a simple input without autocomplete -->
  <div class="relative">
    <input
      type="text"
      placeholder="Search anime..."
      class="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-full bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
      on:keydown={(e) => {
        if (e.key === 'Enter') {
          const target = e.target;
          const query = target.value;
          if (query.trim()) {
            analytics.searchPerformed(query.trim(), 0); // Results count will be updated on search page
            navigateWithTransition(`/search?query=${encodeURIComponent(query.trim())}`);
          }
        }
      }}
    />
    <svg class="absolute right-3 top-3 h-5 w-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
    </svg>
  </div>
{:else}

  <!-- Mobile backdrop overlay when focused -->
  {#if isFocused}
    <div
      class="sm:hidden fixed inset-0 z-[45] bg-white/50 dark:bg-gray-900/50 backdrop-blur-sm"
      style="backdrop-filter: blur(12px); -webkit-backdrop-filter: blur(12px); opacity: 0;"
      role="presentation"
      on:click={() => {
        if (mobileInputRef) mobileInputRef.blur();
      }}
      on:keydown={() => {}}
      use:animateBackdrop
    ></div>
  {/if}

  <!-- Mobile: nearly full-screen search -->
  <div class="sm:hidden z-50 transition-all duration-300 ease-in-out {isFocused ? 'fixed inset-4 top-8' : 'relative w-full'}">
    <div
      bind:this={mobileFormRef}
      class="transition-all duration-300 ease-in-out {isFocused && autocompleteState.isOpen ? 'shadow-2xl rounded-t-2xl' : isFocused ? 'shadow-2xl rounded-2xl' : 'shadow-sm focus-within:shadow-xl rounded-full'} {isFocused ? 'w-full relative bg-white dark:bg-gray-800' : 'w-full relative'}"
      style="transform-origin: center top;"
      {...rootProps}
    >
      <svg class="absolute top-0 bottom-0 left-4 m-auto h-5 w-5 text-gray-500 dark:text-gray-400 z-10" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
      </svg>
      <input
        bind:this={mobileInputRef}
        class="w-full py-3 px-4 pl-12 leading-5 text-gray-900 dark:text-gray-100 bg-white dark:bg-gray-700 outline-none border border-gray-200 dark:border-gray-600 focus:border-gray-400 dark:focus:border-gray-500 transition-all duration-300 {isFocused && autocompleteState.isOpen ? 'text-lg rounded-t-2xl border-b-0' : isFocused ? 'text-lg rounded-2xl' : 'text-base rounded-full'}"
        placeholder={isFocused ? "Search anime..." : "Search"}
        on:focus={handleFocus}
        on:blur={handleBlur}
        on:keydown={handleKeyDown}
        on:input={handleInputChange}
        {...inputProps}
      />
      {#if isFocused && autocompleteState.isOpen}
        <div
          bind:this={mobilePanelRef}
          class="absolute z-50 w-full left-0 right-0 overflow-auto bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-b-2xl shadow-2xl -mt-px border-t-0 max-h-[calc(100vh-120px)]"
          style="transform-origin: center top; opacity: 0;"
        >
          <div class="h-px bg-gradient-to-r from-transparent via-gray-200 dark:via-gray-600 to-transparent mx-4"></div>
          {#each autocompleteState.collections as collection}
            <ul class="py-2">
              {#each filterValidItems(collection.items) as item (item.objectID)}
                <AutocompleteItem {item} onClick={() => handleItemClick(item)} />
              {/each}
            </ul>
          {/each}
        </div>
      {/if}
    </div>
  </div>

  <!-- Desktop: floating, always-visible search -->
  <div
    class="hidden sm:flex z-[60] left-1/2 -translate-x-1/2 w-full max-w-xl top-0 focus-within:top-16 transition-all duration-300 ease-in-out scale-100 focus-within:scale-105 relative {isFocused && autocompleteState.isOpen ? 'shadow-2xl' : 'shadow-sm focus-within:shadow-xl'} {isFocused && autocompleteState.isOpen ? 'rounded-t-2xl' : 'rounded-full'} bg-white/80 dark:bg-gray-800/80 backdrop-blur-lg"
    bind:this={desktopFormRef}
    style="transform-origin: center top;"
    {...rootProps}
  >
    <svg class="absolute top-0 bottom-0 left-4 m-auto h-5 w-5 text-gray-500 dark:text-gray-400 z-10" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
    </svg>
    <input
      bind:this={desktopInputRef}
      class="w-full py-2 px-4 pl-10 text-base outline-none text-gray-900 dark:text-gray-100 bg-transparent border border-gray-200 dark:border-gray-600 focus:border-gray-400 dark:focus:border-gray-500 transition-all duration-300 {isFocused && autocompleteState.isOpen ? 'rounded-t-2xl border-b-0' : 'rounded-full'}"
      placeholder="Search anime..."
      on:focus={handleFocus}
      on:blur={handleBlur}
      on:keydown={handleKeyDown}
      on:input={handleInputChange}
      {...inputProps}
    />
    <div class="absolute top-full left-0 right-0">
      {#if isFocused && autocompleteState.isOpen}
        <div
          bind:this={desktopPanelRef}
          class="absolute z-[60] w-full left-0 right-0 overflow-auto bg-white/95 dark:bg-gray-800/95 backdrop-blur-lg border border-gray-200/50 dark:border-gray-600/50 rounded-b-2xl shadow-2xl shadow-black/10 dark:shadow-black/30 -mt-px border-t-0 max-h-72"
          style="transform-origin: center top; opacity: 0;"
        >
          <div class="h-px bg-gradient-to-r from-transparent via-gray-200 dark:via-gray-600 to-transparent mx-4"></div>
          {#each autocompleteState.collections as collection}
            <ul class="py-2">
              {#each filterValidItems(collection.items) as item (item.objectID)}
                <AutocompleteItem {item} onClick={() => handleItemClick(item)} />
              {/each}
            </ul>
          {/each}
        </div>
      {/if}
    </div>
  </div>

{/if}

