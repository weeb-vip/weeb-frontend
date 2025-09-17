<script lang="ts">
  import { onMount } from 'svelte';
  import { isValid } from 'date-fns';
  import AutocompleteItem from './AutocompleteItem.svelte';
  import { configStore } from '../stores/config';

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

  onMount(async () => {
    // Only run on client-side
    if (typeof window === 'undefined') return;

    try {
      // Initialize config store - fetch from HTTP and wait for it
      console.log('Initializing config store...');
      await configStore.init();
      console.log('Config store initialized successfully');
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

        console.log('Modules loaded:', {
          algoliasearch: typeof algoliasearch,
          createAutocomplete: typeof createAutocomplete,
          getAlgoliaResults: typeof getAlgoliaResults,
          algoliasearchModule: Object.keys(algoliasearchModule)
        });

        if (typeof algoliasearch !== 'function') {
          throw new Error('algoliasearch is not a function: ' + typeof algoliasearch);
        }

        searchClient = algoliasearch("A2HF2P5C6X", "45216ed5ac3f9e0a478d3c354d353d58");
        console.log('Search client created:', searchClient);

        autocompleteInstance = createAutocomplete({
          onStateChange({ state }) {
            console.log('Autocomplete state changed:', {
              isOpen: state.isOpen,
              query: state.query,
              collections: state.collections?.length || 0,
              status: state.status
            });
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
                  console.log('getItems called with query:', query);
                  if (!query) {
                    return [];
                  }

                  // Get config from the Svelte store with fallback
                  const config = configStore.get();
                  const indexName = config?.algolia_index || 'anime-staging';

                  console.log('Using Algolia index from Svelte store:', indexName, 'config:', config);

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

        console.log('Autocomplete instance created:', autocompleteInstance);

        isClient = true;
        isLoading = false;
        console.log('Algolia initialized successfully (Svelte)');

        // Add environment event listeners
        if (mobileFormRef && mobileInputRef && mobilePanelRef) {
          const envProps = autocompleteInstance.getEnvironmentProps({
            formElement: mobileFormRef,
            inputElement: mobileInputRef,
            panelElement: mobilePanelRef,
          });

          window.addEventListener("touchstart", envProps.onTouchStart);
          window.addEventListener("touchmove", envProps.onTouchMove);
          window.addEventListener("mousedown", envProps.onMouseDown);

          return () => {
            window.removeEventListener("touchstart", envProps.onTouchStart);
            window.removeEventListener("touchmove", envProps.onTouchMove);
            window.removeEventListener("mousedown", envProps.onMouseDown);
          };
        }
      } catch (error) {
        console.error('Failed to initialize Algolia (Svelte):', error);
        // Still set isClient to true to show a non-disabled input
        isClient = true;
      }
    };

    console.log('Autocomplete component mounting (Svelte), isClient:', isClient);
    initializeAlgolia();
  });

  function handleItemClick(item: any) {
    if (autocompleteInstance) {
      autocompleteInstance.setIsOpen(false);
      autocompleteInstance.setQuery('');
    }
    // Navigate to show page
    if (typeof window !== 'undefined') {
      window.location.href = `/show/${item.id ? encodeURIComponent(item.id) : ''}`;
    }
    if (desktopInputRef) desktopInputRef.blur();
    if (mobileInputRef) mobileInputRef.blur();
  }

  function handleFocus() {
    isFocused = true;
    if (autocompleteInstance) {
      autocompleteInstance.setIsOpen(true);
    }
  }

  function handleBlur() {
    // Delay to allow click events to fire
    setTimeout(() => {
      isFocused = false;
      if (autocompleteInstance) {
        autocompleteInstance.setIsOpen(false);
      }
    }, 200);
  }

  function handleKeyDown(event: KeyboardEvent) {
    if (event.key === 'Escape') {
      isFocused = false;
      if (autocompleteInstance) {
        autocompleteInstance.setIsOpen(false);
      }
      (event.target as HTMLInputElement).blur();
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
            window.location.href = `/search?query=${encodeURIComponent(query.trim())}`;
          }
        }
      }}
    />
    <svg class="absolute right-3 top-3 h-5 w-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
    </svg>
  </div>
{:else}
  <!-- Backdrop overlay when focused -->
  <div
    class="fixed inset-0 z-40 bg-white/30 dark:bg-gray-900/30 backdrop-blur-md transition-opacity duration-300 ease-in-out {isFocused ? 'opacity-100' : 'opacity-0 pointer-events-none'}"
    role="presentation"
    on:click={() => {
      if (desktopInputRef) desktopInputRef.blur();
      if (mobileInputRef) mobileInputRef.blur();
    }}
    on:keydown={() => {}}
  ></div>

  <!-- Mobile: nearly full-screen search -->
  <div class="sm:hidden z-50 transition-all duration-300 ease-in-out {isFocused ? 'fixed inset-4 top-8' : 'relative w-full'}">
    <div
      bind:this={mobileFormRef}
      class="transition-all duration-300 ease-in-out {isFocused && autocompleteState.isOpen ? 'shadow-2xl rounded-t-2xl' : isFocused ? 'shadow-2xl rounded-2xl' : 'shadow-sm focus-within:shadow-xl rounded-full'} {isFocused ? 'w-full relative bg-white dark:bg-gray-800' : 'w-full relative'}"
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
          class="absolute z-50 w-full left-0 right-0 overflow-auto transition-all duration-200 ease-in-out bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-b-2xl shadow-2xl -mt-px border-t-0 max-h-[calc(100vh-120px)]"
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
    class="hidden sm:flex z-50 left-1/2 -translate-x-1/2 w-full max-w-xl top-0 focus-within:top-16 transition-all duration-300 ease-in-out scale-100 focus-within:scale-105 relative {isFocused && autocompleteState.isOpen ? 'shadow-2xl' : 'shadow-sm focus-within:shadow-xl'} {isFocused && autocompleteState.isOpen ? 'rounded-t-2xl' : 'rounded-full'} bg-white/80 dark:bg-gray-800/80 backdrop-blur-lg"
    bind:this={desktopFormRef}
    {...rootProps}
  >
    <svg class="absolute top-0 bottom-0 left-4 m-auto h-5 w-5 text-gray-500 dark:text-gray-400 z-10" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
    </svg>
    <input
      bind:this={desktopInputRef}
      class="w-full py-2 px-4 pl-10 text-base outline-none text-gray-900 dark:text-gray-100 bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 focus:border-gray-400 dark:focus:border-gray-500 transition-all duration-300 {isFocused && autocompleteState.isOpen ? 'rounded-t-2xl border-b-0' : 'rounded-full'}"
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
          class="absolute z-50 w-full left-0 right-0 overflow-auto transition-all duration-200 ease-in-out bg-white/95 dark:bg-gray-800/95 backdrop-blur-lg border border-gray-200/50 dark:border-gray-600/50 rounded-b-2xl shadow-2xl shadow-black/10 dark:shadow-black/30 -mt-px border-t-0 max-h-72"
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
