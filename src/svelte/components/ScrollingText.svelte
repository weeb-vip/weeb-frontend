<script lang="ts">
  import { onMount } from 'svelte';

  export let text: string;
  export let className: string = '';
  export let maxWidth: string = '100%';
  export let scrollSpeed: number = 3; // seconds for consistent speed

  let containerRef: HTMLDivElement;
  let measureRef: HTMLSpanElement;
  let isOverflowing = false;
  let isHovered = false;

  function checkOverflow() {
    if (!containerRef || !measureRef) return;

    const containerWidth = containerRef.offsetWidth;
    const textWidth = measureRef.scrollWidth;
    const wasOverflowing = isOverflowing;

    isOverflowing = textWidth > containerWidth;

    // Remove debug logging for overflow checks
  }

  onMount(() => {
    setTimeout(checkOverflow, 100); // Give time for layout

    // Recheck on window resize
    const handleResize = () => {
      setTimeout(checkOverflow, 100); // Small delay to ensure layout is updated
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  });

  // Recheck when text changes
  $: if (text && containerRef) {
    setTimeout(checkOverflow, 100);
  }

  function handleMouseEnter() {
    console.log('Mouse enter - text:', text, 'isOverflowing:', isOverflowing);
    isHovered = true;
  }

  function handleMouseLeave() {
    console.log('Mouse leave');
    isHovered = false;
  }
</script>

<div
  bind:this={containerRef}
  class="overflow-hidden whitespace-nowrap relative {className}"
  style="max-width: {maxWidth}"
  on:mouseenter={handleMouseEnter}
  on:mouseleave={handleMouseLeave}
>
  <!-- Hidden measurement element -->
  <span
    bind:this={measureRef}
    class="invisible absolute whitespace-nowrap"
  >
    {text}
  </span>

  <!-- Normal text with ellipsis -->
  <span
    class="inline-block truncate w-full transition-opacity duration-200 {isOverflowing && isHovered ? 'opacity-0' : 'opacity-100'}"
  >
    {text}
  </span>

  <!-- Scrolling text (only shown on hover if overflowing) -->
  {#if isOverflowing}
    <span
      class="absolute top-0 left-0 inline-block whitespace-nowrap transition-opacity duration-200 {isHovered ? 'opacity-100 animate-scroll' : 'opacity-0'}"
      style="--scroll-speed: {scrollSpeed}s;"
    >
      {text}
    </span>
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
    animation: scroll var(--scroll-speed) linear infinite;
  }
</style>