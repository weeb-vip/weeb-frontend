<script lang="ts">
  import { getSafeImageUrl, resizeCdnUrl } from '../utils/image';
  import { untrack } from 'svelte';
  import debug from '../../utils/debug';

  /** What `onChosen` reports: the URL that won, and why it was the one. */
  export type ChosenDetail = {
    src: string | null;
    reason: 'load' | 'last-source' | 'already-loaded' | 'retry-same' | 'same-already-loaded' | 'placeholder' | 'all-failed';
  };

  let {
    src = '',
    alt = '',
    fallbackSrc = '/assets/not found.jpg',
    /**
     * When set, a total load failure renders a titled panel instead of loading
     * fallbackSrc. `/assets/not found.jpg` is a bright white illustration: on this
     * near-black ground it became the highest-contrast object in the viewport, so
     * on a page whose thesis is "cover art carries the product" the missing art
     * out-shouted the real art. It is also indistinguishable from a poster, so a
     * reader cannot tell "no artwork" from "the artwork looks like that".
     */
    placeholderTitle = null,
    path = '',
    priority = false,
    className = '',
    style = '',
    width = undefined,
    height = undefined,
    loading = undefined,
    /** Intended device-pixel width. When set, CDN sources are routed through
     * Cloudflare Image Resizing (production only). Undefined = full-res (unchanged). */
    cdnWidth = undefined,
    /** Ordered list of candidate URLs (first has highest priority) */
    sources = [],
    /** Optional: reject by URL pattern (e.g., 404 placeholders) */
    rejectPatterns = [
      /(?:^|\/)(?:404|not[-_]?found|error)\.(?:png|jpe?g|webp|gif|svg)$/i,
      /(?:^|\/)(?:placeholder|default)\.(?:png|jpe?g|webp|gif|svg)$/i
    ],
    /** Custom acceptance check (URL + decoded dimensions) */
    accept = (img: HTMLImageElement, url: string) => {
      for (const pat of rejectPatterns) {
        const re = typeof pat === 'string' ? new RegExp(pat) : pat;
        if (re.test(url)) return false;
      }
      // Reject tiny "error sprite" assets
      if (img.naturalWidth <= 2 && img.naturalHeight <= 2) return false;
      return true;
    },
    /** Per-attempt timeout (ms). 0/undefined = no timeout per image */
    perTryTimeoutMs = 3000,
    /** Called once a candidate has been settled on -- including the failure
     * cases, where `src` is the fallback or null. */
    onChosen,
  }: {
    src?: string;
    alt?: string;
    fallbackSrc?: string;
    placeholderTitle?: string | null;
    path?: string;
    priority?: boolean;
    className?: string;
    style?: string;
    width?: string | number;
    height?: string | number;
    loading?: 'lazy' | 'eager';
    cdnWidth?: number;
    sources?: string[];
    rejectPatterns?: (string | RegExp)[];
    accept?: (img: HTMLImageElement, url: string) => boolean;
    perTryTimeoutMs?: number;
    onChosen?: (detail: ChosenDetail) => void;
  } = $props();

  const actualLoading = $derived(loading || (priority ? 'eager' : 'lazy'));

  let isLoaded = $state(false);
  let isError = $state(false);
  let showPlaceholder = $state(false);
  let chosenSrc = $state<string | null>(null);
  let domImageLoaded = $state(false); // Track when the DOM <img> has loaded
  // Bookkeeping the template never reads, so plain locals: making these state
  // would only add reactivity nothing subscribes to.
  let destroyed = false;
  let runId = 0;
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
        // Already a complete URL -- http(s), or an inline data:/blob: source --
        // so there is no CDN key to build. Anything else is a record id.
        if (/^(?:https?:|data:|blob:)/i.test(s)) {
          return s;
        }
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

    // Route CDN sources through Cloudflare Image Resizing when a target width is
    // given (no-op unless enabled in config, i.e. production), and keep the
    // untransformed URL behind each one.
    //
    // The transform is a separate thing that can fail while the image behind it
    // is perfectly fine, and when it does every poster on the site becomes the
    // not-found placeholder:
    //
    //     GET /cdn-cgi/image/width=360,.../weeb/<id>
    //     HTTP/2 429   cf-resized: err=9422
    //     ERROR 9422: Free unique transformations by account has been exhausted
    //
    // That is a monthly cap on unique transformations, so it recurs on a
    // schedule rather than being a one-off. Falling through to the original
    // degrades the page to full-size images -- more bytes than intended, but the
    // artwork is there -- instead of losing all of it.
    //
    // Only where the two differ: resizeCdnUrl returns its input unchanged when
    // resizing is off or the URL is not a CDN one, and a duplicate entry would
    // just be a second identical request.
    if (cdnWidth) {
      orderedSources = orderedSources.flatMap(u => {
        const resized = resizeCdnUrl(u, cdnWidth);
        return resized === u ? [u] : [resized, u];
      });
    }

    debug.log(`Trying ${orderedSources.length} image sources in priority order`);

    // Only reset states if we're loading a different image
    const newFirstSource = orderedSources[0];
    if (newFirstSource === chosenSrc && domImageLoaded) {
      // Same image already loaded, no need to reload
      debug.log('Same image source already loaded, skipping reload');
      debug.log(`  Reporting the already-loaded image: ${chosenSrc}`);
      // Report it so the parent knows the image is ready (important if it reset bgLoaded)
      onChosen?.({ src: chosenSrc, reason: 'already-loaded' });
      isLoadingInProgress = false;
      return;
    }

    // Don't reset states yet - keep current image visible while loading new one
    const previousSrc = chosenSrc;
    const wasLoaded = domImageLoaded;

    // Try candidates in priority order and stop at the first that loads.
    //
    // This used to start every candidate at once and discard the losers. That
    // costs one wasted request per fallback on every image the app renders, and
    // the cost scales with the chain: a poster shelf of 54 cards with a two-step
    // fallback fetches 108 images to show 54. The race only ever bought latency
    // in the case where the preferred source fails, which is the rare one --
    // and perTryTimeoutMs already bounds how long that case can take.
    let best: { url: string; index: number } | null = null;
    for (let index = 0; index < orderedSources.length; index++) {
      try {
        await withTimeout(loadOne(orderedSources[index]), perTryTimeoutMs);
        best = { url: orderedSources[index], index };
        break;
      } catch {
        // try the next candidate
      }
      if (destroyed || id !== runId) {
        isLoadingInProgress = false;
        return;
      }
    }

    if (destroyed || id !== runId) {
      isLoadingInProgress = false;
      return;
    }

    if (best) {

      debug.success(`Image loaded successfully: ${best.url} (priority ${best.index + 1})`);
      showPlaceholder = false;

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
        onChosen?.({ src: chosenSrc, reason: 'retry-same' });
      } else {
        // Same image, already loaded in DOM - still notify the parent
        debug.log('Same image already loaded in DOM, keeping current state');
        debug.log('Reporting the chosen image so the parent knows it is ready');
        onChosen?.({ src: chosenSrc, reason: 'same-already-loaded' });
        isLoadingInProgress = false;
        return;
      }

      // Landing on a later candidate is not degradation, so nothing here is
      // marked as an error state. This used to blur whenever the LAST of several
      // sources won -- reasonable when the chain was [real image,
      // not-found.jpg], and wrong the moment callers pass genuine alternatives.
      // A poster shelf asking for [tvdb poster, scraper image] hits the second
      // for every show TheTVDB does not carry, and blurred every one of them.
      isError = false;
      const isLastSource = best.index === orderedSources.length - 1;
      onChosen?.({
        src: chosenSrc,
        reason: isLastSource && orderedSources.length > 1 ? 'last-source' : 'load'
      });
      isLoadingInProgress = false;
      return;
    }

    // none worked → fallback
    if (!destroyed && id === runId) {
      debug.error('All image sources failed, using fallback');
      if (placeholderTitle) {
        // Nothing further to fetch: the panel is the final state, so the skeleton
        // stops here rather than waiting on an image that will never arrive.
        chosenSrc = null;
        showPlaceholder = true;
        domImageLoaded = true;
        isError = true;
        isLoaded = true;
        onChosen?.({ src: null, reason: 'placeholder' });
      } else {
        if (fallbackSrc !== previousSrc) {
          chosenSrc = fallbackSrc ?? null;
          domImageLoaded = false; // Need to load fallback image
        }
        isError = true;
        isLoaded = true;
        onChosen?.({ src: chosenSrc, reason: 'all-failed' });
      }
    }
    isLoadingInProgress = false;
  }

  // Track previous values to detect actual changes (initialised on mount to avoid pre-mount comparisons)
  let prevSrc = '';
  let prevSources: string[] = [];
  let prevPath = '';

  // Runs once: every read below is untracked, so nothing here re-subscribes.
  $effect(() => {
    mounted = true;

    // Reset all state on mount to handle View Transitions properly
    // When navigating back to a page, the component may have stale state
    domImageLoaded = false;
    isLoadingInProgress = false;
    isLoaded = false;
    isError = false;
    showPlaceholder = false;
    destroyed = false;
    chosenSrc = null; // Force fresh image selection
    runId = 0; // Reset run ID

    // Clean up any previous image elements
    for (const img of imgs) {
      img.onload = null;
      img.onerror = null;
    }
    imgs.length = 0;

    // Initialize tracking with current values
    prevSrc = untrack(() => src);
    prevSources = untrack(() => sources);
    prevPath = untrack(() => path);

    // Small delay to ensure DOM is ready after View Transitions
    requestAnimationFrame(() => {
      if (!destroyed) {
        tryInOrder();
      }
    });

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
      showPlaceholder = false;
      chosenSrc = null;
      requestAnimationFrame(() => {
        if (!destroyed) {
          tryInOrder();
        }
      });
    }

    window.addEventListener('pageshow', handlePageShow);
    window.addEventListener('swipe-navigation-restored', handleSwipeNavigationRestored);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      destroyed = true;
      window.removeEventListener('pageshow', handlePageShow);
      window.removeEventListener('swipe-navigation-restored', handleSwipeNavigationRestored);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      for (const img of imgs) {
        img.onload = null;
        img.onerror = null;
      }
    };
  });

  // Reload only when the props that actually name an image change. This effect
  // is declared after the mount one, so on the first flush `mounted` is already
  // true and the prev* values already match -- it is a no-op until a real change.
  $effect(() => {
    const nextSrc = src;
    const nextPath = path;
    const sourcesStr = JSON.stringify(sources);

    if (!mounted) return;

    const prevSourcesStr = JSON.stringify(prevSources);
    if (nextSrc === prevSrc && sourcesStr === prevSourcesStr && nextPath === prevPath) return;

    debug.log(`=== Props changed after mount ===`);
    if (nextSrc !== prevSrc) debug.log(`  src: ${prevSrc} -> ${nextSrc}`);
    if (sourcesStr !== prevSourcesStr) debug.log(`  sources changed`);
    if (nextPath !== prevPath) debug.log(`  path: ${prevPath} -> ${nextPath}`);

    prevSrc = nextSrc;
    prevSources = [...sources];
    prevPath = nextPath;
    untrack(() => tryInOrder());
  });

  // Fallback error handler for simple mode
  function handleSimpleError() {
    debug.error(`Image failed to load: ${chosenSrc}`);
    if (placeholderTitle) {
      chosenSrc = null;
      showPlaceholder = true;
      domImageLoaded = true;
      isError = true;
      isLoaded = true;
      return;
    }
    chosenSrc = fallbackSrc;
    domImageLoaded = false; // Reset to load fallback
    isError = true;
    isLoaded = true;
  }

  function handleSimpleLoad() {
    debug.log(`DOM image loaded: ${chosenSrc}`);
    isLoaded = true;
    domImageLoaded = true; // Image fully loaded in DOM
  }
</script>

<div class="relative {className}" {style}>
  {#if !domImageLoaded && !showPlaceholder}
    <!-- Show skeleton while image is loading or selecting source -->
    <!-- Decorative: a shelf of 60 cards produced 60 polite live regions and
         prefixed every card's accessible name with "Loading...". The card's own
         title already names it. -->
    <div class="absolute inset-0 bg-weeb-surface skeleton rounded" aria-hidden="true"></div>
  {/if}

  {#if showPlaceholder}
    <!-- Recedes instead of leading: the same ground a card sits on, with the
         title doing the identifying work the artwork cannot. -->
    <div class="art-placeholder" role="img" aria-label={alt || `${placeholderTitle} — no artwork available`}>
      <span class="art-placeholder__title">{placeholderTitle}</span>
    </div>
  {:else if chosenSrc}
    <img
      src={chosenSrc}
      {alt}
      class="w-full h-full object-cover {!domImageLoaded ? 'opacity-0' : ''}"
      {width}
      {height}
      loading={actualLoading}
      fetchpriority={priority ? 'high' : 'auto'}
      data-original-src={getSafeImageUrl(src, path)}
      data-sources={sources.length > 0 ? JSON.stringify(sources) : undefined}
      onerror={handleSimpleError}
      onload={handleSimpleLoad}
    />
  {/if}
</div>

<style>
  .art-placeholder {
    width: 100%;
    height: 100%;
    display: flex;
    align-items: flex-end;
    padding: 12px;
    background: var(--weeb-surface);
  }
  .art-placeholder__title {
    font-family: var(--weeb-font);
    font-size: 13px;
    font-weight: 600;
    line-height: 1.3;
    /* fg-secondary, not fg-muted: muted measures 4.1:1 on this ground. */
    color: var(--weeb-fg-secondary);
    display: -webkit-box;
    -webkit-line-clamp: 4;
    line-clamp: 4;
    -webkit-box-orient: vertical;
    overflow: hidden;
  }
</style>
