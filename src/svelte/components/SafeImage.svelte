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

  function handleError(event: Event) {
    const img = event.target as HTMLImageElement;
    if (img.src !== fallbackSrc) {
      img.onerror = null; // Prevent infinite loop
      img.src = fallbackSrc;
    }
    // Dispatch error event for parent component if needed
    dispatch('error', event);
  }

  function handleLoad(event: Event) {
    // Dispatch load event for parent component if needed
    dispatch('load', event);
  }
</script>

<img
  src={imageUrl}
  {alt}
  class={className}
  {style}
  {width}
  {height}
  loading={actualLoading}
  fetchpriority={priority ? 'high' : 'auto'}
  data-original-src={imageUrl}
  on:error={handleError}
  on:load={handleLoad}
  on:click
/>
