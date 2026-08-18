<script lang="ts">
  import { goto } from '$app/navigation';
  import { onMount, onDestroy } from 'svelte';
  import { animate, stagger } from 'motion';
  import AutocompleteItem from './AutocompleteItem.svelte';
  import { configStore } from '../stores/config';
  import { analytics } from '../../utils/analytics';
  import { animeHref } from '../../services/utils';

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

  // Keyboard navigation: the currently highlighted result (-1 = none). The
  // panel is rendered twice (mobile + desktop) but only one is visible, so a
  // single flat index drives both; per-device option ids keep the DOM valid.
  let activeIndex = -1;
  $: flatItems = (autocompleteState.collections || [])
    .flatMap((c: any) => filterValidItems(c.items || []));
  // Keep the highlight in range as results change under the user.
  $: if (activeIndex >= flatItems.length) activeIndex = flatItems.length - 1;

  function activeDevice(): 'desktop' | 'mobile' {
    return typeof window !== 'undefined' && window.innerWidth >= 640 ? 'desktop' : 'mobile';
  }

  function scrollActiveIntoView() {
    if (activeIndex < 0 || typeof document === 'undefined') return;
    const el = document.getElementById(`ac-opt-${activeDevice()}-${activeIndex}`);
    el?.scrollIntoView({ block: 'nearest' });
  }


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
        if ('default' in algoliasearchModule && typeof algoliasearchModule.default === 'function') {
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
        const cleanupFunctions: Array<() => void> = [];

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
      // url_slug: algolia stores the CDC payload verbatim, not camelCase.
      goto(animeHref({ id: item?.id, slug: item?.url_slug ?? item?.slug }));
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
    backdrop.className = 'fixed inset-0 bg-weeb-surface/50 bg-weeb-bg/50 backdrop-blur-sm';
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
      { duration: 0.3, ease: 'easeOut' }
    );
  }

  function removeDesktopBackdrop() {
    if (typeof window === 'undefined') return;
    const backdrop = document.getElementById('desktop-search-backdrop');
    if (backdrop) {
      // Animate backdrop out before removing
      animate(backdrop,
        { opacity: [1, 0] },
        { duration: 0.2, ease: 'easeIn' }
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
        { type: 'spring', stiffness: 300, damping: 25 }
      );
    }

    // Animate panel opening when results appear
    setTimeout(() => {
      const panel = window.innerWidth >= 640 ? desktopPanelRef : mobilePanelRef;
      if (panel && autocompleteState.isOpen) {
        animate(panel,
          { opacity: [0, 1], y: [-10, 0], scale: [0.95, 1] },
          { type: 'spring', stiffness: 400, damping: 30 }
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
        { duration: 0.2, ease: 'easeOut' }
      );
    }

    // Delay to allow click events to fire and animation to complete
    setTimeout(() => {
      isFocused = false;
      activeIndex = -1;
      if (autocompleteInstance) {
        autocompleteInstance.setIsOpen(false);
      }
      removeDesktopBackdrop();
    }, 200);
  }

  function handleKeyDown(event: KeyboardEvent) {
    const len = flatItems.length;

    if (event.key === 'ArrowDown') {
      if (!autocompleteState.isOpen) return;
      event.preventDefault();
      activeIndex = len === 0 ? -1 : (activeIndex + 1) % len;
      scrollActiveIntoView();
      return;
    }

    if (event.key === 'ArrowUp') {
      if (!autocompleteState.isOpen) return;
      event.preventDefault();
      activeIndex = len === 0 ? -1 : (activeIndex <= 0 ? len - 1 : activeIndex - 1);
      scrollActiveIntoView();
      return;
    }

    if (event.key === 'Enter') {
      // A highlighted result wins; otherwise fall through to a full search.
      if (activeIndex >= 0 && flatItems[activeIndex]) {
        event.preventDefault();
        handleItemClick(flatItems[activeIndex]);
      } else if (autocompleteState.query) {
        event.preventDefault();
        const query = autocompleteState.query;
        analytics.searchPerformed(query.trim(), flatItems.length);
        if (autocompleteInstance) {
          autocompleteInstance.setIsOpen(false);
          autocompleteInstance.setQuery('');
        }
        (event.target as HTMLInputElement).blur();
        goto(`/search?query=${encodeURIComponent(query)}`);
      }
      return;
    }

    if (event.key === 'Escape') {
      // Animate panel closing on escape
      const panel = window.innerWidth >= 640 ? desktopPanelRef : mobilePanelRef;
      if (panel && autocompleteState.isOpen) {
        animate(panel,
          { opacity: [1, 0], y: [0, -10] },
          { duration: 0.2, ease: 'easeOut' }
        );
      }

      activeIndex = -1;
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
    // Results are about to change; drop the highlight so it can't point at a
    // stale row (Enter would otherwise open the wrong show).
    activeIndex = -1;
    if (autocompleteInstance) {
      console.log('Setting query on autocomplete instance');
      autocompleteInstance.setQuery(value);
      autocompleteInstance.refresh();
    } else {
      console.log('No autocomplete instance available');
    }
  }

  function filterValidItems(items: any[]): any[] {
    return items.filter((item) => item != null);
  }

  $: inputProps = autocompleteInstance?.getInputProps({}) || {};
  $: rootProps = autocompleteInstance?.getRootProps({}) || {};

  // Total time the entrance stagger may span, regardless of how many results
  // came back. A fixed per-item delay does not scale: at 0.05s, twenty results
  // took a full second to finish appearing, and the old document-wide selector
  // matched the mobile *and* desktop panels, so it was really forty items and
  // about two seconds — while Algolia itself answers in well under a hundred
  // milliseconds.
  const RESULTS_STAGGER_BUDGET_S = 0.12;

  function animateResultsIn() {
    // Only the panel actually on screen; both are in the DOM at all times.
    const panel = window.innerWidth >= 640 ? desktopPanelRef : mobilePanelRef;
    const items = panel ? [...panel.querySelectorAll('[data-autocomplete-item]')] : [];
    if (items.length === 0 || typeof animate !== 'function') return;

    try {
      const animationOptions: any = {
        type: 'spring',
        stiffness: 300,
        damping: 25
      };

      if (typeof stagger === 'function') {
        animationOptions.delay = stagger(RESULTS_STAGGER_BUDGET_S / items.length);
      }

      animate(items, { opacity: [0, 1], y: [12, 0] }, animationOptions);
    } catch (e) {
      // Silently fail - animations are not critical
    }
  }

  // Animate results in when the panel opens — deliberately NOT on every
  // keystroke. Each run restarts the items from opacity 0, so re-running it per
  // input made already-rendered results blink out and fade back in on every
  // character, which is what made the search feel slow. Refining a query now
  // swaps the contents in place.
  let resultsPanelWasOpen = false;
  $: {
    const hasResults = (autocompleteState.collections || []).some(
      (c: any) => (c?.items?.length ?? 0) > 0
    );
    const panelShowing = Boolean(autocompleteState.isOpen) && hasResults;

    if (panelShowing && !resultsPanelWasOpen) {
      // Let Svelte flush the items into the panel before measuring them.
      setTimeout(animateResultsIn, 0);
    }
    resultsPanelWasOpen = panelShowing;
  }

  // Svelte action for mobile backdrop animation
  function animateBackdrop(node: HTMLElement) {
    // Animate in
    animate(node,
      { opacity: [0, 1] },
      { duration: 0.3, ease: 'easeOut' }
    );

    return {
      destroy() {
        // Animate out (if still mounted)
        if (node.parentNode) {
          animate(node,
            { opacity: [1, 0] },
            { duration: 0.2, ease: 'easeIn' }
          );
        }
      }
    };
  }
</script>

{#if isLoading}
  <!-- Loading skeleton -->
  <div class="ac-skeleton-wrap">
    <div class="ac-skeleton-pill">
      <div class="ac-skeleton-bar"></div>
      <div class="ac-skeleton-spinner"></div>
    </div>
  </div>
{:else if !isClient}
  <!-- Fallback placeholder -->
  <div class="ac-fallback-wrap">
    <input
      type="text"
      placeholder="Search anime..."
      disabled
      class="ac-fallback-input"
    />
    <svg class="ac-fallback-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
    </svg>
  </div>
{:else if !autocompleteInstance}
  <!-- If Algolia failed to load, show a simple input without autocomplete -->
  <div class="ac-fallback-wrap">
    <input
      type="text"
      placeholder="Search anime..."
      class="ac-simple-input"
      on:keydown={(e) => {
        if (e.key === 'Enter') {
          const query = e.currentTarget.value;
          if (query.trim()) {
            analytics.searchPerformed(query.trim(), 0);
            goto(`/search?query=${encodeURIComponent(query.trim())}`);
          }
        }
      }}
    />
    <svg class="ac-fallback-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
    </svg>
  </div>
{:else}

  <!-- Mobile backdrop overlay when focused -->
  {#if isFocused}
    <div
      class="ac-mobile-backdrop"
      role="presentation"
      on:click={() => {
        if (mobileInputRef) mobileInputRef.blur();
      }}
      on:keydown={() => {}}
      use:animateBackdrop
    ></div>
  {/if}

  <!-- Mobile: nearly full-screen search -->
  <div class="ac-mobile-container" class:ac-mobile-container--focused={isFocused}>
    <div
      bind:this={mobileFormRef}
      class="ac-mobile-form"
      class:ac-mobile-form--open={isFocused && autocompleteState.isOpen}
      class:ac-mobile-form--focused={isFocused && !autocompleteState.isOpen}
      style="transform-origin: center top;"
      {...rootProps}
    >
      <svg class="ac-search-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
      </svg>
      <input
        bind:this={mobileInputRef}
        class="ac-input ac-input--mobile"
        class:ac-input--panel-open={isFocused && autocompleteState.isOpen}
        class:ac-input--focused={isFocused && !autocompleteState.isOpen}
        placeholder={isFocused ? "Search anime..." : "Search"}
        on:focus={handleFocus}
        on:blur={handleBlur}
        on:keydown={handleKeyDown}
        on:input={handleInputChange}
        {...inputProps}
        role="combobox"
        aria-expanded={isFocused && autocompleteState.isOpen && flatItems.length > 0}
        aria-controls="ac-listbox-mobile"
        aria-autocomplete="list"
        aria-activedescendant={activeIndex >= 0 ? `ac-opt-mobile-${activeIndex}` : undefined}
      />
      {#if !isFocused}
        <span class="ac-kbd">/</span>
      {/if}
      {#if isFocused && autocompleteState.isOpen}
        <div
          bind:this={mobilePanelRef}
          class="ac-panel ac-panel--mobile"
          style="transform-origin: center top;"
        >
          <div class="ac-panel-divider"></div>
          {#if flatItems.length > 0}
            <ul class="ac-results-list" role="listbox" id="ac-listbox-mobile" aria-label="Search results">
              {#each flatItems as item, i (item.objectID)}
                <AutocompleteItem
                  {item}
                  id={`ac-opt-mobile-${i}`}
                  active={activeIndex === i}
                  onClick={() => handleItemClick(item)}
                />
              {/each}
            </ul>
          {:else if autocompleteState.query}
            <div class="ac-empty">
              <svg class="ac-empty-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <span>No results for '{autocompleteState.query}'</span>
            </div>
          {/if}
          {#if autocompleteState.query}
            <div class="ac-footer">
              <a
                href="/search?query={encodeURIComponent(autocompleteState.query)}"
                class="ac-footer-link"
                on:click|preventDefault={() => {
                  goto(`/search?query=${encodeURIComponent(autocompleteState.query)}`);
                }}
              >
                Search for '{autocompleteState.query}'
              </a>
            </div>
          {/if}
        </div>
      {/if}
    </div>
  </div>

  <!-- Desktop: floating, always-visible search -->
  <div
    class="ac-desktop-container"
    class:ac-desktop-container--open={isFocused && autocompleteState.isOpen}
    bind:this={desktopFormRef}
    style="transform-origin: center top;"
    {...rootProps}
  >
    <svg class="ac-search-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
    </svg>
    <input
      bind:this={desktopInputRef}
      class="ac-input ac-input--desktop"
      class:ac-input--panel-open={isFocused && autocompleteState.isOpen}
      placeholder="Search anime..."
      on:focus={handleFocus}
      on:blur={handleBlur}
      on:keydown={handleKeyDown}
      on:input={handleInputChange}
      {...inputProps}
      role="combobox"
      aria-expanded={isFocused && autocompleteState.isOpen && flatItems.length > 0}
      aria-controls="ac-listbox-desktop"
      aria-autocomplete="list"
      aria-activedescendant={activeIndex >= 0 ? `ac-opt-desktop-${activeIndex}` : undefined}
    />
    {#if !isFocused}
      <span class="ac-kbd">/</span>
    {/if}
    <div class="ac-desktop-panel-anchor">
      {#if isFocused && autocompleteState.isOpen}
        <div
          bind:this={desktopPanelRef}
          class="ac-panel ac-panel--desktop"
          style="transform-origin: center top;"
        >
          <div class="ac-panel-divider"></div>
          {#if flatItems.length > 0}
            <ul class="ac-results-list" role="listbox" id="ac-listbox-desktop" aria-label="Search results">
              {#each flatItems as item, i (item.objectID)}
                <AutocompleteItem
                  {item}
                  id={`ac-opt-desktop-${i}`}
                  active={activeIndex === i}
                  onClick={() => handleItemClick(item)}
                />
              {/each}
            </ul>
          {:else if autocompleteState.query}
            <div class="ac-empty">
              <svg class="ac-empty-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <span>No results for '{autocompleteState.query}'</span>
            </div>
          {/if}
          {#if autocompleteState.query}
            <div class="ac-footer">
              <a
                href="/search?query={encodeURIComponent(autocompleteState.query)}"
                class="ac-footer-link"
                on:click|preventDefault={() => {
                  goto(`/search?query=${encodeURIComponent(autocompleteState.query)}`);
                }}
              >
                Search for '{autocompleteState.query}'
              </a>
            </div>
          {/if}
        </div>
      {/if}
    </div>
  </div>

{/if}

<style>
  /* ── Tokens (local aliases for readability) ── */
  :root {
    --_ac-bg: var(--weeb-bg, oklch(14% 0.015 275));
    --_ac-bg-elevated: var(--weeb-bg-elevated, oklch(18% 0.018 275));
    --_ac-surface: var(--weeb-surface, oklch(22% 0.02 275));
    --_ac-surface-hover: var(--weeb-surface-hover, oklch(26% 0.022 275));
    --_ac-fg: var(--weeb-fg, oklch(95% 0.005 265));
    --_ac-fg-secondary: var(--weeb-fg-secondary, oklch(70% 0.01 270));
    --_ac-fg-muted: var(--weeb-fg-muted, oklch(55% 0.01 270));
    --_ac-border: var(--weeb-border, oklch(28% 0.015 275));
    --_ac-accent: var(--weeb-accent, oklch(55% 0.15 280));
    --_ac-accent-hover: var(--weeb-accent-hover, oklch(62% 0.16 280));
    --_ac-radius: var(--weeb-radius, 8px);
    --_ac-radius-lg: var(--weeb-radius-lg, 12px);
    --_ac-font: var(--weeb-font, system-ui, -apple-system, sans-serif);
    --_ac-font-mono: var(--weeb-font-mono, 'JetBrains Mono', monospace);
  }

  /* ── Keyframes ── */
  @keyframes ac-slide-down {
    from {
      opacity: 0;
      transform: translateY(-8px);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }

  @keyframes ac-pulse {
    0%, 100% { opacity: 1; }
    50% { opacity: 0.5; }
  }

  @keyframes ac-spin {
    to { transform: rotate(360deg); }
  }

  /* ── Loading skeleton ── */
  .ac-skeleton-wrap {
    position: relative;
  }

  .ac-skeleton-pill {
    display: flex;
    align-items: center;
    height: 38px;
    padding: 0 16px;
    border: 1px solid var(--_ac-border);
    border-radius: 19px;
    background: var(--_ac-surface-hover);
    animation: ac-pulse 1.8s ease-in-out infinite;
  }

  .ac-skeleton-bar {
    height: 14px;
    width: 120px;
    border-radius: 7px;
    background: var(--_ac-surface-hover);
  }

  .ac-skeleton-spinner {
    margin-left: auto;
    height: 16px;
    width: 16px;
    border: 2px solid var(--_ac-border);
    border-top-color: var(--_ac-fg-muted);
    border-radius: 50%;
    animation: ac-spin 0.8s linear infinite;
  }

  /* ── Fallback / disabled states ── */
  .ac-fallback-wrap {
    position: relative;
  }

  .ac-fallback-input {
    width: 100%;
    height: 38px;
    padding: 0 40px 0 16px;
    border: 1px solid var(--_ac-border);
    border-radius: 19px;
    background: var(--_ac-bg-elevated);
    color: var(--_ac-fg-muted);
    font-family: var(--_ac-font);
    font-size: 14px;
    outline: none;
  }

  .ac-simple-input {
    width: 100%;
    height: 38px;
    padding: 0 40px 0 16px;
    border: 1px solid var(--_ac-border);
    border-radius: 19px;
    background: var(--_ac-surface);
    color: var(--_ac-fg);
    font-family: var(--_ac-font);
    font-size: 14px;
    outline: none;
    transition: border-color 0.2s;
  }

  .ac-simple-input:focus {
    border-color: var(--_ac-accent);
    box-shadow: 0 0 0 3px oklch(55% 0.15 280 / 0.12);
  }

  .ac-fallback-icon {
    position: absolute;
    right: 12px;
    top: 50%;
    transform: translateY(-50%);
    height: 14px;
    width: 14px;
    color: var(--_ac-fg-muted);
  }

  /* ── Search icon (shared) ── */
  .ac-search-icon {
    position: absolute;
    left: 14px;
    top: 50%;
    transform: translateY(-50%);
    height: 14px;
    width: 14px;
    color: var(--_ac-fg-muted);
    z-index: 2;
    pointer-events: none;
  }

  /* ── Keyboard shortcut badge ── */
  .ac-kbd {
    position: absolute;
    right: 12px;
    top: 50%;
    transform: translateY(-50%);
    display: inline-flex;
    align-items: center;
    justify-content: center;
    height: 20px;
    min-width: 20px;
    padding: 0 5px;
    border: 1px solid var(--_ac-border);
    border-radius: 4px;
    background: var(--_ac-bg-elevated);
    color: var(--_ac-fg-muted);
    font-family: var(--_ac-font-mono);
    font-size: 11px;
    line-height: 1;
    pointer-events: none;
    z-index: 2;
  }

  /* ── Main input ── */
  .ac-input {
    width: 100%;
    height: 38px;
    padding: 0 40px 0 38px;
    border: 1px solid var(--_ac-border);
    border-radius: 19px;
    background: var(--_ac-surface);
    color: var(--_ac-fg);
    font-family: var(--_ac-font);
    font-size: 14px;
    outline: none;
    transition: border-color 0.2s, box-shadow 0.2s, border-radius 0.2s, background 0.2s;
  }

  .ac-input::placeholder {
    color: var(--_ac-fg-muted);
  }

  .ac-input:focus {
    border-color: var(--_ac-accent);
    box-shadow: 0 0 0 3px oklch(55% 0.15 280 / 0.12);
  }

  .ac-input--panel-open {
    border-radius: 12px 12px 0 0;
    border-bottom-color: transparent;
    box-shadow: none;
  }

  .ac-input--panel-open:focus {
    box-shadow: none;
  }

  /* ── Mobile backdrop ── */
  .ac-mobile-backdrop {
    display: none;
    position: fixed;
    inset: 0;
    z-index: 45;
    background: oklch(14% 0.015 275 / 0.6);
    backdrop-filter: blur(12px);
    -webkit-backdrop-filter: blur(12px);
    opacity: 0;
  }

  @media (max-width: 639px) {
    .ac-mobile-backdrop {
      display: block;
    }
  }

  /* ── Mobile container ── */
  .ac-mobile-container {
    position: relative;
    width: 100%;
    z-index: 50;
    transition: all 0.3s ease-in-out;
  }

  @media (min-width: 640px) {
    .ac-mobile-container {
      display: none;
    }
  }

  .ac-mobile-container--focused {
    position: fixed;
    inset: 16px;
    top: 32px;
    width: auto;
  }

  .ac-mobile-form {
    position: relative;
    width: 100%;
    border-radius: 19px;
    transition: all 0.3s ease-in-out;
    transform-origin: center top;
  }

  .ac-mobile-form--open {
    background: var(--_ac-surface);
    border-radius: var(--_ac-radius-lg) var(--_ac-radius-lg) 0 0;
    box-shadow: 0 25px 50px -12px oklch(0% 0 0 / 0.5);
  }

  .ac-mobile-form--focused {
    background: var(--_ac-surface);
    border-radius: var(--_ac-radius-lg);
    box-shadow: 0 25px 50px -12px oklch(0% 0 0 / 0.5);
  }

  .ac-mobile-form .ac-input--mobile {
    font-size: 14px;
  }

  .ac-mobile-form--open .ac-input--mobile,
  .ac-mobile-form--focused .ac-input--mobile {
    font-size: 16px;
    height: 48px;
    padding-left: 44px;
  }

  .ac-mobile-form--open .ac-search-icon,
  .ac-mobile-form--focused .ac-search-icon {
    left: 16px;
    height: 18px;
    width: 18px;
  }

  /* ── Desktop container ── */
  .ac-desktop-container {
    display: none;
    position: relative;
    width: 100%;
    max-width: 520px;
    z-index: 60;
    transform-origin: center top;
  }

  @media (min-width: 640px) {
    .ac-desktop-container {
      display: flex;
    }
  }

  .ac-desktop-panel-anchor {
    position: absolute;
    top: 100%;
    left: 0;
    right: 0;
  }

  /* ── Dropdown panel (shared) ── */
  .ac-panel {
    position: absolute;
    z-index: 60;
    width: 100%;
    left: 0;
    right: 0;
    margin-top: -1px;
    overflow-y: auto;
    background: var(--_ac-bg-elevated);
    border: 1px solid var(--_ac-border);
    border-top: none;
    border-radius: 0 0 var(--_ac-radius-lg) var(--_ac-radius-lg);
    box-shadow:
      0 20px 40px -8px oklch(0% 0 0 / 0.45),
      0 8px 16px -4px oklch(0% 0 0 / 0.3);
    animation: ac-slide-down 0.2s ease-out forwards;
    transform-origin: center top;
  }

  .ac-panel--desktop {
    max-height: 400px;
  }

  .ac-panel--mobile {
    max-height: calc(100vh - 120px);
  }

  /* Custom scrollbar */
  .ac-panel::-webkit-scrollbar {
    width: 6px;
  }

  .ac-panel::-webkit-scrollbar-track {
    background: transparent;
  }

  .ac-panel::-webkit-scrollbar-thumb {
    background: var(--_ac-border);
    border-radius: 3px;
  }

  .ac-panel::-webkit-scrollbar-thumb:hover {
    background: var(--_ac-fg-muted);
  }

  /* ── Panel divider ── */
  .ac-panel-divider {
    height: 1px;
    margin: 0 16px;
    background: linear-gradient(to right, transparent, var(--_ac-border), transparent);
  }

  /* ── Results list ── */
  .ac-results-list {
    list-style: none;
    margin: 0;
    padding: 8px 0;
  }

  /* ── Empty state ── */
  .ac-empty {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 8px;
    padding: 32px 16px;
    color: var(--_ac-fg-muted);
    font-family: var(--_ac-font);
    font-size: 14px;
    text-align: center;
  }

  .ac-empty-icon {
    height: 24px;
    width: 24px;
    color: var(--_ac-fg-muted);
  }

  /* ── Footer ── */
  .ac-footer {
    border-top: 1px solid var(--_ac-border);
    padding: 10px 16px;
  }

  .ac-footer-link {
    display: block;
    color: var(--_ac-accent);
    font-family: var(--_ac-font);
    font-size: 13px;
    text-decoration: none;
    transition: text-decoration-color 0.15s;
  }

  .ac-footer-link:hover {
    text-decoration: underline;
    color: var(--_ac-accent-hover);
  }
</style>

