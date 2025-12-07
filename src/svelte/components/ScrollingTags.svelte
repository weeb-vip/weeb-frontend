<script lang="ts">
  import { onMount } from 'svelte';

  export let tags: string[] = [];
  export let className: string = '';
  export let scrollSpeed: number = 50;

  let containerRef: HTMLDivElement;
  let contentRef: HTMLDivElement;
  let isOverflowing = false;
  let isHovered = false;
  let animationDuration = 3;

  function checkOverflow() {
    if (!containerRef || !contentRef) return;

    const containerWidth = containerRef.offsetWidth;
    const contentWidth = contentRef.scrollWidth;

    isOverflowing = contentWidth > containerWidth;

    if (isOverflowing) {
      const scrollDistance = contentWidth + 32;
      animationDuration = scrollDistance / scrollSpeed;
    }
  }

  onMount(() => {
    setTimeout(checkOverflow, 100);

    const handleResize = () => {
      setTimeout(checkOverflow, 100);
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  });

  $: if (tags && containerRef) {
    setTimeout(checkOverflow, 100);
  }

  function handleMouseEnter() {
    isHovered = true;
  }

  function handleMouseLeave() {
    isHovered = false;
  }
</script>

<div
  bind:this={containerRef}
  class="overflow-hidden whitespace-nowrap relative {className}"
  on:mouseenter={handleMouseEnter}
  on:mouseleave={handleMouseLeave}
>
  <!-- Static content with gradient fade -->
  <div
    bind:this={contentRef}
    class="inline-block transition-opacity duration-200 {isOverflowing && isHovered ? 'opacity-0' : 'opacity-100'}"
  >
    {#if tags && tags.length > 0}
      {#each tags as tag}
        <span class="text-xs px-1.5 py-0.5 bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-300 rounded inline-block">{tag}</span>{' '}
      {/each}
    {:else}
      <span class="text-xs px-1.5 py-0.5 bg-gray-100 dark:bg-gray-800 text-gray-400 dark:text-gray-500 rounded inline-block">
        No tags
      </span>
    {/if}
  </div>

  <!-- Gradient fade (only when not hovered and overflowing) -->
  {#if isOverflowing && !isHovered}
    <span class="absolute right-0 top-0 bottom-0 w-8 bg-gradient-to-l from-white dark:from-gray-800 to-transparent"></span>
  {/if}

  <!-- Scrolling content (only shown on hover if overflowing) -->
  {#if isOverflowing}
    <div
      class="absolute top-0 left-0 inline-block whitespace-nowrap transition-opacity duration-200 {isHovered ? 'opacity-100 animate-scroll' : 'opacity-0'}"
      style="--scroll-duration: {animationDuration}s;"
    >
      {#each tags as tag}
        <span class="text-xs px-1.5 py-0.5 bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-300 rounded inline-block">{tag}</span>{' '}
      {/each}
    </div>
  {/if}
</div>

<style>
  @keyframes scroll {
    0% {
      transform: translateX(0);
    }
    100% {
      transform: translateX(calc(-100% - 2rem));
    }
  }

  .animate-scroll {
    animation: scroll var(--scroll-duration) linear infinite;
  }
</style>
