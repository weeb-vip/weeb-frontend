<script lang="ts">
  import { getSafeImageUrl } from '../utils/image';
  import { createEventDispatcher } from 'svelte';
  import debug from '../../utils/debug';

  export let src: string;
  export let alt: string = '';
  export let fallbackSrc: string = '/assets/not found.jpg';
  export let path: string = '';
  export let priority: boolean = false;
  export let className: string = '';
  export let style: string = '';
  export let width: string | number | undefined = undefined;
  export let height: string | number | undefined = undefined;
  export let loading: 'lazy' | 'eager' | undefined = undefined;

  const dispatch = createEventDispatcher();

  $: imageUrl = getSafeImageUrl(src, path);
  $: actualLoading = loading || (priority ? 'eager' : 'lazy');

  let isLoaded = false;
  let isError = false;
  let imgElement: HTMLImageElement;
  let retryCount = 0;
  let currentUrl = '';
  const MAX_RETRIES = 2;

  // Track URL changes and reset state
  $: if (imageUrl !== currentUrl) {
    currentUrl = imageUrl;
    retryCount = 0;
    isError = false;
    isLoaded = false;
  }

  function handleError(event: Event) {
    const img = event.target as HTMLImageElement;

    // Log the failed URL for debugging
    debug.error(`Image failed to load: ${img.src}`);

    // Try retry with cache-busting before falling back
    if (retryCount < MAX_RETRIES && img.src !== fallbackSrc) {
      retryCount++;
      debug.warn(`Retrying image load (attempt ${retryCount}/${MAX_RETRIES}): ${imageUrl}`);

      // Add cache-busting parameter and retry
      const separator = imageUrl.includes('?') ? '&' : '?';
      const retryUrl = `${imageUrl}${separator}retry=${retryCount}&t=${Date.now()}`;

      // Use setTimeout to avoid immediate re-trigger
      setTimeout(() => {
        if (imgElement) {
          imgElement.src = retryUrl;
        }
      }, 100 * retryCount); // Exponential backoff: 100ms, 200ms

      return;
    }

    // All retries exhausted or already showing fallback
    if (img.src !== fallbackSrc) {
      debug.error(`Image failed after ${retryCount} retries, using fallback: ${fallbackSrc}`);
      img.onerror = null; // Prevent infinite loop
      img.src = fallbackSrc;
    }

    isError = true;
    isLoaded = true;
    dispatch('error', event);
  }

  function handleLoad(event: Event) {
    if (retryCount > 0) {
      debug.success(`Image loaded successfully after ${retryCount} retries: ${imageUrl}`);
    }

    isLoaded = true;
    const img = event.target as HTMLImageElement;
    img.classList.add('loaded');
    dispatch('load', event);
  }

  // Check if image is already loaded when component mounts (SSR case)
  function checkIfAlreadyLoaded(img: HTMLImageElement) {
    if (img && (img.complete || img.naturalWidth > 0)) {
      isLoaded = true;
      img.classList.add('loaded');
    }
  }
</script>

<div class="relative inline-block h-full">
  <img
    bind:this={imgElement}
    src={imageUrl}
    {alt}
    class="{className} aspect-2/3 transition-opacity duration-300 {!isLoaded && actualLoading === 'lazy' ? 'opacity-0' : 'opacity-100'}"
    {style}
    {width}
    {height}
    loading={actualLoading}
    fetchpriority={priority ? 'high' : 'auto'}
    data-original-src={imageUrl}
    on:error={handleError}
    on:load={handleLoad}
    on:click
    use:checkIfAlreadyLoaded
  />

  {#if !isLoaded && actualLoading === 'lazy'}
    <!-- Skeleton loader while image loads -->
    <div
      class="absolute inset-0 bg-gray-200 dark:bg-gray-700 animate-pulse rounded"
    ></div>
  {/if}
</div>
