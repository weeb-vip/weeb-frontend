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

  $: imageUrl = getSafeImageUrl(src, path);
  $: actualLoading = loading || (priority ? 'eager' : 'lazy');

  let isLoaded = false;
  let isError = false;
  let chosenSrc: string | null = null;
  let useFallback = false;
  let destroyed = false;
  let runId = 0;
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
    const id = ++runId;
    chosenSrc = null;
    isLoaded = false;
    isError = false;
    useFallback = false;

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
      orderedSources = [imageUrl];
    } else {
      // No sources or src provided - use imageUrl as last resort
      debug.warn('No image sources or src provided, using imageUrl');
      orderedSources = [imageUrl];
    }

    debug.log(`Trying ${orderedSources.length} image sources in order`);

    for (let i = 0; i < orderedSources.length; i++) {
      const url = orderedSources[i];
      const isLastSource = i === orderedSources.length - 1;
      const hasMultipleSources = orderedSources.length > 1;

      try {
        const { url: okUrl } = await withTimeout(loadOne(url), perTryTimeoutMs);
        if (destroyed || id !== runId) return;

        debug.success(`Image loaded successfully: ${okUrl}`);
        chosenSrc = okUrl;
        isLoaded = true;

        // Mark as fallback/error if we had to use the last source AND there were multiple sources
        if (isLastSource && hasMultipleSources) {
          useFallback = true;
          isError = true;
          dispatch('chosen', { src: chosenSrc, reason: 'last-source' });
        } else {
          useFallback = false;
          dispatch('chosen', { src: chosenSrc, reason: 'load' });
        }
        return; // stop at the first accepted success
      } catch (err) {
        debug.warn(`Image source failed: ${url}`);
        // move on to the next candidate
      }
    }

    // none worked → fallback
    if (!destroyed && id === runId) {
      debug.error('All image sources failed, using fallback');
      chosenSrc = fallbackSrc ?? null;
      useFallback = false; // Don't blur the fallback image
      isError = true;
      isLoaded = true;
      dispatch('chosen', { src: chosenSrc, reason: 'all-failed' });
    }
  }

  onMount(() => {
    tryInOrder();

    // Re-trigger image loading after View Transitions
    const handlePageLoad = () => {
      debug.log('View Transition complete, reloading images');
      tryInOrder();
    };

    document.addEventListener('astro:page-load', handlePageLoad);

    return () => {
      document.removeEventListener('astro:page-load', handlePageLoad);
    };
  });

  onDestroy(() => {
    destroyed = true;
    for (const img of imgs) {
      img.onload = null;
      img.onerror = null;
    }
  });

  // Re-run when inputs change
  $: (src, sources, fallbackSrc, perTryTimeoutMs, rejectPatterns, accept, path, tryInOrder());

  // Fallback error handler for simple mode
  function handleSimpleError() {
    debug.error(`Image failed to load: ${chosenSrc}`);
    chosenSrc = fallbackSrc;
    useFallback = false; // Don't blur the fallback image
    isError = true;
    isLoaded = true;
    dispatch('error', { src: chosenSrc });
  }

  function handleSimpleLoad() {
    isLoaded = true;
    dispatch('load', { src: chosenSrc });
  }
</script>

{#if chosenSrc}
  <img
    src={chosenSrc}
    {alt}
    class="{className} transition-opacity duration-300 {useFallback ? 'blur-md scale-110 -inset-4' : 'inset-0'} {!isLoaded && actualLoading === 'lazy' ? 'opacity-0' : 'opacity-100'}"
    {style}
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
{:else}
  <!-- Placeholder while racing -->
  <div
    class="bg-gray-200 dark:bg-gray-700 animate-pulse rounded"
    style={style}
  ></div>
{/if}
