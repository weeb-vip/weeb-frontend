<script lang="ts">
  import { onMount } from 'svelte';

  export let tabs: string[];
  export let defaultTab: string;

  let activeTab = defaultTab;
  let isDropdownOpen = false;
  let contentRef: HTMLDivElement;
  let tabsRef: HTMLDivElement;
  let touchStart: number | null = null;
  let touchStartY: number | null = null;
  let currentX = 0;
  let isTransitioning = false;
  let isSticky = false;
  let stickyTabsEl: HTMLDivElement;

  $: activeIndex = tabs.indexOf(activeTab);

  // Action to assign sticky reference
  function assignStickyRef(node: HTMLDivElement) {
    stickyTabsEl = node;
    return {};
  }

  // Handle sticky behavior on scroll
  onMount(() => {
    let tabsOriginalTop: number | null = null;
    let ticking = false;
    let originalParent: Node | null = null;
    let nextSibling: Node | null = null;

    const handleScroll = () => {
      if (!ticking) {
        requestAnimationFrame(() => {
          if (!tabsRef) {
            ticking = false;
            return;
          }

          // Check multiple possible scroll containers
          const windowScrollY = window.scrollY || window.pageYOffset;
          const documentScrollY = document.documentElement.scrollTop || document.body.scrollTop;
          const scrollTop = Math.max(windowScrollY, documentScrollY);

          // Store original position on first calculation (only when not sticky and element is in original position)
          if (tabsOriginalTop === null && !isSticky && stickyTabsEl && stickyTabsEl.parentNode !== document.body) {
            const tabsRect = stickyTabsEl.getBoundingClientRect();
            tabsOriginalTop = tabsRect.top + scrollTop;
          }

          // Make sticky when scrolled past the tabs position
          if (tabsOriginalTop !== null) {
            // Header height is 10.5rem = 168px, but let's be more precise
            const headerHeight = 168;

            // The tabs should become sticky when they would go under the header
            // This means when scroll position + header height > tabs original position
            const shouldBeSticky = scrollTop + headerHeight > tabsOriginalTop;

            if (shouldBeSticky !== isSticky) {
              isSticky = shouldBeSticky;

              // Move sticky tabs to body when sticky, restore when not sticky
              if (isSticky && stickyTabsEl && stickyTabsEl.parentNode !== document.body) {
                // Store original position before moving
                originalParent = stickyTabsEl.parentNode;
                nextSibling = stickyTabsEl.nextSibling;
                document.body.appendChild(stickyTabsEl);
              } else if (!isSticky && stickyTabsEl && stickyTabsEl.parentNode === document.body && originalParent) {
                // Restore to original position
                if (nextSibling) {
                  originalParent.insertBefore(stickyTabsEl, nextSibling);
                } else {
                  originalParent.appendChild(stickyTabsEl);
                }
              }
            }
          }

          ticking = false;
        });
        ticking = true;
      }
    };

    // Listen to multiple scroll containers like in ShowContent
    function bindScroll() {
      window.addEventListener('scroll', handleScroll, { passive: true });
      document.addEventListener('scroll', handleScroll, { passive: true });
      document.documentElement.addEventListener('scroll', handleScroll, { passive: true });
      document.body.addEventListener('scroll', handleScroll, { passive: true });
      handleScroll(); // Check initial position
    }

    function unbindScroll() {
      window.removeEventListener('scroll', handleScroll);
      document.removeEventListener('scroll', handleScroll);
      document.documentElement.removeEventListener('scroll', handleScroll);
      document.body.removeEventListener('scroll', handleScroll);
    }

    // Initial bind
    bindScroll();

    // Handle Astro view transitions
    const rebind = () => {
      unbindScroll();
      bindScroll();
    };

    document.addEventListener('astro:after-swap', rebind);
    document.addEventListener('astro:page-load', rebind);

    return () => {
      document.removeEventListener('astro:after-swap', rebind);
      document.removeEventListener('astro:page-load', rebind);
      unbindScroll();
    };
  });

  // Handle touch events for smooth swiping
  function onTouchStart(e: TouchEvent) {
    // Only handle touches that start on non-interactive elements
    const target = e.target as HTMLElement;
    if (target.closest('button, a, input, select, textarea, [role="button"], .character-card')) {
      return;
    }

    touchStart = e.targetTouches[0].clientX;
    touchStartY = e.targetTouches[0].clientY;
    currentX = 0;
    isTransitioning = false;
  }

  function onTouchMove(e: TouchEvent) {
    if (!touchStart || !touchStartY || !contentRef) return;

    const currentTouch = e.targetTouches[0].clientX;
    const currentTouchY = e.targetTouches[0].clientY;
    const diff = currentTouch - touchStart;
    const diffY = currentTouchY - touchStartY;
    const containerWidth = contentRef.offsetWidth;

    // Only handle horizontal swipes (ignore if more vertical than horizontal)
    const verticalDiff = Math.abs(diffY);
    const horizontalDiff = Math.abs(diff);

    // If the gesture is more vertical than horizontal, don't interfere
    if (verticalDiff > horizontalDiff && verticalDiff > 15) {
      return;
    }

    // Only start handling swipe after minimum threshold
    if (horizontalDiff < 5) {
      return;
    }

    // Prevent default scrolling when we're handling the swipe
    e.preventDefault();

    // Convert pixel difference to percentage for smooth movement
    let percentageDiff = (diff / containerWidth) * 100;

    // Limit the swipe distance and add resistance at boundaries
    if ((activeIndex === 0 && diff > 0) || (activeIndex === tabs.length - 1 && diff < 0)) {
      // Add resistance at boundaries (reduce movement)
      percentageDiff = percentageDiff * 0.3;
    }

    currentX = percentageDiff;
  }

  function onTouchEnd() {
    if (!touchStart) return;

    isTransitioning = true;

    // Use percentage-based threshold - 15% of screen width (lower threshold for easier swiping)
    const swipeThreshold = 15;

    const shouldGoNext = currentX < -swipeThreshold && activeIndex < tabs.length - 1;
    const shouldGoPrev = currentX > swipeThreshold && activeIndex > 0;

    if (shouldGoNext) {
      activeTab = tabs[activeIndex + 1];
      // Don't auto-scroll when swiping
      // scrollToTabsContent();
    } else if (shouldGoPrev) {
      activeTab = tabs[activeIndex - 1];
      // Don't auto-scroll when swiping
      // scrollToTabsContent();
    }

    // Reset position
    currentX = 0;
    touchStart = null;
    touchStartY = null;

    // Remove transition class after animation
    setTimeout(() => isTransitioning = false, 300);
  }

  function goToPrevious() {
    if (activeIndex > 0) {
      isTransitioning = true;
      currentX = 0;
      activeTab = tabs[activeIndex - 1];
      // Don't auto-scroll when using navigation buttons
      // scrollToTabsContent();
      setTimeout(() => isTransitioning = false, 300);
    }
  }

  function goToNext() {
    if (activeIndex < tabs.length - 1) {
      isTransitioning = true;
      currentX = 0;
      activeTab = tabs[activeIndex + 1];
      // Don't auto-scroll when using navigation buttons
      // scrollToTabsContent();
      setTimeout(() => isTransitioning = false, 300);
    }
  }

  function selectTab(tab: string) {
    isTransitioning = true;
    currentX = 0;
    activeTab = tab;
    isDropdownOpen = false;

    // Don't auto-scroll when manually selecting tabs - let user maintain their scroll position
    // scrollToTabsContent();

    setTimeout(() => isTransitioning = false, 300);
  }

  function scrollToTabsContent() {
    if (tabsRef) {
      // Get the tabs position and scroll to it smoothly
      const tabsRect = tabsRef.getBoundingClientRect();
      const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
      const tabsTop = tabsRect.top + scrollTop;

      // Scroll to just below the tabs with a small offset for the header
      const headerOffset = 180; // Slightly more than header height to provide breathing room
      const targetScroll = Math.max(0, tabsTop - headerOffset);

      window.scrollTo({
        top: targetScroll,
        behavior: 'smooth'
      });
    }
  }
</script>

<div class="tabs-container">
  <!-- Spacer to prevent content jump when tabs become sticky -->
  {#if isSticky}
    <div class="tabs-spacer"></div>
  {/if}

  <!-- Mobile: Dropdown + Navigation -->
  <div
    bind:this={tabsRef}
    use:assignStickyRef
    class="tabs-mobile {isSticky ? 'tabs-mobile--sticky' : ''}"
    style={isSticky ? 'top: var(--weeb-nav-height, 60px)' : ''}
  >
    <div class="tabs-mobile-nav">
      <!-- Left chevron -->
      <button
        on:click={goToPrevious}
        disabled={activeIndex === 0}
        class="tabs-nav-btn"
        class:tabs-nav-btn--disabled={activeIndex === 0}
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
      </button>

      <!-- Dropdown -->
      <div class="tabs-dropdown-wrap">
        <button
          on:click={() => isDropdownOpen = !isDropdownOpen}
          class="tabs-dropdown-btn"
        >
          <span class="tabs-dropdown-label">{activeTab}</span>
          <svg class="tabs-dropdown-chevron" class:tabs-dropdown-chevron--open={isDropdownOpen} width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"/></svg>
        </button>

        {#if isDropdownOpen}
          <!-- svelte-ignore a11y-click-events-have-key-events -->
          <!-- svelte-ignore a11y-no-static-element-interactions -->
          <div class="tabs-dropdown-backdrop" on:click={() => isDropdownOpen = false}></div>

          <div class="tabs-dropdown-menu">
            {#each tabs as tab}
              <button
                on:click={() => selectTab(tab)}
                class="tabs-dropdown-item"
                class:tabs-dropdown-item--active={activeTab === tab}
              >
                {tab}
              </button>
            {/each}
          </div>
        {/if}
      </div>

      <!-- Right chevron -->
      <button
        on:click={goToNext}
        disabled={activeIndex === tabs.length - 1}
        class="tabs-nav-btn"
        class:tabs-nav-btn--disabled={activeIndex === tabs.length - 1}
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"/></svg>
      </button>
    </div>

    <!-- Page indicators -->
    <div class="tabs-dots">
      {#each tabs as _, index}
        <div
          class="tabs-dot"
          class:tabs-dot--active={index === activeIndex}
        ></div>
      {/each}
    </div>
  </div>

  <!-- Desktop: Traditional tabs -->
  <div class="tabs-desktop">
    <nav class="tabs-desktop-nav">
      {#each tabs as tab}
        <button
          class="tabs-desktop-btn"
          class:tabs-desktop-btn--active={activeTab === tab}
          on:click={() => selectTab(tab)}
        >
          {tab}
        </button>
      {/each}
    </nav>
  </div>

  <!-- Content with swipe detection -->
  <div class="tabs-content">
    <!-- Mobile: Swipeable content -->
    <div class="tabs-swipe-container">
      <div
        bind:this={contentRef}
        class="tabs-swipe-track {isTransitioning ? 'tabs-swipe-track--transitioning' : ''}"
        style="transform: translateX({-activeIndex * (100 / tabs.length) + currentX}%); width: {tabs.length * 100}%"
        on:touchstart={onTouchStart}
        on:touchmove={onTouchMove}
        on:touchend={onTouchEnd}
      >
        {#each tabs as tab, index}
          <div class="tabs-swipe-panel" style="width: {100 / tabs.length}%">
            <div class="tabs-swipe-panel-inner">
              {#if activeTab === tab}
                {#if tab === 'Episodes'}
                  <slot name="Episodes" />
                {:else if tab === 'Characters'}
                  <slot name="Characters" />
                {:else if tab === 'Trailers'}
                  <slot name="Trailers" />
                {:else if tab === 'Artworks'}
                  <slot name="Artworks" />
                {/if}
              {/if}
            </div>
          </div>
        {/each}
      </div>
    </div>

    <!-- Desktop: Traditional single content -->
    <div class="tabs-desktop-content">
      {#if activeTab === 'Episodes'}
        <slot name="Episodes" />
      {:else if activeTab === 'Characters'}
        <slot name="Characters" />
      {:else if activeTab === 'Trailers'}
        <slot name="Trailers" />
      {:else if activeTab === 'Artworks'}
        <slot name="Artworks" />
      {/if}
    </div>
  </div>
</div>

<style>
  .tabs-container {
    display: flex;
    flex-direction: column;
  }

  .tabs-spacer {
    height: 64px;
  }

  /* ===== Mobile tabs ===== */
  .tabs-mobile {
    transition: all 0.2s;
  }

  .tabs-mobile--sticky {
    position: fixed;
    left: 0;
    right: 0;
    z-index: 10;
    background: var(--weeb-surface);
    border-bottom: 1px solid var(--weeb-border);
    padding: 12px 16px 8px;
    box-shadow: 0 4px 12px oklch(0% 0 0 / 0.3);
  }

  .tabs-mobile-nav {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 12px;
  }

  .tabs-nav-btn {
    width: 36px;
    height: 36px;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: var(--weeb-radius, 8px);
    border: 1px solid var(--weeb-border);
    background: transparent;
    color: var(--weeb-fg-secondary);
    transition: all 0.15s;
    flex-shrink: 0;
  }

  .tabs-nav-btn:hover:not(.tabs-nav-btn--disabled) {
    background: var(--weeb-surface-hover);
    color: var(--weeb-fg);
    border-color: var(--weeb-accent);
  }

  .tabs-nav-btn--disabled {
    opacity: 0.3;
    cursor: not-allowed;
  }

  /* Dropdown */
  .tabs-dropdown-wrap {
    position: relative;
    flex: 1;
    max-width: 260px;
  }

  .tabs-dropdown-btn {
    width: 100%;
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 9px 14px;
    background: var(--weeb-bg-elevated);
    border: 1px solid var(--weeb-border);
    border-radius: var(--weeb-radius, 8px);
    color: var(--weeb-fg);
    font-size: 14px;
    font-weight: 600;
    text-align: left;
    transition: border-color 0.15s;
  }

  .tabs-dropdown-btn:hover {
    border-color: var(--weeb-accent);
  }

  .tabs-dropdown-label {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .tabs-dropdown-chevron {
    flex-shrink: 0;
    transition: transform 0.2s;
    color: var(--weeb-fg-muted);
  }

  .tabs-dropdown-chevron--open {
    transform: rotate(180deg);
  }

  .tabs-dropdown-backdrop {
    position: fixed;
    inset: 0;
    z-index: 10;
  }

  .tabs-dropdown-menu {
    position: absolute;
    top: calc(100% + 4px);
    left: 0;
    right: 0;
    background: var(--weeb-surface);
    border: 1px solid var(--weeb-border);
    border-radius: var(--weeb-radius, 8px);
    box-shadow: 0 8px 24px oklch(0% 0 0 / 0.4);
    z-index: 20;
    overflow: hidden;
  }

  .tabs-dropdown-item {
    display: block;
    width: 100%;
    text-align: left;
    padding: 10px 16px;
    font-size: 13px;
    font-weight: 500;
    color: var(--weeb-fg-secondary);
    background: none;
    border: none;
    transition: background 0.1s, color 0.1s;
  }

  .tabs-dropdown-item:hover {
    background: var(--weeb-surface-hover);
    color: var(--weeb-fg);
  }

  .tabs-dropdown-item--active {
    background: oklch(25% 0.04 280 / 0.5);
    color: var(--weeb-accent);
    font-weight: 600;
  }

  /* Dots */
  .tabs-dots {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 6px;
    margin-top: 8px;
  }

  .tabs-dot {
    width: 6px;
    height: 6px;
    border-radius: 50%;
    background: var(--weeb-border);
    transition: background 0.2s, transform 0.2s;
  }

  .tabs-dot--active {
    background: var(--weeb-accent);
    transform: scale(1.3);
  }

  /* ===== Desktop tabs ===== */
  .tabs-desktop {
    display: none;
  }

  .tabs-desktop-nav {
    display: flex;
    gap: 0;
    border-bottom: 1px solid var(--weeb-border);
  }

  .tabs-desktop-btn {
    padding: 12px 20px;
    font-size: 14px;
    font-weight: 500;
    color: var(--weeb-fg-muted);
    border: none;
    border-bottom: 2px solid transparent;
    background: none;
    transition: color 0.15s, border-color 0.15s;
    cursor: pointer;
  }

  .tabs-desktop-btn:hover {
    color: var(--weeb-fg-secondary);
    border-bottom-color: var(--weeb-border);
  }

  .tabs-desktop-btn--active {
    color: var(--weeb-accent);
    border-bottom-color: var(--weeb-accent);
    font-weight: 600;
  }

  /* ===== Content ===== */
  .tabs-content {
    padding: 24px 0;
  }

  .tabs-swipe-container {
    overflow: hidden;
  }

  .tabs-swipe-track {
    display: flex;
  }

  .tabs-swipe-track--transitioning {
    transition: transform 0.3s ease-out;
  }

  .tabs-swipe-panel {
    width: 100%;
    flex-shrink: 0;
    padding: 0 16px;
  }

  .tabs-swipe-panel-inner {
    width: 100%;
  }

  .tabs-desktop-content {
    display: none;
  }

  /* ===== Responsive ===== */
  @media (min-width: 640px) {
    .tabs-mobile {
      display: none;
    }

    .tabs-spacer {
      display: none;
    }

    .tabs-desktop {
      display: block;
    }

    .tabs-swipe-container {
      display: none;
    }

    .tabs-desktop-content {
      display: block;
    }

    .tabs-content {
      padding: 32px 0;
    }
  }
</style>
