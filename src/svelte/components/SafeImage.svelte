<script lang="ts">
  import { getSafeImageUrl } from '../utils/image';
  import { createEventDispatcher, onDestroy, onMount } from 'svelte';
  import debug from '../../utils/debug';

  // Original props
  export let src: string = '';
  export let alt: string = '';
  export let fallbackSrc: string = '/assets/not found.jpg';
  export let path: string = '';
  export let priority: boolean = false;
  export let className: string = '';
  export let style: string = '';
  export let width: string | number | undefined = undefined;
  export let height: string | number | undefined = undefined;
  export let loading: 'lazy' | 'eager' | undefined = undefined;

  // New ordered loading props (like RacyImage)
  /** Ordered list of candidate URLs (first has highest priority) */
  export let sources: string[] = [];

  /** Optional: reject by URL pattern (e.g., 404 placeholders) */
  export let rejectPatterns: (string | RegExp)[] = [
    /(?:^|\/)(?:404|not[-_]?found|error)\.(?:png|jpe?g|webp|gif|svg)$/i,
    /(?:^|\/)(?:placeholder|default)\.(?:png|jpe?g|webp|gif|svg)$/i
  ];

  /** Custom acceptance check (URL + decoded dimensions) */
  export let accept: (img: HTMLImageElement, url: string) => boolean = (img, url) => {
    for (const pat of rejectPatterns) {
      const re = typeof pat === 'string' ? new RegExp(pat) : pat;
      if (re.test(url)) return false;
    }
    // Reject tiny "error sprite" assets
    if (img.naturalWidth <= 2 && img.naturalHeight <= 2) return false;
    return true;
  };

  /** Per-attempt timeout (ms). 0/undefined = no timeout per image */
  export let perTryTimeoutMs: number = 3000;

  const dispatch = createEventDispatcher();

  $: actualLoading = loading || (priority ? 'eager' : 'lazy');

  let isLoaded = false;
  let isError = false;
  let chosenSrc: string | null = null;
  let useFallback = false;
  let destroyed = false;
  let runId = 0;
  let domImageLoaded = false; // Track when the DOM <img> has loaded
  let mounted = false; // Track if component is mounted
  let isLoadingInProgress = false; // Prevent concurrent loads
  const imgs: HTMLImageElement[] = [];

  function loadOne(url: string): Promise<{ url: string; img: HTMLImageElement }> {
    return new Promise((resolve, reject) => {
      const img = new Image();
      imgs.push(img);
      img.decoding = 'async';
      img.onload = async () => {
        try {
          if (img.decode) { try { await img.decode(); } catch { /* ignore */ } }
          if (accept(img, url)) {
            resolve({ url, img });
          } else {
            reject(new Error(`Rejected by accept(): ${url}`));
          }
        } catch (e) {
          reject(e);
        }
      };
      img.onerror = () => reject(new Error(`Failed load: ${url}`));
      img.src = url;
    });
  }

  function withTimeout<T>(p: Promise<T>, ms?: number) {
    if (!ms || ms <= 0) return p;
    return new Promise<T>((resolve, reject) => {
      const t = setTimeout(() => reject(new Error('timeout')), ms);
      p.then(v => { clearTimeout(t); resolve(v); }, e => { clearTimeout(t); reject(e); });
    });
  }

  async function tryInOrder() {
    // Prevent concurrent loads
    if (isLoadingInProgress) {
      debug.warn('Load already in progress, skipping duplicate call');
      return;
    }

    isLoadingInProgress = true;
    const id = ++runId;

    // Build ordered list: use sources if provided, otherwise use src
    let orderedSources: string[] = [];

    if (sources.length > 0) {
      // Use provided sources array - don't process if already full URLs
      orderedSources = sources.map(s => {
        // If it's already a full URL (http/https), use as-is
        if (s.startsWith('http://') || s.startsWith('https://')) {
          return s;
        }
        // Otherwise, process through getSafeImageUrl
        return getSafeImageUrl(s, path);
      });
    } else if (src) {
      // Fallback to single src
      orderedSources = [getSafeImageUrl(src, path)];
    } else {
      // No sources or src provided
      debug.warn('No image sources or src provided');
      orderedSources = [getSafeImageUrl(src, path)];
    }

    debug.log(`Racing ${orderedSources.length} image sources in parallel with priority order`);

    // Only reset states if we're loading a different image
    const newFirstSource = orderedSources[0];
    if (newFirstSource === chosenSrc && domImageLoaded) {
      // Same image already loaded, no need to reload
      debug.log('Same image source already loaded, skipping reload');
      debug.log(`  Dispatching 'chosen' event for already-loaded image: ${chosenSrc}`);
      // Dispatch event so parent knows image is ready (important if parent reset bgLoaded)
      dispatch('chosen', { src: chosenSrc, reason: 'already-loaded' });
      isLoadingInProgress = false;
      return;
    }

    // Don't reset states yet - keep current image visible while loading new one
    const previousSrc = chosenSrc;
    const wasLoaded = domImageLoaded;

    // Start loading all sources in parallel
    const loadPromises = orderedSources.map((url, index) =>
      withTimeout(loadOne(url), perTryTimeoutMs)
        .then(result => ({ ...result, index, success: true }))
        .catch(err => ({ url, index, success: false, error: err }))
    );

    // Wait for all to complete
    const results = await Promise.all(loadPromises);
    if (destroyed || id !== runId) {
      isLoadingInProgress = false;
      return;
    }

    // Find the best result respecting priority order
    const successfulResults = results.filter(r => r.success);

    if (successfulResults.length > 0) {
      // Sort by index (priority) and pick the first successful one
      successfulResults.sort((a, b) => a.index - b.index);
      const best = successfulResults[0];

      debug.success(`Image loaded successfully: ${best.url} (priority ${best.index + 1})`);

      // Only reset states if we actually have a different image
      if (best.url !== previousSrc) {
        debug.log(`Setting new chosenSrc: ${best.url} (was: ${previousSrc})`);
        chosenSrc = best.url;
        isLoaded = true;
        domImageLoaded = false; // Reset so new image can load in DOM
      } else if (!domImageLoaded) {
        // Same image but DOM hasn't loaded it yet - this might be a retry
        debug.log('Same image but DOM not loaded, resetting domImageLoaded');
        domImageLoaded = false;
        dispatch('chosen', { src: chosenSrc, reason: 'retry-same' });
      } else {
        // Same image, already loaded in DOM - still dispatch event for parent
        debug.log('Same image already loaded in DOM, keeping current state');
        debug.log('Dispatching chosen event so parent knows image is ready');
        dispatch('chosen', { src: chosenSrc, reason: 'same-already-loaded' });
        isLoadingInProgress = false;
        return;
      }

      // Mark as fallback if we had to use the last source AND there were multiple sources
      const hasMultipleSources = orderedSources.length > 1;
      const isLastSource = best.index === orderedSources.length - 1;

      if (isLastSource && hasMultipleSources) {
        useFallback = true;
        isError = true;
        dispatch('chosen', { src: chosenSrc, reason: 'last-source' });
      } else {
        useFallback = false;
        isError = false;
        dispatch('chosen', { src: chosenSrc, reason: 'load' });
      }
      isLoadingInProgress = false;
      return;
    }

    // none worked → fallback
    if (!destroyed && id === runId) {
      debug.error('All image sources failed, using fallback');
      if (fallbackSrc !== previousSrc) {
        chosenSrc = fallbackSrc ?? null;
        domImageLoaded = false; // Need to load fallback image
      }
      useFallback = false; // Don't blur the fallback image
      isError = true;
      isLoaded = true;
      dispatch('chosen', { src: chosenSrc, reason: 'all-failed' });
    }
    isLoadingInProgress = false;
  }

  // Track previous values to detect actual changes (initialize in onMount to avoid pre-mount comparisons)
  let prevSrc = '';
  let prevSources: string[] = [];
  let prevPath = '';

  onMount(() => {
    mounted = true;

    // Reset all state on mount to handle View Transitions properly
    // When navigating back to a page, the component may have stale state
    domImageLoaded = false;
    isLoadingInProgress = false;
    isLoaded = false;
    isError = false;
    destroyed = false;
    chosenSrc = null; // Force fresh image selection
    useFallback = false;
    runId = 0; // Reset run ID

    // Clean up any previous image elements
    for (const img of imgs) {
      img.onload = null;
      img.onerror = null;
    }
    imgs.length = 0;

    // Initialize tracking with current values
    prevSrc = src;
    prevSources = sources;
    prevPath = path;

    // Small delay to ensure DOM is ready after View Transitions
    requestAnimationFrame(() => {
      if (!destroyed) {
        tryInOrder();
      }
    });

    // Re-trigger image loading after View Transitions (for persisted components)
    const handlePageLoad = () => {
      debug.log('View Transition complete, resetting image state and reloading');
      // Reset state because DOM has been swapped by View Transitions
      // The <img> element is new, so we need to reload even if chosenSrc is the same
      domImageLoaded = false;
      isLoadingInProgress = false;
      chosenSrc = null; // Force fresh image selection
      requestAnimationFrame(() => {
        if (!destroyed) {
          tryInOrder();
        }
      });
    };

    // Handle browser back/forward cache (bfcache) restoration
    const handlePageShow = (event: PageTransitionEvent) => {
      if (event.persisted) {
        debug.log('Page restored from bfcache, reloading images');
        forceReloadImages();
      }
    };

    // Handle mobile swipe-back navigation (custom event from swipe-navigation.ts)
    const handleSwipeNavigationRestored = () => {
      debug.log('Swipe navigation restored, reloading images');
      forceReloadImages();
    };

    // Handle visibility change (mobile browsers may need to reload images when tab becomes visible)
    const handleVisibilityChange = () => {
      if (!document.hidden && !domImageLoaded && chosenSrc) {
        debug.log('Page became visible with incomplete image load, retrying');
        forceReloadImages();
      }
    };

    // Helper to force reload images
    function forceReloadImages() {
      domImageLoaded = false;
      isLoadingInProgress = false;
      chosenSrc = null;
      requestAnimationFrame(() => {
        if (!destroyed) {
          tryInOrder();
        }
      });
    }

    document.addEventListener('astro:page-load', handlePageLoad);
    window.addEventListener('pageshow', handlePageShow);
    window.addEventListener('swipe-navigation-restored', handleSwipeNavigationRestored);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      document.removeEventListener('astro:page-load', handlePageLoad);
      window.removeEventListener('pageshow', handlePageShow);
      window.removeEventListener('swipe-navigation-restored', handleSwipeNavigationRestored);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  });

  onDestroy(() => {
    destroyed = true;
    for (const img of imgs) {
      img.onload = null;
      img.onerror = null;
    }
  });

  // Re-enable reactive statements with better guards
  // Only trigger if mounted AND the values have actually changed from what we tracked
  $: {
    if (!mounted) break $;

    const sourcesStr = JSON.stringify(sources);
    const prevSourcesStr = JSON.stringify(prevSources);

    if (src !== prevSrc || sourcesStr !== prevSourcesStr || path !== prevPath) {
      debug.log(`=== Props changed after mount ===`);
      if (src !== prevSrc) debug.log(`  src: ${prevSrc} -> ${src}`);
      if (sourcesStr !== prevSourcesStr) debug.log(`  sources changed`);
      if (path !== prevPath) debug.log(`  path: ${prevPath} -> ${path}`);

      prevSrc = src;
      prevSources = [...sources];
      prevPath = path;
      tryInOrder();
    }
  }

  // Fallback error handler for simple mode
  function handleSimpleError() {
    debug.error(`Image failed to load: ${chosenSrc}`);
    chosenSrc = fallbackSrc;
    domImageLoaded = false; // Reset to load fallback
    useFallback = false; // Don't blur the fallback image
    isError = true;
    isLoaded = true;
    dispatch('error', { src: chosenSrc });
  }

  function handleSimpleLoad() {
    debug.log(`DOM image loaded: ${chosenSrc}`);
    isLoaded = true;
    domImageLoaded = true; // Image fully loaded in DOM
    dispatch('load', { src: chosenSrc });
  }
</script>

<div class="relative {className}" {style}>
  {#if !domImageLoaded}
    <!-- Show skeleton while image is loading or selecting source -->
    <div
      class="absolute inset-0 bg-gray-200 dark:bg-gray-700 skeleton rounded"
      role="status"
      aria-label="Loading image"
    >
      <span class="sr-only">Loading...</span>
    </div>
  {/if}

  {#if chosenSrc}
    <img
      src={chosenSrc}
      {alt}
      class="w-full h-full object-cover {useFallback ? 'blur-md scale-110' : ''} {!domImageLoaded ? 'opacity-0' : ''}"
      {width}
      {height}
      loading={actualLoading}
      fetchpriority={priority ? 'high' : 'auto'}
      data-original-src={getSafeImageUrl(src, path)}
      data-sources={sources.length > 0 ? JSON.stringify(sources) : undefined}
      on:error={handleSimpleError}
      on:load={handleSimpleLoad}
      on:click
    />
  {/if}
</div>
