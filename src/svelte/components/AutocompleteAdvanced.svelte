<script lang="ts">
  import { onMount } from 'svelte';
  import { animate, stagger } from 'motion';
  import AutocompleteItem from './AutocompleteItem.svelte';
  import EmptyState from './EmptyState.svelte';
  import { clickOutside } from '../actions/clickOutside';
  import { AutocompleteAdvancedBloc } from './AutocompleteAdvanced.bloc.svelte';

  /**
   * The view: markup, animation and the two inputs. Everything about what a
   * query returns, which row is highlighted and where a result goes lives in
   * the bloc.
   */
  let { bloc = new AutocompleteAdvancedBloc() }: { bloc?: AutocompleteAdvancedBloc } = $props();

  let desktopInputRef = $state<HTMLInputElement | null>(null);
  let mobileInputRef = $state<HTMLInputElement | null>(null);
  let desktopFormRef = $state<HTMLDivElement | null>(null);
  let mobileFormRef = $state<HTMLDivElement | null>(null);
  let desktopPanelRef = $state<HTMLDivElement | null>(null);
  let mobilePanelRef = $state<HTMLDivElement | null>(null);

  // The text in the box. The bloc's `query` is the search backend's idea of
  // it, which arrives a tick later; binding the input to that would fight the
  // user's typing.
  let text = $state('');

  onMount(() => {
    bloc.init();

    return () => {
      bloc.destroy();
      removeDesktopBackdrop();
    };
  });

  /** Whichever of the two panels is actually on screen; both are in the DOM. */
  function visiblePanel(): HTMLElement | null {
    if (typeof window === 'undefined') return null;
    return window.innerWidth >= 640 ? desktopPanelRef : mobilePanelRef;
  }

  function activeDevice(): 'desktop' | 'mobile' {
    return typeof window !== 'undefined' && window.innerWidth >= 640 ? 'desktop' : 'mobile';
  }

  // Keep the highlighted option in view as the arrows walk past the fold.
  $effect(() => {
    const index = bloc.activeIndex;
    if (index < 0 || typeof document === 'undefined') return;
    document.getElementById(`ac-opt-${activeDevice()}-${index}`)?.scrollIntoView({ block: 'nearest' });
  });

  function createDesktopBackdrop() {
    if (typeof window === 'undefined') return;

    // Remove existing backdrop
    document.getElementById('desktop-search-backdrop')?.remove();

    // Create backdrop element at body level (outside header constraints)
    const backdrop = document.createElement('div');
    backdrop.id = 'desktop-search-backdrop';
    backdrop.className = 'fixed inset-0 bg-weeb-surface/50 bg-weeb-bg/50 backdrop-blur-sm';
    backdrop.style.cssText =
      'z-index: 35; backdrop-filter: blur(12px); -webkit-backdrop-filter: blur(12px); opacity: 0;'; // Start invisible
    backdrop.setAttribute('role', 'presentation');
    backdrop.addEventListener('click', () => desktopInputRef?.blur());

    document.body.appendChild(backdrop);
    animate(backdrop, { opacity: [0, 1] }, { duration: 0.3, ease: 'easeOut' });
  }

  function removeDesktopBackdrop() {
    if (typeof window === 'undefined') return;
    const backdrop = document.getElementById('desktop-search-backdrop');
    if (!backdrop) return;
    // Animate backdrop out before removing
    animate(backdrop, { opacity: [1, 0] }, { duration: 0.2, ease: 'easeIn' }).then(() =>
      backdrop.remove()
    );
  }

  function animatePanelOut() {
    const panel = visiblePanel();
    if (panel && bloc.isPanelOpen) {
      animate(panel, { opacity: [1, 0], y: [0, -10] }, { duration: 0.2, ease: 'easeOut' });
    }
  }

  function handleFocus() {
    bloc.focus();

    // Create backdrop for desktop only, bypassing header constraints
    if (typeof window !== 'undefined' && window.innerWidth >= 1024) {
      createDesktopBackdrop();
    }

    // Animate search input container on focus
    const container = window.innerWidth >= 640 ? desktopFormRef : mobileFormRef;
    if (container) {
      animate(container, { scale: [1, 1.02, 1] }, { type: 'spring', stiffness: 300, damping: 25 });
    }

    // Animate panel opening when results appear
    setTimeout(() => {
      const panel = visiblePanel();
      if (panel && bloc.isPanelOpen) {
        animate(
          panel,
          { opacity: [0, 1], y: [-10, 0], scale: [0.95, 1] },
          { type: 'spring', stiffness: 400, damping: 30 }
        );
      }
    }, 10);
  }

  function handleBlur() {
    animatePanelOut();
    bloc.blur();
    removeDesktopBackdrop();
  }

  function handleKeydown(event: KeyboardEvent) {
    const outcome = bloc.keydown(event.key);

    if (outcome === 'moved' || outcome === 'submitted') event.preventDefault();
    if (outcome === 'dismissed') animatePanelOut();
    if (outcome === 'submitted') text = '';
    if (outcome === 'submitted' || outcome === 'dismissed') {
      removeDesktopBackdrop();
      (event.currentTarget as HTMLInputElement).blur();
    }
  }

  function handleSelect(item: unknown) {
    text = '';
    bloc.select(item);
    desktopInputRef?.blur();
    mobileInputRef?.blur();
  }

  // Total time the entrance stagger may span, regardless of how many results
  // came back. A fixed per-item delay does not scale: at 0.05s, twenty results
  // took a full second to finish appearing, and the old document-wide selector
  // matched the mobile *and* desktop panels, so it was really forty items and
  // about two seconds — while Algolia itself answers in well under a hundred
  // milliseconds.
  const RESULTS_STAGGER_BUDGET_S = 0.12;

  function animateResultsIn() {
    const panel = visiblePanel();
    const items = panel ? [...panel.querySelectorAll('[data-autocomplete-item]')] : [];
    if (items.length === 0 || typeof animate !== 'function') return;

    try {
      const animationOptions: any = { type: 'spring', stiffness: 300, damping: 25 };
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
  $effect(() => {
    const panelShowing = bloc.isPanelOpen && bloc.hasResults;

    if (panelShowing && !resultsPanelWasOpen) {
      // Let Svelte flush the items into the panel before measuring them.
      setTimeout(animateResultsIn, 0);
    }
    resultsPanelWasOpen = panelShowing;
  });

  // Svelte action for mobile backdrop animation
  function animateBackdrop(node: HTMLElement) {
    animate(node, { opacity: [0, 1] }, { duration: 0.3, ease: 'easeOut' });

    return {
      destroy() {
        // Animate out (if still mounted)
        if (node.parentNode) {
          animate(node, { opacity: [1, 0] }, { duration: 0.2, ease: 'easeIn' });
        }
      }
    };
  }
</script>

{#snippet searchIcon()}
  <svg aria-hidden="true" focusable="false" width="24" height="24" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
  </svg>
{/snippet}

<!-- One panel body, rendered into whichever of the two shells is on screen.
     The mobile and desktop copies had drifted apart line by line. -->
{#snippet panelBody(device: 'mobile' | 'desktop')}
  <div class="ac-panel-divider"></div>
  {#if bloc.hasResults}
    <ul class="ac-results-list" role="listbox" id={`ac-listbox-${device}`} aria-label="Search results">
      {#each bloc.rows as row (row.kind === 'header' ? `h-${row.sourceId}` : row.item.objectID)}
        {#if row.kind === 'header'}
          <li class="ac-group-label" role="presentation">
            {bloc.groupLabel(row.sourceId)}
          </li>
        {:else}
          <AutocompleteItem
            item={row.item}
            id={`ac-opt-${device}-${row.index}`}
            active={bloc.activeIndex === row.index}
            onClick={() => handleSelect(row.item)}
          />
        {/if}
      {/each}
    </ul>
  {:else if bloc.query}
    <EmptyState icon={searchIcon} size="compact" message={`No results for '${bloc.query}'`} />
  {/if}
  {#if bloc.query}
    <div class="ac-footer">
      <a
        href={bloc.searchAllHref}
        class="ac-footer-link"
        onclick={(event) => {
          event.preventDefault();
          text = '';
          bloc.searchAll();
        }}
      >
        Search for '{bloc.query}'
      </a>
    </div>
  {/if}
{/snippet}

{#if bloc.status === 'loading'}
  <!-- Loading skeleton -->
  <div class="ac-skeleton-wrap">
    <div class="ac-skeleton-pill">
      <div class="ac-skeleton-bar"></div>
      <div class="ac-skeleton-spinner"></div>
    </div>
  </div>
{:else if bloc.status === 'unavailable'}
  <!-- Algolia could not be reached: a plain input that still runs a full
       search, rather than a dead search box. -->
  <div class="ac-fallback-wrap">
    <input
      type="text"
      placeholder="Search anime..."
      class="ac-simple-input"
      onkeydown={(e) => {
        if (e.key === 'Enter') bloc.searchFor(e.currentTarget.value);
      }}
    />
    <svg aria-hidden="true" focusable="false" class="ac-fallback-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
    </svg>
  </div>
{:else}

  <!-- Mobile backdrop overlay when focused -->
  {#if bloc.isFocused}
    <div
      class="ac-mobile-backdrop"
      role="presentation"
      onclick={() => mobileInputRef?.blur()}
      onkeydown={() => {}}
      use:animateBackdrop
    ></div>
  {/if}

  <!-- Mobile: nearly full-screen search -->
  <div class="ac-mobile-container" class:ac-mobile-container--focused={bloc.isFocused}>
    <div
      bind:this={mobileFormRef}
      class="ac-mobile-form"
      class:ac-mobile-form--open={bloc.isPanelOpen}
      class:ac-mobile-form--focused={bloc.isFocused && !bloc.isPanelOpen}
      style="transform-origin: center top;"
      use:clickOutside={{
        handler: () => mobileInputRef?.blur(),
        enabled: bloc.isFocused,
        event: 'pointerdown'
      }}
    >
      <svg aria-hidden="true" focusable="false" class="ac-search-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
      </svg>
      <input
        bind:this={mobileInputRef}
        bind:value={text}
        class="ac-input ac-input--mobile"
        class:ac-input--panel-open={bloc.isPanelOpen}
        class:ac-input--focused={bloc.isFocused && !bloc.isPanelOpen}
        onfocus={handleFocus}
        onblur={handleBlur}
        onkeydown={handleKeydown}
        oninput={(e) => bloc.input(e.currentTarget.value)}
        id="search-desktop"
        placeholder={bloc.isFocused ? 'Search anime...' : 'Search'}
        aria-label="Search anime"
        role="combobox"
        aria-expanded={bloc.isPanelOpen && bloc.hasResults}
        aria-controls="ac-listbox-mobile"
        aria-autocomplete="list"
        aria-activedescendant={bloc.activeIndex >= 0 ? `ac-opt-mobile-${bloc.activeIndex}` : undefined}
      />
      {#if !bloc.isFocused}
        <span class="ac-kbd">/</span>
      {/if}
      {#if bloc.isPanelOpen}
        <div
          bind:this={mobilePanelRef}
          class="ac-panel ac-panel--mobile"
          style="transform-origin: center top;"
        >
          {@render panelBody('mobile')}
        </div>
      {/if}
    </div>
  </div>

  <!-- Desktop: floating, always-visible search -->
  <div
    class="ac-desktop-container"
    class:ac-desktop-container--open={bloc.isPanelOpen}
    bind:this={desktopFormRef}
    style="transform-origin: center top;"
    use:clickOutside={{
      handler: () => desktopInputRef?.blur(),
      enabled: bloc.isFocused,
      event: 'mousedown'
    }}
  >
    <svg aria-hidden="true" focusable="false" class="ac-search-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
    </svg>
    <input
      bind:this={desktopInputRef}
      bind:value={text}
      class="ac-input ac-input--desktop"
      class:ac-input--panel-open={bloc.isPanelOpen}
      onfocus={handleFocus}
      onblur={handleBlur}
      onkeydown={handleKeydown}
      oninput={(e) => bloc.input(e.currentTarget.value)}
      placeholder="Search anime..."
      aria-label="Search anime"
      role="combobox"
      aria-expanded={bloc.isPanelOpen && bloc.hasResults}
      aria-controls="ac-listbox-desktop"
      aria-autocomplete="list"
      aria-activedescendant={bloc.activeIndex >= 0 ? `ac-opt-desktop-${bloc.activeIndex}` : undefined}
    />
    {#if !bloc.isFocused}
      <span class="ac-kbd">/</span>
    {/if}
    <div class="ac-desktop-panel-anchor">
      {#if bloc.isPanelOpen}
        <div
          bind:this={desktopPanelRef}
          class="ac-panel ac-panel--desktop"
          style="transform-origin: center top;"
        >
          {@render panelBody('desktop')}
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
    --_ac-fg: var(--weeb-fg, var(--weeb-fg));
    --_ac-fg-secondary: var(--weeb-fg-secondary, oklch(70% 0.01 270));
    --_ac-fg-muted: var(--weeb-fg-muted, var(--weeb-fg-muted));
    --_ac-border: var(--weeb-border, oklch(28% 0.015 275));
    --_ac-accent: var(--weeb-accent, var(--weeb-accent));
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
    box-shadow: 0 0 0 3px color-mix(in oklch, var(--weeb-accent) 12%, transparent);
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
    min-height: 44px;
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
    box-shadow: 0 0 0 3px color-mix(in oklch, var(--weeb-accent) 12%, transparent);
  }
  /* The glow above is 1.09:1 against the page -- decoration, not an indicator.
     This is the one that actually reads. */
  .ac-input:focus-visible {
    outline: 2px solid var(--weeb-accent-text);
    outline-offset: 2px;
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

  /* ── Group heading ──
     Only rendered when a query matches more than one index, so a panel of
     anime alone looks exactly as it did before works were searchable. Quiet
     rather than decorative: it separates two lists, it is not a result. */
  .ac-group-label {
    padding: 10px 16px 4px;
    font-size: 11px;
    font-weight: 600;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    color: var(--weeb-fg-muted, #8b8b8b);
    pointer-events: none;
  }
  /* The first heading sits directly under the panel divider, where the list's
     own top padding is already doing the work. */
  .ac-group-label:first-child {
    padding-top: 2px;
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

