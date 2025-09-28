<script lang="ts">
  import { getSafeImageUrl } from '../utils/image';
  import { createEventDispatcher } from 'svelte';

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

  function handleError(event: Event) {
    const img = event.target as HTMLImageElement;
    if (img.src !== fallbackSrc) {
      img.onerror = null; // Prevent infinite loop
      img.src = fallbackSrc;
    }
    isError = true;
    isLoaded = true;
    // Dispatch error event for parent component if needed
    dispatch('error', event);
  }

  function handleLoad(event: Event) {
    isLoaded = true;
    const img = event.target as HTMLImageElement;
    img.classList.add('loaded');
    // Dispatch load event for parent component if needed
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
