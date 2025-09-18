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

  $: activeIndex = tabs.indexOf(activeTab);

  // Handle sticky behavior on scroll
  onMount(() => {
    let tabsOriginalTop: number | null = null;
    let ticking = false;

    const handleScroll = () => {
      if (!ticking) {
        requestAnimationFrame(() => {
          if (!tabsRef) {
            ticking = false;
            return;
          }

          const scrollTop = window.pageYOffset || document.documentElement.scrollTop;

          // Store original position on first calculation (only when not sticky)
          if (tabsOriginalTop === null && !isSticky) {
            const tabsRect = tabsRef.getBoundingClientRect();
            tabsOriginalTop = tabsRect.top + scrollTop;
          }

          // Make sticky when scrolled past the tabs position
          if (tabsOriginalTop !== null) {
            // Header height is 10.5rem = 168px, but let's be more precise
            const headerHeight = 168;

            // The tabs should become sticky when they would go under the header
            // This means when scroll position + header height > tabs original position
            const shouldBeSticky = scrollTop + headerHeight > tabsOriginalTop;
            isSticky = shouldBeSticky;
          }

          ticking = false;
        });
        ticking = true;
      }
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    handleScroll(); // Check initial position

    return () => window.removeEventListener('scroll', handleScroll);
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
      scrollToTabsContent();
    } else if (shouldGoPrev) {
      activeTab = tabs[activeIndex - 1];
      scrollToTabsContent();
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
      scrollToTabsContent();
      setTimeout(() => isTransitioning = false, 300);
    }
  }

  function goToNext() {
    if (activeIndex < tabs.length - 1) {
      isTransitioning = true;
      currentX = 0;
      activeTab = tabs[activeIndex + 1];
      scrollToTabsContent();
      setTimeout(() => isTransitioning = false, 300);
    }
  }

  function selectTab(tab: string) {
    isTransitioning = true;
    currentX = 0;
    activeTab = tab;
    isDropdownOpen = false;

    // Scroll to top of tabs content when switching tabs
    scrollToTabsContent();

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

<div class="flex flex-col">
  <!-- Spacer to prevent content jump when tabs become sticky -->
  {#if isSticky}
    <div class="sm:hidden h-16"></div>
  {/if}

  <!-- Mobile: Dropdown + Navigation -->
  <div
    bind:this={tabsRef}
    class="sm:hidden transition-all duration-200 {isSticky
      ? 'fixed left-0 right-0 z-30 bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700 px-4 py-2 shadow-sm'
      : ''}"
    style={isSticky ? 'top: 10.5rem' : ''}
  >
    <!-- Compact navigation with chevrons flanking dropdown -->
    <div class="flex items-center justify-center space-x-3">
      <!-- Left chevron -->
      <button
        on:click={goToPrevious}
        disabled={activeIndex === 0}
        class="p-1.5 rounded-full transition-colors duration-200 {activeIndex === 0
          ? 'text-gray-300 dark:text-gray-600 cursor-not-allowed'
          : 'text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700'}"
      >
        <i class="fas fa-chevron-left w-3 h-3"></i>
      </button>

      <!-- Dropdown for quick navigation -->
      <div class="relative flex-1 max-w-xs">
        <button
          on:click={() => isDropdownOpen = !isDropdownOpen}
          class="w-full flex items-center justify-between px-3 py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg shadow-sm text-gray-900 dark:text-gray-100 font-medium text-left hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors duration-200 text-sm"
        >
          <span class="truncate">{activeTab}</span>
          <i class="fas fa-chevron-down w-3 h-3 ml-2 flex-shrink-0 transition-transform duration-200 {isDropdownOpen ? 'rotate-180' : ''}"></i>
        </button>

        {#if isDropdownOpen}
          <!-- Backdrop -->
          <!-- svelte-ignore a11y-click-events-have-key-events -->
          <!-- svelte-ignore a11y-no-static-element-interactions -->
          <div
            class="fixed inset-0 z-10"
            on:click={() => isDropdownOpen = false}
          ></div>

          <!-- Dropdown menu -->
          <div class="absolute top-full left-0 right-0 mt-1 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg shadow-lg z-20 py-1">
            {#each tabs as tab}
              <button
                on:click={() => selectTab(tab)}
                class="w-full text-left px-3 py-2 text-sm transition-colors duration-200 {activeTab === tab
                  ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 font-medium'
                  : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'}"
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
        class="p-1.5 rounded-full transition-colors duration-200 {activeIndex === tabs.length - 1
          ? 'text-gray-300 dark:text-gray-600 cursor-not-allowed'
          : 'text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700'}"
      >
        <i class="fas fa-chevron-right w-3 h-3"></i>
      </button>
    </div>

    <!-- Page indicators -->
    <div class="flex items-center justify-center space-x-1.5 mt-2">
      {#each tabs as _, index}
        <div
          class="w-1.5 h-1.5 rounded-full transition-colors duration-200 {index === activeIndex
            ? 'bg-blue-500'
            : 'bg-gray-300 dark:bg-gray-600'}"
        ></div>
      {/each}
    </div>
  </div>

  <!-- Desktop: Traditional tabs -->
  <div class="hidden sm:block">
    <div class="border-b border-gray-200 dark:border-gray-700">
      <nav class="flex space-x-8">
        {#each tabs as tab}
          <button
            class="py-2 px-1 border-b-2 font-medium text-sm transition-colors duration-200 {activeTab === tab
              ? 'border-blue-500 text-blue-600 dark:text-blue-400'
              : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 hover:border-gray-300 dark:hover:border-gray-600'}"
            on:click={() => selectTab(tab)}
          >
            {tab}
          </button>
        {/each}
      </nav>
    </div>
  </div>

  <!-- Content with swipe detection -->
  <div class="py-6 sm:py-8">
    <!-- Mobile: Swipeable content -->
    <div class="sm:hidden overflow-hidden">
      <div
        bind:this={contentRef}
        class="flex {isTransitioning ? 'transition-transform duration-300 ease-out' : ''}"
        style="transform: translateX({-activeIndex * (100 / tabs.length) + currentX}%); width: {tabs.length * 100}%"
        on:touchstart={onTouchStart}
        on:touchmove={onTouchMove}
        on:touchend={onTouchEnd}
      >
        {#each tabs as tab, index}
          <div class="w-full flex-shrink-0 px-4" style="width: {100 / tabs.length}%">
            <div class="w-full">
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
    <div class="hidden sm:block">
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